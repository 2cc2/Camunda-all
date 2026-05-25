"use strict";
/**
 * Standalone mock inbound message publisher for Depot.
 *
 * Usage (while workers are running in another terminal):
 *   CAMUNDA_REST_ADDRESS=http://localhost:8080 npx ts-node source/mock-inbound.ts --orderId=ORDER-20260507-001
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.nowIso = nowIso;
exports.buildAskForCtnMockVariables = buildAskForCtnMockVariables;
exports.buildOutboundCtnToDepotMockVariables = buildOutboundCtnToDepotMockVariables;
exports.parseArgs = parseArgs;
exports.publishStartMessage = publishStartMessage;
exports.publishFollowupInboundMessages = publishFollowupInboundMessages;
exports.publishMockInboundMessages = publishMockInboundMessages;
exports.main = main;
const config_1 = require("./config");
const publisher_1 = require("./rabbitmq/publisher");
function nowIso() {
    return new Date().toISOString();
}
function buildAskForCtnMockVariables(orderId) {
    return {
        orderId,
        timestamp: nowIso(),
        senderId: config_1.PARTY.shippingAgency.id,
        containerId: 'MSKU1234567',
        vesselId: 'VESSEL-042'
    };
}
function buildOutboundCtnToDepotMockVariables(orderId) {
    return {
        orderId,
        timestamp: nowIso(),
        senderId: config_1.PARTY.transport.id,
        ctnNumber: 'MSKU1234567',
        vesselId: 'VESSEL-042',
        handOverTime: nowIso(),
        handoverTime: nowIso(),
        receiptId: 'RECEIPT-20260507-001',
        driverName: 'Zhang San',
        carLicense: 'HU-A-12345'
    };
}
function parseArgs(argv = globalThis.process?.argv ?? []) {
    const orderIdArg = argv.find((a) => a.startsWith('--orderId='));
    const orderId = orderIdArg?.split('=')[1];
    if (!orderId) {
        console.error('Usage: npx ts-node source/mock-inbound.ts --orderId=ORDER-YYYYMMDD-NNN');
        const p = globalThis.process;
        if (p)
            p.exitCode = 1;
        throw new Error('Missing --orderId argument');
    }
    return { orderId };
}
async function publishStartMessage(client, orderId) {
    await client.publishMessage(config_1.MESSAGE_NAMES.askForCtn, orderId, buildAskForCtnMockVariables(orderId));
    console.log(`[mock] published ${config_1.MESSAGE_NAMES.askForCtn}`);
}
async function publishFollowupInboundMessages(client, orderId, sleep = (ms) => new Promise((r) => setTimeout(r, ms))) {
    await sleep(1500);
    await client.publishMessage(config_1.MESSAGE_NAMES.outboundCtnToDepot, orderId, buildOutboundCtnToDepotMockVariables(orderId));
    console.log(`[mock] published ${config_1.MESSAGE_NAMES.outboundCtnToDepot}`);
}
async function publishMockInboundMessages(client, orderId, sleep = (ms) => new Promise((r) => setTimeout(r, ms))) {
    await publishStartMessage(client, orderId);
    await publishFollowupInboundMessages(client, orderId, sleep);
}
async function main() {
    const { orderId } = parseArgs();
    void config_1.CAMUNDA_AUTH_STRATEGY;
    void config_1.CAMUNDA_GRPC_ADDRESS;
    const client = new publisher_1.RabbitMQPublisher();
    await client.connect();
    console.log(`Publishing inbound Depot messages for orderId=${orderId}`);
    await publishMockInboundMessages(client, orderId);
    await client.close();
    console.log('Done. Check Operate or worker logs for progress.');
}
if (require.main === module) {
    main().catch((err) => {
        console.error(err);
        const p = globalThis.process;
        if (p)
            p.exitCode = 1;
    });
}
//# sourceMappingURL=mock-inbound.js.map