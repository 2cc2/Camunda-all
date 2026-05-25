import * as amqp from 'amqplib'
import { EXCHANGE, RABBITMQ_CONNECTION, RETRY, ROUTING_KEYS } from './config'

export type ObservedOutboundMessage = {
  queue: string
  raw: string
  payload: Record<string, any>
}

export class RabbitMQOutboundObserver {
  private connection: amqp.ChannelModel | null = null
  private channel: amqp.Channel | null = null
  private queueName: string | null = null
  private readonly observed: ObservedOutboundMessage[] = []
  private started = false

  async connect(): Promise<void> {
    if (this.connection) return

    this.connection = await amqp.connect(RABBITMQ_CONNECTION.url)
    this.channel = await this.connection.createChannel()
    await this.channel.assertExchange(EXCHANGE.name, EXCHANGE.type, { durable: true })
    const asserted = await this.channel.assertQueue('', {
      exclusive: true,
      autoDelete: true,
      arguments: {
        'x-expires': RETRY.observerQueueExpiresMs
      }
    })
    this.queueName = asserted.queue

    await this.channel.bindQueue(asserted.queue, EXCHANGE.name, ROUTING_KEYS.transportEmptyCtnToTransport)
    await this.channel.bindQueue(asserted.queue, EXCHANGE.name, ROUTING_KEYS.shippingAgencyCtnArrivalInfoToSa)
    await this.channel.bindQueue(asserted.queue, EXCHANGE.name, ROUTING_KEYS.containerTerminalOutboundCtnToCt)
  }

  async start(): Promise<void> {
    if (!this.channel) {
      throw new Error('Outbound observer not connected')
    }
    if (this.started) return

    if (!this.queueName) {
      throw new Error('Outbound observer queue not ready')
    }

    await this.consumeQueue(this.queueName)
    this.started = true
  }

  private async consumeQueue(queue: string): Promise<void> {
    if (!this.channel) {
      throw new Error('Outbound observer channel not ready')
    }

    await this.channel.consume(
      queue,
      (msg) => {
        if (!msg) return
        const raw = msg.content.toString()
        let payload: Record<string, any> = {}
        try {
          payload = JSON.parse(raw)
        } catch {
          payload = { parseError: true, raw }
        }
        this.observed.push({
          queue: this.describeRoutingKey(msg.fields.routingKey),
          raw,
          payload
        })
        this.channel?.ack(msg)
      },
      { noAck: false }
    )
  }

  private describeRoutingKey(routingKey: string): string {
    switch (routingKey) {
      case ROUTING_KEYS.transportEmptyCtnToTransport:
        return 'Transport'
      case ROUTING_KEYS.shippingAgencyCtnArrivalInfoToSa:
        return 'Shipping Agency'
      case ROUTING_KEYS.containerTerminalOutboundCtnToCt:
        return 'Container Terminal'
      default:
        return routingKey
    }
  }

  async waitForMessages(expectedCount: number, timeoutMs = 10000): Promise<ObservedOutboundMessage[]> {
    const startedAt = Date.now()
    while (Date.now() - startedAt < timeoutMs) {
      if (this.observed.length >= expectedCount) {
        return [...this.observed]
      }
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
    throw new Error(`Timed out waiting for ${expectedCount} outbound messages. Got ${this.observed.length}.`)
  }

  getObservedMessages(): ObservedOutboundMessage[] {
    return [...this.observed]
  }

  async close(): Promise<void> {
    if (this.channel) {
      await this.channel.close()
    }
    if (this.connection) {
      await this.connection.close()
    }
    this.channel = null
    this.connection = null
    this.queueName = null
    this.started = false
  }
}
