"use strict";
/**
 * Strict cross-group E2E test — FAILS if real inbound messages are not received.
 *
 * Usage:
 *   npx ts-node source/e2e-strict.ts [--orderId=ORDER-20260525-001]
 *
 * Unlike e2e-cross-group.ts, this version does NOT fall back to mock.
 * If C3 or C5 does not send the expected message within the timeout,
 * the test aborts with FAIL.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_1 = require("@camunda8/sdk");
const config_1 = require("./config");
const workers_1 = require("./workers");
const publisher_1 = require("./rabbitmq/publisher");
const consumer_1 = require("./rabbitmq/consumer");
const fs = require('fs');
const path = require('path');
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
async function main() {
    const { orderId } = parseArgs();
    console.log(`\n========================================`);
    console.log(`  C2 STRICT Cross-Group E2E Test`);
    console.log(`  (No mock fallback — real messages only)`);
    console.log(`========================================`);
    console.log(`  orderId: ${orderId}`);
    console.log(`========================================\n`);
    await assertReachable(config_1.CAMUNDA_REST_ADDRESS);
    const client = new sdk_1.Camunda8({
        CAMUNDA_AUTH_STRATEGY: config_1.CAMUNDA_AUTH_STRATEGY,
        ZEEBE_REST_ADDRESS: config_1.CAMUNDA_REST_ADDRESS
    }).getCamundaRestClient();
    const rabbitPublisher = new publisher_1.RabbitMQPublisher();
    await rabbitPublisher.connect();
    console.log('[e2e] RabbitMQ publisher connected');
    const rabbitConsumer = new consumer_1.RabbitMQConsumer(client);
    await rabbitConsumer.connect();
    await rabbitConsumer.startConsuming();
    console.log('[e2e] RabbitMQ consumer started');
    const workers = (0, workers_1.startOwnerContractWorkers)(client, rabbitPublisher);
    console.log('[e2e] C2 workers started');
    await deployOwnerModel(client);
    const ownerInstance = await client.createProcessInstance({
        processDefinitionId: config_1.PROCESS_IDS.owner,
        variables: { orderId }
    });
    const instanceKey = ownerInstance?.processInstanceKey ?? 'unknown';
    console.log(`[e2e] Instance started. key=${instanceKey}`);
    /* Phase 1: order-to-ffw */
    console.log('[e2e] Phase 1: Waiting for order-to-ffw...');
    const orderSent = await waitForVariable(config_1.CAMUNDA_REST_ADDRESS, instanceKey, 'orderSentToFfw', 8000);
    if (!orderSent.found) {
        throw new Error('TIMEOUT: order-to-ffw worker did not complete within 8s');
    }
    console.log('[e2e] order-to-ffw completed.');
    /* Phase 2: ctn-to-owner from C3 (STRICT — no mock) */
    console.log('[e2e] Phase 2: Waiting for REAL ctn-to-owner from C3 (up to 15s)...');
    const ctnReal = await waitForVariable(config_1.CAMUNDA_REST_ADDRESS, instanceKey, 'ctnNumber', 15000);
    if (!ctnReal.found) {
        throw new Error('MISSING_INBOUND: ctn-to-owner not received from C3 within 15s');
    }
    console.log(`[e2e] REAL ctn-to-owner received. ctn=${ctnReal.value}`);
    /* Phase 3: outbound-ctn-to-transport */
    console.log('[e2e] Phase 3: Waiting for outbound-ctn-to-transport...');
    const outboundSent = await waitForVariable(config_1.CAMUNDA_REST_ADDRESS, instanceKey, 'outboundCtnSentToTransport', 8000);
    if (!outboundSent.found) {
        throw new Error('TIMEOUT: outbound-ctn-to-transport did not complete within 8s');
    }
    console.log('[e2e] outbound-ctn-to-transport completed.');
    /* Phase 4: expense-note-to-owner from C5 (STRICT — no mock) */
    console.log('[e2e] Phase 4: Waiting for REAL expense-note-to-owner from C5 (up to 15s)...');
    const expenseReal = await waitForVariable(config_1.CAMUNDA_REST_ADDRESS, instanceKey, 'expenseAmount', 15000);
    if (!expenseReal.found) {
        throw new Error('MISSING_INBOUND: expense-note-to-owner not received from C5 within 15s');
    }
    console.log(`[e2e] REAL expense-note-to-owner received. amount=${expenseReal.value}`);
    /* Phase 5: Wait for completion */
    console.log('[e2e] Phase 5: Waiting for instance COMPLETED (timeout 30s)...');
    const start = Date.now();
    while (Date.now() - start < 30000) {
        const state = await getInstanceState(config_1.CAMUNDA_REST_ADDRESS, instanceKey);
        if (state === 'COMPLETED') {
            const elapsed = Date.now() - start;
            console.log(`\n========================================`);
            console.log(`  RESULT: PASS`);
            console.log(`  Instance ${instanceKey} completed in ${(elapsed / 1000).toFixed(1)}s`);
            console.log(`  All inbound messages were REAL.`);
            console.log(`========================================\n`);
            workers.fillCertificateWorker.stop();
            workers.handleOrderWorker.stop();
            workers.sendOrderToFfwWorker.stop();
            workers.sendOutboundCtnToTransportWorker.stop();
            workers.paymentWorker.stop();
            await rabbitConsumer.close();
            await rabbitPublisher.close();
            const p = globalThis.process;
            if (p)
                p.exitCode = 0;
            return;
        }
        process.stdout.write(`\r[e2e] state=${state} elapsed=${((Date.now() - start) / 1000).toFixed(1)}s`);
        await sleep(1000);
    }
    throw new Error('TIMEOUT: instance did not reach COMPLETED within 30s');
}
main().catch((err) => {
    console.error(`\n========================================`);
    console.error(`  RESULT: FAIL`);
    console.error(`  ${err.message}`);
    console.error(`========================================\n`);
    const p = globalThis.process;
    if (p)
        p.exitCode = 1;
});
//# sourceMappingURL=e2e-strict.js.map