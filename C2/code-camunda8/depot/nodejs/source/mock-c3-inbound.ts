import { MESSAGE_NAMES, PARTY } from './config'
import { RabbitMQPublisher } from './rabbitmq/publisher'

function nowIso(): string {
  return new Date().toISOString()
}

function parseArgs(argv: string[] = process.argv): { orderId: string } {
  const orderIdArg = argv.find((item) => item.startsWith('--orderId='))
  const orderId = orderIdArg?.split('=')[1]

  if (!orderId) {
    throw new Error('Usage: npm run mock:c3 -- --orderId=ORDER-YYYYMMDD-NNN')
  }

  return { orderId }
}

async function main(): Promise<void> {
  const { orderId } = parseArgs()
  const publisher = new RabbitMQPublisher()
  await publisher.connect()

  try {
    await publisher.publishMessage(MESSAGE_NAMES.outboundCtnToDepot, orderId, {
      orderId,
      timestamp: nowIso(),
      senderId: PARTY.transport.id,
      ctnNumber: 'MSKU1234567',
      vesselId: 'VESSEL-042',
      handoverTime: nowIso(),
      receiptId: 'RECEIPT-20260525-C3',
      driverName: 'Zhang San',
      carLicense: 'HU-A-12345'
    })
    console.log(`Published C3-compatible outbound-ctn-to-depot for ${orderId}`)
  } finally {
    await publisher.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
