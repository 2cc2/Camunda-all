"use strict";
/**
 * Standalone mock inbound message publisher.
 *
 * Usage (while workers are running in another terminal):
 *   CAMUNDA_REST_ADDRESS=http://localhost:8080 npx ts-node source/mock-inbound.ts --orderId=ORDER-20260427-001
 *
 * Publishes the two inbound messages that Owner expects:
 *   1. ctn-to-owner       (Transport -> Owner)
 *   2. expense-note-to-owner (FFW -> Owner)
 */
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_1 = require("@camunda8/sdk");
const config_1 = require("./config");
function nowIso() {
    return new Date().toISOString();
}
function parseArgs() {
    const argv = globalThis.process?.argv ?? [];
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
async function main() {
    const { orderId } = parseArgs();
    const client = new sdk_1.Camunda8({
        CAMUNDA_AUTH_STRATEGY: config_1.CAMUNDA_AUTH_STRATEGY,
        ZEEBE_REST_ADDRESS: config_1.CAMUNDA_REST_ADDRESS
    }).getCamundaRestClient();
    console.log(`Publishing inbound messages for orderId=${orderId}`);
    // 1) Transport -> Owner: ctn-to-owner (M22)
    await client.publishMessage({
        name: config_1.MESSAGE_NAMES.ctnToOwner,
        correlationKey: orderId,
        timeToLive: 600,
        variables: {
            orderId,
            timestamp: nowIso(),
            senderId: config_1.PARTY.transport.id,
            ctnNumber: 'CTN-884821',
            handOverTime: nowIso(),
            driverName: '张三',
            carLicense: '沪A-12345'
        }
    });
    console.log(`[mock] published ${config_1.MESSAGE_NAMES.ctnToOwner}`);
    await new Promise((r) => setTimeout(r, 1500));
    // 2) FFW -> Owner: expense-note-to-owner
    await client.publishMessage({
        name: config_1.MESSAGE_NAMES.expenseNoteToOwner,
        correlationKey: orderId,
        timeToLive: 600,
        variables: {
            orderId,
            timestamp: nowIso(),
            senderId: config_1.PARTY.freightForwarder.id,
            expenseId: 'EXP-20260427-001',
            expenseAmount: 1234.56,
            currency: 'CNY'
        }
    });
    console.log(`[mock] published ${config_1.MESSAGE_NAMES.expenseNoteToOwner}`);
    console.log('Done. Check Operate or worker logs for progress.');
}
main().catch((err) => {
    console.error(err);
    const p = globalThis.process;
    if (p)
        p.exitCode = 1;
});
//# sourceMappingURL=mock-inbound.js.map