import { startProcessInstance } from './camundaApi'
import { CUSTOMS_PROCESS_ID, CB_PROCESS_ID, CT_PROCESS_ID, SA_PROCESS_ID, ORDER_ID } from './config'
import { getMockBusFilePath, resetMockBus, readMockMessages } from './mockEnvironmentBus'

export type RunCustomsSummary = {
    orderId: string
    processInstanceKeys: {
        customs: string
        customsBroker: string
        containerTerminal: string
        shippingAgency: string
    }
    messages: ReturnType<typeof readMockMessages>
    durationMs: number
}

type RunCustomsOptions = {
    orderId?: string
    timeoutMs?: number
    resetBus?: boolean
    printProgress?: boolean
}

export async function runCustomsFlow(options: RunCustomsOptions = {}): Promise<RunCustomsSummary> {
    const orderId = options.orderId ?? ORDER_ID
    const timeoutMs = options.timeoutMs ?? 60000
    const resetBus = options.resetBus ?? true
    const printProgress = options.printProgress ?? true

    if (resetBus) {
        resetMockBus()
    }

    if (printProgress) {
        console.log('================================================')
        console.log('  启动多参与者真实数据交互')
        console.log('================================================')
        console.log(`  orderId: ${orderId}`)
        console.log(`  message bus: ${getMockBusFilePath()}`)
        console.log('')
    }

    // ========== 1. 启动 Customs 流程 ==========
    if (printProgress) console.log('[1/4] 启动 Customs 流程...')
    const customsResult = await startProcessInstance(CUSTOMS_PROCESS_ID, {
        orderId,
    })
    const customsKey = String(customsResult.processInstanceKey)
    if (printProgress) console.log(`  Customs 流程已启动, processInstanceKey = ${customsKey}`)

    await sleep(1500)

    // ========== 2. 启动 Customs Broker 流程 ==========
    if (printProgress) console.log('[2/4] 启动 Customs Broker 流程...')
    const cbResult = await startProcessInstance(CB_PROCESS_ID, {
        orderId,
    })
    const cbKey = String(cbResult.processInstanceKey)
    if (printProgress) console.log(`  Customs Broker 流程已启动, processInstanceKey = ${cbKey}`)

    await sleep(500)

    // ========== 3. 启动 Container Terminal 流程 ==========
    if (printProgress) console.log('[3/4] 启动 Container Terminal 流程...')
    const ctResult = await startProcessInstance(CT_PROCESS_ID, {
        orderId,
    })
    const ctKey = String(ctResult.processInstanceKey)
    if (printProgress) console.log(`  Container Terminal 流程已启动, processInstanceKey = ${ctKey}`)

    await sleep(500)

    // ========== 4. 启动 Shipping Agency 流程 ==========
    if (printProgress) console.log('[4/4] 启动 Shipping Agency 流程...')
    const saResult = await startProcessInstance(SA_PROCESS_ID, {
        orderId,
    })
    const saKey = String(saResult.processInstanceKey)
    if (printProgress) console.log(`  Shipping Agency 流程已启动, processInstanceKey = ${saKey}`)

    // ========== 等待流程完成（通过消息总线观察） ==========
    if (printProgress) {
        console.log('\n================================================')
        console.log(`  等待消息交互完成 (最多 ${(timeoutMs / 1000).toFixed(0)} 秒)...`)
        console.log('================================================\n')
    }

    const startedAt = Date.now()
    let cursor = 0

    while (Date.now() - startedAt < timeoutMs) {
        const messages = readMockMessages()

        // 打印新消息
        const unseenMessages = messages.slice(cursor)
        for (const msg of unseenMessages) {
            cursor += 1
            if (printProgress) {
                const since = (new Date(msg.timestamp).getTime() - startedAt) / 1000
                const arrow = msg.direction === 'environment-to-customs' ? '→' : '←'
                console.log(`  [${since.toFixed(1)}s] ${arrow} ${msg.businessName} (${msg.technicalName})`)
            }
        }

        // 检测海关放行消息（表示流程接近完成）
        const clearanceMessages = messages.filter(
            (m) => m.businessName === 'customs-clearance'
        )

        if (clearanceMessages.length >= 1) {
            // 再等 3 秒让后续流程完成
            await sleep(3000)

            const allMessages = readMockMessages()
            const sentCount = allMessages.filter((m) => m.direction === 'environment-to-customs').length
            const recvCount = allMessages.filter((m) => m.direction === 'customs-to-environment').length

            if (printProgress) {
                console.log('\n================================================')
                console.log('  最终状态摘要')
                console.log('================================================\n')

                console.log(`  ✅ 环境 → 海关: ${sentCount} 条消息`)
                console.log(`  ✅ 海关 → 环境: ${recvCount} 条消息`)
                console.log(`  ✅ 总消息数: ${allMessages.length}`)
                console.log('')
                console.log('  流程实例:')
                console.log(`    - Customs:            ${customsKey}`)
                console.log(`    - Customs Broker:     ${cbKey}`)
                console.log(`    - Container Terminal: ${ctKey}`)
                console.log(`    - Shipping Agency:    ${saKey}`)
                console.log('')
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
            }

            return {
                orderId,
                processInstanceKeys: {
                    customs: customsKey,
                    customsBroker: cbKey,
                    containerTerminal: ctKey,
                    shippingAgency: saKey,
                },
                messages: allMessages,
                durationMs: Date.now() - startedAt,
            }
        }

        await sleep(1000)
    }

    if (printProgress) {
        console.log(`\n  ⚠️ 超时：未在 ${(timeoutMs / 1000).toFixed(0)} 秒内检测到 customs-clearance 消息`)
        console.log('  请检查 worker 或 bridge 输出排查问题')
        console.log('')
    }
    throw new Error(`未在 ${timeoutMs}ms 内检测到 customs-clearance 消息`)
}

async function main() {
    await runCustomsFlow()
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

main().catch((error) => {
    console.error('运行失败:', error)
    process.exit(1)
})
