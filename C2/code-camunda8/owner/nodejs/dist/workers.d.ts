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
import { CamundaRestClient, Dto } from '@camunda8/sdk';
import { OwnerProcessVariables } from './types';
import { RabbitMQPublisher } from './rabbitmq/publisher';
declare class OwnerVariables extends Dto.LosslessDto implements OwnerProcessVariables {
    orderId?: string;
    timestamp?: string;
    senderId?: string;
    certificateOfEntrustment?: OwnerProcessVariables['certificateOfEntrustment'];
    order?: OwnerProcessVariables['order'];
    ctnNumber?: string;
    expenseAmount?: number;
    currency?: string;
    orderSentToFfw?: boolean;
    outboundCtnSentToTransport?: boolean;
    paymentDone?: boolean;
    paidAt?: string;
}
export declare function startOwnerContractWorkers(client: CamundaRestClient, rabbitPublisher?: RabbitMQPublisher): {
    fillCertificateWorker: import("@camunda8/sdk").CamundaJobWorker<OwnerVariables, OwnerVariables>;
    handleOrderWorker: import("@camunda8/sdk").CamundaJobWorker<OwnerVariables, OwnerVariables>;
    sendOrderToFfwWorker: import("@camunda8/sdk").CamundaJobWorker<OwnerVariables, OwnerVariables>;
    sendOutboundCtnToTransportWorker: import("@camunda8/sdk").CamundaJobWorker<OwnerVariables, OwnerVariables>;
    paymentWorker: import("@camunda8/sdk").CamundaJobWorker<OwnerVariables, OwnerVariables>;
};
export {};
//# sourceMappingURL=workers.d.ts.map