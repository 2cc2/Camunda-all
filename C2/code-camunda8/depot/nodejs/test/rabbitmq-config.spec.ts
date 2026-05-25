import {
  DLX_EXCHANGE,
  MESSAGE_NAME_TO_ROUTING_KEY,
  QUEUES,
  RETRY,
  ROUTING_KEYS,
  ROUTING_KEY_TO_MESSAGE_NAME,
  createRabbitMessage
} from '../source/rabbitmq/config'
import { MESSAGE_NAMES } from '../source/config'

describe('Depot RabbitMQ config', () => {
  test('maps inbound and outbound Camunda message names to routing keys', () => {
    expect(MESSAGE_NAME_TO_ROUTING_KEY[MESSAGE_NAMES.askForCtn]).toBe(ROUTING_KEYS.depotAskForCtn)
    expect(MESSAGE_NAME_TO_ROUTING_KEY[MESSAGE_NAMES.outboundCtnToDepot]).toBe(
      ROUTING_KEYS.depotOutboundCtnToDepot
    )
    expect(MESSAGE_NAME_TO_ROUTING_KEY[MESSAGE_NAMES.emptyCtnToTransport]).toBe(
      ROUTING_KEYS.transportEmptyCtnToTransport
    )
    expect(MESSAGE_NAME_TO_ROUTING_KEY[MESSAGE_NAMES.ctnArrivalInfoToSa]).toBe(
      ROUTING_KEYS.shippingAgencyCtnArrivalInfoToSa
    )
    expect(MESSAGE_NAME_TO_ROUTING_KEY[MESSAGE_NAMES.outboundCtnToCt]).toBe(
      ROUTING_KEYS.containerTerminalOutboundCtnToCt
    )
  })

  test('supports reverse routing lookup', () => {
    expect(ROUTING_KEY_TO_MESSAGE_NAME[ROUTING_KEYS.depotAskForCtn]).toBe(MESSAGE_NAMES.askForCtn)
    expect(ROUTING_KEY_TO_MESSAGE_NAME[ROUTING_KEYS.containerTerminalOutboundCtnToCt]).toBe(
      MESSAGE_NAMES.outboundCtnToCt
    )
  })

  test('creates a standard RabbitMQ payload envelope', () => {
    const message = createRabbitMessage({
      camundaMessageName: MESSAGE_NAMES.askForCtn,
      correlationKey: 'ORDER-20260525-001',
      variables: { senderId: 'SHIPPING-AGENCY-01' },
      source: 'unit-test'
    })

    expect(message.camundaMessageName).toBe(MESSAGE_NAMES.askForCtn)
    expect(message.correlationKey).toBe('ORDER-20260525-001')
    expect(message.variables.senderId).toBe('SHIPPING-AGENCY-01')
    expect(message.source).toBe('unit-test')
    expect(typeof message.eventId).toBe('string')
    expect(typeof message.timestamp).toBe('string')
    expect(message.retryCount).toBe(0)
    expect(message.maxRetries).toBe(RETRY.maxRetries)
  })

  test('defines shared queue and DLQ names', () => {
    expect(QUEUES.transportInbound).toBe('camunda.transport')
    expect(QUEUES.shippingAgencyInbound).toBe('camunda.shipping-agency')
    expect(QUEUES.containerTerminalInbound).toBe('camunda.container-terminal')
    expect(QUEUES.deadLetter).toBe('dlq.camunda')
    expect(DLX_EXCHANGE.name).toBe('dlx.camunda')
  })
})
