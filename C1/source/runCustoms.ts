import { BASE_URL, CUSTOMS_PROCESS_ID, MESSAGE_NAMES, ORDER_ID } from './config'

type JsonRecord = Record<string, unknown>
type ProcessInstanceResponse = {
    processInstanceKey?: string | number
    state?: string
    [key: string]: unknown
}

async function startProcessInstance(processDefinitionId: string, variables: JsonRecord) {
    const response = await fetch(`${BASE_URL}/v2/process-instances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            processDefinitionId,
            variables,
        }),
    })

    const json = (await response.json()) as ProcessInstanceResponse
    if (!response.ok) {
        throw new Error(`启动流程失败: ${JSON.stringify(json)}`)
    }
    return json
}

async function publishMessage(name: string, variables: JsonRecord, correlationKey: string = ORDER_ID) {
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

async function getProcessInstance(processInstanceKey: string) {
    const response = await fetch(`${BASE_URL}/v2/process-instances/${processInstanceKey}`)
    const json = (await response.json()) as ProcessInstanceResponse

    if (!response.ok) {
        throw new Error(`查询流程实例失败: ${JSON.stringify(json)}`)
    }
    return json
}

async function waitForState(processInstanceKey: string, expectedState: string, timeoutMs: number) {
    const startedAt = Date.now()

    while (Date.now() - startedAt < timeoutMs) {
        const instance = await getProcessInstance(processInstanceKey)
        const state = String(instance.state ?? 'UNKNOWN')

        console.log(`当前流程状态: ${state}`)

        if (state === expectedState) {
            return instance
        }

        await sleep(1500)
    }

    throw new Error(`在 ${timeoutMs}ms 内未等到状态 ${expectedState}`)
}

async function main() {
    console.log(`准备启动 Customs 流程，orderId = ${ORDER_ID}`)

    const startResult = await startProcessInstance(CUSTOMS_PROCESS_ID, {
        orderId: ORDER_ID,
    })

    const processInstanceKey = String(startResult.processInstanceKey)
    console.log(`已创建流程实例，processInstanceKey = ${processInstanceKey}`)

    await sleep(1200)

    console.log('\n[1/4] 发送 declaration received')
    await publishMessage(MESSAGE_NAMES.declarationReceived, {
        orderId: ORDER_ID,
        declarationId: 'DECL-20260508-001',
        senderId: 'CUSTOMS-BROKER-05',
        declaredValue: 25000,
        currency: 'USD',
        quantity: 500,
    })

    console.log('[2/4] 发送 manifest received')
    await publishMessage(MESSAGE_NAMES.manifestReceived, {
        orderId: ORDER_ID,
        manifestId: 'MNF-20260508-001',
        senderId: 'CUSTOMS-BROKER-05',
        vesselId: 'VESSEL-042',
    })

    console.log('[3/4] 发送 CTN and ship arrive')
    await publishMessage(MESSAGE_NAMES.ctnAndShipArrive, {
        orderId: ORDER_ID,
        vesselId: 'VESSEL-042',
        containerId: 'MSKU1234567',
        arrivalTime: '2026-05-08T10:00:00Z',
    })

    // 必须等待 declareSuccess worker 执行完，流程才能走到 Appointment received。
    await sleep(2500)

    console.log('[4/4] 发送 appointment received')
    await publishMessage(MESSAGE_NAMES.appointmentReceived, {
        orderId: ORDER_ID,
        appointmentId: 'APT-20260508-001',
        appointmentTime: '2026-05-09T09:00:00Z',
        inspectionLocation: 'Shanghai Yangshan Inspection Area',
        contactPerson: 'Li Ming',
        contactPhone: '+86-21-12345678',
    })

    console.log('\n所有外部消息发送完成，等待流程实例结束...')
    const completedInstance = await waitForState(processInstanceKey, 'COMPLETED', 30000)

    console.log('\n流程已完成。最终状态摘要:')
    console.log(JSON.stringify(completedInstance, null, 2))
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

main().catch((error) => {
    console.error('运行失败:', error)
    process.exit(1)
})
