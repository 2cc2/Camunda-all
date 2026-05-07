/**
 * sendFFMsg.ts —— 给 Freight Forwarder (FF) 流程发送消息
 *
 * Freight-Forward.bpmn 里 FF 流程的启动是 Message Start Event,
 * 监听 Message_Owner_order_received 消息,所以发第 1 条消息会自动建实例。
 *
 * 三个消息接收点(按 Freight-Forward.bpmn 的流程顺序):
 *   1. Message Start "order received"                    -> 启动 FF 流程实例
 *   2. Intermediate Catch "Manifest received"            -> 收到船代的舱单
 *   3. Intermediate Catch "SA Equipment Receipt received"-> 收到船代的 EIR
 *
 * 用法: npx ts-node sendFFMsg.ts
 */

const ORDER_ID = 'ORDER-20260420-001'
const BASE_URL = 'http://localhost:8080'

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
        throw new Error(`发送失败 [${name}]: ${JSON.stringify(json)}`)
    }
    return json
}

async function main() {
    try {
        // ============ 第 1 条: 启动 FF 流程 ============
        // Message Start Event,Camunda 会新建一个 FF 流程实例。
        // 注意:消息名里的 order 是小写(BPMN 里写的就是 Message_Owner_order_received)
        console.log('⏳ [1/3] 发送 Owner Order to FFW (启动 FF 流程)...')
        await publishMessage('Message_Owner_order_received', {
            orderId:      ORDER_ID,
            shipperName:  'ACME Trading Co., Ltd.',
            consignee:    'Global Buyer Inc.',
            pol:          'CNSHA',   // Port of Loading
            pod:          'USLAX',   // Port of Discharge
            commodity:    'Electronics',
            quantity:     1,
            ctnType:      '40HQ',
        })
        console.log('✅ FF 流程已启动,SA / CB 两个分支并行执行中...')

        // 给 FF 里两个并行 ServiceTask 一点处理时间
        await sleep(2500)

        // ============ 第 2 条: 舱单(Manifest)送达 FF ============
        console.log('⏳ [2/3] 发送 FF Manifest received...')
        await publishMessage('Message_FF_Manifest_received', {
            manifestId:   'MNF-FF-20260420-001',
            shipName:     'MSC OSCAR',
            voyageNumber: 'V0428E',
            issuedBy:     'SA-MAERSK-01',
        })
        console.log('✅ FF 已收到舱单,继续等待 SA Equipment Receipt...')

        await sleep(500)

        // ============ 第 3 条: 船代下发 EIR ============
        // 这条之后,FF 会执行 "send Equipment Receipt to Transport" ServiceTask。
        console.log('⏳ [3/3] 发送 SA Equipment Receipt received...')
        await publishMessage('Message_SA_Equipment_Receipt_received', {
            receiptId:    'EIR-MSK-992384',
            depotId:      'DEPOT-BAOSHAN-01',
            pickupDepot:  'DEPOT-BAOSHAN-01',
            ctnType:      '40HQ',
            ctnQuantity:  1,
            validUntil:   '2026-04-25T18:00:00Z',
        })
        console.log('✅ EIR 已送达 FF')

        console.log('\n🎉 FF 流程的三条消息全部发送完毕!')
    } catch (error) {
        console.error('❌ 错误:', error)
    }
}

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms))
}

main()
