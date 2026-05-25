"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
async function checkHttp(name, url) {
    try {
        const response = await fetch(url, { method: 'GET' });
        console.log(`[OK] ${name}: ${url} -> HTTP ${response.status}`);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(`[FAIL] ${name}: ${url} -> ${message}`);
    }
}
async function main() {
    const rabbitManagementUrl = 'http://localhost:15672';
    const rabbitAmqp = process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672';
    console.log('Checking local Depot runtime environment...\n');
    await checkHttp('Camunda REST', config_1.CAMUNDA_REST_ADDRESS);
    await checkHttp('RabbitMQ Management', rabbitManagementUrl);
    console.log(`\nConfigured gRPC address: ${config_1.CAMUNDA_GRPC_ADDRESS}`);
    console.log(`Configured AMQP address: ${rabbitAmqp}`);
    console.log('\nIf RabbitMQ Management fails, start the Windows RabbitMQ service and enable rabbitmq_management.');
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
//# sourceMappingURL=check-env.js.map