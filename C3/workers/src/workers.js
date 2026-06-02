const { Camunda8 } = require("@camunda8/sdk");
const { getConfig } = require("./config");
const { nowIso } = require("./api");
const { publishBusinessMessage } = require("./rabbitmq");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function voyageNo(variables) {
  return variables.voyageNo || variables.voyageNumber;
}

function manifestPayload(variables) {
  return {
    orderId: variables.orderId,
    timestamp: nowIso(),
    senderId: "SAG",
    manifestNo: variables.manifestNo,
    soNo: variables.soNo,
    vesselId: variables.vesselId,
    voyageNo: voyageNo(variables),
    loadingPortCode: variables.loadingPortCode,
    dischargePortCode: variables.dischargePortCode,
    eta: variables.eta,
    containerCount: variables.containerCount
  };
}

function equipmentReceiptNo(variables) {
  return variables.equipmentReceiptNo || variables.eirRequestId || `ER-${variables.orderId}`;
}

function publishSagMessage(config, name, variables) {
  return publishBusinessMessage(config, name, variables);
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

      const payload = manifestPayload(job.variables);
      await publishSagMessage(config, "ff-manifest-received", payload);
      await publishSagMessage(config, "ct-manifest-received", payload);
      await publishSagMessage(config, "cb-manifest-received", payload);

      log.info(`Manifest notifications published for order ${job.variables.orderId}`);
      return job.complete({
        manifestNo: payload.manifestNo,
        manifestTimestamp: nowIso(),
        manifestSentToFF: true,
        manifestSentToTerminal: true,
        manifestSentToCustoms: true
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

      const receiptNo = equipmentReceiptNo(job.variables);
      await publishSagMessage(config, "make-equipment-receipt", {
        orderId: job.variables.orderId,
        timestamp: nowIso(),
        senderId: "SAG",
        equipmentReceiptNo: receiptNo,
        manifestNo: job.variables.manifestNo,
        depotId: job.variables.depotId,
        vesselId: job.variables.vesselId,
        voyageNo: voyageNo(job.variables),
        requestedContainerType: job.variables.requestedContainerType,
        requestedContainerCount: job.variables.requestedContainerCount,
        pickupValidUntil: "2026-04-17T23:59:59Z"
      });

      log.info(`make-equipment-receipt published for order ${job.variables.orderId}`);
      return job.complete({
        equipmentReceiptNo: receiptNo,
        equipmentReceiptTimestamp: nowIso(),
        equipmentReceiptSentToFF: true
      });
    }
  });

  const askForCTNWorker = client.createJobWorker({
    type: "ask-for-ctn",
    timeout: 10000,
    maxJobsToActivate: 5,
    worker: "ask-for-ctn-worker",
    jobHandler: async (job, log) => {
      log.info(`ask-for-ctn started: ${job.jobKey}`);
      await sleep(600);

      await publishSagMessage(config, "ask-for-ctn", {
        orderId: job.variables.orderId,
        timestamp: nowIso(),
        senderId: "SAG",
        requestNo: `REQ-${job.variables.orderId}`,
        equipmentReceiptNo: equipmentReceiptNo(job.variables),
        depotId: job.variables.depotId,
        requestedContainerType: job.variables.requestedContainerType,
        requestedContainerCount: job.variables.requestedContainerCount,
        requiredBefore: "2026-04-17T12:00:00Z",
        purpose: "Export loading",
        remarks: "Please confirm availability"
      });

      // Demo-only simulated depot reply, now routed through RabbitMQ and bridged to Camunda.
      await publishSagMessage(config, "ctn-arrival-info", {
        orderId: job.variables.orderId,
        timestamp: nowIso(),
        senderId: "DEPOT-01",
        containerId: job.variables.containerId,
        ctnArrivalConfirmed: true,
        timeToLive: 300000
      });

      log.info(`ask-for-ctn and ctn-arrival-info published for order ${job.variables.orderId}`);
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

      await publishSagMessage(config, "ship-arrive-at-ct", {
        orderId: job.variables.orderId,
        timestamp: nowIso(),
        senderId: "SAG",
        arrivalNoticeNo: `ARR-${job.variables.orderId}`,
        vesselId: job.variables.vesselId,
        voyageNo: voyageNo(job.variables),
        terminalId: job.variables.terminalId,
        actualArrivalTime: "2026-04-18T08:00:00Z",
        berthNo: "B12",
        manifestNo: job.variables.manifestNo,
        arrivalStatus: "arrived"
      });

      return job.complete({
        shipArrivalMessageSent: true,
        shipArrivalTimestamp: nowIso()
      });
    }
  });

  const makeCrewListToSBGSWorker = client.createJobWorker({
    type: "crewlist-received",
    timeout: 10000,
    maxJobsToActivate: 5,
    worker: "crewlist-received-worker",
    jobHandler: async (job, log) => {
      log.info(`crewlist-received started: ${job.jobKey}`);
      await sleep(600);

      await publishSagMessage(config, "crewlist-received", {
        orderId: job.variables.orderId,
        timestamp: nowIso(),
        senderId: "SAG",
        crewListNo: `CRL-${job.variables.orderId}`,
        vesselId: job.variables.vesselId,
        voyageNo: voyageNo(job.variables),
        departurePortCode: job.variables.dischargePortCode,
        estimatedDepartureTime: "2026-04-19T18:00:00Z",
        captainName: "LEE MINHO",
        crewCount: 2,
        crewMembers: [
          {
            fullName: "LEE MINHO",
            nationalityCode: "KR",
            passportNo: "M12345678",
            rank: "Captain"
          }
        ]
      });

      // Demo-only simulated terminal departure notice, now routed through RabbitMQ and bridged to Camunda.
      await publishSagMessage(config, "ship-departure-notification", {
        orderId: job.variables.orderId,
        timestamp: nowIso(),
        senderId: "CONTAINER-TERMINAL-01",
        vesselId: job.variables.vesselId,
        departureTime: nowIso(),
        voyageNo: voyageNo(job.variables),
        timeToLive: 300000
      });

      log.info(`crewlist-received and ship-departure-notification published for order ${job.variables.orderId}`);
      return job.complete({
        crewListNo: `CRL-${job.variables.orderId}`,
        crewListSent: true
      });
    }
  });

  const issueExpenseNoteWorker = client.createJobWorker({
    type: "expense-note-received",
    timeout: 10000,
    maxJobsToActivate: 5,
    worker: "expense-note-received-worker",
    jobHandler: async (job, log) => {
      log.info(`expense-note-received started: ${job.jobKey}`);
      await sleep(600);

      await publishSagMessage(config, "expense-note-received", {
        orderId: job.variables.orderId,
        timestamp: nowIso(),
        senderId: "SAG",
        expenseNoteNo: `EXP-${job.variables.orderId}`,
        ownerId: job.variables.ownerId,
        vesselId: job.variables.vesselId,
        voyageNo: voyageNo(job.variables),
        issueDate: nowIso(),
        currency: "USD",
        totalAmount: 1250.5,
        chargeItems: [
          {
            itemName: "Terminal handling charge",
            amount: 800.0,
            currency: "USD"
          }
        ]
      });

      return job.complete({
        expenseNoteNo: `EXP-${job.variables.orderId}`,
        expenseNoteSent: true,
        expenseAmount: 1250.5,
        expenseCurrency: "USD"
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
    askForCTNWorker,
    shipArriveAtCTWorker,
    makeCrewListToSBGSWorker,
    issueExpenseNoteWorker,
    personnelInformationRegistrationWorker
  };
}

module.exports = {
  startWorkers
};
