"use strict";
/**
 * Message flow functions for Owner contract.
 *
 * Provides typed builders for outbound messages and parsers for inbound messages.
 * All functions enforce the naming-rule conventions (common fields, orderId format, etc.).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidOrderId = isValidOrderId;
exports.isValidContainerId = isValidContainerId;
exports.isValidVesselId = isValidVesselId;
exports.buildOrderToFfw = buildOrderToFfw;
exports.buildOutboundCtnToTransport = buildOutboundCtnToTransport;
exports.parseCtnToOwner = parseCtnToOwner;
exports.parseExpenseNoteToOwner = parseExpenseNoteToOwner;
const config_1 = require("./config");
// ============================================================================
// Helpers
// ============================================================================
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
/** Validates ORDER-YYYYMMDD-NNN pattern */
function isValidOrderId(orderId) {
    return /^ORDER-\d{8}-\d{3}$/.test(orderId);
}
/** Validates 4 letters + 7 digits container id */
function isValidContainerId(containerId) {
    return /^[A-Z]{4}\d{7}$/.test(containerId);
}
/** Validates VESSEL-NNN pattern */
function isValidVesselId(vesselId) {
    return /^VESSEL-\d{3}$/.test(vesselId);
}
// ============================================================================
// Outbound message builders
// ============================================================================
/**
 * Build M1: order-to-ffw payload.
 *
 * @param orderId   Order identifier (ORDER-YYYYMMDD-NNN)
 * @param order     Optional order details from handle-order task
 */
function buildOrderToFfw(orderId, order) {
    if (!isValidOrderId(orderId)) {
        throw new Error(`Invalid orderId format: ${orderId}`);
    }
    return {
        ...buildCommon(orderId, config_1.PARTY.owner.id),
        ffwId: config_1.PARTY.freightForwarder.id,
        pol: order?.pol ?? 'CNSHA',
        pod: order?.pod ?? 'CNSHA',
        cargoWeight: order?.cargoWeight ?? '1500kg',
        containerType: order?.containerType ?? '1x40HQ',
        order
    };
}
/**
 * Build M*: outbound-ctn-to-transport payload.
 *
 * @param orderId       Order identifier
 * @param ctnNumber     Container number assigned by Transport
 * @param pickupAddress Address where Transport should pick up the loaded container
 * @param contactName   On-site contact person
 * @param contactPhone  On-site contact phone
 * @param readyTime     ISO 8601 time when container is ready for pickup
 */
function buildOutboundCtnToTransport(orderId, ctnNumber, pickupAddress, contactName, contactPhone, readyTime) {
    if (!isValidOrderId(orderId)) {
        throw new Error(`Invalid orderId format: ${orderId}`);
    }
    return {
        ...buildCommon(orderId, config_1.PARTY.owner.id),
        transportId: config_1.PARTY.transport.id,
        ctnNumber,
        direction: 'outbound',
        readyTime: readyTime ?? nowIso(),
        pickupAddress,
        contactName,
        contactPhone
    };
}
// ============================================================================
// Inbound message parsers
// ============================================================================
/**
 * Parse and validate M22: ctn-to-owner inbound message.
 *
 * @param raw  Untyped object from Camunda message variables
 */
function parseCtnToOwner(raw) {
    const orderId = requireString(raw.orderId, 'orderId');
    const senderId = requireString(raw.senderId, 'senderId');
    const ctnNumber = requireString(raw.ctnNumber, 'ctnNumber');
    const handOverTime = requireString(raw.handOverTime, 'handOverTime');
    const driverName = requireString(raw.driverName, 'driverName');
    const carLicense = requireString(raw.carLicense, 'carLicense');
    return {
        orderId,
        timestamp: raw.timestamp ?? nowIso(),
        senderId,
        ctnNumber,
        handOverTime,
        driverName,
        carLicense
    };
}
/**
 * Parse and validate expense-note-to-owner inbound message.
 *
 * @param raw  Untyped object from Camunda message variables
 */
function parseExpenseNoteToOwner(raw) {
    const orderId = requireString(raw.orderId, 'orderId');
    const senderId = requireString(raw.senderId, 'senderId');
    const expenseId = requireString(raw.expenseId, 'expenseId');
    const expenseAmount = requireNumber(raw.expenseAmount, 'expenseAmount');
    const currency = requireString(raw.currency, 'currency');
    return {
        orderId,
        timestamp: raw.timestamp ?? nowIso(),
        senderId,
        expenseId,
        expenseAmount,
        currency
    };
}
// ============================================================================
// Validation helpers
// ============================================================================
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
//# sourceMappingURL=messages.js.map