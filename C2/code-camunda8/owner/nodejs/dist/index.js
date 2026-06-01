"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_1 = require("@camunda8/sdk");
const config_1 = require("./config");
const workers_1 = require("./workers");
const publisher_1 = require("./rabbitmq/publisher");
async function main() {
    const client = new sdk_1.Camunda8({
        CAMUNDA_AUTH_STRATEGY: config_1.CAMUNDA_AUTH_STRATEGY,
        ZEEBE_REST_ADDRESS: config_1.CAMUNDA_REST_ADDRESS
    }).getCamundaRestClient();
    const rabbitPublisher = new publisher_1.RabbitMQPublisher();
    await rabbitPublisher.connect();
    const workers = (0, workers_1.startOwnerContractWorkers)(client, rabbitPublisher);
    console.log('Owner contract workers started.');
    console.log(`REST endpoint: ${config_1.CAMUNDA_REST_ADDRESS}`);
    console.log(`RabbitMQ publisher: ${rabbitPublisher.isReady() ? 'connected' : 'disconnected'}`);
    console.log('Workers registered:');
    console.log('  - fill-out-certificate-of-entrustment');
    console.log('  - handle-order');
    console.log('  - send-order-to-ffw (RabbitMQ -> C3 FFW)');
    console.log('  - send-outbound-ctn-to-transport (RabbitMQ -> C3 Transport)');
    console.log('  - payment');
    console.log('Waiting for jobs...\n');
    // Graceful shutdown
    const shutdown = async () => {
        console.log('\nShutting down...');
        workers.fillCertificateWorker.stop();
        workers.handleOrderWorker.stop();
        workers.sendOrderToFfwWorker.stop();
        workers.sendOutboundCtnToTransportWorker.stop();
        workers.paymentWorker.stop();
        await rabbitPublisher.close();
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map