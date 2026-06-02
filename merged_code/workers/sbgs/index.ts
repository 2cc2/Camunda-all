/**
 * SBGS（边防）Worker
 *
 * Process_SBGS 涉及的 task 类型：
 *  - personnel-info-registration  （内部 - 船员信息登记，流程结束）
 */

import { makeClient } from '../../shared/zeebe-client';
import { TASK_TYPES } from '../../shared/task-types';
import { log } from '../../shared/utils';

const ORG = 'SBG';

export function startSbgsWorkers() {
  const client = makeClient();

  client.createJobWorker({
    type: TASK_TYPES.PERSONNEL_INFO_REGISTRATION,
    worker: 'sbg-personnel-info-registration',
    timeout: 10000,
    maxJobsToActivate: 5,
    jobHandler: async (job) => {
      log(ORG, TASK_TYPES.PERSONNEL_INFO_REGISTRATION, (job.variables as any).orderId);
      return job.complete({ sbgsRegistered: true });
    },
  });

  console.log(`[${ORG}] workers registered: personnel-info-registration`);
}

if (require.main === module) {
  startSbgsWorkers();
}
