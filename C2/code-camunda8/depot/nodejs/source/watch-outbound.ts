import { RabbitMQOutboundObserver } from './rabbitmq/observer'

async function main(): Promise<void> {
  const observer = new RabbitMQOutboundObserver()
  await observer.connect()
  await observer.start()

  const shutdown = async () => {
    await observer.close()
    const p: any = (globalThis as any).process
    if (p) p.exit(0)
  }

  process.once('SIGINT', () => {
    void shutdown()
  })
  process.once('SIGTERM', () => {
    void shutdown()
  })

  console.log('Watching Depot outbound queues:')
  console.log('  - Transport')
  console.log('  - Shipping Agency')
  console.log('  - Container Terminal')
  console.log('Press Ctrl+C to stop.\n')

  const seen = new Set<string>()
  while (true) {
    const messages = observer.getObservedMessages()
    for (const message of messages) {
      if (seen.has(message.raw)) continue
      seen.add(message.raw)
      console.log(`[${message.queue}] ${JSON.stringify(message.payload)}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
}

main().catch((error) => {
  console.error(error)
  const p: any = (globalThis as any).process
  if (p) p.exitCode = 1
})
