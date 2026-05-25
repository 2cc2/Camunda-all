"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_1 = require("@camunda8/sdk");
const config_1 = require("./config");
const workers_1 = require("./workers");
const bridge_1 = require("./rabbitmq/bridge");
async function main() {
    const client = new sdk_1.Camunda8({
        CAMUNDA_AUTH_STRATEGY: config_1.CAMUNDA_AUTH_STRATEGY,
        ZEEBE_REST_ADDRESS: config_1.CAMUNDA_REST_ADDRESS
    }).getCamundaRestClient();
    const bridge = new bridge_1.CamundaRabbitMQBridge();
    await bridge.connect();
    await bridge.start();
    const workers = (0, workers_1.startDepotContractWorkers)(client, bridge.publisher);
    const shutdown = async (signal) => {
        console.log(`\nShutting down Depot bridge on ${signal}...`);
        workers.sendEmptyCtnToTransportWorker.stop();
        workers.sendCtnArrivalInfoToSaWorker.stop();
        workers.sendOutboundCtnToCtWorker.stop();
        await bridge.close();
        const p = globalThis.process;
        if (p)
            p.exit(0);
    };
    process.once('SIGINT', () => {
        void shutdown('SIGINT');
    });
    process.once('SIGTERM', () => {
        void shutdown('SIGTERM');
    });
    console.log('Depot contract workers started with RabbitMQ bridge.');
    console.log(`REST endpoint: ${config_1.CAMUNDA_REST_ADDRESS}`);
    console.log('Workers registered:');
    console.log('  - send-empty-ctn-to-transport');
    console.log('  - send-ctn-arrival-info-to-sa');
    console.log('  - send-outbound-ctn-to-ct');
    console.log('Waiting for upstream RabbitMQ messages ask-for-ctn / outbound-ctn-to-depot...\n');
}
main().catch((error) => {
    console.error(error);
    const p = globalThis.process;
    if (p)
        p.exitCode = 1;
});
//# sourceMappingURL=index.js.map