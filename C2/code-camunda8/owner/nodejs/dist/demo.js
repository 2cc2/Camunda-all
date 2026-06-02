"use strict";
/**
 * Owner contract demo / mock test runner.
 *
 * Usage:
 *   CAMUNDA_REST_ADDRESS=http://localhost:8080 npx ts-node source/demo.ts --orderId=ORDER-20260427-001 --mockInbound=true --useRabbitmq=true
 *
 * What it does:
 * 1. Deploys owner.bpmn to Camunda 8
 * 2. Starts a process instance with the given orderId
 * 3. Optionally mocks inbound messages (ctn-to-owner, expense-note-to-owner)
 * 4. Workers drive the process to completion
 * 5. If --useRabbitmq=true, sends outbound messages via RabbitMQ to C3
 */
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_1 = require("@camunda8/sdk");
const config_1 = require("./config");
const workers_1 = require("./workers");
const publisher_1 = require("./rabbitmq/publisher");
const consumer_1 = require("./rabbitmq/consumer");
const INBOUND_RABBITMQ_MESSAGES = {
    ctnToOwner: {
        camundaMessageName: 'Message_Transport_empty_CTN_received',
        routingKey: 'owner.ctn-to-owner'
    },
    expenseNoteToOwner: {
        camundaMessageName: 'Message_expense_note_received',
        routingKey: 'owner.expense-note-to-owner'
    }
};
function nowIso() {
    return new Date().toISOString();
}
function pad3(n) {
    return String(n).padStart(3, '0');
}
function generateOrderId(now = new Date(), seq = Math.floor(Math.random() * 1000)) {
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `ORDER-${yyyy}${mm}${dd}-${pad3(seq)}`;
}
async function assertReachable(baseUrl) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    try {
        const res = await fetch(baseUrl, { method: 'GET', signal: controller.signal });
        void res;
    }
    catch (err) {
        const message = err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err);
        throw new Error(`Camunda 8 REST unreachable at ${baseUrl}. Start Camunda (or set CAMUNDA_REST_ADDRESS). Root error: ${message}`);
    }
    finally {
        clearTimeout(timeout);
    }
}
function parseArgs() {
    const argv = globalThis.process?.argv ?? [];
    const orderIdArg = argv.find((a) => a.startsWith('--orderId='));
    const mockInboundArg = argv.find((a) => a.startsWith('--mockInbound='));
    const useRabbitmqArg = argv.find((a) => a.startsWith('--useRabbitmq='));
    const orderId = orderIdArg?.split('=')[1] ?? generateOrderId();
    const mockInbound = (mockInboundArg?.split('=')[1] ?? 'true').toLowerCase() === 'true';
    const useRabbitmq = (useRabbitmqArg?.split('=')[1] ?? 'false').toLowerCase() === 'true';
    return { orderId, mockInbound, useRabbitmq };
}
async function deployOwnerModel(client) {
    const fs = require('fs');
    const path = require('path');
    const bpmnPath = path.join(__dirname, '..', '..', 'bpmn', 'owner.bpmn');
    const resources = [
        {
            name: 'owner.bpmn',
            filePath: bpmnPath
        }
    ].map((r) => ({ name: r.name, content: fs.readFileSync(r.filePath) }));
    const res = await client.deployResources(resources);
    const processCount = Array.isArray(res?.processes) ? res.processes.length : 0;
    console.log(`Deployed ${resources.length} BPMN resources. deploymentKey=${res?.deploymentKey ?? 'unknown'} processes=${processCount}`);
}
/**
 * Mock inbound messages that Owner expects to receive.
 *
 * Per owner.bpmn:
 *   - Event_1ekkpx7: CTN received   (from Transport)
 *   - Event_00o2m98: expense note received
 */
