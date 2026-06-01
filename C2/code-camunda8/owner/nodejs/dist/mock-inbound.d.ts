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
export {};
//# sourceMappingURL=mock-inbound.d.ts.map