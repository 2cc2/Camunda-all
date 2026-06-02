"use strict";
/**
 * RabbitMQ 消息发布器 (C2 Owner)
 *
 * 将 C2 的内部消息通过 RabbitMQ 发布到 C3 组。
 * 与 C3 的 RabbitMQ 拓扑兼容：exchange 'camunda.events' (topic)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RabbitMQPublisher = void 0;
const amqp = __importStar(require("amqplib"));
const config_1 = require("./config");
class RabbitMQPublisher {
    connection = null;
    channel = null;
    ready = false;
    async connect() {
        if (this.ready)
            return;
        try {
            this.connection = await amqp.connect(config_1.RABBITMQ_CONNECTION.url);
            this.channel = await this.connection.createChannel();
            await this.channel.assertExchange(config_1.EXCHANGE.NAME, config_1.EXCHANGE.TYPE, { durable: true });
            this.ready = true;
            console.log('[RabbitMQ Publisher] Connected to exchange:', config_1.EXCHANGE.NAME);
        }
        catch (error) {
            console.error('[RabbitMQ Publisher] Connection failed:', error);
            throw error;
        }
    }
    /**
     * 发布消息到 RabbitMQ
     *
     * @param internalMessageName C2 内部消息名 (如 'order-to-ffw')
     * @param correlationKey 关联键 (orderId)
     * @param variables 流程变量
     */
    async publish(internalMessageName, correlationKey, variables) {
        if (!this.channel || !this.ready) {
            throw new Error('[RabbitMQ Publisher] Not connected, call connect() first');
        }
        const mapping = config_1.MESSAGE_MAPPING[internalMessageName];
        if (!mapping) {
            throw new Error(`[RabbitMQ Publisher] Unknown internal message name: ${internalMessageName}`);
        }
        const message = (0, config_1.createMessage)({
            camundaMessageName: mapping.camundaName,
            correlationKey,
            variables,
            source: 'c2-owner',
        });
        const buffer = Buffer.from(JSON.stringify(message));
        const result = this.channel.publish(config_1.EXCHANGE.NAME, mapping.routingKey, buffer, {
            persistent: true,
            contentType: 'application/json',
            contentEncoding: 'utf-8',
        });
        if (result) {
            console.log(`[RabbitMQ] Published [${mapping.routingKey}] -> ${mapping.camundaName} (key=${correlationKey})`);
        }
        else {
            console.warn(`[RabbitMQ] Publish buffer full [${mapping.routingKey}]`);
        }
        return result;
    }
    async publishCamundaMessage(params) {
        if (!this.channel || !this.ready) {
            throw new Error('[RabbitMQ Publisher] Not connected, call connect() first');
        }
        const message = (0, config_1.createMessage)({
            camundaMessageName: params.camundaMessageName,
            correlationKey: params.correlationKey,
            variables: params.variables,
            source: params.source || 'c2-owner-mock',
        });
        const buffer = Buffer.from(JSON.stringify(message));
        const result = this.channel.publish(config_1.EXCHANGE.NAME, params.routingKey, buffer, {
            persistent: true,
            contentType: 'application/json',
            contentEncoding: 'utf-8',
        });
        if (result) {
            console.log(`[RabbitMQ] Published [${params.routingKey}] -> ${params.camundaMessageName} (key=${params.correlationKey})`);
        }
        else {
            console.warn(`[RabbitMQ] Publish buffer full [${params.routingKey}]`);
        }
        return result;
    }
    async close() {
        try {
            if (this.channel)
                await this.channel.close();
            if (this.connection)
                await this.connection.close();
        }
        catch {
            // ignore
        }
        this.ready = false;
        this.connection = null;
        this.channel = null;
        console.log('[RabbitMQ Publisher] Connection closed');
    }
    isReady() {
        return this.ready;
    }
}
exports.RabbitMQPublisher = RabbitMQPublisher;
//# sourceMappingURL=publisher.js.map