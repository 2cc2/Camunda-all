/**
 * 同时启动 4 个需要手动启动的流程实例（Owner、Customs、Container Terminal、Transport），使用相同的 orderId。
 * 其余 5 个流程（FF、SA、SBGS、CB、Depot）通过消息 start event 自动触发。
 * 用法：npm run start:processes [orderId]
 *   - 不传参数：自动生成 ORDER-YYYYMMDD-XXX
 *   - 传参数：使用指定的 orderId
 */

import { makeClient, getConnectionInfo } from '../shared/zeebe-client';
import { generateOrderId } from '../shared/utils';

const RESTART_PROCESS_IDS = [
  'Process_1n9bswo',   // Owner（plain start）
  'Process_Customs',    // Customs（plain start）
  'Process_CT',         // Container Terminal（plain start）
  'Process_Transport',  // Transport（plain start — 被并发网关分叉，等待消息）
];

async function main() {
  const client = makeClient();
  const info = getConnectionInfo();
  const orderId = process.argv[2] || generateOrderId();

  console.log('Starting process instances...');
  console.log(`  REST: ${info.ZEEBE_REST_ADDRESS}`);
  console.log(`  Order ID: ${orderId}`);
  console.log('');

  const results = await Promise.allSettled(
    RESTART_PROCESS_IDS.map(async (processId) => {
      console.log(`  → Creating instance of ${processId}...`);
      const result = await (client as any).createProcessInstance({
        processDefinitionId: processId,
        variables: { orderId },
      });
      console.log(`  ✓ ${processId} started (key=${result?.processInstanceKey ?? result?.processInstance?.processInstanceKey ?? '?'})`);
    })
  );

  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    console.error('\nSome instances failed to start:');
    for (const f of failed) {
      console.error(' ', (f as PromiseRejectedResult).reason);
    }
  }

  console.log(`\nDone. ${RESTART_PROCESS_IDS.length} process instances started with orderId="${orderId}".`);
  console.log('View in Operate: http://localhost:8081');
}

main().catch((err) => {
  console.error('Failed to start processes:', err);
  process.exit(1);
});
