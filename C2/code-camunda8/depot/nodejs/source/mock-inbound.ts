/**
 * Standalone mock inbound message publisher for Depot.
 *
 * Usage (while workers are running in another terminal):
 *   CAMUNDA_REST_ADDRESS=http://localhost:8080 npx ts-node source/mock-inbound.ts --orderId=ORDER-20260507-001
 */

import { Camunda8 } from '@camunda8/sdk'
import {
  CAMUNDA_AUTH_STRATEGY,
  CAMUNDA_GRPC_ADDRESS,
  CAMUNDA_REST_ADDRESS,
  MESSAGE_NAMES,
  PARTY
} from './config'

export function nowIso(): string {
  return new Date().toISOString()
}

export function buildAskForCtnMockVariables(orderId: string) {
  return {
    orderId,
    timestamp: nowIso(),
    senderId: PARTY.shippingAgency.id,
    containerId: 'MSKU1234567',
    vesselId: 'VESSEL-042'
  }
}

export function buildOutboundCtnToDepotMockVariables(orderId: string) {
  return {
    orderId,
    timestamp: nowIso(),
    senderId: PARTY.transport.id,
    ctnNumber: 'MSKU1234567',
    vesselId: 'VESSEL-042',
    handOverTime: nowIso(),
    receiptId: 'RECEIPT-20260507-001',
    driverName: 'Zhang San',
    carLicense: 'HU-A-12345'
  }
}

export function parseArgs(argv: string[] = (globalThis as any).process?.argv ?? []): { orderId: string } {
  const orderIdArg = argv.find((a: string) => a.startsWith('--orderId='))
  const orderId = orderIdArg?.split('=')[1]

  if (!orderId) {
    console.error('Usage: npx ts-node source/mock-inbound.ts --orderId=ORDER-YYYYMMDD-NNN')
    const p: any = (globalThis as any).process
    if (p) p.exitCode = 1
    throw new Error('Missing --orderId argument')
  }

  return { orderId }
}

type PublishMessageClient = {
  publishMessage: (payload: any) => Promise<unknown>
}

export async function publishStartMessage(
  client: PublishMessageClient,
  orderId: string
): Promise<void> {
  await client.publishMessage({
    name: MESSAGE_NAMES.askForCtn,
    correlationKey: orderId,
    timeToLive: 600,
    variables: buildAskForCtnMockVariables(orderId)
  })
  console.log(`[mock] published ${MESSAGE_NAMES.askForCtn}`)
}

export async function publishFollowupInboundMessages(
  client: PublishMessageClient,
  orderId: string,
  sleep: (ms: number) => Promise<unknown> = (ms) => new Promise((r) => setTimeout(r, ms))
): Promise<void> {
  await sleep(1500)

  await client.publishMessage({
    name: MESSAGE_NAMES.outboundCtnToDepot,
    correlationKey: orderId,
    timeToLive: 600,
    variables: buildOutboundCtnToDepotMockVariables(orderId)
  })
  console.log(`[mock] published ${MESSAGE_NAMES.outboundCtnToDepot}`)
}

export async function publishMockInboundMessages(
  client: PublishMessageClient,
  orderId: string,
  sleep: (ms: number) => Promise<unknown> = (ms) => new Promise((r) => setTimeout(r, ms))
): Promise<void> {
  await publishStartMessage(client, orderId)
  await publishFollowupInboundMessages(client, orderId, sleep)
}

export async function main(): Promise<void> {
  const { orderId } = parseArgs()

  const client = new Camunda8({
    CAMUNDA_AUTH_STRATEGY,
    ZEEBE_REST_ADDRESS: CAMUNDA_REST_ADDRESS,
    ZEEBE_GRPC_ADDRESS: CAMUNDA_GRPC_ADDRESS
  }).getZeebeGrpcApiClient()

  console.log(`Publishing inbound Depot messages for orderId=${orderId}`)

  await publishMockInboundMessages(client, orderId)
  await client.close()
  console.log('Done. Check Operate or worker logs for progress.')
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err)
    const p: any = (globalThis as any).process
    if (p) p.exitCode = 1
  })
}
