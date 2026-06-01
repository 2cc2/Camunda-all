"use strict";
/**
 * Outbound Message Adapter
 *
 * 统一出口消息发送逻辑：
 *   - 发往 C3 的消息 → RabbitMQ
 *   - 其他消息（mock/C5）→ Camunda REST
 *
 * C2 内部始终使用 lower-case-with-hyphens，adapter 负责映射到外部格式。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOutboundMessage = sendOutboundMessage;
const config_1 = require("./rabbitmq/config");
/**
 * 发送外部消息
 *
 * @param rabbitPublisher RabbitMQ 发布器（用于 C3）
 * @param client Camunda REST 客户端（用于 fallback）
 * @param internalMessageName C2 内部消息名
 * @param correlationKey 关联键
 * @param variables 流程变量
 */
async function sendOutboundMessage(rabbitPublisher, client, internalMessageName, correlationKey, variables, timeToLive) {
    const mapping = config_1.MESSAGE_MAPPING[internalMessageName];
    if (mapping && rabbitPublisher?.isReady()) {
        // 发往 C3：使用 RabbitMQ
        await rabbitPublisher.publish(internalMessageName, correlationKey, variables);
        console.log(`[OutboundAdapter] Sent via RabbitMQ: ${internalMessageName} -> ${mapping.camundaName}`);
    }
    else {
        // 其他：使用 Camunda REST（兼容现有 mock/C5）
        await client.publishMessage({
            name: internalMessageName,
            correlationKey,
            variables: variables,
            timeToLive: timeToLive ?? 600,
        });
        console.log(`[OutboundAdapter] Sent via REST: ${internalMessageName}`);
    }
}
//# sourceMappingURL=outbound-adapter.js.map