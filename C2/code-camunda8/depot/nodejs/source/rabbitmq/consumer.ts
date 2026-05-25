import * as amqp from 'amqplib'
import {
  CAMUNDA_REST,
  EXCHANGE,
  DLX_EXCHANGE,
  QUEUES,
  RABBITMQ_CONNECTION,
  RETRY,
  RabbitMQCamundaMessage
} from './config'

export class RabbitMQConsumer {
  private connection: amqp.ChannelModel | null = null
  private channel: amqp.Channel | null = null
  private ready = false

  async connect(): Promise<void> {
    if (this.ready) return

    this.connection = await amqp.connect(RABBITMQ_CONNECTION.url)
    this.channel = await this.connection.createChannel()
    await this.channel.prefetch(10)

    await this.channel.assertExchange(EXCHANGE.name, EXCHANGE.type, { durable: true })
    await this.channel.assertExchange(DLX_EXCHANGE.name, DLX_EXCHANGE.type, { durable: true })
    await this.channel.assertQueue(QUEUES.depotInbound, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': DLX_EXCHANGE.name,
        'x-dead-letter-routing-key': DLX_EXCHANGE.routingKey,
        'x-message-ttl': RETRY.messageTtlMs
      }
    })
    await this.channel.assertQueue(QUEUES.audit, { durable: true })
    await this.channel.assertQueue(QUEUES.deadLetter, { durable: true })

    this.ready = true
  }

  async startConsuming(): Promise<void> {
    if (!this.channel || !this.ready) {
      throw new Error('RabbitMQ consumer not connected')
    }

    await this.channel.consume(
      QUEUES.depotInbound,
      async (msg) => {
        if (!msg) return
        try {
          const payload = JSON.parse(msg.content.toString()) as RabbitMQCamundaMessage
          await this.forwardToCamunda(payload)
          this.channel?.ack(msg)
        } catch (error) {
          await this.handleFailure(msg, error)
        }
      },
      { noAck: false }
    )

    await this.channel.consume(
      QUEUES.audit,
      (msg) => {
        if (!msg) return
        try {
          const payload = JSON.parse(msg.content.toString()) as RabbitMQCamundaMessage
          console.log(
            `[audit] ${payload.camundaMessageName} key=${payload.correlationKey} source=${payload.source}`
          )
        } finally {
          this.channel?.ack(msg)
        }
      },
      { noAck: false }
    )

    await this.channel.consume(
      QUEUES.deadLetter,
      (msg) => {
        if (!msg) return
        try {
          const payload = JSON.parse(msg.content.toString()) as RabbitMQCamundaMessage
          console.error(
            `[dlq] ${payload.camundaMessageName} orderId=${payload.correlationKey} retries=${payload.retryCount}`
          )
        } catch {
          console.error(`[dlq] unreadable message ${msg.content.toString()}`)
        } finally {
          this.channel?.ack(msg)
        }
      },
      { noAck: false }
    )
  }

  private async forwardToCamunda(message: RabbitMQCamundaMessage): Promise<void> {
    const response = await fetch(CAMUNDA_REST.publishUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: message.camundaMessageName,
        correlationKey: message.correlationKey,
        timeToLive: 600000,
        variables: message.variables
      })
    })

    if (!response.ok) {
      throw new Error(`Camunda REST ${response.status}: ${await response.text()}`)
    }
  }

  private async handleFailure(msg: amqp.ConsumeMessage, error: unknown): Promise<void> {
    if (!this.channel) {
      return
    }

    let payload: RabbitMQCamundaMessage | null = null
    try {
      payload = JSON.parse(msg.content.toString()) as RabbitMQCamundaMessage
    } catch {
      payload = null
    }

    if (!payload) {
      console.error('[rabbitmq-consumer] unreadable inbound message, sending to DLQ:', error)
      this.channel.nack(msg, false, false)
      return
    }

    const nextRetryCount = (payload.retryCount ?? 0) + 1
    const maxRetries = payload.maxRetries ?? RETRY.maxRetries
    console.error(
      `[rabbitmq-consumer] failed orderId=${payload.correlationKey} message=${payload.camundaMessageName} retry=${nextRetryCount}/${maxRetries}:`,
      error
    )

    if (nextRetryCount <= maxRetries) {
      const retryPayload: RabbitMQCamundaMessage = {
        ...payload,
        retryCount: nextRetryCount,
        timestamp: new Date().toISOString()
      }
      this.channel.publish(
        EXCHANGE.name,
        msg.fields.routingKey,
        Buffer.from(JSON.stringify(retryPayload)),
        {
          persistent: true,
          contentType: 'application/json',
          headers: {
            'x-retry-count': nextRetryCount
          }
        }
      )
      this.channel.ack(msg)
      return
    }

    this.channel.publish(
      DLX_EXCHANGE.name,
      DLX_EXCHANGE.routingKey,
      Buffer.from(JSON.stringify({ ...payload, retryCount: nextRetryCount })),
      {
        persistent: true,
        contentType: 'application/json'
      }
    )
    this.channel.ack(msg)
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
