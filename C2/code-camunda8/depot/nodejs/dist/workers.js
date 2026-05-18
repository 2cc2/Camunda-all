"use strict";
/**
 * Camunda 8 Job Workers for Depot contract.
 *
 * Maps BPMN tasks from depot.bpmn to worker implementations:
 * 1. send-empty-ctn-to-transport
 * 2. send-ctn-arrival-info-to-sa
 * 3. send-outbound-ctn-to-ct
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.startDepotContractWorkers = startDepotContractWorkers;
const sdk_1 = require("@camunda8/sdk");
const config_1 = require("./config");
const messages_1 = require("./messages");
class DepotVariables extends sdk_1.Dto.LosslessDto {
    orderId;
    timestamp;
    senderId;
    containerId;
    ctnNumber;
    vesselId;
    receiptId;
    arrivalTime;
    terminalLocation;
    loadingCompletedTime;
    handOverTime;
    driverName;
    carLicense;
    emptyCtnSentToTransport;
    ctnArrivalInfoSentToSa;
    outboundCtnSentToCt;
}
function optionalString(value) {
    return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}
function startDepotContractWorkers(client) {
    const sendEmptyCtnToTransportWorker = client.createJobWorker({
        type: config_1.JOB_TYPES.sendEmptyCtnToTransport,
        timeout: 10000,
        maxJobsToActivate: 5,
        worker: 'dpt-send-empty-ctn-to-transport',
        jobHandler: async (job, log) => {
            const ask = (0, messages_1.parseAskForCtn)(job.variables);
            const payload = {
                name: config_1.MESSAGE_NAMES.emptyCtnToTransport,
                correlationKey: ask.orderId,
                variables: (0, messages_1.buildEmptyCtnToTransport)(ask.orderId, ask.containerId, ask.vesselId)
            };
            log.info(`[send-empty-ctn-to-transport] jobKey=${job.jobKey} orderId=${ask.orderId}`);
            const response = await client.publishMessage({
                ...payload,
                timeToLive: 600
            });
            log.info(`[send-empty-ctn-to-transport] publishResponse=${JSON.stringify(response)}`);
            return job.complete({
                containerId: ask.containerId,
                vesselId: ask.vesselId,
                emptyCtnSentToTransport: true
            });
        }
    });
    const sendCtnArrivalInfoToSaWorker = client.createJobWorker({
        type: config_1.JOB_TYPES.sendCtnArrivalInfoToSa,
        timeout: 10000,
        maxJobsToActivate: 5,
        worker: 'dpt-send-ctn-arrival-info-to-sa',
        jobHandler: async (job, log) => {
            const ask = (0, messages_1.parseAskForCtn)(job.variables);
            const arrivalTime = optionalString(job.variables.arrivalTime);
            const terminalLocation = optionalString(job.variables.terminalLocation);
            const payload = {
                name: config_1.MESSAGE_NAMES.ctnArrivalInfoToSa,
                correlationKey: ask.orderId,
                variables: (0, messages_1.buildCtnArrivalInfoToSa)(ask.orderId, ask.containerId, ask.vesselId, arrivalTime, terminalLocation)
            };
            log.info(`[send-ctn-arrival-info-to-sa] jobKey=${job.jobKey} orderId=${ask.orderId}`);
            const response = await client.publishMessage({
                ...payload,
                timeToLive: 600
            });
            log.info(`[send-ctn-arrival-info-to-sa] publishResponse=${JSON.stringify(response)}`);
            return job.complete({
                arrivalTime: payload.variables.arrivalTime,
                terminalLocation: payload.variables.terminalLocation,
                ctnArrivalInfoSentToSa: true
            });
        }
    });
    const sendOutboundCtnToCtWorker = client.createJobWorker({
        type: config_1.JOB_TYPES.sendOutboundCtnToCt,
        timeout: 10000,
        maxJobsToActivate: 5,
        worker: 'dpt-send-outbound-ctn-to-ct',
        jobHandler: async (job, log) => {
            const outbound = (0, messages_1.parseOutboundCtnToDepot)(job.variables);
            const terminalLocation = optionalString(job.variables.terminalLocation);
            const loadingCompletedTime = optionalString(job.variables.loadingCompletedTime);
            const payload = {
                name: config_1.MESSAGE_NAMES.outboundCtnToCt,
                correlationKey: outbound.orderId,
                variables: (0, messages_1.buildOutboundCtnToCt)(outbound.orderId, outbound.ctnNumber, outbound.vesselId, outbound.receiptId, loadingCompletedTime, terminalLocation, outbound.handOverTime, outbound.driverName, outbound.carLicense)
            };
            log.info(`[send-outbound-ctn-to-ct] jobKey=${job.jobKey} orderId=${outbound.orderId}`);
            const response = await client.publishMessage({
                ...payload,
                timeToLive: 600
            });
            log.info(`[send-outbound-ctn-to-ct] publishResponse=${JSON.stringify(response)}`);
            return job.complete({
                outboundCtnSentToCt: true,
                loadingCompletedTime: payload.variables.loadingCompletedTime
            });
        }
    });
    return {
        sendEmptyCtnToTransportWorker,
        sendCtnArrivalInfoToSaWorker,
        sendOutboundCtnToCtWorker
    };
}
//# sourceMappingURL=workers.js.map