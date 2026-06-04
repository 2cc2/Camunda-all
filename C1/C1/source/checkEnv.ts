import { BASE_URL, RABBITMQ_MANAGEMENT_URL, ZEEBE_GRPC_ADDRESS } from './config'

type CheckResult = {
    ok: boolean
    status: number | null
    url: string
    error?: string
}

async function checkHttp(url: string): Promise<CheckResult> {
    try {
        const response = await fetch(url, { method: 'GET' })
        return {
            ok: response.ok || response.status === 401,
            status: response.status,
            url,
        }
    } catch (error) {
        return {
            ok: false,
            status: null,
            url,
            error: error instanceof Error ? error.message : String(error),
        }
    }
}

export async function verifyEnvironment() {
    const camunda = await checkHttp(`${BASE_URL}/v2/topology`)
    const rabbitmq = await checkHttp(RABBITMQ_MANAGEMENT_URL)
    return { camunda, rabbitmq }
}

export async function assertEnvironmentReady() {
    const result = await verifyEnvironment()

    if (!result.camunda.ok) {
        throw new Error(
            `Camunda REST 不可达: ${result.camunda.url}${result.camunda.error ? ` (${result.camunda.error})` : ''}`
        )
    }

    if (!result.rabbitmq.ok) {
        throw new Error(
            `RabbitMQ 管理页面不可达: ${result.rabbitmq.url}${result.rabbitmq.error ? ` (${result.rabbitmq.error})` : ''}`
        )
    }

    return result
}

async function main() {
    console.log('=== C1 运行环境检查 ===\n')
    const result = await verifyEnvironment()

    printResult('Camunda REST', result.camunda)
    printResult('RabbitMQ Management', result.rabbitmq)
    console.log(`Configured Zeebe gRPC: ${ZEEBE_GRPC_ADDRESS}`)
}

function printResult(name: string, result: CheckResult) {
    if (result.ok) {
        console.log(`[OK]   ${name}: ${result.url} -> HTTP ${result.status}`)
        return
    }

    console.log(`[FAIL] ${name}: ${result.url} -> ${result.error ?? `HTTP ${result.status}`}`)
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
