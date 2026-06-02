/**
 * Owner（货主）Worker
 *
 * Process_1n9bswo 涉及的 task 类型：
 *  - fill-certificate         （userTask 转 serviceTask，自动通过）
 *  - handle-order             （内部处理订单）
 *  - order-to-ffw             （sendTask → 发布 order-to-ffw 给 FF）
 *  - outbound-ctn-to-transport（serviceTask → 发布 outbound-ctn-to-transport 给 Transport）
 *  - payment                  （内部结算，流程结束）
 */

import { makeClient } from '../../shared/zeebe-client';
import { MESSAGES } from '../../shared/messages';
import { TASK_TYPES } from '../../shared/task-types';
import { log, nowIso, senderId } from '../../shared/utils';

const ORG = 'OWN';

export function startOwnerWorkers() {
  const client = makeClient();

  client.createJobWorker({
    type: TASK_TYPES.FILL_CERTIFICATE,
    worker: 'owner-fill-certificate',
    timeout: 10000,
    maxJobsToActivate: 5,
    jobHandler: async (job) => {
      log(ORG, TASK_TYPES.FILL_CERTIFICATE, (job.variables as any).orderId);
      return job.complete({ certificateFilled: true });
    },
  });

  client.createJobWorker({
    type: TASK_TYPES.HANDLE_ORDER,
    worker: 'owner-handle-order',
    timeout: 10000,
    maxJobsToActivate: 5,
    jobHandler: async (job) => {
      log(ORG, TASK_TYPES.HANDLE_ORDER, (job.variables as any).orderId);
      return job.complete({ orderHandled: true });
    },
  });

  client.createJobWorker({
    type: TASK_TYPES.ORDER_TO_FFW,
    worker: 'owner-order-to-ffw',
    timeout: 10000,
    maxJobsToActivate: 5,
    jobHandler: async (job) => {
      const orderId = (job.variables as any).orderId;
      log(ORG, TASK_TYPES.ORDER_TO_FFW, orderId);
      await client.publishMessage({
        name: MESSAGES.ORDER_TO_FFW,
        correlationKey: orderId,
        timeToLive: 3600000,
        variables: {
          orderId,
          timestamp: nowIso(),
          senderId: senderId(ORG),
          ffwId: 'FF-GLOBAL-LOGISTICS',
          pol: 'CNSHA',
          pod: 'CNSHA',
          cargoWeight: '1500kg',
        },
      });
      return job.complete();
    },
  });

  client.createJobWorker({
    type: TASK_TYPES.OUTBOUND_CTN_TO_TRANSPORT,
    worker: 'owner-outbound-ctn-to-transport',
    timeout: 10000,
    maxJobsToActivate: 5,
    jobHandler: async (job) => {
      const orderId = (job.variables as any).orderId;
      log(ORG, TASK_TYPES.OUTBOUND_CTN_TO_TRANSPORT, orderId);
      await client.publishMessage({
        name: MESSAGES.OUTBOUND_CTN_TO_TRANSPORT,
        correlationKey: orderId,
        timeToLive: 3600000,
        variables: {
          orderId,
          timestamp: nowIso(),
          senderId: senderId(ORG),
          ctnReady: true,
        },
      });
      return job.complete();
    },
  });

  client.createJobWorker({
    type: TASK_TYPES.PAYMENT,
    worker: 'owner-payment',
    timeout: 10000,
    maxJobsToActivate: 5,
    jobHandler: async (job) => {
      log(ORG, TASK_TYPES.PAYMENT, (job.variables as any).orderId);
      return job.complete({ paymentCompleted: true });
    },
  });

  console.log(`[${ORG}] workers registered: fill-certificate, handle-order, order-to-ffw, outbound-ctn-to-transport, payment`);
}

// 单独启动：ts-node workers/owner/index.ts
if (require.main === module) {
  startOwnerWorkers();
}
