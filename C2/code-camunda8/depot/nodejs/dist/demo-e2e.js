"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const demo_1 = require("./demo");
const observer_1 = require("./rabbitmq/observer");
async function main() {
    const observer = new observer_1.RabbitMQOutboundObserver();
    await observer.connect();
    await observer.start();
    try {
        await (0, demo_1.runDemo)();
        const messages = await observer.waitForMessages(3, 12000);
        console.log('\nObserved outbound messages:');
        for (const message of messages) {
            console.log(`- ${message.queue}: ${message.payload.camundaMessageName ?? 'unknown-message'}`);
        }
    }
    finally {
        await observer.close();
    }
}
main().catch((error) => {
    console.error(error);
    const p = globalThis.process;
    if (p)
        p.exitCode = 1;
});
//# sourceMappingURL=demo-e2e.js.map