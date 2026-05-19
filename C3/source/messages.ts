/**
 * messages.ts —— 统一的消息发送工具 (RabbitMQ 版)
 *
 * 用途：
 *   - 汇总所有消息发送逻辑
 *   - 通过 RabbitMQ 发布消息（而非直接 HTTP 调用 Camunda API）
 *   - 管理不同流程的消息类型（Transport、FF）
 *
 * 消息流：
 *   messages.ts -> RabbitMQ Exchange -> RabbitMQ Queue -> Consumer -> Camunda REST API
 *
 * 导出函数：
 *   - initPublisher()              // 初始化 RabbitMQ 连接
 *   - closePublisher()             // 关闭连接
 *   - sendOwnerMessages()          // Transport 流程相关消息
 *   - sendFFMessages()             // Freight Forwarder 相关消息
 */

import { RabbitMQPublisher } from './rabbitmq/publisher'

const ORDER_ID = 'ORDER-20260420-001'

/** 全局 Publisher 实例（延迟初始化） */
let publisher: RabbitMQPublisher | null = null

/** 获取 Publisher 实例，如未初始化则抛错 */
function getPublisher(): RabbitMQPublisher {
    if (!publisher) {
        throw new Error('Publisher 未初始化，请先调用 initPublisher()')
    }
    return publisher
}

/**
 * 初始化 RabbitMQ Publisher 连接
 *
 * 必须在调用任何 send* 函数之前调用
 */
export async function initPublisher(): Promise<void> {
    if (publisher) return
    publisher = new RabbitMQPublisher()
    await publisher.connect()
}

/**
 * 关闭 Publisher 连接
 */
export async function closePublisher(): Promise<void> {
    if (publisher) {
        await publisher.close()
        publisher = null
    }
}

/**
 * ==================== Transport 流程消息（原 sendMsg.ts / Owner 消息） ====================
 *
 * Transport.bpmn 中的三个 Message Catch Event：
 *   1. Message_FF_Equipment_Receipt_received  (FF 发来的设备交接单)
 *   2. Message_Transport_empty_CTN_received   (Depot 发来的空箱)
 *   3. Message_Owner_Outbound_CTN_received    (Owner 发来的出口箱)
 */
async function sendOwnerMessages() {
    try {
        const pub = getPublisher()

        console.log('\n📨 ========== Transport 流程消息 (via RabbitMQ) ==========')

        console.log('⏳ 发送第 1 条消息: FF Equipment Receipt...')
        await pub.publishEquipmentReceiptReceived(ORDER_ID, {
            receiptId: 'EIR-MSK-992384',
            pickupDepot: 'DEPOT-BAOSHAN-01',
        })
        console.log('✅ 第 1 条消息已发布到 RabbitMQ！')

        console.log('⏳ 发送第 2 条消息: Empty CTN...')
        await pub.publishEmptyCtnReceived(ORDER_ID, {
            ctnNumber: 'CTN-884821',
        })
        console.log('✅ 第 2 条消息已发布到 RabbitMQ！')

        console.log('⏳ 发送第 3 条消息: Outbound CTN received...')
        await pub.publishOutboundCtnReceived(ORDER_ID, {
            ctnNumber: 'CTN-884821',
        })
        console.log('✅ 第 3 条消息已发布到 RabbitMQ！')

        console.log('🎉 Transport 流程的三条消息全部发布到 RabbitMQ 完毕！')
    } catch (error) {
        console.error('❌ Transport 流程错误:', error)
        throw error
    }
}

/**
 * ==================== Freight Forwarder (FF) 流程消息 ====================
 *
 * Freight-Forward.bpmn 中的消息接收点:
 *   1. Message Start "order received"                    -> 启动 FF 流程实例
 *   2. Intermediate Catch "Manifest received"            -> 收到船代的舱单
 *   3. Intermediate Catch "SA Equipment Receipt received"-> 收到船代的 EIR
 */
