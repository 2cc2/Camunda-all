"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BINDINGS = exports.ROUTING_KEY_TO_MESSAGE_NAME = exports.MESSAGE_NAME_TO_ROUTING_KEY = exports.ROUTING_KEYS = exports.QUEUES = exports.RETRY = exports.DLX_EXCHANGE = exports.EXCHANGE = exports.CAMUNDA_REST = exports.RABBITMQ_CONNECTION = void 0;
exports.createRabbitMessage = createRabbitMessage;
const config_1 = require("../config");
exports.RABBITMQ_CONNECTION = {
    url: process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672'
};
exports.CAMUNDA_REST = {
    publishUrl: `${config_1.CAMUNDA_REST_ADDRESS}${config_1.CAMUNDA_REST_PUBLISH_ENDPOINT}`
};
exports.EXCHANGE = {
    name: 'camunda.events',
    type: 'topic'
};
exports.DLX_EXCHANGE = {
    name: 'dlx.camunda',
    type: 'direct',
    routingKey: 'dead'
};
exports.RETRY = {
    maxRetries: 3,
    messageTtlMs: 600000,
    observerQueueExpiresMs: 120000
};
exports.QUEUES = {
    depotInbound: 'camunda.depot',
    transportInbound: 'camunda.transport',
    shippingAgencyInbound: 'camunda.shipping-agency',
    containerTerminalInbound: 'camunda.container-terminal',
    audit: 'camunda.all',
    deadLetter: 'dlq.camunda'
};
exports.ROUTING_KEYS = {
    depotAskForCtn: 'depot.ask-for-ctn',
    depotOutboundCtnToDepot: 'depot.outbound-ctn-to-depot',
    transportEmptyCtnToTransport: 'transport.empty-ctn-to-transport',
    shippingAgencyCtnArrivalInfoToSa: 'shipping-agency.ctn-arrival-info-to-sa',
    containerTerminalOutboundCtnToCt: 'container-terminal.outbound-ctn-to-ct'
};
exports.MESSAGE_NAME_TO_ROUTING_KEY = {
    [config_1.MESSAGE_NAMES.askForCtn]: exports.ROUTING_KEYS.depotAskForCtn,
    [config_1.MESSAGE_NAMES.outboundCtnToDepot]: exports.ROUTING_KEYS.depotOutboundCtnToDepot,
    [config_1.MESSAGE_NAMES.emptyCtnToTransport]: exports.ROUTING_KEYS.transportEmptyCtnToTransport,
    [config_1.MESSAGE_NAMES.ctnArrivalInfoToSa]: exports.ROUTING_KEYS.shippingAgencyCtnArrivalInfoToSa,
    [config_1.MESSAGE_NAMES.outboundCtnToCt]: exports.ROUTING_KEYS.containerTerminalOutboundCtnToCt
};
exports.ROUTING_KEY_TO_MESSAGE_NAME = Object.fromEntries(Object.entries(exports.MESSAGE_NAME_TO_ROUTING_KEY).map(([messageName, routingKey]) => [routingKey, messageName]));
exports.BINDINGS = [
    { queue: exports.QUEUES.depotInbound, routingKey: exports.ROUTING_KEYS.depotAskForCtn },
    { queue: exports.QUEUES.depotInbound, routingKey: exports.ROUTING_KEYS.depotOutboundCtnToDepot },
    { queue: exports.QUEUES.transportInbound, routingKey: exports.ROUTING_KEYS.transportEmptyCtnToTransport },
    { queue: exports.QUEUES.shippingAgencyInbound, routingKey: exports.ROUTING_KEYS.shippingAgencyCtnArrivalInfoToSa },
    { queue: exports.QUEUES.containerTerminalInbound, routingKey: exports.ROUTING_KEYS.containerTerminalOutboundCtnToCt },
    { queue: exports.QUEUES.audit, routingKey: '#' },
    { queue: exports.QUEUES.deadLetter, routingKey: exports.DLX_EXCHANGE.routingKey }
];
function createRabbitMessage(params) {
    return {
        camundaMessageName: params.camundaMessageName,
        correlationKey: params.correlationKey,
        variables: params.variables,
        eventId: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        source: params.source ?? 'depot-rabbitmq-publisher',
        retryCount: 0,
        maxRetries: exports.RETRY.maxRetries
    };
}
//# sourceMappingURL=config.js.map