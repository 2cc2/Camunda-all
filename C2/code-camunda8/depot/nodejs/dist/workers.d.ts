/**
 * Camunda 8 Job Workers for Depot contract.
 *
 * Maps BPMN tasks from depot.bpmn to worker implementations:
 * 1. send-empty-ctn-to-transport
 * 2. send-ctn-arrival-info-to-sa
 * 3. send-outbound-ctn-to-ct
 */
import { CamundaRestClient, Dto } from '@camunda8/sdk';
import { DepotProcessVariables } from './types';
declare class DepotVariables extends Dto.LosslessDto implements DepotProcessVariables {
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
    driverName?: string;
    carLicense?: string;
    emptyCtnSentToTransport?: boolean;
    ctnArrivalInfoSentToSa?: boolean;
    outboundCtnSentToCt?: boolean;
}
export declare function startDepotContractWorkers(client: CamundaRestClient): {
    sendEmptyCtnToTransportWorker: import("@camunda8/sdk").CamundaJobWorker<DepotVariables, DepotVariables>;
    sendCtnArrivalInfoToSaWorker: import("@camunda8/sdk").CamundaJobWorker<DepotVariables, DepotVariables>;
    sendOutboundCtnToCtWorker: import("@camunda8/sdk").CamundaJobWorker<DepotVariables, DepotVariables>;
};
export {};
//# sourceMappingURL=workers.d.ts.map