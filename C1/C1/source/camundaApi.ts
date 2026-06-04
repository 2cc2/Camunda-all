import { CAMUNDA_REST_V2_BASE_URL, ORDER_ID } from './config'
import { JsonRecord } from './mockEnvironmentBus'

export type ProcessInstanceResponse = {
    processInstanceKey?: string | number
    state?: string
    [key: string]: unknown
}

export async function startProcessInstance(processDefinitionId: string, variables: JsonRecord) {
    const response = await fetch(`${CAMUNDA_REST_V2_BASE_URL}/process-instances`, {
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

export async function publishMessage(name: string, variables: JsonRecord, correlationKey: string = ORDER_ID) {
    const response = await fetch(`${CAMUNDA_REST_V2_BASE_URL}/messages/publication`, {
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
