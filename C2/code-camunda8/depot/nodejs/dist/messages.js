"use strict";
/**
 * Message flow functions for Depot contract.
 *
 * Provides typed builders for outbound messages and parsers for inbound messages.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidOrderId = isValidOrderId;
exports.isValidContainerId = isValidContainerId;
exports.isValidVesselId = isValidVesselId;
exports.buildEmptyCtnToTransport = buildEmptyCtnToTransport;
exports.buildCtnArrivalInfoToSa = buildCtnArrivalInfoToSa;
exports.buildOutboundCtnToCt = buildOutboundCtnToCt;
exports.parseAskForCtn = parseAskForCtn;
exports.parseOutboundCtnToDepot = parseOutboundCtnToDepot;
const config_1 = require("./config");
function nowIso() {
    return new Date().toISOString();
}
function buildCommon(orderId, senderId) {
    return {
        orderId,
        timestamp: nowIso(),
        senderId
    };
}
function isValidOrderId(orderId) {
    return /^ORDER-\d{8}-\d{3}$/.test(orderId);
}
function isValidContainerId(containerId) {
    return /^[A-Z]{4}\d{7}$/.test(containerId);
}
function isValidVesselId(vesselId) {
    return /^VESSEL-\d{3}$/.test(vesselId);
}
function buildEmptyCtnToTransport(orderId, containerId, vesselId) {
    validateOrderId(orderId);
    validateContainerId(containerId);
    validateVesselId(vesselId);
    return {
        ...buildCommon(orderId, config_1.PARTY.depot.id),
        transportId: config_1.PARTY.transport.id,
        containerId,
        vesselId
    };
}
function buildCtnArrivalInfoToSa(orderId, containerId, vesselId, arrivalTime, terminalLocation) {
    validateOrderId(orderId);
    validateContainerId(containerId);
    validateVesselId(vesselId);
    return {
        ...buildCommon(orderId, config_1.PARTY.depot.id),
        shippingAgencyId: config_1.PARTY.shippingAgency.id,
        containerId,
        vesselId,
        arrivalTime: arrivalTime ?? nowIso(),
        terminalLocation: terminalLocation ?? 'Shanghai Yangshan Terminal'
    };
}
function buildOutboundCtnToCt(orderId, containerId, vesselId, receiptId, loadingCompletedTime, terminalLocation, handOverTime, driverName, carLicense) {
    validateOrderId(orderId);
    validateContainerId(containerId);
    validateVesselId(vesselId);
    requireString(receiptId, 'receiptId');
    return {
        ...buildCommon(orderId, config_1.PARTY.depot.id),
        containerTerminalId: config_1.PARTY.containerTerminal.id,
        containerId,
        vesselId,
        receiptId,
        loadingCompletedTime: loadingCompletedTime ?? handOverTime ?? nowIso(),
        terminalLocation: terminalLocation ?? 'Shanghai Yangshan Terminal',
        handOverTime,
        driverName,
        carLicense
    };
}
function parseAskForCtn(raw) {
    const orderId = requireString(raw.orderId, 'orderId');
    const senderId = requireString(raw.senderId, 'senderId');
    const containerId = requireString(raw.containerId, 'containerId');
    const vesselId = requireString(raw.vesselId, 'vesselId');
    validateOrderId(orderId);
    validateContainerId(containerId);
    validateVesselId(vesselId);
    return {
        orderId,
        timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : nowIso(),
        senderId,
        containerId,
        vesselId
    };
}
function parseOutboundCtnToDepot(raw) {
    const orderId = requireString(raw.orderId, 'orderId');
    const senderId = requireString(raw.senderId, 'senderId');
    const ctnNumber = requireString(raw.ctnNumber, 'ctnNumber');
    const vesselId = requireString(raw.vesselId, 'vesselId');
    const handOverTime = requireString(raw.handOverTime ?? raw.handoverTime, 'handOverTime');
    const receiptId = requireString(raw.receiptId, 'receiptId');
    const driverName = requireString(raw.driverName, 'driverName');
    const carLicense = requireString(raw.carLicense, 'carLicense');
    validateOrderId(orderId);
    validateContainerId(ctnNumber);
    validateVesselId(vesselId);
    return {
        orderId,
        timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : nowIso(),
        senderId,
        ctnNumber,
        vesselId,
        handOverTime,
        handoverTime: handOverTime,
        receiptId,
        driverName,
        carLicense
    };
}
function validateOrderId(orderId) {
    if (!isValidOrderId(orderId)) {
        throw new Error(`Invalid orderId format: ${orderId}`);
    }
}
function validateContainerId(containerId) {
    if (!isValidContainerId(containerId)) {
        throw new Error(`Invalid containerId format: ${containerId}`);
    }
}
function validateVesselId(vesselId) {
    if (!isValidVesselId(vesselId)) {
        throw new Error(`Invalid vesselId format: ${vesselId}`);
    }
}
function requireString(value, fieldName) {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`Missing required string variable: ${fieldName}`);
    }
    return value;
}
//# sourceMappingURL=messages.js.map