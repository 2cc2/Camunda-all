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
export {};
//# sourceMappingURL=e2e-cross-group.d.ts.map