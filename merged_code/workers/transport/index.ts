/**
 * Transport（车队）Worker
 *
 * Process_Transport 涉及的 task 类型：
 *  - ctn-to-owner             → 发布 ctn-to-owner 给 Owner
 *  - outbound-ctn-to-depot    → 发布 outbound-ctn-to-depot 给 Depot
 */

import { makeClient } from '../../shared/zeebe-client';
import { MESSAGES } from '../../shared/messages';
import { TASK_TYPES } from '../../shared/task-types';
import { log, nowIso, senderId } from '../../shared/utils';

const ORG = 'TRP';

export function startTransportWorkers() {
  const client = makeClient();

  client.createJobWorker({
    type: TASK_TYPES.CTN_TO_OWNER,
    worker: 'trp-ctn-to-owner',
    timeout: 10000,
    maxJobsToActivate: 5,
    jobHandler: async (job) => {
      const orderId = (job.variables as any).orderId;
      log(ORG, TASK_TYPES.CTN_TO_OWNER, orderId);
      const ctnNumber = `CTN-${Date.now().toString().slice(-6)}`;
      await client.publishMessage({
        name: MESSAGES.CTN_TO_OWNER,
        correlationKey: orderId,
        timeToLive: 3600000,
        variables: {
          orderId,
          timestamp: nowIso(),
          senderId: senderId(ORG),
          ctnNumber,
          handOverTime: nowIso(),
          driverName: '张三',
          carLicense: '沪A-12345',
        },
      });
      return job.complete({ ctnNumber });
    },
  });

  client.createJobWorker({
    type: TASK_TYPES.OUTBOUND_CTN_TO_DEPOT,
    worker: 'trp-outbound-ctn-to-depot',
    timeout: 10000,
    maxJobsToActivate: 5,
    jobHandler: async (job) => {
      const orderId = (job.variables as any).orderId;
      log(ORG, TASK_TYPES.OUTBOUND_CTN_TO_DEPOT, orderId);
      await client.publishMessage({
        name: MESSAGES.OUTBOUND_CTN_TO_DEPOT,
        correlationKey: orderId,
        timeToLive: 3600000,
        variables: {
          orderId,
          timestamp: nowIso(),
          senderId: senderId(ORG),
          ctnNumber: (job.variables as any).ctnNumber ?? 'CTN-UNKNOWN',
          handOverTime: nowIso(),
          receiptId: `REC-${orderId}`,
          driverName: '张三',
          carLicense: '沪A-12345',
        },
      });
      return job.complete();
    },
  });

  console.log(`[${ORG}] workers registered: ctn-to-owner, outbound-ctn-to-depot`);
}

if (require.main === module) {
  startTransportWorkers();
}
