/**
 * RabbitMQ 消息发布器
 *
 * 职责：
 *   - 管理 RabbitMQ 连接和 Channel
 *   - 声明 Exchange / Queue / Binding
 *   - 提供统一的 publish() 接口，将 Camunda 消息发到 RabbitMQ
 *
 * 使用方式：
 *   const pub = new RabbitMQPublisher()
 *   await pub.connect()           // 建立连接 + 声明拓扑
 *   await pub.publish(routingKey, message)  // 发消息
 *   await pub.close()             // 关闭连接
 */

import * as amqp from 'amqplib'
import {
    RABBITMQ_CONNECTION,
    EXCHANGE,
    DLX_EXCHANGE,
    QUEUES,
    BINDINGS,
    CAMUNDA_REST,
    ROUTING_KEY_TO_CAMUNDA_MESSAGE,
    CamundaRabbitMQMessage,
    createMessage,
} from './config'

export class RabbitMQPublisher {
    private connection: amqp.ChannelModel | null = null
    private channel: amqp.Channel | null = null

    /** 是否已完成连接和拓扑声明 */
    private ready = false

    // ==================== 连接管理 ====================

    /** 连接到 RabbitMQ 并声明 Exchange / Queue / Binding */
    async connect(): Promise<void> {
        if (this.ready) return

        try {
            this.connection = await amqp.connect(RABBITMQ_CONNECTION.url)
            this.channel = await this.connection.createChannel()

            // 1. 声明主交换机
            await this.channel.assertExchange(EXCHANGE.NAME, EXCHANGE.TYPE, { durable: true })

            // 2. 声明死信交换机
            await this.channel.assertExchange(DLX_EXCHANGE.NAME, DLX_EXCHANGE.TYPE, { durable: true })

            // 3. 声明所有队列（带死信配置）
            const dlqArgs = { 'x-dead-letter-exchange': DLX_EXCHANGE.NAME }
            const normalArgs = {
                'x-dead-letter-exchange': DLX_EXCHANGE.NAME,
                'x-message-ttl': 300000, // 5 分钟 TTL，与 Camunda timeToLive 对齐
            }

            await this.channel.assertQueue(QUEUES.TRANSPORT, { durable: true, arguments: normalArgs })
            await this.channel.assertQueue(QUEUES.FF, { durable: true, arguments: normalArgs })
            await this.channel.assertQueue(QUEUES.ALL, { durable: true, arguments: normalArgs })
            await this.channel.assertQueue(QUEUES.DLQ, { durable: true, arguments: dlqArgs })

            // 4. 声明绑定
            for (const binding of BINDINGS) {
                await this.channel.bindQueue(binding.queue, binding.exchange, binding.routingKey)
            }

            this.ready = true
            console.log('✅ [RabbitMQ Publisher] 连接成功，拓扑已声明')
        } catch (error) {
            console.error('❌ [RabbitMQ Publisher] 连接失败:', error)
            throw error
        }
    }

    // ==================== 消息发布 ====================

    /**
     * 发布消息到 RabbitMQ
     *
     * @param routingKey  路由键 (如 'transport.empty-ctn-received')
     * @param camundaMessageName  Camunda 消息名称 (如 'Message_Transport_empty_CTN_received')
     * @param correlationKey  关联键 (如 orderId)
     * @param variables  流程变量
     */
    async publish(
        routingKey: string,
        camundaMessageName: string,
        correlationKey: string,
        variables: Record<string, unknown>,
    ): Promise<boolean> {
        if (!this.channel || !this.ready) {
            throw new Error('[RabbitMQ Publisher] 未连接，请先调用 connect()')
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
            contentEncoding: 'utf-8',
        })

        if (result) {
            console.log(`📤 [RabbitMQ] 消息已发布 [${routingKey}] -> ${camundaMessageName} (key=${correlationKey})`)
        } else {
            console.warn(`⚠️  [RabbitMQ] 消息缓冲区已满 [${routingKey}]`)
        }

        return result
    }

    // ==================== 便捷方法: Transport 流程 ====================

    /** 发送 "Empty CTN received" 消息 */
    async publishEmptyCtnReceived(
        correlationKey: string,
        variables: { ctnNumber: string; [k: string]: unknown },
    ): Promise<boolean> {
        return this.publish(
            'transport.empty-ctn-received',
            'Message_Transport_empty_CTN_received',
            correlationKey,
            variables,
        )
    }

    /** 发送 "FF Equipment Receipt received" 消息 */
    async publishEquipmentReceiptReceived(
        correlationKey: string,
        variables: { receiptId: string; pickupDepot: string; [k: string]: unknown },
    ): Promise<boolean> {
        return this.publish(
            'transport.equipment-receipt-received',
            'Message_FF_Equipment_Receipt_received',
            correlationKey,
            variables,
        )
    }

    /** 发送 "Outbound CTN received" 消息 */
    async publishOutboundCtnReceived(
        correlationKey: string,
        variables: { ctnNumber: string; [k: string]: unknown },
    ): Promise<boolean> {
        return this.publish(
            'transport.outbound-ctn-received',
            'Message_Owner_Outbound_CTN_received',
            correlationKey,
            variables,
        )
    }

    // ==================== 便捷方法: FF 流程 ====================

    /** 发送 "Owner order received" 消息 (启动 FF 流程) */
    async publishOrderReceived(
        correlationKey: string,
        variables: Record<string, unknown>,
    ): Promise<boolean> {
        return this.publish(
            'ff.order-received',
            'Message_Owner_order_received',
            correlationKey,
            variables,
        )
    }

    /** 发送 "FF Manifest received" 消息 */
    async publishManifestReceived(
        correlationKey: string,
        variables: Record<string, unknown>,
    ): Promise<boolean> {
        return this.publish(
            'ff.manifest-received',
            'Message_FF_Manifest_received',
            correlationKey,
            variables,
        )
    }

    /** 发送 "SA Equipment Receipt received" 消息 */
    async publishSaEquipmentReceiptReceived(
        correlationKey: string,
        variables: Record<string, unknown>,
    ): Promise<boolean> {
        return this.publish(
            'ff.equipment-receipt-received',
            'Message_SA_Equipment_Receipt_received',
            correlationKey,
            variables,
        )
    }

    // ==================== 连接关闭 ====================

    async close(): Promise<void> {
        try {
            if (this.channel) await this.channel.close()
            if (this.connection) await this.connection.close()
        } catch {
            // 忽略关闭时的错误
        }
        this.ready = false
        this.connection = null
        this.channel = null
        console.log('✅ [RabbitMQ Publisher] 连接已关闭')
    }

    isReady(): boolean {
        return this.ready
    }
}
