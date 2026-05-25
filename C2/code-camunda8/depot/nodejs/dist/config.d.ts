/**
 * Depot contract configuration.
 *
 * Naming conventions:
 * - Message names: lower-case-with-hyphens
 * - Task types (job worker types): lower-case-with-hyphens
 * - Correlation key: orderId (ORDER-YYYYMMDD-NNN)
 * - All messages carry common fields: orderId, timestamp, senderId
 */
export declare const CAMUNDA_AUTH_STRATEGY: "NONE";
export declare const CAMUNDA_REST_ADDRESS: string;
export declare const CAMUNDA_GRPC_ADDRESS: string;
export declare const CAMUNDA_REST_PUBLISH_ENDPOINT = "/v2/messages/publication";
/** Party identifiers used by the Depot module */
export declare const PARTY: {
    readonly depot: {
        readonly id: "DEPOT-01";
        readonly name: "Depot (DPT)";
    };
    readonly shippingAgency: {
        readonly id: "SHIPPING-AGENCY-01";
        readonly name: "Shipping Agency (SAG)";
    };
    readonly transport: {
        readonly id: "TRANSPORT-FLEET-08";
        readonly name: "Transport (TRP)";
    };
    readonly containerTerminal: {
        readonly id: "CONTAINER-TERMINAL-01";
        readonly name: "Container Terminal (CTE)";
    };
};
/** Job worker types for Depot BPMN tasks */
export declare const JOB_TYPES: {
    readonly sendEmptyCtnToTransport: "send-empty-ctn-to-transport";
    readonly sendCtnArrivalInfoToSa: "send-ctn-arrival-info-to-sa";
    readonly sendOutboundCtnToCt: "send-outbound-ctn-to-ct";
};
/** Message names for Depot inbound / outbound integration */
export declare const MESSAGE_NAMES: {
    readonly askForCtn: "ask-for-ctn";
    readonly emptyCtnToTransport: "empty-ctn-to-transport";
    readonly ctnArrivalInfoToSa: "ctn-arrival-info-to-sa";
    readonly outboundCtnToDepot: "outbound-ctn-to-depot";
    readonly outboundCtnToCt: "outbound-ctn-to-ct";
};
/** Process IDs used for deployment and instance creation */
export declare const PROCESS_IDS: {
    readonly depot: "depot-export-contract";
};
//# sourceMappingURL=config.d.ts.map