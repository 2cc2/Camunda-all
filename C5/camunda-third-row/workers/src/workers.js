const { Camunda8 } = require("@camunda8/sdk");
const { getConfig } = require("./config");
const { nowIso, publishMessage } = require("./api");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildClient() {
  const { zeebeRestAddress } = getConfig();

  return new Camunda8({
    CAMUNDA_AUTH_STRATEGY: "NONE",
    ZEEBE_REST_ADDRESS: zeebeRestAddress
  }).getCamundaRestClient();
}

function startWorkers() {
  const config = getConfig();
  const client = buildClient();

  const handleManifestWorker = client.createJobWorker({
    type: "handle-manifest",
    timeout: 10000,
    maxJobsToActivate: 5,
    worker: "handle-manifest-worker",
    jobHandler: async (job, log) => {
      log.info(`handle-manifest started: ${job.jobKey}`);
      await sleep(600);

      const manifestId = `MAN-${job.variables.orderId}`;
      log.info(`Manifest prepared for FF and terminal: ${manifestId}`);
      return job.complete({
        manifestId,
        manifestTimestamp: nowIso(),
        manifestSentToFF: true,
        manifestSentToTerminal: true
      });
    }
  });

  const makeEquipmentReceiptWorker = client.createJobWorker({
    type: "make-equipment-receipt",
    timeout: 10000,
    maxJobsToActivate: 5,
    worker: "make-equipment-receipt-worker",
    jobHandler: async (job, log) => {
      log.info(`make-equipment-receipt started: ${job.jobKey}`);
      await sleep(600);

      const equipmentReceiptId = `EIR-${job.variables.orderId}`;
      log.info(`Equipment receipt prepared: ${equipmentReceiptId}`);
      return job.complete({
        equipmentReceiptId,
        equipmentReceiptTimestamp: nowIso(),
        equipmentReceiptSentToFF: true
      });
    }
  });

  const askDepotForCTNWorker = client.createJobWorker({
    type: "ask-depot-for-ctn",
    timeout: 10000,
    maxJobsToActivate: 5,
    worker: "ask-depot-for-ctn-worker",
    jobHandler: async (job, log) => {
      log.info(`ask-depot-for-ctn started: ${job.jobKey}`);
      await sleep(600);

      await publishMessage(config.camundaRestAddress, {
        name: "ctn-arrival-info",
        correlationKey: job.variables.orderId,
        timeToLive: 300000,
        variables: {
          orderId: job.variables.orderId,
          timestamp: nowIso(),
          senderId: "DEPOT-01",
          containerId: job.variables.containerId,
          ctnArrivalConfirmed: true
        }
      });

      log.info(`ctn-arrival-info published for order ${job.variables.orderId}`);
      return job.complete({
        depotRequestSent: true,
        depotRequestTimestamp: nowIso()
      });
    }
  });

  const shipArriveAtCTWorker = client.createJobWorker({
    type: "ship-arrive-at-ct",
    timeout: 10000,
    maxJobsToActivate: 5,
    worker: "ship-arrive-at-ct-worker",
    jobHandler: async (job, log) => {
      log.info(`ship-arrive-at-ct started: ${job.jobKey}`);
      await sleep(600);

      return job.complete({
        shipArrivalMessageSent: true,
        shipArrivalTimestamp: nowIso()
      });
    }
  });

  const makeCrewListToSBGSWorker = client.createJobWorker({
    type: "make-crew-list-to-sbgs",
    timeout: 10000,
    maxJobsToActivate: 5,
    worker: "make-crew-list-to-sbgs-worker",
    jobHandler: async (job, log) => {
      log.info(`make-crew-list-to-sbgs started: ${job.jobKey}`);
      await sleep(600);

      await publishMessage(config.camundaRestAddress, {
        name: "crew-list-to-sbgs",
        correlationKey: job.variables.orderId,
        timeToLive: 300000,
        variables: {
          orderId: job.variables.orderId,
          timestamp: nowIso(),
          senderId: "SHIPPING-AGENCY-01",
          vesselId: job.variables.vesselId,
          crewListId: `CREW-${job.variables.orderId}`
        }
      });

      await publishMessage(config.camundaRestAddress, {
        name: "ship-departure-notification",
        correlationKey: job.variables.orderId,
        timeToLive: 300000,
        variables: {
          orderId: job.variables.orderId,
          timestamp: nowIso(),
          senderId: "CONTAINER-TERMINAL-01",
          vesselId: job.variables.vesselId,
          departureTime: nowIso(),
          voyageNumber: job.variables.voyageNumber
        }
      });

      log.info(`crew-list-to-sbgs and ship-departure-notification published for order ${job.variables.orderId}`);
      return job.complete({
        crewListId: `CREW-${job.variables.orderId}`,
        crewListSent: true
      });
    }
  });

  const issueExpenseNoteWorker = client.createJobWorker({
    type: "issue-expense-note-to-owner",
    timeout: 10000,
    maxJobsToActivate: 5,
    worker: "issue-expense-note-to-owner-worker",
    jobHandler: async (job, log) => {
      log.info(`issue-expense-note-to-owner started: ${job.jobKey}`);
      await sleep(600);

      return job.complete({
        expenseNoteId: `EXP-${job.variables.orderId}`,
        expenseNoteSent: true,
        expenseAmount: 1250.5,
        expenseCurrency: "CNY"
      });
    }
  });

  const personnelInformationRegistrationWorker = client.createJobWorker({
    type: "personnel-information-registration",
    timeout: 10000,
    maxJobsToActivate: 5,
    worker: "personnel-information-registration-worker",
    jobHandler: async (job, log) => {
      log.info(`personnel-information-registration started: ${job.jobKey}`);
      await sleep(500);

      return job.complete({
        sbgsCheckCompleted: true,
        sbgsCheckTimestamp: nowIso()
      });
    }
  });

  return {
    handleManifestWorker,
    makeEquipmentReceiptWorker,
    askDepotForCTNWorker,
    shipArriveAtCTWorker,
    makeCrewListToSBGSWorker,
    issueExpenseNoteWorker,
    personnelInformationRegistrationWorker
  };
}

module.exports = {
  startWorkers
};
