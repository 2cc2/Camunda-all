/**
 * Customs Broker（报关行）Worker
 *
 * Process_CB 涉及的 task 类型：
 *  - declaration-submitted   → 发布 declaration-submitted 给 Customs
 *  - inspection-appointment  → 发布 inspection-appointment 给 Customs
 */

import { makeClient } from '../../shared/zeebe-client';
import { MESSAGES } from '../../shared/messages';
import { TASK_TYPES } from '../../shared/task-types';
import { log, nowIso, senderId } from '../../shared/utils';

const ORG = 'CUB';

export function startCustomsBrokerWorkers() {
  const client = makeClient();

  client.createJobWorker({
    type: TASK_TYPES.DECLARATION_SUBMITTED,
    worker: 'cub-declare-to-customs',
    timeout: 10000,
    maxJobsToActivate: 5,
    jobHandler: async (job) => {
      const orderId = (job.variables as any).orderId;
      log(ORG, TASK_TYPES.DECLARATION_SUBMITTED, orderId);
      const declarationId = `DECL-${orderId}-${Date.now()}`;
      await client.publishMessage({
        name: MESSAGES.DECLARATION_SUBMITTED,
        correlationKey: orderId,
        timeToLive: 3600000,
        variables: {
          orderId,
          timestamp: nowIso(),
          senderId: senderId(ORG),
          declarationId,
          hsCode: (job.variables as any).hsCode ?? '9503.00',
          declaredValue: (job.variables as any).declaredValue ?? 25000,
          currency: (job.variables as any).currency ?? 'USD',
          quantity: (job.variables as any).quantity ?? 500,
          countryOfOrigin: (job.variables as any).countryOfOrigin ?? 'CN',
          countryOfDestination: (job.variables as any).countryOfDestination ?? 'US',
          cargoDescription: (job.variables as any).cargoName ?? 'Mobile Accessories',
        },
      });
      return job.complete({ declarationId });
    },
  });

  client.createJobWorker({
    type: TASK_TYPES.INSPECTION_APPOINTMENT,
    worker: 'cub-appoint-for-inspection',
    timeout: 10000,
    maxJobsToActivate: 5,
    jobHandler: async (job) => {
      const orderId = (job.variables as any).orderId;
      log(ORG, TASK_TYPES.INSPECTION_APPOINTMENT, orderId);
      const appointmentId = `APT-${orderId}-${Date.now()}`;
      await client.publishMessage({
        name: MESSAGES.INSPECTION_APPOINTMENT,
        correlationKey: orderId,
        timeToLive: 3600000,
        variables: {
          orderId,
          timestamp: nowIso(),
          senderId: senderId(ORG),
          appointmentId,
          appointmentTime: nowIso(),
          inspectionLocation: 'Shanghai Yangshan Inspection Area',
          contactPerson: 'Li Ming',
          contactPhone: '+86-21-12345678',
        },
      });
      return job.complete({ appointmentId });
    },
  });

  console.log(`[${ORG}] workers registered: declaration-submitted, inspection-appointment`);
}

if (require.main === module) {
  startCustomsBrokerWorkers();
}
