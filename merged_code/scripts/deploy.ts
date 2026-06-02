/**
 * 把 bpmn/all.bpmn 部署到本地 Zeebe。
 * 用法：npm run deploy
 */

import * as path from 'path';
import { makeClient, getConnectionInfo } from '../shared/zeebe-client';

async function main() {
  const client = makeClient();
  const info = getConnectionInfo();
  const bpmnPath = path.resolve(__dirname, '..', 'bpmn', 'all.bpmn');

  console.log('Deploying BPMN to Zeebe...');
  console.log(`  REST: ${info.ZEEBE_REST_ADDRESS}`);
  console.log(`  gRPC: ${info.ZEEBE_GRPC_ADDRESS}`);
  console.log(`  file: ${bpmnPath}`);

  try {
    const result = await (client as any).deployResourcesFromFiles([bpmnPath]);
    console.log('\nDeployment succeeded:');
    const deployments = (result?.deployments ?? result?.processes ?? []) as any[];
    if (deployments.length > 0) {
      for (const d of deployments) {
        const proc = d.processDefinition ?? d.process ?? d;
        console.log(`  - bpmnProcessId=${proc.processDefinitionId ?? proc.bpmnProcessId ?? proc.id}  ` +
          `version=${proc.version ?? '?'}  key=${proc.processDefinitionKey ?? proc.processKey ?? '?'}`);
      }
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
    console.log('\nTip: 现在可以运行 `npm run start:all` 启动 worker。');
  } catch (err) {
    console.error('\nDeploy failed:', err);
    console.error('请确认 Camunda 8 Run 已启动且 .env 中的 ZEEBE_REST_ADDRESS 正确。');
    process.exit(1);
  }
}

main();
