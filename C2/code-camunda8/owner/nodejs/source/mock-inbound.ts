/**
 * Standalone mock inbound message publisher.
 *
 * Usage (while workers are running in another terminal):
 *   CAMUNDA_REST_ADDRESS=http://localhost:8080 npx ts-node source/mock-inbound.ts --orderId=ORDER-20260427-001
 *
 * Publishes the two inbound messages that Owner expects:
 *   1. ctn-to-owner       (Transport -> Owner)
 *   2. expense-note-to-owner (FFW -> Owner)
 */

import { Camunda8 } from '@camunda8/sdk'
import { CAMUNDA_AUTH_STRATEGY, CAMUNDA_REST_ADDRESS, MESSAGE_NAMES, PARTY } from './config'

function nowIso(): string {
  return new Date().toISOString()
}

function parseArgs(): { orderId: string } {
  const argv: string[] = (globalThis as any).process?.argv ?? []
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

async function main(): Promise<void> {
  const { orderId } = parseArgs()

  const client = new Camunda8({
    CAMUNDA_AUTH_STRATEGY,
    ZEEBE_REST_ADDRESS: CAMUNDA_REST_ADDRESS
  }).getCamundaRestClient()

  console.log(`Publishing inbound messages for orderId=${orderId}`)

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
  console.log(`[mock] published ${MESSAGE_NAMES.ctnToOwner}`)

  await new Promise((r) => setTimeout(r, 1500))

  // 2) FFW -> Owner: expense-note-to-owner
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
  console.log(`[mock] published ${MESSAGE_NAMES.expenseNoteToOwner}`)

  console.log('Done. Check Operate or worker logs for progress.')
}

main().catch((err) => {
  console.error(err)
  const p: any = (globalThis as any).process
  if (p) p.exitCode = 1
})
