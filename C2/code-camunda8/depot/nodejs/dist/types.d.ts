/**
 * Entity definitions for Depot (货场) contract.
 *
 * Derived from:
 * - depot.bpmn task variables
 * - message naming rules document
 * - current Depot collaboration chain:
 *   Shipping Agency -> Depot: ask-for-ctn
 *   Transport -> Depot: outbound-ctn-to-depot
 */
export interface CommonFields {
    orderId: string;
    timestamp: string;
    senderId: string;
}
/** Shipping Agency -> Depot: ask-for-ctn */
export interface AskForCtnPayload extends CommonFields {
    containerId: string;
    vesselId: string;
}
/** Transport -> Depot: outbound-ctn-to-depot */
export interface OutboundCtnToDepotPayload extends CommonFields {
    ctnNumber: string;
    vesselId: string;
    handOverTime: string;
    handoverTime?: string;
    receiptId: string;
    driverName: string;
    carLicense: string;
}
/** Depot -> Transport: empty-ctn-to-transport */
export interface EmptyCtnToTransportPayload extends CommonFields {
    transportId: string;
    containerId: string;
    vesselId: string;
}
/** Depot -> Shipping Agency: ctn-arrival-info-to-sa */
export interface CtnArrivalInfoToSaPayload extends CommonFields {
    shippingAgencyId: string;
    containerId: string;
    vesselId: string;
    arrivalTime: string;
    terminalLocation: string;
}
/** Depot -> Container Terminal: outbound-ctn-to-ct */
export interface OutboundCtnToCtPayload extends CommonFields {
    containerTerminalId: string;
    containerId: string;
    vesselId: string;
    receiptId: string;
    loadingCompletedTime: string;
    terminalLocation: string;
    handOverTime?: string;
    driverName?: string;
    carLicense?: string;
}
export interface DepotProcessVariables {
    orderId?: string;
    timestamp?: string;
    senderId?: string;
    containerId?: string;
    ctnNumber?: string;
    vesselId?: string;
    receiptId?: string;
    arrivalTime?: string;
    terminalLocation?: string;
    loadingCompletedTime?: string;
    handOverTime?: string;
    handoverTime?: string;
    driverName?: string;
    carLicense?: string;
    emptyCtnSentToTransport?: boolean;
    ctnArrivalInfoSentToSa?: boolean;
    outboundCtnSentToCt?: boolean;
}
//# sourceMappingURL=types.d.ts.map