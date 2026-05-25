"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CamundaRabbitMQBridge = void 0;
const consumer_1 = require("./consumer");
const publisher_1 = require("./publisher");
class CamundaRabbitMQBridge {
    publisher;
    consumer;
    constructor() {
        this.publisher = new publisher_1.RabbitMQPublisher();
        this.consumer = new consumer_1.RabbitMQConsumer();
    }
    async connect() {
        await this.publisher.connect();
        await this.consumer.connect();
    }
    async start() {
        await this.consumer.startConsuming();
    }
    async close() {
        await this.consumer.close();
        await this.publisher.close();
    }
}
exports.CamundaRabbitMQBridge = CamundaRabbitMQBridge;
//# sourceMappingURL=bridge.js.map