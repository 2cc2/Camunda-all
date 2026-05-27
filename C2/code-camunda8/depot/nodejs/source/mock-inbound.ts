/**
 * Standalone mock inbound message publisher for Depot.
 *
 * Usage (while workers are running in another terminal):
 *   npx ts-node source/mock-inbound.ts --orderId=ORDER-20260507-001
 */

import { MESSAGE_NAMES, PARTY } from './config'
import { DepotMessagePublisher, RabbitMQPublisher } from './rabbitmq/publisher'

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
    handoverTime: nowIso(),
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

export async function publishStartMessage(
  publisher: DepotMessagePublisher,
  orderId: string
): Promise<void> {
  await publisher.publishMessage(MESSAGE_NAMES.askForCtn, orderId, buildAskForCtnMockVariables(orderId))
  console.log(`[mock] published ${MESSAGE_NAMES.askForCtn}`)
}

export async function publishFollowupInboundMessages(
  publisher: DepotMessagePublisher,
  orderId: string,
  sleep: (ms: number) => Promise<unknown> = (ms) => new Promise((r) => setTimeout(r, ms))
): Promise<void> {
  await sleep(1500)

  await publisher.publishMessage(
    MESSAGE_NAMES.outboundCtnToDepot,
    orderId,
    buildOutboundCtnToDepotMockVariables(orderId)
  )
  console.log(`[mock] published ${MESSAGE_NAMES.outboundCtnToDepot}`)
}

export async function publishMockInboundMessages(
  publisher: DepotMessagePublisher,
  orderId: string,
  sleep: (ms: number) => Promise<unknown> = (ms) => new Promise((r) => setTimeout(r, ms))
): Promise<void> {
  await publishStartMessage(publisher, orderId)
  await publishFollowupInboundMessages(publisher, orderId, sleep)
}

export async function main(): Promise<void> {
  const { orderId } = parseArgs()
  const publisher = new RabbitMQPublisher()
  await publisher.connect()

  console.log(`Publishing inbound Depot messages for orderId=${orderId}`)

  await publishMockInboundMessages(publisher, orderId)
  await publisher.close()
  console.log('Done. Check Operate or worker logs for progress.')
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err)
    const p: any = (globalThis as any).process
    if (p) p.exitCode = 1
  })
}
