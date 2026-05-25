export declare const RABBITMQ_CONNECTION: {
    readonly url: string;
};
export declare const CAMUNDA_REST: {
    readonly publishUrl: `${string}/v2/messages/publication`;
};
export declare const EXCHANGE: {
    readonly name: "camunda.events";
    readonly type: "topic";
};
export declare const DLX_EXCHANGE: {
    readonly name: "dlx.camunda";
    readonly type: "direct";
    readonly routingKey: "dead";
};
export declare const RETRY: {
    readonly maxRetries: 3;
    readonly messageTtlMs: 600000;
    readonly observerQueueExpiresMs: 120000;
};
export declare const QUEUES: {
    readonly depotInbound: "camunda.depot";
    readonly transportInbound: "camunda.transport";
    readonly shippingAgencyInbound: "camunda.shipping-agency";
    readonly containerTerminalInbound: "camunda.container-terminal";
    readonly audit: "camunda.all";
    readonly deadLetter: "dlq.camunda";
};
export declare const ROUTING_KEYS: {
    readonly depotAskForCtn: "depot.ask-for-ctn";
    readonly depotOutboundCtnToDepot: "depot.outbound-ctn-to-depot";
    readonly transportEmptyCtnToTransport: "transport.empty-ctn-to-transport";
    readonly shippingAgencyCtnArrivalInfoToSa: "shipping-agency.ctn-arrival-info-to-sa";
    readonly containerTerminalOutboundCtnToCt: "container-terminal.outbound-ctn-to-ct";
};
export declare const MESSAGE_NAME_TO_ROUTING_KEY: Record<string, string>;
export declare const ROUTING_KEY_TO_MESSAGE_NAME: Record<string, string>;
export declare const BINDINGS: readonly [{
    readonly queue: "camunda.depot";
    readonly routingKey: "depot.ask-for-ctn";
}, {
    readonly queue: "camunda.depot";
    readonly routingKey: "depot.outbound-ctn-to-depot";
}, {
    readonly queue: "camunda.transport";
    readonly routingKey: "transport.empty-ctn-to-transport";
}, {
    readonly queue: "camunda.shipping-agency";
    readonly routingKey: "shipping-agency.ctn-arrival-info-to-sa";
}, {
    readonly queue: "camunda.container-terminal";
    readonly routingKey: "container-terminal.outbound-ctn-to-ct";
}, {
    readonly queue: "camunda.all";
    readonly routingKey: "#";
}, {
    readonly queue: "dlq.camunda";
    readonly routingKey: "dead";
}];
export interface RabbitMQCamundaMessage {
    camundaMessageName: string;
    correlationKey: string;
    variables: Record<string, any>;
    eventId: string;
    timestamp: string;
    source: string;
    retryCount: number;
    maxRetries: number;
}
export declare function createRabbitMessage(params: {
    camundaMessageName: string;
    correlationKey: string;
    variables: Record<string, any>;
    source?: string;
}): RabbitMQCamundaMessage;
//# sourceMappingURL=config.d.ts.map