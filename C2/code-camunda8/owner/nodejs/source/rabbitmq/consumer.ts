/**
 * RabbitMQ 消费者 (C2 Owner)
 *
 * 订阅 C2 专用队列，收到消息后通过 Camunda REST API 注入到 C2 BPMN。
 * 用于未来其他组修复后向 C2 发送消息的场景（如 C3 Transport 发送 ctn-to-owner）。
 */

import * as amqp from 'amqplib'
import { CamundaRestClient } from '@camunda8/sdk'
import {
    RABBITMQ_CONNECTION,
    EXCHANGE,
    QUEUES,
    CAMUNDA_TO_INTERNAL_MESSAGE,
    CamundaRabbitMQMessage,
} from './config'

export class RabbitMQConsumer {
    private connection: amqp.ChannelModel | null = null
    private channel: amqp.Channel | null = null
    private ready = false
    private consumerTag: string | null = null

    constructor(private readonly camundaClient: CamundaRestClient) {}

    async connect(): Promise<void> {
        if (this.ready) return

        try {
            this.connection = await amqp.connect(RABBITMQ_CONNECTION.url)
            this.channel = await this.connection.createChannel()

            await this.channel.assertExchange(EXCHANGE.NAME, EXCHANGE.TYPE, { durable: true })
            await this.channel.assertQueue(QUEUES.OWNER, { durable: true })
            await this.channel.bindQueue(QUEUES.OWNER, EXCHANGE.NAME, 'owner.#')
            await this.channel.assertQueue(QUEUES.OWNER_DEBUG, { durable: true })
            await this.channel.bindQueue(QUEUES.OWNER_DEBUG, EXCHANGE.NAME, 'owner.#')

            this.ready = true
            console.log('[RabbitMQ Consumer] Connected, queue:', QUEUES.OWNER)
            console.log('[RabbitMQ Consumer] Debug queue bound:', QUEUES.OWNER_DEBUG)
        } catch (error) {
            console.error('[RabbitMQ Consumer] Connection failed:', error)
            throw error
        }
    }

    async startConsuming(): Promise<void> {
        if (!this.channel || !this.ready) {
            throw new Error('[RabbitMQ Consumer] Not connected, call connect() first')
        }

        const { consumerTag } = await this.channel.consume(QUEUES.OWNER, async (msg) => {
            if (!msg) return

            try {
                const raw = msg.content.toString()
                const message: CamundaRabbitMQMessage = JSON.parse(raw)

                console.log(
                    `[RabbitMQ Consumer] Received: ${message.camundaMessageName} (key=${message.correlationKey})`
                )

                const internalName = CAMUNDA_TO_INTERNAL_MESSAGE[message.camundaMessageName]
                if (!internalName) {
                    console.warn(`[RabbitMQ Consumer] Unknown camunda message name: ${message.camundaMessageName}`)
                    this.channel!.nack(msg, false, false)
                    return
                }

                await this.camundaClient.publishMessage({
                    name: internalName,
                    correlationKey: message.correlationKey,
                    variables: message.variables as any,
                    timeToLive: 600,
                })

                console.log(`[RabbitMQ Consumer] Forwarded to Camunda as: ${internalName}`)
                this.channel!.ack(msg)
            } catch (error) {
                console.error('[RabbitMQ Consumer] Failed to process message:', error)
                this.channel!.nack(msg, false, false)
            }
        })

        this.consumerTag = consumerTag
        console.log('[RabbitMQ Consumer] Started consuming:', QUEUES.OWNER)
    }

    async close(): Promise<void> {
        try {
            if (this.channel && this.consumerTag) {
                await this.channel.cancel(this.consumerTag)
            }
            if (this.channel) await this.channel.close()
            if (this.connection) await this.connection.close()
        } catch {
            // ignore
        }
        this.ready = false
        this.consumerTag = null
        this.connection = null
        this.channel = null
        console.log('[RabbitMQ Consumer] Connection closed')
    }

    isReady(): boolean {
        return this.ready
    }
}
