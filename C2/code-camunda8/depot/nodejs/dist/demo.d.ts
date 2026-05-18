/**
 * Depot contract demo / mock test runner.
 *
 * Usage:
 *   CAMUNDA_REST_ADDRESS=http://localhost:8080 npx ts-node source/demo.ts --orderId=ORDER-20260507-001 --mockInbound=true
 *
 * What it does:
 * 1. Deploys depot.bpmn to Camunda 8
 * 2. Starts a process instance with the given orderId
 * 3. Optionally mocks inbound messages (ask-for-ctn, outbound-ctn-to-depot)
 * 4. Workers drive the process to completion
 */
export {};
//# sourceMappingURL=demo.d.ts.map