/**
 * Depot contract demo / mock test runner.
 *
 * Usage:
 *   CAMUNDA_REST_ADDRESS=http://localhost:8080 npx ts-node source/demo.ts --orderId=ORDER-20260507-001 --mockInbound=true
 *
 * What it does:
 * 1. Deploys depot.bpmn to Camunda 8
 * 2. Publishes the start message to RabbitMQ with the given orderId
 * 3. Optionally mocks inbound messages (ask-for-ctn, outbound-ctn-to-depot)
 * 4. Workers drive the process to completion
 */

import { Camunda8 } from '@camunda8/sdk'
import {
  CAMUNDA_AUTH_STRATEGY,
  CAMUNDA_GRPC_ADDRESS,
  CAMUNDA_REST_ADDRESS,
  PROCESS_IDS
} from './config'
import { publishFollowupInboundMessages, publishStartMessage } from './mock-inbound'
import { startDepotContractWorkers } from './workers'
import { CamundaRabbitMQBridge } from './rabbitmq/bridge'

declare const require: any

type Args = {
  orderId: string
  mockInbound: boolean
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
  const path = require('path')
  const bpmnPath = path.join(__dirname, '..', '..', 'bpmn', 'depot.bpmn')
  const res = await client.deployResource({ processFilename: bpmnPath })
  const processCount = Array.isArray(res?.processes) ? res.processes.length : 1
  console.log(
    `Deployed 1 BPMN resources. deploymentKey=${res?.deploymentKey ?? 'unknown'} processes=${processCount}`
  )
}

export async function runDemo(): Promise<void> {
  const { orderId, mockInbound } = parseArgs()

  await assertReachable(CAMUNDA_REST_ADDRESS)

  const client = new Camunda8({
    CAMUNDA_AUTH_STRATEGY,
    ZEEBE_REST_ADDRESS: CAMUNDA_REST_ADDRESS,
    ZEEBE_GRPC_ADDRESS: CAMUNDA_GRPC_ADDRESS
  })
  const restClient = client.getCamundaRestClient()
  const grpcClient = client.getZeebeGrpcApiClient()
  const bridge = new CamundaRabbitMQBridge()

  await bridge.connect()
  await bridge.start()

  const workers = startDepotContractWorkers(restClient, bridge.publisher)

  console.log(`Starting Depot contract demo with orderId=${orderId}`)
  console.log(`REST endpoint: ${CAMUNDA_REST_ADDRESS}`)
  console.log(`gRPC endpoint: ${CAMUNDA_GRPC_ADDRESS}`)

  await deployDepotModel(grpcClient)

  if (mockInbound) {
    console.log(`Depot process will be started through RabbitMQ and forwarded into ${PROCESS_IDS.depot}.`)
    await publishStartMessage(bridge.publisher, orderId)
    await publishFollowupInboundMessages(
      bridge.publisher,
      orderId,
      (ms) => new Promise((r) => setTimeout(r, ms + 2500))
    )

    await new Promise((r) => setTimeout(r, 5000))

    workers.sendEmptyCtnToTransportWorker.stop()
    workers.sendCtnArrivalInfoToSaWorker.stop()
    workers.sendOutboundCtnToCtWorker.stop()
    await bridge.close()
    await grpcClient.close()
    const p: any = (globalThis as any).process
    if (p) p.exitCode = 0
    return
  }

  console.log(
    'mockInbound=false: please publish ask-for-ctn and outbound-ctn-to-depot to RabbitMQ using correlationKey=orderId.'
  )
  console.log('Workers will drive the process. Watch logs or Operate.')
}

if (require.main === module) {
  runDemo().catch((err) => {
    console.error(err)
    const p: any = (globalThis as any).process
    if (p) p.exitCode = 1
  })
}
