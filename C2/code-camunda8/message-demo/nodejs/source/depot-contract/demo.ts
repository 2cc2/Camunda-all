import { Camunda8 } from '@camunda8/sdk'
import { CAMUNDA_AUTH_STRATEGY, CAMUNDA_REST_ADDRESS, MESSAGE_NAMES, PARTY, PROCESS_IDS } from './config'
import { startDepotContractWorkers } from './workers'

declare const require: any
declare const __dirname: string

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

async function deployDepotModel(client: any): Promise<void> {
  const fs = require('fs')
  const path = require('path')

  const resources = [
    {
      name: 'depot-export-contract.bpmn',
      filePath: path.resolve(__dirname, '..', '..', '..', 'bpmn', 'depot-export-contract.bpmn')
    }
  ].map((r) => ({ name: r.name, content: fs.readFileSync(r.filePath) }))

  const res = await client.deployResources(resources)
  const processCount = Array.isArray(res?.processes) ? res.processes.length : 0
  console.log(
    `Deployed ${resources.length} BPMN resources. deploymentKey=${res?.deploymentKey ?? 'unknown'} processes=${processCount}`
  )
}

async function mockInboundMessages(client: any, orderId: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 1200))
  await client.publishMessage({
    name: MESSAGE_NAMES.askForCtn,
    correlationKey: orderId,
    timeToLive: 600,
    variables: {
      orderId,
      timestamp: nowIso(),
      senderId: PARTY.freightForwarder.id,
      containerId: 'MSKU1234567',
      vesselId: 'VESSEL-042'
    }
  })
  console.log(`[mock] sent ${MESSAGE_NAMES.askForCtn} orderId=${orderId}`)

  await new Promise((r) => setTimeout(r, 1500))
  await client.publishMessage({
    name: MESSAGE_NAMES.outboundCtnAndReceiptReceived,
    correlationKey: orderId,
    timeToLive: 600,
    variables: {
      orderId,
      timestamp: nowIso(),
      senderId: PARTY.freightForwarder.id,
      containerId: 'MSKU1234567',
      vesselId: 'VESSEL-042',
      receiptId: 'RECEIPT-2026-001'
    }
  })
  console.log(`[mock] sent ${MESSAGE_NAMES.outboundCtnAndReceiptReceived} orderId=${orderId}`)
}

async function main(): Promise<void> {
  const { orderId, mockInbound } = parseArgs()

  await assertReachable(CAMUNDA_REST_ADDRESS)

  const client = new Camunda8({
    CAMUNDA_AUTH_STRATEGY,
    ZEEBE_REST_ADDRESS: CAMUNDA_REST_ADDRESS
  }).getCamundaRestClient()

  const workers = startDepotContractWorkers(client)

  console.log(`Starting Depot contract demo with orderId=${orderId}`)
  console.log(`REST endpoint: ${CAMUNDA_REST_ADDRESS}`)

  await deployDepotModel(client)

  const depotInstance = await client.createProcessInstance({
    processDefinitionId: PROCESS_IDS.depot,
    variables: { orderId }
  })

  console.log(
    `Depot process instance started. key=${(depotInstance as any)?.processInstanceKey ?? 'unknown'}`
  )

  if (mockInbound) {
    await mockInboundMessages(client, orderId)

    await new Promise((r) => setTimeout(r, 1200))

    workers.sendEmptyCtnToTransportWorker.stop()
    workers.sendCtnArrivalInfoToSaWorker.stop()
    workers.sendOutboundCtnToCtWorker.stop()
    const p: any = (globalThis as any).process
    if (p) p.exitCode = 0
    return
  }

  console.log(
    `mockInbound=false: please externally correlate ${MESSAGE_NAMES.askForCtn} and ${MESSAGE_NAMES.outboundCtnAndReceiptReceived} using correlationKey=orderId.`
  )
  console.log('Workers will drive the process. Watch logs or Operate.')
}

main().catch((err) => {
  console.error(err)
  const p: any = (globalThis as any).process
  if (p) p.exitCode = 1
})
