/**
 * Owner contract E2E automated test.
 *
 * Usage:
 *   npx ts-node source/e2e-test.ts [--orderId=ORDER-20260525-001] [--useRabbitmq=true]
 *
 * What it does:
 * 1. Deploys owner.bpmn to Camunda 8
 * 2. Starts a process instance
 * 3. Starts C2 workers
 * 4. Automatically sends inbound messages (ctn-to-owner, expense-note-to-owner) with correct timing
 * 5. Polls process instance state until COMPLETED or timeout
 * 6. Prints pass/fail result
 */
export {};
//# sourceMappingURL=e2e-test.d.ts.map