/**
 * sendFFMsg.ts —— Freight Forwarder (FF) 流程消息发送脚本 (RabbitMQ 版)
 *
 * 用途：发送 FF 流程相关的消息到 RabbitMQ
 * 用法：npx ts-node sendFFMsg.ts
 *
 * 消息流：
 *   此脚本 -> RabbitMQ Exchange -> Queue -> Consumer -> Camunda REST API
 */

import { initPublisher, closePublisher, sendFFMessages } from './messages'

async function main() {
    try {
        await initPublisher()
        await sendFFMessages()
    } catch (error) {
        console.error('❌ 错误:', error)
        process.exit(1)
    } finally {
        await closePublisher()
    }
}

main()
