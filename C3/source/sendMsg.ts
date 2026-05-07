/**
 * sendMsg.ts —— 给 Transport 流程发消息
 *
 * Transport.bpmn 里 Transport 流程是 None Start Event(空启动),
 * 部署后不会自动启动,必须显式创建一个流程实例。
 * 此脚本做两件事:
 *   1. 调 REST API 启动一个 Transport 流程实例(传入 orderId 作为 correlation key)
 *   2. 顺序发送三条消息推动流程往下走
 *
 * 用法: npx ts-node sendMsg.ts
 */

const ORDER_ID = 'ORDER-20260420-001'
const BASE_URL = 'http://localhost:8080'

// Transport.bpmn 里 <bpmn:process id="..."> 的值
const TRANSPORT_PROCESS_ID = 'Process_1v0gn15'

async function startProcessInstance(
    processDefinitionId: string,
    variables: Record<string, unknown>,
) {
    const response = await fetch(`${BASE_URL}/v2/process-instances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            processDefinitionId,
            variables,
        }),
    })

    const json = await response.json()
    if (!response.ok) {
        throw new Error(`启动流程失败: ${JSON.stringify(json)}`)
    }
    return json
}

async function publishMessage(
    name: string,
    variables: Record<string, unknown>,
    correlationKey: string = ORDER_ID,
) {
    const response = await fetch(`${BASE_URL}/v2/messages/publication`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name,
            correlationKey,
            timeToLive: 300000,
            variables,
        }),
    })

    const json = await response.json()
    if (!response.ok) {
        throw new Error(`发送消息失败 [${name}]: ${JSON.stringify(json)}`)
    }
    return json
}

async function main() {
    try {
        // ============ 第 0 步: 启动 Transport 流程实例 ============
        console.log('⏳ [0/3] 启动 Transport 流程实例(传入 orderId 作为 correlation key)...')
        const startResult = await startProcessInstance(TRANSPORT_PROCESS_ID, {
            orderId: ORDER_ID,
        })
        console.log(`✅ Transport 流程实例已创建,instanceKey = ${startResult.processInstanceKey}`)

        // 给流程一点时间进入到并行的 catch event 状态
        await sleep(1000)

        // ============ 第 1 条: FF Equipment Receipt 送达 Transport ============
        console.log('⏳ [1/3] 发送 FF Equipment Receipt to Transport...')
        await publishMessage('Message_FF_Equipment_Receipt_received', {
            receiptId: 'EIR-MSK-992384',
            pickupDepot: 'DEPOT-BAOSHAN-01',
        })
        console.log('✅ 第 1 条消息发送成功!')

        // ============ 第 2 条: 空箱(Empty CTN)送达 Transport ============
        console.log('⏳ [2/3] 发送 Empty CTN to Transport...')
        await publishMessage('Message_Transport_empty_CTN_received', {
            ctnNumber: 'CTN-884821',
        })
        console.log('✅ 第 2 条消息发送成功!')

        // 此时 Transport 流程会跑 ServiceTask "provide CTN to Owner"(派箱),
        // 等一下让 worker 完成这步
        await sleep(2000)

        // ============ 第 3 条: 出口重箱送达 Transport ============
        console.log('⏳ [3/3] 发送 Outbound CTN to Transport...')
        await publishMessage('Message_Owner_Outbound_CTN_received', {
            ctnNumber: 'CTN-884821',
        })
        console.log('✅ 第 3 条消息发送成功!')

        console.log('\n🎉 三条消息全部发送完毕!Transport 流程应当走完。')
    } catch (error) {
        console.error('❌ 错误:', error)
    }
}

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms))
}

main()
