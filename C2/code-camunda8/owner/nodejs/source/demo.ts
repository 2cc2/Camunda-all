/**
 * Owner contract demo / mock test runner.
 *
 * Usage:
 *   CAMUNDA_REST_ADDRESS=http://localhost:8080 npx ts-node source/demo.ts --orderId=ORDER-20260427-001 --mockInbound=true
 *
 * What it does:
 * 1. Deploys owner.bpmn to Camunda 8
 * 2. Starts a process instance with the given orderId
 * 3. Optionally mocks inbound messages (ctn-to-owner, expense-note-to-owner)
 * 4. Workers drive the process to completion
 */

import { Camunda8 } from '@camunda8/sdk'
import {
  CAMUNDA_AUTH_STRATEGY,
  CAMUNDA_REST_ADDRESS,
  MESSAGE_NAMES,
  PARTY,
  PROCESS_IDS
} from './config'
import { startOwnerContractWorkers } from './workers'

declare const require: any

type Args = {
  orderId: string
  mockInbound: boolean
}

function nowIso(): string {
  return new Date().toISOString()
}

function pad3(n: number): string {
  return String(n).padStart(3, '0')
}

function generateOrderId(now = new Date(), seq = Math.floor(Math.random() * 1000)): string {
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `ORDER-${yyyy}${mm}${dd}-${pad3(seq)}`
}

async function assertReachable(baseUrl: string): Promise<void> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 1500)

  try {
    const res = await fetch(baseUrl, { method: 'GET', signal: controller.signal })
    void res
  } catch (err) {
    const message =
      err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err)
    throw new Error(
      `Camunda 8 REST unreachable at ${baseUrl}. Start Camunda (or set CAMUNDA_REST_ADDRESS). Root error: ${message}`
    )
  } finally {
    clearTimeout(timeout)
  }
}

function parseArgs(): Args {
  const argv: string[] = (globalThis as any).process?.argv ?? []
  const orderIdArg = argv.find((a: string) => a.startsWith('--orderId='))
  const mockInboundArg = argv.find((a: string) => a.startsWith('--mockInbound='))

  const orderId = orderIdArg?.split('=')[1] ?? generateOrderId()
  const mockInbound = (mockInboundArg?.split('=')[1] ?? 'true').toLowerCase() === 'true'

  return { orderId, mockInbound }
}

async function deployOwnerModel(client: any): Promise<void> {
  const fs = require('fs')
  const path = require('path')

  const bpmnPath = path.join(__dirname, '..', '..', 'bpmn', 'owner.bpmn')
  const resources = [
    {
      name: 'owner.bpmn',
      filePath: bpmnPath
    }
  ].map((r) => ({ name: r.name, content: fs.readFileSync(r.filePath) }))

  const res = await client.deployResources(resources)
  const processCount = Array.isArray(res?.processes) ? res.processes.length : 0
  console.log(
    `Deployed ${resources.length} BPMN resources. deploymentKey=${res?.deploymentKey ?? 'unknown'} processes=${processCount}`
  )
}

/**
 * Mock inbound messages that Owner expects to receive.
 *
 * Per owner.bpmn:
 *   - Event_1ekkpx7: CTN received   (from Transport)
 *   - Event_00o2m98: expense note received
 */
async function mockInboundMessages(client: any, orderId: string): Promise<void> {
  // Wait for the engine to advance to the first message catch event.
  await new Promise((r) => setTimeout(r, 3000))

  // 1) Transport -> Owner: ctn-to-owner (M22)
  await client.publishMessage({
    name: MESSAGE_NAMES.ctnToOwner,
    correlationKey: orderId,
    timeToLive: 600,
    variables: {
      orderId,
      timestamp: nowIso(),
      senderId: PARTY.transport.id,
      ctnNumber: 'CTN-884821',
      handOverTime: nowIso(),
      driverName: '张三',
      carLicense: '沪A-12345'
    }
  })
  console.log(`[mock] sent ${MESSAGE_NAMES.ctnToOwner} orderId=${orderId}`)

  // Wait for send-outbound-ctn-to-transport worker to finish and engine to reach second catch event.
  await new Promise((r) => setTimeout(r, 5000))

  // 2) Freight Forwarder -> Owner: expense-note-to-owner
  await client.publishMessage({
    name: MESSAGE_NAMES.expenseNoteToOwner,
    correlationKey: orderId,
    timeToLive: 600,
    variables: {
      orderId,
      timestamp: nowIso(),
      senderId: PARTY.freightForwarder.id,
      expenseId: 'EXP-20260427-001',
      expenseAmount: 1234.56,
      currency: 'CNY'
    }
  })
  console.log(`[mock] sent ${MESSAGE_NAMES.expenseNoteToOwner} orderId=${orderId}`)
}

async function main(): Promise<void> {
  const { orderId, mockInbound } = parseArgs()

  await assertReachable(CAMUNDA_REST_ADDRESS)

  const client = new Camunda8({
    CAMUNDA_AUTH_STRATEGY,
    ZEEBE_REST_ADDRESS: CAMUNDA_REST_ADDRESS
  }).getCamundaRestClient()

  const workers = startOwnerContractWorkers(client)

  console.log(`Starting Owner contract demo with orderId=${orderId}`)
  console.log(`REST endpoint: ${CAMUNDA_REST_ADDRESS}`)

  await deployOwnerModel(client)

  const ownerInstance = await client.createProcessInstance({
    processDefinitionId: PROCESS_IDS.owner,
    variables: { orderId }
  })

  console.log(
    `Owner process instance started. key=${(ownerInstance as any)?.processInstanceKey ?? 'unknown'}`
  )

  if (mockInbound) {
    await mockInboundMessages(client, orderId)

    // Give the engine time to advance and complete the payment task.
    await new Promise((r) => setTimeout(r, 5000))

    workers.fillCertificateWorker.stop()
    workers.handleOrderWorker.stop()
    workers.sendOrderToFfwWorker.stop()
    workers.sendOutboundCtnToTransportWorker.stop()
    workers.paymentWorker.stop()
    const p: any = (globalThis as any).process
    if (p) p.exitCode = 0
    return
  } else {
    console.log(
      `mockInbound=false: please externally correlate ${MESSAGE_NAMES.ctnToOwner} and ${MESSAGE_NAMES.expenseNoteToOwner} using correlationKey=orderId.`
    )
  }

  console.log('Workers will drive the process. Watch logs or Operate.')
}

main().catch((err) => {
  console.error(err)
  const p: any = (globalThis as any).process
  if (p) p.exitCode = 1
})
