/**
 * RabbitMQ 消息发布器 (C2 Owner)
 *
 * 将 C2 的内部消息通过 RabbitMQ 发布到 C3 组。
 * 与 C3 的 RabbitMQ 拓扑兼容：exchange 'camunda.events' (topic)
 */

import * as amqp from 'amqplib'
import {
    RABBITMQ_CONNECTION,
    EXCHANGE,
    MESSAGE_MAPPING,
    createMessage,
} from './config'

export class RabbitMQPublisher {
    private connection: amqp.ChannelModel | null = null
    private channel: amqp.Channel | null = null
    private ready = false

    async connect(): Promise<void> {
        if (this.ready) return

        try {
            this.connection = await amqp.connect(RABBITMQ_CONNECTION.url)
            this.channel = await this.connection.createChannel()

            await this.channel.assertExchange(EXCHANGE.NAME, EXCHANGE.TYPE, { durable: true })

            this.ready = true
            console.log('[RabbitMQ Publisher] Connected to exchange:', EXCHANGE.NAME)
        } catch (error) {
            console.error('[RabbitMQ Publisher] Connection failed:', error)
            throw error
        }
    }

    /**
     * 发布消息到 RabbitMQ
     *
     * @param internalMessageName C2 内部消息名 (如 'order-to-ffw')
     * @param correlationKey 关联键 (orderId)
     * @param variables 流程变量
     */
    async publish(
        internalMessageName: string,
        correlationKey: string,
        variables: Record<string, unknown>,
    ): Promise<boolean> {
        if (!this.channel || !this.ready) {
            throw new Error('[RabbitMQ Publisher] Not connected, call connect() first')
        }

        const mapping = MESSAGE_MAPPING[internalMessageName]
        if (!mapping) {
            throw new Error(`[RabbitMQ Publisher] Unknown internal message name: ${internalMessageName}`)
        }

        const message = createMessage({
            camundaMessageName: mapping.camundaName,
            correlationKey,
            variables,
            source: 'c2-owner',
        })

        const buffer = Buffer.from(JSON.stringify(message))

        const result = this.channel.publish(EXCHANGE.NAME, mapping.routingKey, buffer, {
            persistent: true,
            contentType: 'application/json',
            contentEncoding: 'utf-8',
        })

        if (result) {
            console.log(`[RabbitMQ] Published [${mapping.routingKey}] -> ${mapping.camundaName} (key=${correlationKey})`)
        } else {
            console.warn(`[RabbitMQ] Publish buffer full [${mapping.routingKey}]`)
        }

        return result
    }

    async close(): Promise<void> {
        try {
            if (this.channel) await this.channel.close()
            if (this.connection) await this.connection.close()
        } catch {
            // ignore
        }
        this.ready = false
        this.connection = null
        this.channel = null
        console.log('[RabbitMQ Publisher] Connection closed')
    }

    isReady(): boolean {
        return this.ready
    }
}