async function mockInboundMessages(client, orderId, rabbitPublisher) {
    // Wait for the engine to advance to the first message catch event.
    await new Promise((r) => setTimeout(r, 3000));
    const ctnVariables = {
        orderId,
        timestamp: nowIso(),
        senderId: config_1.PARTY.transport.id,
        ctnNumber: 'CTN-884821',
        handOverTime: nowIso(),
        driverName: 'Driver Zhang',
        carLicense: 'SHA-12345'
    };
    // 1) Transport -> Owner: ctn-to-owner (M22)
    if (rabbitPublisher?.isReady()) {
        await rabbitPublisher.publishCamundaMessage({
            ...INBOUND_RABBITMQ_MESSAGES.ctnToOwner,
            correlationKey: orderId,
            variables: ctnVariables,
            source: 'mock-transport'
        });
        console.log(`[mock] sent ${config_1.MESSAGE_NAMES.ctnToOwner} via RabbitMQ orderId=${orderId}`);
    }
    else {
        await client.publishMessage({
            name: config_1.MESSAGE_NAMES.ctnToOwner,
            correlationKey: orderId,
            timeToLive: 600,
            variables: ctnVariables
        });
        console.log(`[mock] sent ${config_1.MESSAGE_NAMES.ctnToOwner} via REST orderId=${orderId}`);
    }
    // Wait for send-outbound-ctn-to-transport worker to finish and engine to reach second catch event.
    await new Promise((r) => setTimeout(r, 5000));
    const expenseVariables = {
        orderId,
        timestamp: nowIso(),
        senderId: config_1.PARTY.freightForwarder.id,
        expenseId: 'EXP-20260427-001',
        expenseAmount: 1234.56,
        currency: 'CNY'
    };
    // 2) Freight Forwarder -> Owner: expense-note-to-owner
    if (rabbitPublisher?.isReady()) {
        await rabbitPublisher.publishCamundaMessage({
            ...INBOUND_RABBITMQ_MESSAGES.expenseNoteToOwner,
            correlationKey: orderId,
            variables: expenseVariables,
            source: 'mock-freight-forwarder'
        });
        console.log(`[mock] sent ${config_1.MESSAGE_NAMES.expenseNoteToOwner} via RabbitMQ orderId=${orderId}`);
    }
    else {
        await client.publishMessage({
            name: config_1.MESSAGE_NAMES.expenseNoteToOwner,
            correlationKey: orderId,
            timeToLive: 600,
            variables: expenseVariables
        });
        console.log(`[mock] sent ${config_1.MESSAGE_NAMES.expenseNoteToOwner} via REST orderId=${orderId}`);
    }
}
async function main() {
    const { orderId, mockInbound, useRabbitmq } = parseArgs();
    await assertReachable(config_1.CAMUNDA_REST_ADDRESS);
    const client = new sdk_1.Camunda8({
        CAMUNDA_AUTH_STRATEGY: config_1.CAMUNDA_AUTH_STRATEGY,
        ZEEBE_REST_ADDRESS: config_1.CAMUNDA_REST_ADDRESS
    }).getCamundaRestClient();
    // Initialize RabbitMQ if enabled
    let rabbitPublisher;
    let rabbitConsumer;
    if (useRabbitmq) {
        rabbitPublisher = new publisher_1.RabbitMQPublisher();
        await rabbitPublisher.connect();
        console.log('[demo] RabbitMQ publisher connected');
        rabbitConsumer = new consumer_1.RabbitMQConsumer(client);
        await rabbitConsumer.connect();
        await rabbitConsumer.startConsuming();
        console.log('[demo] RabbitMQ consumer started');
    }
    const workers = (0, workers_1.startOwnerContractWorkers)(client, rabbitPublisher);
    console.log(`Starting Owner contract demo with orderId=${orderId}`);
    console.log(`REST endpoint: ${config_1.CAMUNDA_REST_ADDRESS}`);
    console.log(`RabbitMQ: ${useRabbitmq ? 'enabled' : 'disabled'}`);
    await deployOwnerModel(client);
    const ownerInstance = await client.createProcessInstance({
        processDefinitionId: config_1.PROCESS_IDS.owner,
        variables: { orderId }
    });
    console.log(`Owner process instance started. key=${ownerInstance?.processInstanceKey ?? 'unknown'}`);
    if (mockInbound) {
        await mockInboundMessages(client, orderId, rabbitPublisher);
        // Give the engine time to advance and complete the payment task.
        await new Promise((r) => setTimeout(r, 5000));
        workers.fillCertificateWorker.stop();
        workers.handleOrderWorker.stop();
        workers.sendOrderToFfwWorker.stop();
        workers.sendOutboundCtnToTransportWorker.stop();
        workers.paymentWorker.stop();
        if (rabbitConsumer)
            await rabbitConsumer.close();
        if (rabbitPublisher)
            await rabbitPublisher.close();
        const p = globalThis.process;
        if (p)
            p.exitCode = 0;
        return;
    }
    else {
        console.log(`mockInbound=false: please externally correlate ${config_1.MESSAGE_NAMES.ctnToOwner} and ${config_1.MESSAGE_NAMES.expenseNoteToOwner} using correlationKey=orderId.`);
    }
    console.log('Workers will drive the process. Watch logs or Operate.');
    // Graceful shutdown for non-mock mode
    const shutdown = async () => {
        console.log('\nShutting down...');
        workers.fillCertificateWorker.stop();
        workers.handleOrderWorker.stop();
        workers.sendOrderToFfwWorker.stop();
        workers.sendOutboundCtnToTransportWorker.stop();
        workers.paymentWorker.stop();
        if (rabbitConsumer)
            await rabbitConsumer.close();
        if (rabbitPublisher)
            await rabbitPublisher.close();
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}
main().catch((err) => {
    console.error(err);
    const p = globalThis.process;
    if (p)
        p.exitCode = 1;
});
//# sourceMappingURL=demo.js.map