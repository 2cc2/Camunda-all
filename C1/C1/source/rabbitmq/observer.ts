import * as amqp from 'amqplib'
import { CamundaRabbitMQMessage, EXCHANGE, RABBITMQ_CONNECTION } from './config'

export type ObservedRabbitMessage = {
    routingKey: string
    payload: CamundaRabbitMQMessage
}

export class RabbitMQAuditObserver {
    private connection: amqp.ChannelModel | null = null
    private channel: amqp.Channel | null = null
    private queueName: string | null = null
    private readonly observed: ObservedRabbitMessage[] = []

    async connect(): Promise<void> {
        if (this.connection) return

        this.connection = await amqp.connect(RABBITMQ_CONNECTION.url)
        this.channel = await this.connection.createChannel()
        await this.channel.assertExchange(EXCHANGE.NAME, EXCHANGE.TYPE, { durable: true })

        const asserted = await this.channel.assertQueue('', {
            exclusive: true,
            autoDelete: true,
        })
        this.queueName = asserted.queue
        await this.channel.bindQueue(asserted.queue, EXCHANGE.NAME, '#')
    }

    async start(): Promise<void> {
        if (!this.channel || !this.queueName) {
            throw new Error('RabbitMQ observer 未连接')
        }

        await this.channel.consume(
            this.queueName,
            (msg) => {
                if (!msg) return
                try {
                    const payload = JSON.parse(msg.content.toString()) as CamundaRabbitMQMessage
                    this.observed.push({
                        routingKey: msg.fields.routingKey,
                        payload,
                    })
                } finally {
                    this.channel?.ack(msg)
                }
            },
            { noAck: false },
        )
    }

    async waitForMessages(expectedCount: number, timeoutMs = 10000) {
        const startedAt = Date.now()
        while (Date.now() - startedAt < timeoutMs) {
            if (this.observed.length >= expectedCount) {
                return [...this.observed]
            }
            await new Promise((resolve) => setTimeout(resolve, 200))
        }
        throw new Error(`等待 RabbitMQ 消息超时: 期望 ${expectedCount} 条，实际 ${this.observed.length} 条`)
    }

    getObservedMessages() {
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
    }
}
