/**
 * Owner contract E2E automated test.
 *
 * Usage:
 *   npx ts-node source/e2e-test.ts [--orderId=ORDER-20260525-001] [--useRabbitmq=true]
 *
 * What it does:
 * 1. Deploys owner.bpmn to Camunda 8
 * 2. Starts a process instance
 * 3. Starts C2 workers
 * 4. Automatically sends inbound messages (ctn-to-owner, expense-note-to-owner) with correct timing
 * 5. Polls process instance state until COMPLETED or timeout
 * 6. Prints pass/fail result
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
import { RabbitMQPublisher } from './rabbitmq/publisher'
import { RabbitMQConsumer } from './rabbitmq/consumer'

declare const require: any

const fs = require('fs')
const path = require('path')

/* -------------------------------------------------------------------------- */
/*  CLI args                                                                  */
/* -------------------------------------------------------------------------- */

function parseArgs() {
  const argv: string[] = (globalThis as any).process?.argv ?? []
  const orderIdArg = argv.find((a: string) => a.startsWith('--orderId='))
  const useRabbitmqArg = argv.find((a: string) => a.startsWith('--useRabbitmq='))

  const orderId = orderIdArg?.split('=')[1] ?? generateOrderId()
  const useRabbitmq = (useRabbitmqArg?.split('=')[1] ?? 'false').toLowerCase() === 'true'

  return { orderId, useRabbitmq }
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

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function nowIso(): string {
  return new Date().toISOString()
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
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
      `Camunda 8 REST unreachable at ${baseUrl}. Start Camunda first. Root error: ${message}`
    )
  } finally {
    clearTimeout(timeout)
  }
}

async function deployOwnerModel(client: any): Promise<void> {
  const bpmnPath = path.join(__dirname, '..', '..', 'bpmn', 'owner.bpmn')
  const resources = [{ name: 'owner.bpmn', content: fs.readFileSync(bpmnPath) }]
  const res = await client.deployResources(resources)
  const processCount = Array.isArray(res?.processes) ? res.processes.length : 0
  console.log(`[e2e] Deployed ${resources.length} BPMN. deploymentKey=${res?.deploymentKey ?? 'unknown'} processes=${processCount}`)
}

/* -------------------------------------------------------------------------- */
/*  State polling                                                             */
/* -------------------------------------------------------------------------- */

type InstanceState = 'ACTIVE' | 'COMPLETED' | 'CANCELED' | 'UNKNOWN'

async function getInstanceState(baseUrl: string, instanceKey: string): Promise<InstanceState> {
  try {
    const res = await fetch(`${baseUrl}/v2/process-instances/${instanceKey}`)
    if (!res.ok) return 'UNKNOWN'
    const data: any = await res.json()
    return data?.state ?? 'UNKNOWN'
  } catch {
    return 'UNKNOWN'
  }
}

async function waitForCompletion(
  baseUrl: string,
  instanceKey: string,
  options: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<{ state: InstanceState; elapsedMs: number }> {
  const { timeoutMs = 30000, intervalMs = 1000 } = options
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    const state = await getInstanceState(baseUrl, instanceKey)
    const elapsed = Date.now() - start

    if (state === 'COMPLETED') {
      return { state, elapsedMs: elapsed }
    }
    if (state === 'CANCELED') {
      return { state, elapsedMs: elapsed }
    }

    process.stdout.write(`\r[e2e] Polling... state=${state} elapsed=${(elapsed / 1000).toFixed(1)}s`)
    await sleep(intervalMs)
  }

  const finalState = await getInstanceState(baseUrl, instanceKey)
  return { state: finalState, elapsedMs: Date.now() - start }
}

/* -------------------------------------------------------------------------- */
/*  Inbound message helpers                                                   */
/* -------------------------------------------------------------------------- */

async function publishInboundMessage(client: any, name: string, orderId: string, variables: Record<string, any>) {
  await client.publishMessage({
    name,
    correlationKey: orderId,
    timeToLive: 600,
    variables
  })
}

/* -------------------------------------------------------------------------- */
/*  Main test                                                                 */
/* -------------------------------------------------------------------------- */

