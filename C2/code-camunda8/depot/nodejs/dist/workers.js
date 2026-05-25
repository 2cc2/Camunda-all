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
class DirectCamundaMessagePublisher {
    client;
    constructor(client) {
        this.client = client;
    }
    async publishMessage(name, correlationKey, variables) {
        await this.client.publishMessage({
            name,
            correlationKey,
            timeToLive: 600,
            variables
        });
    }
}
function startDepotContractWorkers(client, publisher = new DirectCamundaMessagePublisher(client)) {
    const sendEmptyCtnToTransportWorker = client.createJobWorker({
        type: config_1.JOB_TYPES.sendEmptyCtnToTransport,
        timeout: 10000,
        maxJobsToActivate: 5,
        worker: 'dpt-send-empty-ctn-to-transport',
        jobHandler: async (job, log) => {
            const ask = (0, messages_1.parseAskForCtn)(job.variables);
            const variables = (0, messages_1.buildEmptyCtnToTransport)(ask.orderId, ask.containerId, ask.vesselId);
            log.info(`[send-empty-ctn-to-transport] jobKey=${job.jobKey} orderId=${ask.orderId}`);
            await publisher.publishMessage(config_1.MESSAGE_NAMES.emptyCtnToTransport, ask.orderId, variables);
            log.info(`[send-empty-ctn-to-transport] published=${config_1.MESSAGE_NAMES.emptyCtnToTransport}`);
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
            const variables = (0, messages_1.buildCtnArrivalInfoToSa)(ask.orderId, ask.containerId, ask.vesselId, arrivalTime, terminalLocation);
            log.info(`[send-ctn-arrival-info-to-sa] jobKey=${job.jobKey} orderId=${ask.orderId}`);
            await publisher.publishMessage(config_1.MESSAGE_NAMES.ctnArrivalInfoToSa, ask.orderId, variables);
            log.info(`[send-ctn-arrival-info-to-sa] published=${config_1.MESSAGE_NAMES.ctnArrivalInfoToSa}`);
            return job.complete({
                arrivalTime: variables.arrivalTime,
                terminalLocation: variables.terminalLocation,
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
            const variables = (0, messages_1.buildOutboundCtnToCt)(outbound.orderId, outbound.ctnNumber, outbound.vesselId, outbound.receiptId, loadingCompletedTime, terminalLocation, outbound.handOverTime, outbound.driverName, outbound.carLicense);
            log.info(`[send-outbound-ctn-to-ct] jobKey=${job.jobKey} orderId=${outbound.orderId}`);
            await publisher.publishMessage(config_1.MESSAGE_NAMES.outboundCtnToCt, outbound.orderId, variables);
            log.info(`[send-outbound-ctn-to-ct] published=${config_1.MESSAGE_NAMES.outboundCtnToCt}`);
            return job.complete({
                outboundCtnSentToCt: true,
                loadingCompletedTime: variables.loadingCompletedTime
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