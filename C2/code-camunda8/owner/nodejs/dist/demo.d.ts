/**
 * Owner contract demo / mock test runner.
 *
 * Usage:
 *   CAMUNDA_REST_ADDRESS=http://localhost:8080 npx ts-node source/demo.ts --orderId=ORDER-20260427-001 --mockInbound=true --useRabbitmq=true
 *
 * What it does:
 * 1. Deploys owner.bpmn to Camunda 8
 * 2. Starts a process instance with the given orderId
 * 3. Optionally mocks inbound messages (ctn-to-owner, expense-note-to-owner)
 * 4. Workers drive the process to completion
 * 5. If --useRabbitmq=true, sends outbound messages via RabbitMQ to C3
 */
export {};
//# sourceMappingURL=demo.d.ts.map