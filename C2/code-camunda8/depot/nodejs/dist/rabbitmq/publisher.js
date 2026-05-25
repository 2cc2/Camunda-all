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
        this.connection = await amqp.connect(config_1.RABBITMQ_CONNECTION.url);
        this.channel = await this.connection.createChannel();
        await this.channel.assertExchange(config_1.EXCHANGE.name, config_1.EXCHANGE.type, { durable: true });
        await this.channel.assertExchange(config_1.DLX_EXCHANGE.name, config_1.DLX_EXCHANGE.type, { durable: true });
        const queueArgs = {
            'x-dead-letter-exchange': config_1.DLX_EXCHANGE.name,
            'x-dead-letter-routing-key': config_1.DLX_EXCHANGE.routingKey,
            'x-message-ttl': config_1.RETRY.messageTtlMs
        };
        await this.channel.assertQueue(config_1.QUEUES.depotInbound, { durable: true, arguments: queueArgs });
        await this.channel.assertQueue(config_1.QUEUES.transportInbound, { durable: true, arguments: queueArgs });
        await this.channel.assertQueue(config_1.QUEUES.shippingAgencyInbound, { durable: true, arguments: queueArgs });
        await this.channel.assertQueue(config_1.QUEUES.containerTerminalInbound, { durable: true, arguments: queueArgs });
        await this.channel.assertQueue(config_1.QUEUES.audit, { durable: true });
        await this.channel.assertQueue(config_1.QUEUES.deadLetter, { durable: true });
        for (const binding of config_1.BINDINGS) {
            await this.channel.bindQueue(binding.queue, config_1.EXCHANGE.name, binding.routingKey);
        }
        await this.channel.bindQueue(config_1.QUEUES.deadLetter, config_1.DLX_EXCHANGE.name, config_1.DLX_EXCHANGE.routingKey);
        this.ready = true;
    }
    async publishMessage(camundaMessageName, correlationKey, variables) {
        if (!this.channel || !this.ready) {
            throw new Error('RabbitMQ publisher not connected');
        }
        const routingKey = config_1.MESSAGE_NAME_TO_ROUTING_KEY[camundaMessageName];
        if (!routingKey) {
            throw new Error(`No RabbitMQ routing key mapping for message: ${camundaMessageName}`);
        }
        const message = (0, config_1.createRabbitMessage)({
            camundaMessageName,
            correlationKey,
            variables
        });
        this.channel.publish(config_1.EXCHANGE.name, routingKey, Buffer.from(JSON.stringify(message)), {
            persistent: true,
            contentType: 'application/json'
        });
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
exports.RabbitMQPublisher = RabbitMQPublisher;
//# sourceMappingURL=publisher.js.map