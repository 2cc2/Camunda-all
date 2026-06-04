import * as amqp from 'amqplib'
import {
    RABBITMQ_CONNECTION,
    EXCHANGE,
    DLX_EXCHANGE,
    QUEUES,
    BINDINGS,
    ROUTING_KEYS,
    ROUTING_KEY_TO_CAMUNDA_MESSAGE,
    CamundaRabbitMQMessage,
    createMessage,
} from './config'

export class RabbitMQPublisher {
    private connection: amqp.ChannelModel | null = null
    private channel: amqp.Channel | null = null
    private ready = false

    async connect(): Promise<void> {
        if (this.ready) return

        this.connection = await amqp.connect(RABBITMQ_CONNECTION.url)
        this.channel = await this.connection.createChannel()

        // 声明主交换机
        await this.channel.assertExchange(EXCHANGE.NAME, EXCHANGE.TYPE, { durable: true })

        // 声明死信交换机
        await this.channel.assertExchange(DLX_EXCHANGE.NAME, DLX_EXCHANGE.TYPE, { durable: true })

        // 声明所有队列（带死信配置 + TTL）
        const args = {
            'x-dead-letter-exchange': DLX_EXCHANGE.NAME,
            'x-message-ttl': 300000,
        }
        const dlqArgs = { 'x-dead-letter-exchange': DLX_EXCHANGE.NAME }

        await this.channel.assertQueue(QUEUES.CB, { durable: true, arguments: args })
        await this.channel.assertQueue(QUEUES.CT, { durable: true, arguments: args })
        await this.channel.assertQueue(QUEUES.SA, { durable: true, arguments: args })
        await this.channel.assertQueue(QUEUES.CUSTOMS, { durable: true, arguments: args })
        await this.channel.assertQueue(QUEUES.ALL, { durable: true, arguments: args })
        await this.channel.assertQueue(QUEUES.DLQ, { durable: true, arguments: dlqArgs })

        // 声明绑定
        for (const binding of BINDINGS) {
            await this.channel.bindQueue(binding.queue, binding.exchange, binding.routingKey)
        }

        this.ready = true
        console.log('[RabbitMQ Publisher] 连接成功，拓扑已声明')
    }

    async publish(
        routingKey: string,
        correlationKey: string,
        variables: Record<string, unknown>,
    ): Promise<boolean> {
        if (!this.channel || !this.ready) {
            throw new Error('[RabbitMQ Publisher] 未连接，请先调用 connect()')
        }

        const camundaMessageName = ROUTING_KEY_TO_CAMUNDA_MESSAGE[routingKey]
        if (!camundaMessageName) {
            throw new Error(`[RabbitMQ Publisher] 未知的 routingKey: ${routingKey}`)
        }

        const message: CamundaRabbitMQMessage = createMessage({
            camundaMessageName,
            correlationKey,
            variables,
        })

        const buffer = Buffer.from(JSON.stringify(message))
        const result = this.channel.publish(EXCHANGE.NAME, routingKey, buffer, {
            persistent: true,
            contentType: 'application/json',
        })

        if (result) {
            console.log(`  📤 [RabbitMQ] ${routingKey} → ${camundaMessageName} (key=${correlationKey})`)
        } else {
            console.warn(`  ⚠️ [RabbitMQ] 发送缓冲区满: ${routingKey}`)
        }

        return result
    }

    // ==================== 便捷方法 ====================

    async publishDeclaration(correlationKey: string, variables: Record<string, unknown>) {
        return this.publish(ROUTING_KEYS.CB_DECLARATION, correlationKey, variables)
    }

    async publishAppointment(correlationKey: string, variables: Record<string, unknown>) {
        return this.publish(ROUTING_KEYS.CB_APPOINTMENT, correlationKey, variables)
    }

    async publishArrival(correlationKey: string, variables: Record<string, unknown>) {
        return this.publish(ROUTING_KEYS.CT_ARRIVAL, correlationKey, variables)
    }

    async publishManifest(correlationKey: string, variables: Record<string, unknown>) {
        return this.publish(ROUTING_KEYS.SA_MANIFEST, correlationKey, variables)
    }

    async publishDeclareSuccess(correlationKey: string, variables: Record<string, unknown>) {
        return this.publish(ROUTING_KEYS.CUSTOMS_DECLARE_SUCCESS, correlationKey, variables)
    }

    async publishClearanceCT(correlationKey: string, variables: Record<string, unknown>) {
        return this.publish(ROUTING_KEYS.CUSTOMS_CLEARANCE_CT, correlationKey, variables)
    }

    async publishClearanceCB(correlationKey: string, variables: Record<string, unknown>) {
        return this.publish(ROUTING_KEYS.CUSTOMS_CLEARANCE_CB, correlationKey, variables)
    }

    async close(): Promise<void> {
        try {
            if (this.channel) await this.channel.close()
            if (this.connection) await this.connection.close()
        } catch { /* ignore */ }
        this.ready = false
        this.connection = null
        this.channel = null
        console.log('[RabbitMQ Publisher] 连接已关闭')
    }

    isReady(): boolean {
        return this.ready
    }
}
