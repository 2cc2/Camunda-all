/**
 * Owner contract configuration.
 *
 * Naming conventions (from 并发理论大作业命名规则):
 * - Message names: lower-case-with-hyphens, e.g. order-to-ffw
 * - Task types (job worker types): lower-case-with-hyphens, e.g. fill-out-certificate
 * - Correlation key: orderId (format ORDER-YYYYMMDD-NNN)
 * - All messages carry common fields: orderId, timestamp, senderId
 */
export declare const CAMUNDA_AUTH_STRATEGY: "NONE";
export declare const CAMUNDA_REST_ADDRESS: string;
/** Party identifiers per naming rules */
export declare const PARTY: {
    readonly owner: {
        readonly id: "OWNER-01";
        readonly name: "Owner (OWN)";
    };
    readonly freightForwarder: {
        readonly id: "FF-GLOBAL-LOGISTICS";
        readonly name: "Freight Forwarder (FFW)";
    };
    readonly transport: {
        readonly id: "TRANSPORT-FLEET-08";
        readonly name: "Transport (TRP)";
    };
};
/**
 * Job worker types for Owner BPMN tasks.
 * Must match the task types defined in owner.bpmn.
 */
export declare const JOB_TYPES: {
    readonly fillOutCertificateOfEntrustment: "fill-out-certificate-of-entrustment";
    readonly handleOrder: "handle-order";
    readonly sendOrderToFfw: "send-order-to-ffw";
    readonly sendOutboundCtnToTransport: "send-outbound-ctn-to-transport";
    readonly payment: "payment";
};
/**
 * Message names for Owner outbound / inbound messages.
 * Lower-case-with-hyphens per naming rules.
 */
export declare const MESSAGE_NAMES: {
    readonly orderToFfw: "order-to-ffw";
    readonly ctnToOwner: "ctn-to-owner";
    readonly outboundCtnToTransport: "outbound-ctn-to-transport";
    readonly expenseNoteToOwner: "expense-note-to-owner";
};
/** Process IDs used for deployment and instance creation */
export declare const PROCESS_IDS: {
    readonly owner: "Process_owner";
};
//# sourceMappingURL=config.d.ts.map