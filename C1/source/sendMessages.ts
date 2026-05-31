/**
 * sendMessages.ts —— 手动通过 RabbitMQ 发送消息（测试用）
 *
 * 用途：不启动流程实例，直接通过 RabbitMQ 向 Camunda 发送消息
 * 前提：已有运行中的流程实例在等待消息
 *
 * 用法：
 *   npx ts-node source/sendMessages.ts
 *   (需要先启动 RabbitMQ + Camunda workers: npm run workers)
 */
import { RabbitMQPublisher } from './rabbitmq'

const ORDER_ID = process.env.ORDER_ID || 'ORDER-20260508-001'

async function main() {
    console.log('================================================')
    console.log('  手动发送消息 (via RabbitMQ)')
    console.log(`  orderId: ${ORDER_ID}`)
    console.log('================================================\n')

    const publisher = new RabbitMQPublisher()
    await publisher.connect()

    // 1. 发送报关申报 (CB → Customs)
    console.log('[1/5] 发送报关申报 (CB → Customs)...')
    await publisher.publishDeclaration(ORDER_ID, {
        orderId: ORDER_ID,
        timestamp: new Date().toISOString(),
        declarationId: 'DECL-MANUAL-001',
        senderId: 'CUSTOMS-BROKER-05',
        hsCode: '9503.00',
        declaredValue: 25000,
        currency: 'USD',
        quantity: 500,
        countryOfOrigin: 'CN',
        cargoDescription: 'Plush Toys',
    })
    console.log('  已发送\n')
    await sleep(1000)

    // 2. 发送预约查验 (CB → Customs)
    console.log('[2/5] 发送预约查验 (CB → Customs)...')
    await publisher.publishAppointment(ORDER_ID, {
        orderId: ORDER_ID,
        timestamp: new Date().toISOString(),
        appointmentId: 'APT-MANUAL-001',
        senderId: 'CUSTOMS-BROKER-05',
        appointmentTime: new Date(Date.now() + 86400000).toISOString(),
        inspectionLocation: 'Shanghai Yangshan Inspection Area',
        contactPerson: 'Li Ming',
        contactPhone: '+86-21-12345678',
    })
    console.log('  已发送\n')
    await sleep(500)

    // 3. 发送船舶到港 (CT → Customs)
    console.log('[3/5] 发送船舶到港 (CT → Customs)...')
    await publisher.publishArrival(ORDER_ID, {
        orderId: ORDER_ID,
        timestamp: new Date().toISOString(),
        senderId: 'CONTAINER-TERMINAL-01',
        vesselId: 'VESSEL-042',
        containerId: 'MSKU1234567',
        arrivalTime: new Date().toISOString(),
    })
    console.log('  已发送\n')
    await sleep(500)

    // 4. 发送舱单 (SA → Customs)
    console.log('[4/5] 发送舱单 (SA → Customs)...')
    await publisher.publishManifest(ORDER_ID, {
        orderId: ORDER_ID,
        timestamp: new Date().toISOString(),
        manifestId: 'MNF-MANUAL-001',
        senderId: 'SHIPPING-AGENCY-01',
        vesselId: 'VESSEL-042',
    })
    console.log('  已发送\n')
    await sleep(1000)

    // 5. 发送 declare success (Customs → CB) —— 模拟海关完成申报受理
    console.log('[5/5] 发送 declare success (Customs → CB)...')
    await publisher.publishDeclareSuccess(ORDER_ID, {
        orderId: ORDER_ID,
        timestamp: new Date().toISOString(),
        senderId: 'CUSTOMS-SH-01',
        declarationId: 'DECL-MANUAL-001',
        declareStatus: 'ACCEPTED',
    })
    console.log('  已发送\n')

    console.log('================================================')
    console.log('  全部消息发送完毕')
    console.log('================================================')

    await publisher.close()
}

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms))
}

main().catch((error) => {
    console.error('发送失败:', error)
    process.exit(1)
})
