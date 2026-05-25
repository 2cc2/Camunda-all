"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
const publisher_1 = require("./rabbitmq/publisher");
function nowIso() {
    return new Date().toISOString();
}
function parseArgs(argv = process.argv) {
    const orderIdArg = argv.find((item) => item.startsWith('--orderId='));
    const orderId = orderIdArg?.split('=')[1];
    if (!orderId) {
        throw new Error('Usage: npm run mock:c3 -- --orderId=ORDER-YYYYMMDD-NNN');
    }
    return { orderId };
}
async function main() {
    const { orderId } = parseArgs();
    const publisher = new publisher_1.RabbitMQPublisher();
    await publisher.connect();
    try {
        await publisher.publishMessage(config_1.MESSAGE_NAMES.outboundCtnToDepot, orderId, {
            orderId,
            timestamp: nowIso(),
            senderId: config_1.PARTY.transport.id,
            ctnNumber: 'MSKU1234567',
            vesselId: 'VESSEL-042',
            handoverTime: nowIso(),
            receiptId: 'RECEIPT-20260525-C3',
            driverName: 'Zhang San',
            carLicense: 'HU-A-12345'
        });
        console.log(`Published C3-compatible outbound-ctn-to-depot for ${orderId}`);
    }
    finally {
        await publisher.close();
    }
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
//# sourceMappingURL=mock-c3-inbound.js.map