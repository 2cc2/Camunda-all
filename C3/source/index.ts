/**
 * index.ts —— 主入口 (Camunda 8 + RabbitMQ)
 *
 * 启动内容：
 *   1. Camunda Job Workers (Transport + FreightForwarder)
 *   2. RabbitMQ Bridge (Consumer 监听队列，自动转发到 Camunda)
 *
 * 消息流：
 *   外部/脚本 -> RabbitMQ Exchange -> Queue -> Consumer -> Camunda REST API -> 流程实例推进
 *   Camunda Job Workers 处理 Service Task（如派箱、发S/O等）
 */

import { Camunda8 } from '@camunda8/sdk'
import { startTransportWorkers } from './Transport'
import { startFreightForwarderWorkers } from './FreightForwarder'
import { CamundaRabbitMQBridge } from './rabbitmq/bridge'

async function main() {
    console.log('🚀 正在启动 Camunda 8 Workers + RabbitMQ Bridge...\n')

    // ==================== 1. 创建 Camunda Client ====================
    const client = new Camunda8({
        CAMUNDA_AUTH_STRATEGY: 'NONE',
        ZEEBE_REST_ADDRESS: 'http://localhost:8080',
        ZEEBE_GRPC_ADDRESS: 'localhost:26500',
    }).getCamundaRestClient()

    // ==================== 2. 启动 Camunda Job Workers ====================
    startTransportWorkers(client)
    console.log('  ✅ Transport Workers 已启动 (ctn-to-owner, outbound-ctn-to-depot)')

    startFreightForwarderWorkers(client)
    console.log('  ✅ FreightForwarder Workers 已启动 (so-to-sa, order-info-to-cb, equipment-receipt-to-transport)')

    // ==================== 3. 启动 RabbitMQ Bridge ====================
    try {
        const bridge = new CamundaRabbitMQBridge()
        await bridge.connect()
        await bridge.start()

        console.log('  ✅ RabbitMQ Bridge 已启动')
        console.log('     消息将自动从 RabbitMQ 转发到 Camunda REST API')
    } catch (error) {
        console.warn('  ⚠️  RabbitMQ Bridge 启动失败（RabbitMQ 可能未运行）:')
        console.warn(`     ${error}`)
        console.warn('     Workers 仍将正常运行，但消息不会通过 RabbitMQ 转发')
        console.warn('     请确保 RabbitMQ 已启动: docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management')
    }

    console.log('\n🟢 系统就绪，等待任务和消息...\n')
    console.log('用法:')
    console.log('  发送 Transport 消息: npx ts-node sendMsg.ts')
    console.log('  发送 FF 消息:        npx ts-node sendFFMsg.ts')
    console.log('')
}

// 优雅退出
process.on('SIGINT', async () => {
    console.log('\n⏹️  正在关闭...')
    process.exit(0)
})

main().catch((err) => {
    console.error('❌ 启动失败:', err)
    process.exit(1)
})
