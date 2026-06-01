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
export {};
//# sourceMappingURL=e2e-strict.d.ts.map