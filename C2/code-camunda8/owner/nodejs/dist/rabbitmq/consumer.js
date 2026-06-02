"use strict";
/**
 * RabbitMQ 消费者 (C2 Owner)
 *
 * 订阅 C2 专用队列，收到消息后通过 Camunda REST API 注入到 C2 BPMN。
 * 用于未来其他组修复后向 C2 发送消息的场景（如 C3 Transport 发送 ctn-to-owner）。
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
exports.RabbitMQConsumer = void 0;
const amqp = __importStar(require("amqplib"));
const config_1 = require("./config");
class RabbitMQConsumer {
    camundaClient;
    connection = null;
    channel = null;
    ready = false;
    consumerTag = null;
    constructor(camundaClient) {
        this.camundaClient = camundaClient;
    }
    async connect() {
        if (this.ready)
            return;
        try {
            this.connection = await amqp.connect(config_1.RABBITMQ_CONNECTION.url);
            this.channel = await this.connection.createChannel();
            await this.channel.assertExchange(config_1.EXCHANGE.NAME, config_1.EXCHANGE.TYPE, { durable: true });
            await this.channel.assertQueue(config_1.QUEUES.OWNER, { durable: true });
            await this.channel.bindQueue(config_1.QUEUES.OWNER, config_1.EXCHANGE.NAME, 'owner.#');
            await this.channel.assertQueue(config_1.QUEUES.OWNER_DEBUG, { durable: true });
            await this.channel.bindQueue(config_1.QUEUES.OWNER_DEBUG, config_1.EXCHANGE.NAME, 'owner.#');
            this.ready = true;
            console.log('[RabbitMQ Consumer] Connected, queue:', config_1.QUEUES.OWNER);
            console.log('[RabbitMQ Consumer] Debug queue bound:', config_1.QUEUES.OWNER_DEBUG);
        }
        catch (error) {
            console.error('[RabbitMQ Consumer] Connection failed:', error);
            throw error;
        }
    }
    async startConsuming() {
        if (!this.channel || !this.ready) {
            throw new Error('[RabbitMQ Consumer] Not connected, call connect() first');
        }
        const { consumerTag } = await this.channel.consume(config_1.QUEUES.OWNER, async (msg) => {
            if (!msg)
                return;
            try {
                const raw = msg.content.toString();
                const message = JSON.parse(raw);
                console.log(`[RabbitMQ Consumer] Received: ${message.camundaMessageName} (key=${message.correlationKey})`);
                const internalName = config_1.CAMUNDA_TO_INTERNAL_MESSAGE[message.camundaMessageName];
                if (!internalName) {
                    console.warn(`[RabbitMQ Consumer] Unknown camunda message name: ${message.camundaMessageName}`);
                    this.channel.nack(msg, false, false);
                    return;
                }
                await this.camundaClient.publishMessage({
                    name: internalName,
                    correlationKey: message.correlationKey,
                    variables: message.variables,
                    timeToLive: 600,
                });
                console.log(`[RabbitMQ Consumer] Forwarded to Camunda as: ${internalName}`);
                this.channel.ack(msg);
            }
            catch (error) {
                console.error('[RabbitMQ Consumer] Failed to process message:', error);
                this.channel.nack(msg, false, false);
            }
        });
        this.consumerTag = consumerTag;
        console.log('[RabbitMQ Consumer] Started consuming:', config_1.QUEUES.OWNER);
    }
    async close() {
        try {
            if (this.channel && this.consumerTag) {
                await this.channel.cancel(this.consumerTag);
            }
            if (this.channel)
                await this.channel.close();
            if (this.connection)
                await this.connection.close();
        }
        catch {
            // ignore
        }
        this.ready = false;
        this.consumerTag = null;
        this.connection = null;
        this.channel = null;
        console.log('[RabbitMQ Consumer] Connection closed');
    }
    isReady() {
        return this.ready;
    }
}
exports.RabbitMQConsumer = RabbitMQConsumer;
//# sourceMappingURL=consumer.js.map