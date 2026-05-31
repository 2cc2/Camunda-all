import { Camunda8 } from '@camunda8/sdk'
import { startCustomsWorkers } from './Customs'
import { startCustomsBrokerWorkers } from './CustomsBroker'
import { startContainerTerminalWorkers } from './ContainerTerminal'
import { startShippingAgencyWorkers } from './ShippingAgency'
import { BASE_URL, ZEEBE_GRPC_ADDRESS } from './config'
import { CamundaRabbitMQBridge } from './rabbitmq'
import { setBridge } from './rabbitmq'

async function main() {
    console.log('================================================')
    console.log('  Camunda 8 + RabbitMQ 消息中间件')
    console.log('  多参与者真实数据交互')
    console.log('================================================\n')

    // ==================== 1. 创建 Camunda Client ====================
    const client = new Camunda8({
        CAMUNDA_AUTH_STRATEGY: 'NONE',
        ZEEBE_REST_ADDRESS: BASE_URL,
        ZEEBE_GRPC_ADDRESS,
    }).getCamundaRestClient()

    // ==================== 2. 启动 Job Workers ====================
    startCustomsWorkers(client)
    startCustomsBrokerWorkers(client)
    startContainerTerminalWorkers(client)
    startShippingAgencyWorkers(client)

    console.log('Job Workers:')
    console.log('  Customs:            declareSuccess, CIQ, inspection, CustomsCearance')
    console.log('  Customs Broker:     submit-declaration, appoint-inspection')
    console.log('  Container Terminal: send-arrival-to-customs')
    console.log('  Shipping Agency:    send-manifest-to-customs')
    console.log('')

    // ==================== 3. 启动 RabbitMQ Bridge ====================
    try {
        const bridge = new CamundaRabbitMQBridge()
        await bridge.connect()
        await bridge.start()
        setBridge(bridge)
        console.log('RabbitMQ Bridge: 已启动')
        console.log('  消息流: Worker → RabbitMQ → Consumer → Camunda REST API')
        console.log('')
    } catch (error) {
        console.warn('RabbitMQ Bridge 启动失败（RabbitMQ 可能未运行）:')
        console.warn(`  ${error}`)
        console.warn('Workers 将使用直接 REST API 调用作为 fallback')
        console.warn('启动 RabbitMQ: docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management')
        console.log('')
    }

    console.log('================================================')
    console.log('  系统就绪')
    console.log('================================================')
    console.log('')
    console.log('运行流程: npm run run')
    console.log('手动发消息: npm run send')
    console.log('')

    // 优雅退出
    process.on('SIGINT', async () => {
        console.log('\n正在关闭...')
        const { getBridge } = await import('./rabbitmq')
        const bridge = getBridge()
        if (bridge) await bridge.close()
        process.exit(0)
    })
}

main().catch((err) => {
    console.error('启动失败:', err)
    process.exit(1)
})
