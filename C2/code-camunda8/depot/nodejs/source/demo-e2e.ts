import { runDemo } from './demo'
import { RabbitMQOutboundObserver } from './rabbitmq/observer'

async function main(): Promise<void> {
  const observer = new RabbitMQOutboundObserver()
  await observer.connect()
  await observer.start()

  try {
    await runDemo()

    const messages = await observer.waitForMessages(3, 12000)
    console.log('\nObserved outbound messages:')
    for (const message of messages) {
      console.log(`- ${message.queue}: ${message.payload.camundaMessageName ?? 'unknown-message'}`)
    }
  } finally {
    await observer.close()
  }
}

main().catch((error) => {
  console.error(error)
  const p: any = (globalThis as any).process
  if (p) p.exitCode = 1
})
