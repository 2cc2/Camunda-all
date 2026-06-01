"use strict";
/**
 * Owner contract configuration.
 *
 * Naming conventions (from 并发理论大作业命名规则):
 * - Message names: lower-case-with-hyphens, e.g. order-to-ffw
 * - Task types (job worker types): lower-case-with-hyphens, e.g. fill-out-certificate
 * - Correlation key: orderId (format ORDER-YYYYMMDD-NNN)
 * - All messages carry common fields: orderId, timestamp, senderId
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROCESS_IDS = exports.MESSAGE_NAMES = exports.JOB_TYPES = exports.PARTY = exports.CAMUNDA_REST_ADDRESS = exports.CAMUNDA_AUTH_STRATEGY = void 0;
exports.CAMUNDA_AUTH_STRATEGY = 'NONE';
exports.CAMUNDA_REST_ADDRESS = process.env.CAMUNDA_REST_ADDRESS ?? 'http://localhost:8080';
/** Party identifiers per naming rules */
exports.PARTY = {
    owner: { id: 'OWNER-01', name: 'Owner (OWN)' },
    freightForwarder: { id: 'FF-GLOBAL-LOGISTICS', name: 'Freight Forwarder (FFW)' },
    transport: { id: 'TRANSPORT-FLEET-08', name: 'Transport (TRP)' }
};
/**
 * Job worker types for Owner BPMN tasks.
 * Must match the task types defined in owner.bpmn.
 */
exports.JOB_TYPES = {
    fillOutCertificateOfEntrustment: 'fill-out-certificate-of-entrustment',
    handleOrder: 'handle-order',
    sendOrderToFfw: 'send-order-to-ffw',
    sendOutboundCtnToTransport: 'send-outbound-ctn-to-transport',
    payment: 'payment'
};
/**
 * Message names for Owner outbound / inbound messages.
 * Lower-case-with-hyphens per naming rules.
 */
exports.MESSAGE_NAMES = {
    // Owner -> Freight Forwarder (M1)
    orderToFfw: 'order-to-ffw',
    // Transport -> Owner (M22)
    ctnToOwner: 'ctn-to-owner',
    // Owner -> Transport (M*)
    outboundCtnToTransport: 'outbound-ctn-to-transport',
    // Environment/Freight Forwarder -> Owner (expense note)
    expenseNoteToOwner: 'expense-note-to-owner'
};
/** Process IDs used for deployment and instance creation */
exports.PROCESS_IDS = {
    owner: 'Process_owner'
};
//# sourceMappingURL=config.js.map