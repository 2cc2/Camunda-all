/**
 * 在同一进程中并行启动 9 个组织的 worker，所有日志合并到一个控制台。
 * 用法：npm run start:all
 *
 * 如果想单独启动某个组织，可用：
 *   npm run start:owner | start:ffw | start:sag | start:cub | start:cus |
 *   start:sbg | start:cte | start:trp | start:dpt
 */

import { getConnectionInfo } from '../shared/zeebe-client';
import { startOwnerWorkers } from '../workers/owner';
import { startFreightForwarderWorkers } from '../workers/freight-forwarder';
import { startShippingAgencyWorkers } from '../workers/shipping-agency';
import { startCustomsBrokerWorkers } from '../workers/customs-broker';
import { startCustomsWorkers } from '../workers/customs';
import { startSbgsWorkers } from '../workers/sbgs';
import { startContainerTerminalWorkers } from '../workers/container-terminal';
import { startTransportWorkers } from '../workers/transport';
import { startDepotWorkers } from '../workers/depot';

const info = getConnectionInfo();
console.log('Starting all 9 organization workers...');
console.log(`  Zeebe REST: ${info.ZEEBE_REST_ADDRESS}`);
console.log(`  Zeebe gRPC: ${info.ZEEBE_GRPC_ADDRESS}`);
console.log('');

startOwnerWorkers();
startFreightForwarderWorkers();
startShippingAgencyWorkers();
startCustomsBrokerWorkers();
startCustomsWorkers();
startSbgsWorkers();
startContainerTerminalWorkers();
startTransportWorkers();
startDepotWorkers();

console.log('\n✅ All 9 worker groups registered. Waiting for jobs...');
console.log('   Press Ctrl+C to stop.\n');

process.on('SIGINT', () => {
  console.log('\nShutting down workers...');
  process.exit(0);
});