async function main(): Promise<void> {
  const { orderId, useRabbitmq } = parseArgs()

  console.log(`\n========================================`)
  console.log(`  C2 Owner E2E Automated Test`)
  console.log(`========================================`)
  console.log(`  orderId:     ${orderId}`)
  console.log(`  useRabbitmq: ${useRabbitmq}`)
  console.log(`========================================\n`)

  await assertReachable(CAMUNDA_REST_ADDRESS)

  const client = new Camunda8({
    CAMUNDA_AUTH_STRATEGY,
    ZEEBE_REST_ADDRESS: CAMUNDA_REST_ADDRESS
  }).getCamundaRestClient()

  /* RabbitMQ init */
  let rabbitPublisher: RabbitMQPublisher | undefined
  let rabbitConsumer: RabbitMQConsumer | undefined

  if (useRabbitmq) {
    rabbitPublisher = new RabbitMQPublisher()
    await rabbitPublisher.connect()
    console.log('[e2e] RabbitMQ publisher connected')

    rabbitConsumer = new RabbitMQConsumer(client)
    await rabbitConsumer.connect()
    await rabbitConsumer.startConsuming()
    console.log('[e2e] RabbitMQ consumer started')
  }

  /* Start workers */
  const workers = startOwnerContractWorkers(client, rabbitPublisher)
  console.log('[e2e] Workers started')

  /* Deploy & create instance */
  await deployOwnerModel(client)

  const ownerInstance = await client.createProcessInstance({
    processDefinitionId: PROCESS_IDS.owner,
    variables: { orderId }
  })

  const instanceKey = (ownerInstance as any)?.processInstanceKey ?? 'unknown'
  console.log(`[e2e] Instance started. key=${instanceKey}`)

  /* ---- Auto-drive with timed inbound messages ---- */

  // Wait for engine to reach CTN received catch event
  console.log('[e2e] Waiting 3s for engine to reach CTN received...')
  await sleep(3000)

  // 1) Send ctn-to-owner
  await publishInboundMessage(client, MESSAGE_NAMES.ctnToOwner, orderId, {
    orderId,
    timestamp: nowIso(),
    senderId: PARTY.transport.id,
    ctnNumber: 'CTN-884821',
    handOverTime: nowIso(),
    driverName: '张三',
    carLicense: '沪A-12345'
  })
  console.log(`[e2e] Sent ${MESSAGE_NAMES.ctnToOwner}`)

  // Wait for send-outbound-ctn-to-transport worker to finish
  console.log('[e2e] Waiting 5s for outbound-ctn-to-transport...')
  await sleep(5000)

  // 2) Send expense-note-to-owner
  await publishInboundMessage(client, MESSAGE_NAMES.expenseNoteToOwner, orderId, {
    orderId,
    timestamp: nowIso(),
    senderId: PARTY.freightForwarder.id,
    expenseId: 'EXP-20260427-001',
    expenseAmount: 1234.56,
    currency: 'CNY'
  })
  console.log(`[e2e] Sent ${MESSAGE_NAMES.expenseNoteToOwner}`)

  /* ---- Poll for completion ---- */
  console.log('[e2e] Polling instance state until COMPLETED (timeout 30s)...')
  const result = await waitForCompletion(CAMUNDA_REST_ADDRESS, instanceKey, {
    timeoutMs: 30000,
    intervalMs: 1000
  })

  process.stdout.write('\n') // newline after polling dots

  /* ---- Assert & report ---- */
  console.log(`\n========================================`)
  if (result.state === 'COMPLETED') {
    console.log(`  RESULT: PASS`)
    console.log(`  Instance ${instanceKey} completed in ${(result.elapsedMs / 1000).toFixed(1)}s`)
  } else {
    console.log(`  RESULT: FAIL`)
    console.log(`  Instance ${instanceKey} state=${result.state} after ${(result.elapsedMs / 1000).toFixed(1)}s`)
    console.log(`  Check Operate: http://localhost:8080/operate`)
  }
  console.log(`========================================\n`)

  /* Cleanup */
  workers.fillCertificateWorker.stop()
  workers.handleOrderWorker.stop()
  workers.sendOrderToFfwWorker.stop()
  workers.sendOutboundCtnToTransportWorker.stop()
  workers.paymentWorker.stop()

  if (rabbitConsumer) await rabbitConsumer.close()
  if (rabbitPublisher) await rabbitPublisher.close()

  const p: any = (globalThis as any).process
  if (p) p.exitCode = result.state === 'COMPLETED' ? 0 : 1
}

main().catch((err) => {
  console.error('[e2e] Fatal error:', err)
  const p: any = (globalThis as any).process
  if (p) p.exitCode = 1
})
