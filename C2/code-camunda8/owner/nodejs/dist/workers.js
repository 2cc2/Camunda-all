"use strict";
/**
 * Camunda 8 Job Workers for Owner (货主) contract.
 *
 * Maps BPMN tasks from owner.bpmn to worker implementations:
 * 1. fill-out-certificate-of-entrustment  (userTask in BPMN)
 * 2. handle-order                         (serviceTask -> external)
 * 3. send-order-to-ffw                    (sendTask -> external)
 * 4. send-outbound-ctn-to-transport       (serviceTask -> external)
 * 5. payment                              (serviceTask -> external)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.startOwnerContractWorkers = startOwnerContractWorkers;
const sdk_1 = require("@camunda8/sdk");
const config_1 = require("./config");
const outbound_adapter_1 = require("./outbound-adapter");
// Re-export Dto for type reuse
class OwnerVariables extends sdk_1.Dto.LosslessDto {
    orderId;
    timestamp;
    senderId;
    certificateOfEntrustment;
    order;
    ctnNumber;
    expenseAmount;
    currency;
    orderSentToFfw;
    outboundCtnSentToTransport;
    paymentDone;
    paidAt;
}
function nowIso() {
    return new Date().toISOString();
}
function requireString(value, fieldName) {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`Missing required string variable: ${fieldName}`);
    }
    return value;
}
function requireNumber(value, fieldName) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new Error(`Missing required number variable: ${fieldName}`);
    }
    return value;
}
function withCommonFields(orderId, senderId, extra = {}) {
    return {
        orderId,
        timestamp: nowIso(),
        senderId,
        ...extra
    };
}
function startOwnerContractWorkers(client, rabbitPublisher) {
    // --------------------------------------------------------------------------
    // 1. fill-out-certificate-of-entrustment
    // --------------------------------------------------------------------------
    const fillCertificateWorker = client.createJobWorker({
        type: config_1.JOB_TYPES.fillOutCertificateOfEntrustment,
        timeout: 10000,
        maxJobsToActivate: 5,
        worker: 'own-fill-out-certificate-of-entrustment',
        jobHandler: async (job, log) => {
            const orderId = requireString(job.variables.orderId, 'orderId');
            const certificateOfEntrustment = job.variables.certificateOfEntrustment ?? {
                telephone: '17798839621',
                consignorName: '上海货主有限公司'
            };
            log.info(`[fill-out-certificate-of-entrustment] jobKey=${job.jobKey} orderId=${orderId}`);
            return job.complete({
                certificateOfEntrustment,
                timestamp: nowIso(),
                senderId: config_1.PARTY.owner.id
            });
        }
    });
    // --------------------------------------------------------------------------
    // 2. handle-order (includes Customs Order processing)
    // --------------------------------------------------------------------------
    const handleOrderWorker = client.createJobWorker({
        type: config_1.JOB_TYPES.handleOrder,
        timeout: 10000,
        maxJobsToActivate: 5,
        worker: 'own-handle-order',
        jobHandler: async (job, log) => {
            const orderId = requireString(job.variables.orderId, 'orderId');
            const order = job.variables.order ?? {
                customsOrderNo: 'CUS-ORDER-001',
                goodsDescription: 'General cargo',
                pol: 'CNSHA',
                pod: 'CNSHA',
                cargoWeight: '1500kg',
                containerType: '1x40HQ'
            };
            log.info(`[handle-order] jobKey=${job.jobKey} orderId=${orderId}`);
            return job.complete({
                order,
                timestamp: nowIso(),
                senderId: config_1.PARTY.owner.id
            });
        }
    });
    // --------------------------------------------------------------------------
    // 3. send-order-to-ffw (M1: order-to-ffw)
    // --------------------------------------------------------------------------
    const sendOrderToFfwWorker = client.createJobWorker({
        type: config_1.JOB_TYPES.sendOrderToFfw,
        timeout: 10000,
        maxJobsToActivate: 5,
        worker: 'own-send-order-to-ffw',
        jobHandler: async (job, log) => {
            const orderId = requireString(job.variables.orderId, 'orderId');
            const order = job.variables.order;
            const payload = {
                name: config_1.MESSAGE_NAMES.orderToFfw,
                correlationKey: orderId,
                variables: withCommonFields(orderId, config_1.PARTY.owner.id, {
                    ffwId: config_1.PARTY.freightForwarder.id,
                    pol: order?.pol ?? 'CNSHA',
                    pod: order?.pod ?? 'CNSHA',
                    cargoWeight: order?.cargoWeight ?? '1500kg',
                    containerType: order?.containerType ?? '1x40HQ',
                    order
                })
            };
            log.info(`[send-order-to-ffw] jobKey=${job.jobKey} orderId=${orderId}`);
            await (0, outbound_adapter_1.sendOutboundMessage)(rabbitPublisher, client, config_1.MESSAGE_NAMES.orderToFfw, orderId, payload.variables, 600);
            return job.complete({ orderSentToFfw: true });
        }
    });
    // --------------------------------------------------------------------------
    // 4. send-outbound-ctn-to-transport (M*: outbound-ctn-to-transport)
    // --------------------------------------------------------------------------
    const sendOutboundCtnToTransportWorker = client.createJobWorker({
        type: config_1.JOB_TYPES.sendOutboundCtnToTransport,
        timeout: 10000,
        maxJobsToActivate: 5,
        worker: 'own-send-outbound-ctn-to-transport',
        jobHandler: async (job, log) => {
            const orderId = requireString(job.variables.orderId, 'orderId');
            const ctnNumber = job.variables.ctnNumber ?? 'CTN-884821';
            const payload = {
                name: config_1.MESSAGE_NAMES.outboundCtnToTransport,
                correlationKey: orderId,
                variables: withCommonFields(orderId, config_1.PARTY.owner.id, {
                    transportId: config_1.PARTY.transport.id,
                    ctnNumber,
                    direction: 'outbound',
                    readyTime: nowIso(),
                    pickupAddress: '上海市浦东新区临港装箱点A区',
                    contactName: '李四',
                    contactPhone: '13800138000'
                })
            };
            log.info(`[send-outbound-ctn-to-transport] jobKey=${job.jobKey} orderId=${orderId} ctn=${ctnNumber}`);
            await (0, outbound_adapter_1.sendOutboundMessage)(rabbitPublisher, client, config_1.MESSAGE_NAMES.outboundCtnToTransport, orderId, payload.variables, 600);
            return job.complete({ outboundCtnSentToTransport: true });
        }
    });
    // --------------------------------------------------------------------------
    // 5. payment
    // --------------------------------------------------------------------------
    const paymentWorker = client.createJobWorker({
        type: config_1.JOB_TYPES.payment,
        timeout: 10000,
        maxJobsToActivate: 5,
        worker: 'own-payment',
        jobHandler: async (job, log) => {
            const orderId = requireString(job.variables.orderId, 'orderId');
            const expenseAmount = job.variables.expenseAmount ?? 1234.56;
            const currency = job.variables.currency ?? 'CNY';
            log.info(`[payment] jobKey=${job.jobKey} orderId=${orderId} amount=${expenseAmount} ${currency}`);
            return job.complete({
                paidAt: nowIso(),
                paymentDone: true
            });
        }
    });
    return {
        fillCertificateWorker,
        handleOrderWorker,
        sendOrderToFfwWorker,
        sendOutboundCtnToTransportWorker,
        paymentWorker
    };
}
//# sourceMappingURL=workers.js.map