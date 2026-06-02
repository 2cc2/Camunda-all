/**
 * Customs（海关）Worker
 *
 * Process_Customs 涉及的 task 类型：
 *  - ciq                            （内部 - CIQ 检验检疫）
 *  - inspection                     （内部 - 物理查验）
 *  - clearance-to-broker            → 发布 clearance-to-broker 给 CB
 *  - customs-clearance-to-terminal  → 同时发布 customs-clearance-to-terminal（给 CT）+ customs-clearance-to-broker（给 CB）
 */

import { makeClient } from '../../shared/zeebe-client';
import { MESSAGES } from '../../shared/messages';
import { TASK_TYPES } from '../../shared/task-types';
import { log, nowIso, senderId } from '../../shared/utils';

const ORG = 'CUS';

export function startCustomsWorkers() {
  const client = makeClient();

  client.createJobWorker({
    type: TASK_TYPES.CIQ,
    worker: 'cus-ciq',
    timeout: 10000,
    maxJobsToActivate: 5,
    jobHandler: async (job) => {
      log(ORG, TASK_TYPES.CIQ, (job.variables as any).orderId);
      return job.complete({ ciqPassed: true });
    },
  });

  client.createJobWorker({
    type: TASK_TYPES.INSPECTION,
    worker: 'cus-inspection',
    timeout: 10000,
    maxJobsToActivate: 5,
    jobHandler: async (job) => {
      log(ORG, TASK_TYPES.INSPECTION, (job.variables as any).orderId);
      return job.complete({ inspectionPassed: true });
    },
  });

  client.createJobWorker({
    type: TASK_TYPES.CLEARANCE_TO_BROKER,
    worker: 'cus-clearance-to-broker',
    timeout: 10000,
    maxJobsToActivate: 5,
    jobHandler: async (job) => {
      const orderId = (job.variables as any).orderId;
      log(ORG, TASK_TYPES.CLEARANCE_TO_BROKER, orderId);
      await client.publishMessage({
        name: MESSAGES.CLEARANCE_TO_BROKER,
        correlationKey: orderId,
        timeToLive: 3600000,
        variables: {
          orderId,
          timestamp: nowIso(),
          senderId: senderId(ORG),
          clearanceId: `CLR-${orderId}`,
          clearanceStatus: 'APPROVED',
          clearanceTime: nowIso(),
        },
      });
      return job.complete();
    },
  });

  client.createJobWorker({
    type: TASK_TYPES.CUSTOMS_CLEARANCE_TO_TERMINAL,
    worker: 'cus-customs-clearance',
    timeout: 10000,
    maxJobsToActivate: 5,
    jobHandler: async (job) => {
      const orderId = (job.variables as any).orderId;
      log(ORG, TASK_TYPES.CUSTOMS_CLEARANCE_TO_TERMINAL, orderId);
      const payload = {
        orderId,
        timestamp: nowIso(),
        senderId: senderId(ORG),
        vesselId: 'VESSEL-042',
        containerId: 'MSKU1234567',
        clearanceStatus: 'APPROVED',
        clearanceTime: nowIso(),
      };
      // 海关放行后通知码头放行装船，并同步通知报关行（CB 的第二个 catch event）
      await client.publishMessage({ name: MESSAGES.CUSTOMS_CLEARANCE_TO_TERMINAL, correlationKey: orderId, timeToLive: 3600000, variables: payload });
      await client.publishMessage({ name: MESSAGES.CUSTOMS_CLEARANCE_TO_BROKER, correlationKey: orderId, timeToLive: 3600000, variables: payload });
      return job.complete();
    },
  });

  console.log(`[${ORG}] workers registered: ciq, inspection, clearance-to-broker, customs-clearance-to-terminal`);
}

if (require.main === module) {
  startCustomsWorkers();
}
