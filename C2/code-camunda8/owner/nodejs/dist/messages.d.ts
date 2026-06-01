/**
 * Message flow functions for Owner contract.
 *
 * Provides typed builders for outbound messages and parsers for inbound messages.
 * All functions enforce the naming-rule conventions (common fields, orderId format, etc.).
 */
import { OrderToFfwPayload, OutboundCtnToTransportPayload, CtnToOwnerPayload, ExpenseNoteToOwnerPayload, OwnerOrder } from './types';
/** Validates ORDER-YYYYMMDD-NNN pattern */
export declare function isValidOrderId(orderId: string): boolean;
/** Validates 4 letters + 7 digits container id */
export declare function isValidContainerId(containerId: string): boolean;
/** Validates VESSEL-NNN pattern */
export declare function isValidVesselId(vesselId: string): boolean;
/**
 * Build M1: order-to-ffw payload.
 *
 * @param orderId   Order identifier (ORDER-YYYYMMDD-NNN)
 * @param order     Optional order details from handle-order task
 */
export declare function buildOrderToFfw(orderId: string, order?: OwnerOrder): OrderToFfwPayload;
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
export declare function buildOutboundCtnToTransport(orderId: string, ctnNumber: string, pickupAddress: string, contactName: string, contactPhone: string, readyTime?: string): OutboundCtnToTransportPayload;
/**
 * Parse and validate M22: ctn-to-owner inbound message.
 *
 * @param raw  Untyped object from Camunda message variables
 */
export declare function parseCtnToOwner(raw: Record<string, unknown>): CtnToOwnerPayload;
/**
 * Parse and validate expense-note-to-owner inbound message.
 *
 * @param raw  Untyped object from Camunda message variables
 */
export declare function parseExpenseNoteToOwner(raw: Record<string, unknown>): ExpenseNoteToOwnerPayload;
//# sourceMappingURL=messages.d.ts.map