/**
 * Shipping Agency（船代）Worker
 *
 * Process_SA 涉及的 task 类型：
 *  - handle-manifest                  → 发布 ff-manifest-received + ct-manifest-received + cb-manifest-received
 *  - sa-equipment-receipt-received    → 发布 sa-equipment-receipt-received 给 FF
 *  - ask-for-ctn                      → 发布 ask-for-ctn 给 Depot
 *  - ship-arrive-at-ct                → 发布 ship-arrive-at-ct 给 CT
 *  - crewlist-received                → 发布 crewlist-received 给 SBGS
 *  - expense-note-received            → 发布 expense-note-received 给 Owner
 */

import { makeClient } from '../../shared/zeebe-client';
import { MESSAGES } from '../../shared/messages';
import { TASK_TYPES } from '../../shared/task-types';
import { log, nowIso, senderId } from '../../shared/utils';

const ORG = 'SAG';

export function startShippingAgencyWorkers() {
  const client = makeClient();

  client.createJobWorker({
    type: TASK_TYPES.HANDLE_MANIFEST,
    worker: 'sag-handle-manifest',
    timeout: 10000,
    maxJobsToActivate: 5,
    jobHandler: async (job) => {
      const orderId = (job.variables as any).orderId;
      log(ORG, TASK_TYPES.HANDLE_MANIFEST, orderId);
      const basePayload = {
        orderId,
        timestamp: nowIso(),
        senderId: senderId(ORG),
        manifestId: `MAN-${orderId}`,
        vesselId: 'VESSEL-042',
      };
      // 同一份 manifest 同步给三方：FF、CT、Customs
      await client.publishMessage({ name: MESSAGES.FF_MANIFEST_RECEIVED, correlationKey: orderId, timeToLive: 3600000, variables: basePayload });
      await client.publishMessage({ name: MESSAGES.CT_MANIFEST_RECEIVED, correlationKey: orderId, timeToLive: 3600000, variables: basePayload });
      await client.publishMessage({ name: MESSAGES.CB_MANIFEST_RECEIVED, correlationKey: orderId, timeToLive: 3600000, variables: basePayload });
      return job.complete({ manifestSent: true });
    },
  });

  client.createJobWorker({
    type: TASK_TYPES.SA_EQUIPMENT_RECEIPT_RECEIVED,
    worker: 'sag-make-equipment-receipt',
    timeout: 10000,
    maxJobsToActivate: 5,
    jobHandler: async (job) => {
      const orderId = (job.variables as any).orderId;
      log(ORG, TASK_TYPES.SA_EQUIPMENT_RECEIPT_RECEIVED, orderId);
      await client.publishMessage({
        name: MESSAGES.SA_EQUIPMENT_RECEIPT_RECEIVED,
        correlationKey: orderId,
        timeToLive: 3600000,
        variables: {
          orderId,
          timestamp: nowIso(),
          senderId: senderId(ORG),
          receiptId: `EIR-MSK-${Date.now()}`,
        },
      });
      return job.complete();
    },
  });

  client.createJobWorker({
    type: TASK_TYPES.ASK_FOR_CTN,
    worker: 'sag-ask-for-ctn',
    timeout: 10000,
    maxJobsToActivate: 5,
    jobHandler: async (job) => {
      const orderId = (job.variables as any).orderId;
      log(ORG, TASK_TYPES.ASK_FOR_CTN, orderId);
      await client.publishMessage({
        name: MESSAGES.ASK_FOR_CTN,
        correlationKey: orderId,
        timeToLive: 3600000,
        variables: {
          orderId,
          timestamp: nowIso(),
          senderId: senderId(ORG),
        },
      });
      return job.complete();
    },
  });

  client.createJobWorker({
    type: TASK_TYPES.SHIP_ARRIVE_AT_CT,
    worker: 'sag-ship-arrive-at-ct',
    timeout: 10000,
    maxJobsToActivate: 5,
    jobHandler: async (job) => {
      const orderId = (job.variables as any).orderId;
      log(ORG, TASK_TYPES.SHIP_ARRIVE_AT_CT, orderId);
      await client.publishMessage({
        name: MESSAGES.SHIP_ARRIVE_AT_CT,
        correlationKey: orderId,
        timeToLive: 3600000,
        variables: {
          orderId,
          timestamp: nowIso(),
          senderId: senderId(ORG),
          vesselId: 'VESSEL-042',
        },
      });
      return job.complete();
    },
  });

  client.createJobWorker({
    type: TASK_TYPES.CREWLIST_RECEIVED,
    worker: 'sag-crewlist',
    timeout: 10000,
    maxJobsToActivate: 5,
    jobHandler: async (job) => {
      const orderId = (job.variables as any).orderId;
      log(ORG, TASK_TYPES.CREWLIST_RECEIVED, orderId);
      await client.publishMessage({
        name: MESSAGES.CREWLIST_RECEIVED,
        correlationKey: orderId,
        timeToLive: 3600000,
        variables: {
          orderId,
          timestamp: nowIso(),
          senderId: senderId(ORG),
          crewListId: `CREW-${orderId}`,
        },
      });
      return job.complete();
    },
  });

  client.createJobWorker({
    type: TASK_TYPES.EXPENSE_NOTE_RECEIVED,
    worker: 'sag-expense-note',
    timeout: 10000,
    maxJobsToActivate: 5,
    jobHandler: async (job) => {
      const orderId = (job.variables as any).orderId;
      log(ORG, TASK_TYPES.EXPENSE_NOTE_RECEIVED, orderId);
      await client.publishMessage({
        name: MESSAGES.EXPENSE_NOTE_RECEIVED,
        correlationKey: orderId,
        timeToLive: 3600000,
        variables: {
          orderId,
          timestamp: nowIso(),
          senderId: senderId(ORG),
          expenseNoteId: `EXP-${orderId}`,
          amount: 1250.50,
          currency: 'CNY',
        },
      });
      return job.complete();
    },
  });

  console.log(`[${ORG}] workers registered: handle-manifest, sa-equipment-receipt-received, ask-for-ctn, ship-arrive-at-ct, crewlist-received, expense-note-received`);
}

if (require.main === module) {
  startShippingAgencyWorkers();
}
