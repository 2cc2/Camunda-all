import { startProcessInstance } from './camundaApi'
import { CUSTOMS_PROCESS_ID, CB_PROCESS_ID, CT_PROCESS_ID, SA_PROCESS_ID, ORDER_ID } from './config'
import { getMockBusFilePath, resetMockBus, readMockMessages } from './mockEnvironmentBus'

async function main() {
    resetMockBus()

    console.log('================================================')
    console.log('  启动多参与者真实数据交互')
    console.log('================================================')
    console.log(`  orderId: ${ORDER_ID}`)
    console.log(`  message bus: ${getMockBusFilePath()}`)
    console.log('')

    // ========== 1. 启动 Customs 流程 ==========
    console.log('[1/4] 启动 Customs 流程...')
    const customsResult = await startProcessInstance(CUSTOMS_PROCESS_ID, {
        orderId: ORDER_ID,
    })
    const customsKey = String(customsResult.processInstanceKey)
    console.log(`  Customs 流程已启动, processInstanceKey = ${customsKey}`)

    await sleep(1500)

    // ========== 2. 启动 Customs Broker 流程 ==========
    console.log('[2/4] 启动 Customs Broker 流程...')
    const cbResult = await startProcessInstance(CB_PROCESS_ID, {
        orderId: ORDER_ID,
    })
    const cbKey = String(cbResult.processInstanceKey)
    console.log(`  Customs Broker 流程已启动, processInstanceKey = ${cbKey}`)

    await sleep(500)

    // ========== 3. 启动 Container Terminal 流程 ==========
    console.log('[3/4] 启动 Container Terminal 流程...')
    const ctResult = await startProcessInstance(CT_PROCESS_ID, {
        orderId: ORDER_ID,
    })
    const ctKey = String(ctResult.processInstanceKey)
    console.log(`  Container Terminal 流程已启动, processInstanceKey = ${ctKey}`)

    await sleep(500)

    // ========== 4. 启动 Shipping Agency 流程 ==========
    console.log('[4/4] 启动 Shipping Agency 流程...')
    const saResult = await startProcessInstance(SA_PROCESS_ID, {
        orderId: ORDER_ID,
    })
    const saKey = String(saResult.processInstanceKey)
    console.log(`  Shipping Agency 流程已启动, processInstanceKey = ${saKey}`)

    // ========== 等待流程完成（通过消息总线观察） ==========
    console.log('\n================================================')
    console.log('  等待消息交互完成 (最多 60 秒)...')
    console.log('================================================\n')

    const startedAt = Date.now()
    const timeoutMs = 60000

    while (Date.now() - startedAt < timeoutMs) {
        const messages = readMockMessages()

        // 打印新消息
        const since = (Date.now() - startedAt) / 1000
        for (const msg of messages) {
            const arrow = msg.direction === 'environment-to-customs' ? '→' : '←'
            console.log(`  [${since.toFixed(1)}s] ${arrow} ${msg.businessName} (${msg.technicalName})`)
        }

        // 检测海关放行消息（表示流程接近完成）
        const clearanceMessages = messages.filter(
            (m) => m.businessName === 'customs-clearance'
        )

        if (clearanceMessages.length >= 1) {
            // 再等 3 秒让后续流程完成
            await sleep(3000)

            console.log('\n================================================')
            console.log('  最终状态摘要')
            console.log('================================================\n')

            const allMessages = readMockMessages()
            const sentCount = allMessages.filter((m) => m.direction === 'environment-to-customs').length
            const recvCount = allMessages.filter((m) => m.direction === 'customs-to-environment').length

            console.log(`  ✅ 环境 → 海关: ${sentCount} 条消息`)
            console.log(`  ✅ 海关 → 环境: ${recvCount} 条消息`)
            console.log(`  ✅ 总消息数: ${allMessages.length}`)
            console.log('')
            console.log('  流程实例:')
            console.log(`    - Customs:           ${customsKey}`)
            console.log(`    - Customs Broker:    ${cbKey}`)
            console.log(`    - Container Terminal: ${ctKey}`)
            console.log(`    - Shipping Agency:   ${saKey}`)
            console.log('')

            // 打印所有消息交互
            console.log('================================================')
            console.log('  消息交互记录')
            console.log('================================================')
            for (const msg of allMessages) {
                const arrow = msg.direction === 'environment-to-customs' ? 'ENV → CUSTOMS' : 'CUSTOMS → ENV'
                console.log(`  ${arrow} | ${msg.businessName}`)
                console.log(`    orderId: ${msg.orderId}, timestamp: ${msg.timestamp}`)
            }
            console.log('')
            console.log(`  详情见: ${getMockBusFilePath()}`)
            console.log('')

            return
        }

        await sleep(2000)
    }

    console.log('\n  ⚠️ 超时：未在 60 秒内检测到 customs-clearance 消息')
    console.log('  请检查 worker 终端输出排查问题')
    console.log('')
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

main().catch((error) => {
    console.error('运行失败:', error)
    process.exit(1)
})
