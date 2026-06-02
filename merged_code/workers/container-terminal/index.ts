/**
 * Container Terminal（码头）Worker
 *
 * Process_CT 涉及的 task 类型：
 *  - load-ctn                     （内部 - 装箱）
 *  - arrival-to-customs           → 发布 arrival-to-customs 给 Customs
 *  - ship-departure-notification  → 发布 ship-departure-notification 给 SA
 */

import { makeClient } from '../../shared/zeebe-client';
import { MESSAGES } from '../../shared/messages';
import { TASK_TYPES } from '../../shared/task-types';
import { log, nowIso, senderId } from '../../shared/utils';

const ORG = 'CTE';

export function startContainerTerminalWorkers() {
  const client = makeClient();

  client.createJobWorker({
    type: TASK_TYPES.LOAD_CTN,
    worker: 'cte-load-ctn',
    timeout: 10000,
    maxJobsToActivate: 5,
    jobHandler: async (job) => {
      log(ORG, TASK_TYPES.LOAD_CTN, (job.variables as any).orderId);
      return job.complete({ ctnLoaded: true, loadingCompletedTime: nowIso() });
    },
  });

  client.createJobWorker({
    type: TASK_TYPES.ARRIVAL_TO_CUSTOMS,
    worker: 'cte-arrival-to-customs',
    timeout: 10000,
    maxJobsToActivate: 5,
    jobHandler: async (job) => {
      const orderId = (job.variables as any).orderId;
      log(ORG, TASK_TYPES.ARRIVAL_TO_CUSTOMS, orderId);
      await client.publishMessage({
        name: MESSAGES.ARRIVAL_TO_CUSTOMS,
        correlationKey: orderId,
        timeToLive: 3600000,
        variables: {
          orderId,
          timestamp: nowIso(),
          senderId: senderId(ORG),
          vesselId: 'VESSEL-042',
          containerId: 'MSKU1234567',
          arrivalTime: nowIso(),
          loadingCompletedTime: nowIso(),
          terminalLocation: 'Shanghai Yangshan Terminal',
        },
      });
      return job.complete();
    },
  });

  client.createJobWorker({
    type: TASK_TYPES.SHIP_DEPARTURE_NOTIFICATION,
    worker: 'cte-ship-departure',
    timeout: 10000,
    maxJobsToActivate: 5,
    jobHandler: async (job) => {
      const orderId = (job.variables as any).orderId;
      log(ORG, TASK_TYPES.SHIP_DEPARTURE_NOTIFICATION, orderId);
      await client.publishMessage({
        name: MESSAGES.SHIP_DEPARTURE_NOTIFICATION,
        correlationKey: orderId,
        timeToLive: 3600000,
        variables: {
          orderId,
          timestamp: nowIso(),
          senderId: senderId(ORG),
          vesselId: 'VESSEL-042',
          departureTime: nowIso(),
          voyageNumber: 'V2026-042E',
          nextPort: 'USLAX',
        },
      });
      return job.complete();
    },
  });

  console.log(`[${ORG}] workers registered: load-ctn, arrival-to-customs, ship-departure-notification`);
}

if (require.main === module) {
  startContainerTerminalWorkers();
}
