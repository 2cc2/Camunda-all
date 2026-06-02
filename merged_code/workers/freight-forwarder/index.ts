/**
 * Freight Forwarder（货代）Worker
 *
 * Process_FF 涉及的 task 类型：
 *  - so-to-sa                       → 发布 so-to-sa 给 SA
 *  - order-info-to-cb               → 发布 order-info-to-cb 给 CB
 *  - equipment-receipt-to-transport → 发布 equipment-receipt-to-transport 给 Transport
 */

import { makeClient } from '../../shared/zeebe-client';
import { MESSAGES } from '../../shared/messages';
import { TASK_TYPES } from '../../shared/task-types';
import { log, nowIso, senderId } from '../../shared/utils';

const ORG = 'FFW';

export function startFreightForwarderWorkers() {
  const client = makeClient();

  client.createJobWorker({
    type: TASK_TYPES.SO_TO_SA,
    worker: 'ffw-so-to-sa',
    timeout: 10000,
    maxJobsToActivate: 5,
    jobHandler: async (job) => {
      const orderId = (job.variables as any).orderId;
      log(ORG, TASK_TYPES.SO_TO_SA, orderId);
      await client.publishMessage({
        name: MESSAGES.SO_TO_SA,
        correlationKey: orderId,
        timeToLive: 3600000,
        variables: {
          orderId,
          timestamp: nowIso(),
          senderId: senderId(ORG),
          saId: 'SA-MAERSK-01',
          pol: 'CNSHA',
          pod: 'CNSHA',
          cargoWeight: '15000kg',
          containerType: '1x40HQ',
        },
      });
      return job.complete();
    },
  });

  client.createJobWorker({
    type: TASK_TYPES.ORDER_INFO_TO_CB,
    worker: 'ffw-order-info-to-cb',
    timeout: 10000,
    maxJobsToActivate: 5,
    jobHandler: async (job) => {
      const orderId = (job.variables as any).orderId;
      log(ORG, TASK_TYPES.ORDER_INFO_TO_CB, orderId);
      await client.publishMessage({
        name: MESSAGES.ORDER_INFO_TO_CB,
        correlationKey: orderId,
        timeToLive: 3600000,
        variables: {
          orderId,
          timestamp: nowIso(),
          senderId: senderId(ORG),
          cbId: 'CB-EXPRESS-02',
          hsCode: '85171210',
          cargoName: 'Mobile Accessories',
          declaredValue: 25000,
          currency: 'USD',
          quantity: 500,
          countryOfOrigin: 'CN',
          countryOfDestination: 'US',
        },
      });
      return job.complete();
    },
  });

  client.createJobWorker({
    type: TASK_TYPES.EQUIPMENT_RECEIPT_TO_TRANSPORT,
    worker: 'ffw-equipment-receipt-to-transport',
    timeout: 10000,
    maxJobsToActivate: 5,
    jobHandler: async (job) => {
      const orderId = (job.variables as any).orderId;
      log(ORG, TASK_TYPES.EQUIPMENT_RECEIPT_TO_TRANSPORT, orderId);
      await client.publishMessage({
        name: MESSAGES.EQUIPMENT_RECEIPT_TO_TRANSPORT,
        correlationKey: orderId,
        timeToLive: 3600000,
        variables: {
          orderId,
          timestamp: nowIso(),
          senderId: senderId(ORG),
          transportId: 'TRANSPORT-FLEET-08',
          receiptId: `EIR-${orderId}`,
          pickupDepot: 'DEPOT-BAOSHAN-01',
        },
      });
      return job.complete();
    },
  });

  console.log(`[${ORG}] workers registered: so-to-sa, order-info-to-cb, equipment-receipt-to-transport`);
}

if (require.main === module) {
  startFreightForwarderWorkers();
}
