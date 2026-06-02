/**
 * Depot（货场）Worker
 *
 * Process_Depot 涉及的 task 类型：
 *  - empty-ctn-to-transport   → 发布 empty-ctn-to-transport 给 Transport
 *  - ctn-arrival-info-to-sa   → 发布 ctn-arrival-info-to-sa 给 SA
 *  - outbound-ctn-to-ct       → 发布 outbound-ctn-to-ct 给 CT
 */

import { makeClient } from '../../shared/zeebe-client';
import { MESSAGES } from '../../shared/messages';
import { TASK_TYPES } from '../../shared/task-types';
import { log, nowIso, senderId } from '../../shared/utils';

const ORG = 'DPT';

export function startDepotWorkers() {
  const client = makeClient();

  client.createJobWorker({
    type: TASK_TYPES.EMPTY_CTN_TO_TRANSPORT,
    worker: 'dpt-empty-ctn-to-transport',
    timeout: 10000,
    maxJobsToActivate: 5,
    jobHandler: async (job) => {
      const orderId = (job.variables as any).orderId;
      log(ORG, TASK_TYPES.EMPTY_CTN_TO_TRANSPORT, orderId);
      await client.publishMessage({
        name: MESSAGES.EMPTY_CTN_TO_TRANSPORT,
        correlationKey: orderId,
        timeToLive: 3600000,
        variables: {
          orderId,
          timestamp: nowIso(),
          senderId: senderId(ORG),
          containerId: 'MSKU1234567',
        },
      });
      return job.complete();
    },
  });

  client.createJobWorker({
    type: TASK_TYPES.CTN_ARRIVAL_INFO_TO_SA,
    worker: 'dpt-ctn-arrival-info-to-sa',
    timeout: 10000,
    maxJobsToActivate: 5,
    jobHandler: async (job) => {
      const orderId = (job.variables as any).orderId;
      log(ORG, TASK_TYPES.CTN_ARRIVAL_INFO_TO_SA, orderId);
      await client.publishMessage({
        name: MESSAGES.CTN_ARRIVAL_INFO_TO_SA,
        correlationKey: orderId,
        timeToLive: 3600000,
        variables: {
          orderId,
          timestamp: nowIso(),
          senderId: senderId(ORG),
          containerId: 'MSKU1234567',
          ctnArrivalConfirmed: true,
        },
      });
      return job.complete();
    },
  });

  client.createJobWorker({
    type: TASK_TYPES.OUTBOUND_CTN_TO_CT,
    worker: 'dpt-outbound-ctn-to-ct',
    timeout: 10000,
    maxJobsToActivate: 5,
    jobHandler: async (job) => {
      const orderId = (job.variables as any).orderId;
      log(ORG, TASK_TYPES.OUTBOUND_CTN_TO_CT, orderId);
      await client.publishMessage({
        name: MESSAGES.OUTBOUND_CTN_TO_CT,
        correlationKey: orderId,
        timeToLive: 3600000,
        variables: {
          orderId,
          timestamp: nowIso(),
          senderId: senderId(ORG),
          containerId: 'MSKU1234567',
        },
      });
      return job.complete();
    },
  });

  console.log(`[${ORG}] workers registered: empty-ctn-to-transport, ctn-arrival-info-to-sa, outbound-ctn-to-ct`);
}

if (require.main === module) {
  startDepotWorkers();
}
