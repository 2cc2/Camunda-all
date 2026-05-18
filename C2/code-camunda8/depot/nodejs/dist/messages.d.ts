/**
 * Message flow functions for Depot contract.
 *
 * Provides typed builders for outbound messages and parsers for inbound messages.
 */
import { AskForCtnPayload, CtnArrivalInfoToSaPayload, EmptyCtnToTransportPayload, OutboundCtnToCtPayload, OutboundCtnToDepotPayload } from './types';
export declare function isValidOrderId(orderId: string): boolean;
export declare function isValidContainerId(containerId: string): boolean;
export declare function isValidVesselId(vesselId: string): boolean;
export declare function buildEmptyCtnToTransport(orderId: string, containerId: string, vesselId: string): EmptyCtnToTransportPayload;
export declare function buildCtnArrivalInfoToSa(orderId: string, containerId: string, vesselId: string, arrivalTime?: string, terminalLocation?: string): CtnArrivalInfoToSaPayload;
export declare function buildOutboundCtnToCt(orderId: string, containerId: string, vesselId: string, receiptId: string, loadingCompletedTime?: string, terminalLocation?: string, handOverTime?: string, driverName?: string, carLicense?: string): OutboundCtnToCtPayload;
export declare function parseAskForCtn(raw: Record<string, unknown>): AskForCtnPayload;
export declare function parseOutboundCtnToDepot(raw: Record<string, unknown>): OutboundCtnToDepotPayload;
//# sourceMappingURL=messages.d.ts.map