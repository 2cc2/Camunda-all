import { CAMUNDA_REST_ADDRESS, CAMUNDA_REST_PUBLISH_ENDPOINT, MESSAGE_NAMES } from '../config'

export const RABBITMQ_CONNECTION = {
  url: process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672'
} as const

export const CAMUNDA_REST = {
  publishUrl: `${CAMUNDA_REST_ADDRESS}${CAMUNDA_REST_PUBLISH_ENDPOINT}`
} as const

export const EXCHANGE = {
  name: 'camunda.events',
  type: 'topic' as const
} as const

export const DLX_EXCHANGE = {
  name: 'dlx.camunda',
  type: 'direct' as const,
  routingKey: 'dead'
} as const

export const RETRY = {
  maxRetries: 3,
  messageTtlMs: 600000,
  observerQueueExpiresMs: 120000
} as const

export const QUEUES = {
  depotInbound: 'camunda.depot',
  transportInbound: 'camunda.transport',
  shippingAgencyInbound: 'camunda.shipping-agency',
  containerTerminalInbound: 'camunda.container-terminal',
  audit: 'camunda.all',
  deadLetter: 'dlq.camunda'
} as const

export const ROUTING_KEYS = {
  depotAskForCtn: 'depot.ask-for-ctn',
  depotOutboundCtnToDepot: 'depot.outbound-ctn-to-depot',
  transportEmptyCtnToTransport: 'transport.empty-ctn-to-transport',
  shippingAgencyCtnArrivalInfoToSa: 'shipping-agency.ctn-arrival-info-to-sa',
  containerTerminalOutboundCtnToCt: 'container-terminal.outbound-ctn-to-ct'
} as const

export const MESSAGE_NAME_TO_ROUTING_KEY: Record<string, string> = {
  [MESSAGE_NAMES.askForCtn]: ROUTING_KEYS.depotAskForCtn,
  [MESSAGE_NAMES.outboundCtnToDepot]: ROUTING_KEYS.depotOutboundCtnToDepot,
  [MESSAGE_NAMES.emptyCtnToTransport]: ROUTING_KEYS.transportEmptyCtnToTransport,
  [MESSAGE_NAMES.ctnArrivalInfoToSa]: ROUTING_KEYS.shippingAgencyCtnArrivalInfoToSa,
  [MESSAGE_NAMES.outboundCtnToCt]: ROUTING_KEYS.containerTerminalOutboundCtnToCt
}

export const ROUTING_KEY_TO_MESSAGE_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(MESSAGE_NAME_TO_ROUTING_KEY).map(([messageName, routingKey]) => [routingKey, messageName])
)

export const BINDINGS = [
  { queue: QUEUES.depotInbound, routingKey: ROUTING_KEYS.depotAskForCtn },
  { queue: QUEUES.depotInbound, routingKey: ROUTING_KEYS.depotOutboundCtnToDepot },
  { queue: QUEUES.transportInbound, routingKey: ROUTING_KEYS.transportEmptyCtnToTransport },
  { queue: QUEUES.shippingAgencyInbound, routingKey: ROUTING_KEYS.shippingAgencyCtnArrivalInfoToSa },
  { queue: QUEUES.containerTerminalInbound, routingKey: ROUTING_KEYS.containerTerminalOutboundCtnToCt },
  { queue: QUEUES.audit, routingKey: '#' },
  { queue: QUEUES.deadLetter, routingKey: DLX_EXCHANGE.routingKey }
] as const

export interface RabbitMQCamundaMessage {
  camundaMessageName: string
  correlationKey: string
  variables: Record<string, any>
  eventId: string
  timestamp: string
  source: string
  retryCount: number
  maxRetries: number
}

export function createRabbitMessage(params: {
  camundaMessageName: string
  correlationKey: string
  variables: Record<string, any>
  source?: string
}): RabbitMQCamundaMessage {
  return {
    camundaMessageName: params.camundaMessageName,
    correlationKey: params.correlationKey,
    variables: params.variables,
    eventId: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    source: params.source ?? 'depot-rabbitmq-publisher',
    retryCount: 0,
    maxRetries: RETRY.maxRetries
  }
}
