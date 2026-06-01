/**
 * Outbound Message Adapter
 *
 * 统一出口消息发送逻辑：
 *   - 发往 C3 的消息 → RabbitMQ
 *   - 其他消息（mock/C5）→ Camunda REST
 *
 * C2 内部始终使用 lower-case-with-hyphens，adapter 负责映射到外部格式。
 */
import { CamundaRestClient } from '@camunda8/sdk';
import { RabbitMQPublisher } from './rabbitmq/publisher';
/**
 * 发送外部消息
 *
 * @param rabbitPublisher RabbitMQ 发布器（用于 C3）
 * @param client Camunda REST 客户端（用于 fallback）
 * @param internalMessageName C2 内部消息名
 * @param correlationKey 关联键
 * @param variables 流程变量
 */
export declare function sendOutboundMessage(rabbitPublisher: RabbitMQPublisher | null | undefined, client: CamundaRestClient, internalMessageName: string, correlationKey: string, variables: Record<string, unknown>, timeToLive?: number): Promise<void>;
//# sourceMappingURL=outbound-adapter.d.ts.map