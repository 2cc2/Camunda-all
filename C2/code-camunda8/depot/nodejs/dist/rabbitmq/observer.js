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
exports.RabbitMQOutboundObserver = void 0;
const amqp = __importStar(require("amqplib"));
const config_1 = require("./config");
class RabbitMQOutboundObserver {
    connection = null;
    channel = null;
    queueName = null;
    observed = [];
    started = false;
    async connect() {
        if (this.connection)
            return;
        this.connection = await amqp.connect(config_1.RABBITMQ_CONNECTION.url);
        this.channel = await this.connection.createChannel();
        await this.channel.assertExchange(config_1.EXCHANGE.name, config_1.EXCHANGE.type, { durable: true });
        const asserted = await this.channel.assertQueue('', {
            exclusive: true,
            autoDelete: true,
            arguments: {
                'x-expires': config_1.RETRY.observerQueueExpiresMs
            }
        });
        this.queueName = asserted.queue;
        await this.channel.bindQueue(asserted.queue, config_1.EXCHANGE.name, config_1.ROUTING_KEYS.transportEmptyCtnToTransport);
        await this.channel.bindQueue(asserted.queue, config_1.EXCHANGE.name, config_1.ROUTING_KEYS.shippingAgencyCtnArrivalInfoToSa);
        await this.channel.bindQueue(asserted.queue, config_1.EXCHANGE.name, config_1.ROUTING_KEYS.containerTerminalOutboundCtnToCt);
    }
    async start() {
        if (!this.channel) {
            throw new Error('Outbound observer not connected');
        }
        if (this.started)
            return;
        if (!this.queueName) {
            throw new Error('Outbound observer queue not ready');
        }
        await this.consumeQueue(this.queueName);
        this.started = true;
    }
    async consumeQueue(queue) {
        if (!this.channel) {
            throw new Error('Outbound observer channel not ready');
        }
        await this.channel.consume(queue, (msg) => {
            if (!msg)
                return;
            const raw = msg.content.toString();
            let payload = {};
            try {
                payload = JSON.parse(raw);
            }
            catch {
                payload = { parseError: true, raw };
            }
            this.observed.push({
                queue: this.describeRoutingKey(msg.fields.routingKey),
                raw,
                payload
            });
            this.channel?.ack(msg);
        }, { noAck: false });
    }
    describeRoutingKey(routingKey) {
        switch (routingKey) {
            case config_1.ROUTING_KEYS.transportEmptyCtnToTransport:
                return 'Transport';
            case config_1.ROUTING_KEYS.shippingAgencyCtnArrivalInfoToSa:
                return 'Shipping Agency';
            case config_1.ROUTING_KEYS.containerTerminalOutboundCtnToCt:
                return 'Container Terminal';
            default:
                return routingKey;
        }
    }
    async waitForMessages(expectedCount, timeoutMs = 10000) {
        const startedAt = Date.now();
        while (Date.now() - startedAt < timeoutMs) {
            if (this.observed.length >= expectedCount) {
                return [...this.observed];
            }
            await new Promise((resolve) => setTimeout(resolve, 200));
        }
        throw new Error(`Timed out waiting for ${expectedCount} outbound messages. Got ${this.observed.length}.`);
    }
    getObservedMessages() {
        return [...this.observed];
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
        this.queueName = null;
        this.started = false;
    }
}
exports.RabbitMQOutboundObserver = RabbitMQOutboundObserver;
//# sourceMappingURL=observer.js.map