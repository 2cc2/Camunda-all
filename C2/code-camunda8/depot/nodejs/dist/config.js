"use strict";
/**
 * Depot contract configuration.
 *
 * Naming conventions:
 * - Message names: lower-case-with-hyphens
 * - Task types (job worker types): lower-case-with-hyphens
 * - Correlation key: orderId (ORDER-YYYYMMDD-NNN)
 * - All messages carry common fields: orderId, timestamp, senderId
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROCESS_IDS = exports.MESSAGE_NAMES = exports.JOB_TYPES = exports.PARTY = exports.CAMUNDA_REST_PUBLISH_ENDPOINT = exports.CAMUNDA_GRPC_ADDRESS = exports.CAMUNDA_REST_ADDRESS = exports.CAMUNDA_AUTH_STRATEGY = void 0;
exports.CAMUNDA_AUTH_STRATEGY = 'NONE';
exports.CAMUNDA_REST_ADDRESS = process.env.CAMUNDA_REST_ADDRESS ?? 'http://localhost:8080';
exports.CAMUNDA_GRPC_ADDRESS = process.env.CAMUNDA_GRPC_ADDRESS ?? 'grpc://localhost:26500';
exports.CAMUNDA_REST_PUBLISH_ENDPOINT = '/v2/messages/publication';
/** Party identifiers used by the Depot module */
exports.PARTY = {
    depot: { id: 'DEPOT-01', name: 'Depot (DPT)' },
    shippingAgency: { id: 'SHIPPING-AGENCY-01', name: 'Shipping Agency (SAG)' },
    transport: { id: 'TRANSPORT-FLEET-08', name: 'Transport (TRP)' },
    containerTerminal: { id: 'CONTAINER-TERMINAL-01', name: 'Container Terminal (CTE)' }
};
/** Job worker types for Depot BPMN tasks */
exports.JOB_TYPES = {
    sendEmptyCtnToTransport: 'send-empty-ctn-to-transport',
    sendCtnArrivalInfoToSa: 'send-ctn-arrival-info-to-sa',
    sendOutboundCtnToCt: 'send-outbound-ctn-to-ct'
};
/** Message names for Depot inbound / outbound integration */
exports.MESSAGE_NAMES = {
    askForCtn: 'ask-for-ctn',
    emptyCtnToTransport: 'empty-ctn-to-transport',
    ctnArrivalInfoToSa: 'ctn-arrival-info-to-sa',
    outboundCtnToDepot: 'outbound-ctn-to-depot',
    outboundCtnToCt: 'outbound-ctn-to-ct'
};
/** Process IDs used for deployment and instance creation */
exports.PROCESS_IDS = {
    depot: 'depot-export-contract'
};
//# sourceMappingURL=config.js.map