async function sendFFMessages() {
    try {
        const pub = getPublisher()

        console.log('\n📨 ========== Freight Forwarder (FF) 流程消息 (via RabbitMQ) ==========')

        // ============ 第 1 条: 启动 FF 流程 ============
        console.log('⏳ [1/3] 发送 Owner Order to FFW (启动 FF 流程)...')
        await pub.publishOrderReceived(ORDER_ID, {
            orderId: ORDER_ID,
            shipperName: 'ACME Trading Co., Ltd.',
            consignee: 'Global Buyer Inc.',
            pol: 'CNSHA',   // Port of Loading
            pod: 'USLAX',   // Port of Discharge
            commodity: 'Electronics',
            quantity: 1,
            ctnType: '40HQ',
        })
        console.log('✅ FF 流程启动消息已发布到 RabbitMQ')

        // 给 FF 里两个并行 ServiceTask 一点处理时间
        await sleep(2500)

        // ============ 第 2 条: 舱单(Manifest)送达 FF ============
        console.log('⏳ [2/3] 发送 FF Manifest received...')
        await pub.publishManifestReceived(ORDER_ID, {
            manifestId: 'MNF-FF-20260420-001',
            shipName: 'MSC OSCAR',
            voyageNumber: 'V0428E',
            issuedBy: 'SA-MAERSK-01',
        })
        console.log('✅ 舱单消息已发布到 RabbitMQ')

        await sleep(500)

        // ============ 第 3 条: 船代下发 EIR ============
        console.log('⏳ [3/3] 发送 SA Equipment Receipt received...')
        await pub.publishSaEquipmentReceiptReceived(ORDER_ID, {
            receiptId: 'EIR-MSK-992384',
            depotId: 'DEPOT-BAOSHAN-01',
            pickupDepot: 'DEPOT-BAOSHAN-01',
            ctnType: '40HQ',
            ctnQuantity: 1,
            validUntil: '2026-04-25T18:00:00Z',
        })
        console.log('✅ EIR 消息已发布到 RabbitMQ')

        console.log('🎉 FF 流程的三条消息全部发布到 RabbitMQ 完毕!')
    } catch (error) {
        console.error('❌ FF 流程错误:', error)
        throw error
    }
}

/**
 * 辅助函数
 */
function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms))
}

// ==================== 导出 ====================
export { publishMessage, sendOwnerMessages, sendFFMessages, sleep }

/**
 * 底层消息发送函数（通过 RabbitMQ）
 *
 * @param camundaMessageName Camunda 消息名称
 * @param variables 流程变量
 * @param correlationKey 关联键，默认使用 ORDER_ID
 * @param routingKey RabbitMQ 路由键，如果不提供则根据 camundaMessageName 自动推断
 */
async function publishMessage(
    camundaMessageName: string,
    variables: Record<string, unknown>,
    correlationKey: string = ORDER_ID,
    routingKey?: string,
) {
    const pub = getPublisher()

    // 如果没提供 routingKey，用 camundaMessageName 作为 routingKey
    // (Consumer 端会根据消息体中的 camundaMessageName 来路由)
    const rk = routingKey || inferRoutingKey(camundaMessageName)

    await pub.publish(rk, camundaMessageName, correlationKey, variables)
}

/**
 * 根据 Camunda 消息名推断 RabbitMQ routing key
 */
function inferRoutingKey(camundaMessageName: string): string {
    const map: Record<string, string> = {
        'Message_FF_Equipment_Receipt_received': 'transport.equipment-receipt-received',
        'Message_Transport_empty_CTN_received': 'transport.empty-ctn-received',
        'Message_Owner_Outbound_CTN_received': 'transport.outbound-ctn-received',
        'Message_Owner_order_received': 'ff.order-received',
        'Message_FF_Manifest_received': 'ff.manifest-received',
        'Message_SA_Equipment_Receipt_received': 'ff.equipment-receipt-received',
    }
    return map[camundaMessageName] || `unknown.${camundaMessageName}`
}
