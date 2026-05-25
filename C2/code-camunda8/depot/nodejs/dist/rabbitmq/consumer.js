"use strict";
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
    connection = null;
    channel = null;
    ready = false;
    async connect() {
        if (this.ready)
            return;
        this.connection = await amqp.connect(config_1.RABBITMQ_CONNECTION.url);
        this.channel = await this.connection.createChannel();
        await this.channel.prefetch(10);
        await this.channel.assertExchange(config_1.EXCHANGE.name, config_1.EXCHANGE.type, { durable: true });
        await this.channel.assertExchange(config_1.DLX_EXCHANGE.name, config_1.DLX_EXCHANGE.type, { durable: true });
        await this.channel.assertQueue(config_1.QUEUES.depotInbound, {
            durable: true,
            arguments: {
                'x-dead-letter-exchange': config_1.DLX_EXCHANGE.name,
                'x-dead-letter-routing-key': config_1.DLX_EXCHANGE.routingKey,
                'x-message-ttl': config_1.RETRY.messageTtlMs
            }
        });
        await this.channel.assertQueue(config_1.QUEUES.audit, { durable: true });
        await this.channel.assertQueue(config_1.QUEUES.deadLetter, { durable: true });
        this.ready = true;
    }
    async startConsuming() {
        if (!this.channel || !this.ready) {
            throw new Error('RabbitMQ consumer not connected');
        }
        await this.channel.consume(config_1.QUEUES.depotInbound, async (msg) => {
            if (!msg)
                return;
            try {
                const payload = JSON.parse(msg.content.toString());
                await this.forwardToCamunda(payload);
                this.channel?.ack(msg);
            }
            catch (error) {
                await this.handleFailure(msg, error);
            }
        }, { noAck: false });
        await this.channel.consume(config_1.QUEUES.audit, (msg) => {
            if (!msg)
                return;
            try {
                const payload = JSON.parse(msg.content.toString());
                console.log(`[audit] ${payload.camundaMessageName} key=${payload.correlationKey} source=${payload.source}`);
            }
            finally {
                this.channel?.ack(msg);
            }
        }, { noAck: false });
        await this.channel.consume(config_1.QUEUES.deadLetter, (msg) => {
            if (!msg)
                return;
            try {
                const payload = JSON.parse(msg.content.toString());
                console.error(`[dlq] ${payload.camundaMessageName} orderId=${payload.correlationKey} retries=${payload.retryCount}`);
            }
            catch {
                console.error(`[dlq] unreadable message ${msg.content.toString()}`);
            }
            finally {
                this.channel?.ack(msg);
            }
        }, { noAck: false });
    }
    async forwardToCamunda(message) {
        const response = await fetch(config_1.CAMUNDA_REST.publishUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: message.camundaMessageName,
                correlationKey: message.correlationKey,
                timeToLive: 600000,
                variables: message.variables
            })
        });
        if (!response.ok) {
            throw new Error(`Camunda REST ${response.status}: ${await response.text()}`);
        }
    }
    async handleFailure(msg, error) {
        if (!this.channel) {
            return;
        }
        let payload = null;
        try {
            payload = JSON.parse(msg.content.toString());
        }
        catch {
            payload = null;
        }
        if (!payload) {
            console.error('[rabbitmq-consumer] unreadable inbound message, sending to DLQ:', error);
            this.channel.nack(msg, false, false);
            return;
        }
        const nextRetryCount = (payload.retryCount ?? 0) + 1;
        const maxRetries = payload.maxRetries ?? config_1.RETRY.maxRetries;
        console.error(`[rabbitmq-consumer] failed orderId=${payload.correlationKey} message=${payload.camundaMessageName} retry=${nextRetryCount}/${maxRetries}:`, error);
        if (nextRetryCount <= maxRetries) {
            const retryPayload = {
                ...payload,
                retryCount: nextRetryCount,
                timestamp: new Date().toISOString()
            };
            this.channel.publish(config_1.EXCHANGE.name, msg.fields.routingKey, Buffer.from(JSON.stringify(retryPayload)), {
                persistent: true,
                contentType: 'application/json',
                headers: {
                    'x-retry-count': nextRetryCount
                }
            });
            this.channel.ack(msg);
            return;
        }
        this.channel.publish(config_1.DLX_EXCHANGE.name, config_1.DLX_EXCHANGE.routingKey, Buffer.from(JSON.stringify({ ...payload, retryCount: nextRetryCount })), {
            persistent: true,
            contentType: 'application/json'
        });
        this.channel.ack(msg);
    }
    async close() {
        if (this.channel) {
            await this.channel.close();
        }
        if (this.connection) {
            await this.connection.close();
        }
        this.channel = null;
        this.connection = null;
        this.ready = false;
    }
}
exports.RabbitMQConsumer = RabbitMQConsumer;
//# sourceMappingURL=consumer.js.map