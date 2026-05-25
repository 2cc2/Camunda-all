/**
 * sendMsg.ts —— Transport 流程消息发送脚本 (RabbitMQ 版)
 *
 * 用途：发送 Transport 流程相关的消息到 RabbitMQ
 * 用法：npx ts-node sendMsg.ts
 *
 * 消息流：
 *   此脚本 -> RabbitMQ Exchange -> Queue -> Consumer -> Camunda REST API
 */

import { initPublisher, closePublisher, sendOwnerMessages } from './messages'

async function main() {
    try {
        await initPublisher()
        await sendOwnerMessages()
    } catch (error) {
        console.error('❌ 错误:', error)
        process.exit(1)
    } finally {
        await closePublisher()
    }
}

main()
