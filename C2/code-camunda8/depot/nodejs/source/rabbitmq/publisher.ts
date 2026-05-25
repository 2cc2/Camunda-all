import * as amqp from 'amqplib'
import {
  MESSAGE_NAME_TO_ROUTING_KEY,
  EXCHANGE,
  DLX_EXCHANGE,
  BINDINGS,
  QUEUES,
  RABBITMQ_CONNECTION,
  RETRY,
  createRabbitMessage
} from './config'

export interface DepotMessagePublisher {
  publishMessage(name: string, correlationKey: string, variables: Record<string, any>): Promise<void>
}

export class RabbitMQPublisher implements DepotMessagePublisher {
  private connection: amqp.ChannelModel | null = null
  private channel: amqp.Channel | null = null
  private ready = false

  async connect(): Promise<void> {
    if (this.ready) return

    this.connection = await amqp.connect(RABBITMQ_CONNECTION.url)
    this.channel = await this.connection.createChannel()

    await this.channel.assertExchange(EXCHANGE.name, EXCHANGE.type, { durable: true })
    await this.channel.assertExchange(DLX_EXCHANGE.name, DLX_EXCHANGE.type, { durable: true })

    const queueArgs = {
      'x-dead-letter-exchange': DLX_EXCHANGE.name,
      'x-dead-letter-routing-key': DLX_EXCHANGE.routingKey,
      'x-message-ttl': RETRY.messageTtlMs
    }

    await this.channel.assertQueue(QUEUES.depotInbound, { durable: true, arguments: queueArgs })
    await this.channel.assertQueue(QUEUES.transportInbound, { durable: true, arguments: queueArgs })
    await this.channel.assertQueue(QUEUES.shippingAgencyInbound, { durable: true, arguments: queueArgs })
    await this.channel.assertQueue(QUEUES.containerTerminalInbound, { durable: true, arguments: queueArgs })
    await this.channel.assertQueue(QUEUES.audit, { durable: true })
    await this.channel.assertQueue(QUEUES.deadLetter, { durable: true })

    for (const binding of BINDINGS) {
      await this.channel.bindQueue(binding.queue, EXCHANGE.name, binding.routingKey)
    }
    await this.channel.bindQueue(QUEUES.deadLetter, DLX_EXCHANGE.name, DLX_EXCHANGE.routingKey)

    this.ready = true
  }

  async publishMessage(
    camundaMessageName: string,
    correlationKey: string,
    variables: Record<string, any>
  ): Promise<void> {
    if (!this.channel || !this.ready) {
      throw new Error('RabbitMQ publisher not connected')
    }

    const routingKey = MESSAGE_NAME_TO_ROUTING_KEY[camundaMessageName]
    if (!routingKey) {
      throw new Error(`No RabbitMQ routing key mapping for message: ${camundaMessageName}`)
    }

    const message = createRabbitMessage({
      camundaMessageName,
      correlationKey,
      variables
    })

    this.channel.publish(
      EXCHANGE.name,
      routingKey,
      Buffer.from(JSON.stringify(message)),
      {
        persistent: true,
        contentType: 'application/json'
      }
    )
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
    this.ready = false
  }
}
