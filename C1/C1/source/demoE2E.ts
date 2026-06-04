import { assertEnvironmentReady } from './checkEnv'
import { deployProcesses } from './deploy'
import { getMockBusFilePath } from './mockEnvironmentBus'
import { RabbitMQAuditObserver } from './rabbitmq/observer'
import { runCustomsFlow } from './runCustoms'
import { startApplicationRuntime, stopApplicationRuntime } from './runtime'

type Args = {
    orderId?: string
}

function parseArgs(): Args {
    const orderIdArg = process.argv.find((arg) => arg.startsWith('--orderId='))
    return {
        orderId: orderIdArg?.split('=')[1],
    }
}

async function main() {
    const { orderId } = parseArgs()

    console.log('================================================')
    console.log('  C1 一键端到端验证')
    console.log('================================================\n')

    await assertEnvironmentReady()
    console.log('[0/4] 环境检查通过\n')

    const observer = new RabbitMQAuditObserver()
    await observer.connect()
    await observer.start()

    const runtime = await startApplicationRuntime({ requireRabbitMQ: true })

    try {
        console.log('[1/4] 部署 BPMN...')
        await deployProcesses()
        console.log('')

        console.log('[2/4] 启动 Workers + RabbitMQ Bridge...')
        console.log('  Workers 和 Bridge 已就绪\n')

        console.log('[3/4] 运行多参与者流程...')
        const summary = await runCustomsFlow({
            orderId,
            printProgress: true,
        })
        console.log('')

        console.log('[4/4] 校验 RabbitMQ 消息流...')
        const rabbitMessages = await observer.waitForMessages(7, 15000)
        for (const message of rabbitMessages) {
            console.log(`  ${message.routingKey} -> ${message.payload.camundaMessageName}`)
        }

        console.log('\n================================================')
        console.log('  端到端验证完成')
        console.log('================================================')
        console.log(`  业务审计文件: ${getMockBusFilePath()}`)
        console.log(`  RabbitMQ 发布数: ${rabbitMessages.length}`)
        console.log(`  业务消息数: ${summary.messages.length}`)
        console.log(`  总耗时: ${(summary.durationMs / 1000).toFixed(1)}s`)
        console.log('')
    } finally {
        await observer.close()
        await stopApplicationRuntime(runtime)
    }
}

main().catch((error) => {
    console.error('demo:e2e 失败:', error)
    process.exit(1)
})
