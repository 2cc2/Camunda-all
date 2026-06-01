"use strict";
/**
 * Cross-group E2E automated test.
 *
 * Usage:
 *   npx ts-node source/e2e-cross-group.ts [--orderId=ORDER-20260525-001]
 *
 * Strategy:
 * 1. Send C2 outbound messages for real (RabbitMQ -> C3).
 * 2. Wait for C3 / C5 to send inbound messages back.
 * 3. If a real message is not received within the timeout, log it and fall back to mock.
 * 4. Poll process instance state until COMPLETED or timeout.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_1 = require("@camunda8/sdk");
const config_1 = require("./config");
const workers_1 = require("./workers");
const publisher_1 = require("./rabbitmq/publisher");
const consumer_1 = require("./rabbitmq/consumer");
const fs = require('fs');
const path = require('path');
/* -------------------------------------------------------------------------- */
/*  CLI args                                                                  */
/* -------------------------------------------------------------------------- */
function parseArgs() {
    const argv = globalThis.process?.argv ?? [];
    const orderIdArg = argv.find((a) => a.startsWith('--orderId='));
    const orderId = orderIdArg?.split('=')[1] ?? generateOrderId();
    return { orderId };
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
/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */
function nowIso() {
    return new Date().toISOString();
}
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
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
        throw new Error(`Camunda 8 REST unreachable at ${baseUrl}. Start Camunda first. Root error: ${message}`);
    }
    finally {
        clearTimeout(timeout);
    }
}
async function deployOwnerModel(client) {
    const bpmnPath = path.join(__dirname, '..', '..', 'bpmn', 'owner.bpmn');
    const resources = [{ name: 'owner.bpmn', content: fs.readFileSync(bpmnPath) }];
    const res = await client.deployResources(resources);
    const processCount = Array.isArray(res?.processes) ? res.processes.length : 0;
    console.log(`[e2e] Deployed ${resources.length} BPMN. processes=${processCount}`);
}
/* -------------------------------------------------------------------------- */
/*  Variable query (Camunda v2 REST)                                          */
/* -------------------------------------------------------------------------- */
async function searchVariable(baseUrl, processInstanceKey, variableName) {
    try {
        const res = await fetch(`${baseUrl}/v2/variables/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filter: { processInstanceKey },
                page: { from: 0, limit: 100 }
            })
        });
        if (!res.ok)
            return null;
        const data = await res.json();
        const items = data.items || [];
        const found = items.find((v) => v.name === variableName);
        if (!found)
            return null;
        try {
            return JSON.parse(found.value);
        }
        catch {
            return found.value;
        }
    }
    catch {
        return null;
    }
}
async function waitForVariable(baseUrl, instanceKey, variableName, timeoutMs, intervalMs = 500) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const value = await searchVariable(baseUrl, instanceKey, variableName);
        if (value !== null) {
            return { found: true, value };
        }
        await sleep(intervalMs);
    }
    return { found: false };
}
/* -------------------------------------------------------------------------- */
/*  Inbound message helpers                                                   */
/* -------------------------------------------------------------------------- */
async function publishInboundMessage(client, name, orderId, variables) {
    await client.publishMessage({
        name,
        correlationKey: orderId,
        timeToLive: 600,
        variables
    });
}
async function mockCtnToOwner(client, orderId) {
    console.log(`[e2e] >>> MOCK: sending ${config_1.MESSAGE_NAMES.ctnToOwner}`);
    await publishInboundMessage(client, config_1.MESSAGE_NAMES.ctnToOwner, orderId, {
        orderId,
        timestamp: nowIso(),
        senderId: config_1.PARTY.transport.id,
        ctnNumber: 'CTN-884821',
        handOverTime: nowIso(),
        driverName: '张三',
        carLicense: '沪A-12345'
    });
}
async function mockExpenseNoteToOwner(client, orderId) {
    console.log(`[e2e] >>> MOCK: sending ${config_1.MESSAGE_NAMES.expenseNoteToOwner}`);
    await publishInboundMessage(client, config_1.MESSAGE_NAMES.expenseNoteToOwner, orderId, {
        orderId,
        timestamp: nowIso(),
        senderId: config_1.PARTY.freightForwarder.id,
        expenseId: 'EXP-20260427-001',
        expenseAmount: 1234.56,
        currency: 'CNY'
    });
}
async function getInstanceState(baseUrl, instanceKey) {
    try {
        const res = await fetch(`${baseUrl}/v2/process-instances/${instanceKey}`);
        if (!res.ok)
            return 'UNKNOWN';
        const data = await res.json();
        return data?.state ?? 'UNKNOWN';
    }
    catch {
        return 'UNKNOWN';
    }
}
async function waitForCompletion(baseUrl, instanceKey, options = {}) {
    const { timeoutMs = 30000, intervalMs = 1000 } = options;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const state = await getInstanceState(baseUrl, instanceKey);
        const elapsed = Date.now() - start;
        if (state === 'COMPLETED') {
            return { state, elapsedMs: elapsed };
        }
        if (state === 'CANCELED') {
            return { state, elapsedMs: elapsed };
        }
        process.stdout.write(`\r[e2e] Polling... state=${state} elapsed=${(elapsed / 1000).toFixed(1)}s`);
        await sleep(intervalMs);
    }
    const finalState = await getInstanceState(baseUrl, instanceKey);
    return { state: finalState, elapsedMs: Date.now() - start };
}
/* -------------------------------------------------------------------------- */
/*  Main test                                                                 */
/* -------------------------------------------------------------------------- */
async function main() {
    const { orderId } = parseArgs();
    console.log(`\n========================================`);
    console.log(`  C2 Cross-Group E2E Automated Test`);
    console.log(`========================================`);
    console.log(`  orderId: ${orderId}`);
    console.log(`========================================\n`);
    await assertReachable(config_1.CAMUNDA_REST_ADDRESS);
    const client = new sdk_1.Camunda8({
        CAMUNDA_AUTH_STRATEGY: config_1.CAMUNDA_AUTH_STRATEGY,
        ZEEBE_REST_ADDRESS: config_1.CAMUNDA_REST_ADDRESS
    }).getCamundaRestClient();
    /* RabbitMQ init (for C3 outbound) */
    let rabbitPublisher;
    let rabbitConsumer;
    rabbitPublisher = new publisher_1.RabbitMQPublisher();
    await rabbitPublisher.connect();
    console.log('[e2e] RabbitMQ publisher connected');
    rabbitConsumer = new consumer_1.RabbitMQConsumer(client);
    await rabbitConsumer.connect();
    await rabbitConsumer.startConsuming();
    console.log('[e2e] RabbitMQ consumer started (listening for real inbound from C3)');
    /* Start workers */
    const workers = (0, workers_1.startOwnerContractWorkers)(client, rabbitPublisher);
    console.log('[e2e] C2 workers started');
    /* Deploy & create instance */
    await deployOwnerModel(client);
    const ownerInstance = await client.createProcessInstance({
        processDefinitionId: config_1.PROCESS_IDS.owner,
        variables: { orderId }
    });
    const instanceKey = ownerInstance?.processInstanceKey ?? 'unknown';
    console.log(`[e2e] Instance started. key=${instanceKey}`);
    /* ---------------------------------------------------------------------- */
    /*  Phase 1: Wait for order-to-ffw worker to send to C3                  */
    /* ---------------------------------------------------------------------- */
    console.log('[e2e] Phase 1: Waiting for order-to-ffw worker (RabbitMQ -> C3)...');
    const orderSent = await waitForVariable(config_1.CAMUNDA_REST_ADDRESS, instanceKey, 'orderSentToFfw', 8000);
    if (!orderSent.found) {
        console.log('[e2e] WARNING: order-to-ffw did not complete within 8s, continuing anyway...');
    }
    else {
        console.log('[e2e] order-to-ffw completed.');
    }
    /* ---------------------------------------------------------------------- */
    /*  Phase 2: Wait for real ctn-to-owner from C3, else mock               */
    /* ---------------------------------------------------------------------- */
    console.log('[e2e] Phase 2: Waiting for real ctn-to-owner from C3 (up to 10s)...');
    const ctnReal = await waitForVariable(config_1.CAMUNDA_REST_ADDRESS, instanceKey, 'ctnNumber', 10000);
    if (ctnReal.found) {
        console.log(`[e2e] REAL ctn-to-owner received from C3. ctn=${ctnReal.value}`);
    }
    else {
        console.log('[e2e] No real ctn-to-owner received from C3 within 10s.');
        await mockCtnToOwner(client, orderId);
    }
    /* ---------------------------------------------------------------------- */
    /*  Phase 3: Wait for outbound-ctn-to-transport worker                    */
    /* ---------------------------------------------------------------------- */
    console.log('[e2e] Phase 3: Waiting for outbound-ctn-to-transport worker...');
    const outboundSent = await waitForVariable(config_1.CAMUNDA_REST_ADDRESS, instanceKey, 'outboundCtnSentToTransport', 8000);
    if (!outboundSent.found) {
        console.log('[e2e] WARNING: outbound-ctn-to-transport did not complete within 8s');
    }
    else {
        console.log('[e2e] outbound-ctn-to-transport completed (RabbitMQ -> C3).');
    }
    /* ---------------------------------------------------------------------- */
    /*  Phase 4: Wait for real expense-note-to-owner from C5, else mock      */
    /* ---------------------------------------------------------------------- */
    console.log('[e2e] Phase 4: Waiting for real expense-note-to-owner from C5 (up to 10s)...');
    const expenseReal = await waitForVariable(config_1.CAMUNDA_REST_ADDRESS, instanceKey, 'expenseAmount', 10000);
    if (expenseReal.found) {
        console.log(`[e2e] REAL expense-note-to-owner received from C5. amount=${expenseReal.value}`);
    }
    else {
        console.log('[e2e] No real expense-note-to-owner received from C5 within 10s.');
        await mockExpenseNoteToOwner(client, orderId);
    }
    /* ---------------------------------------------------------------------- */
    /*  Phase 5: Poll until COMPLETED                                         */
    /* ---------------------------------------------------------------------- */
    console.log('[e2e] Phase 5: Polling instance state until COMPLETED (timeout 30s)...');
    const result = await waitForCompletion(config_1.CAMUNDA_REST_ADDRESS, instanceKey, {
        timeoutMs: 30000,
        intervalMs: 1000
    });
    process.stdout.write('\n');
    /* ---------------------------------------------------------------------- */
    /*  Report                                                                 */
    /* ---------------------------------------------------------------------- */
    console.log(`\n========================================`);
    if (result.state === 'COMPLETED') {
        console.log(`  RESULT: PASS`);
        console.log(`  Instance ${instanceKey} completed in ${(result.elapsedMs / 1000).toFixed(1)}s`);
        console.log(`  Inbound messages:`);
        console.log(`    - ctn-to-owner:        ${ctnReal.found ? 'REAL (from C3)' : 'MOCK (C3 not ready)'}`);
        console.log(`    - expense-note-to-owner: ${expenseReal.found ? 'REAL (from C5)' : 'MOCK (C5 not ready)'}`);
    }
    else {
        console.log(`  RESULT: FAIL`);
        console.log(`  Instance ${instanceKey} state=${result.state} after ${(result.elapsedMs / 1000).toFixed(1)}s`);
        console.log(`  Check Operate: http://localhost:8080/operate`);
    }
    console.log(`========================================\n`);
    /* Cleanup */
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
        p.exitCode = result.state === 'COMPLETED' ? 0 : 1;
}
main().catch((err) => {
    console.error('[e2e] Fatal error:', err);
    const p = globalThis.process;
    if (p)
        p.exitCode = 1;
});
//# sourceMappingURL=e2e-cross-group.js.map