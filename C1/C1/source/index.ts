import { BASE_URL } from './config'
import { startApplicationRuntime, stopApplicationRuntime } from './runtime'

async function main() {
    console.log('================================================')
    console.log('  Camunda 8 + RabbitMQ 消息中间件')
    console.log('  多参与者真实数据交互')
    console.log('================================================\n')

    const runtime = await startApplicationRuntime()

    console.log('Job Workers:')
    console.log('  Customs:            declareSuccess, CIQ, inspection, CustomsCearance')
    console.log('  Customs Broker:     submit-declaration, appoint-inspection')
    console.log('  Container Terminal: send-arrival-to-customs')
    console.log('  Shipping Agency:    send-manifest-to-customs')
    console.log('')

    if (runtime.bridge) {
        console.log('RabbitMQ Bridge: 已启动')
        console.log('  消息流: Worker → RabbitMQ → Consumer → Camunda REST API')
        console.log('')
    } else {
        console.warn('RabbitMQ Bridge 启动失败（RabbitMQ 可能未运行）:')
        console.warn('Workers 将使用直接 REST API 调用作为 fallback')
        console.warn('启动本地环境: docker compose -f docker-compose.local.yaml --env-file docker-compose.local.env up -d')
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
        await stopApplicationRuntime(runtime)
        process.exit(0)
    })
}

main().catch((err) => {
    console.error('启动失败:', err)
    process.exit(1)
})
