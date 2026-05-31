import fs from 'node:fs'
import path from 'node:path'

export type JsonRecord = Record<string, unknown>

export type MockEnvironmentMessage = {
    direction: 'customs-to-environment' | 'environment-to-customs'
    technicalName: string
    businessName: string
    orderId: string
    payload: JsonRecord
    timestamp: string
}

const BUS_FILE_PATH = path.resolve(__dirname, '..', '.mock-environment-bus.jsonl')

export function getMockBusFilePath() {
    return BUS_FILE_PATH
}

export function resetMockBus() {
    fs.writeFileSync(BUS_FILE_PATH, '', 'utf8')
}

export function appendMockMessage(message: MockEnvironmentMessage) {
    const line = `${JSON.stringify(message)}\n`
    fs.appendFileSync(BUS_FILE_PATH, line, 'utf8')
}

export function readMockMessages() {
    if (!fs.existsSync(BUS_FILE_PATH)) {
        return [] as MockEnvironmentMessage[]
    }

    const content = fs.readFileSync(BUS_FILE_PATH, 'utf8').trim()
    if (!content) {
        return [] as MockEnvironmentMessage[]
    }

    return content
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as MockEnvironmentMessage)
}

export async function waitForMockMessage(
    predicate: (message: MockEnvironmentMessage) => boolean,
    timeoutMs: number,
    pollIntervalMs: number = 1000,
) {
    const startedAt = Date.now()
    let cursor = 0

    while (Date.now() - startedAt < timeoutMs) {
        const messages = readMockMessages()
        const unseenMessages = messages.slice(cursor)

        for (const message of unseenMessages) {
            cursor += 1
            if (predicate(message)) {
                return message
            }
        }

        await sleep(pollIntervalMs)
    }

    throw new Error(`在 ${timeoutMs}ms 内未等到符合条件的 mock environment 消息`)
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}
