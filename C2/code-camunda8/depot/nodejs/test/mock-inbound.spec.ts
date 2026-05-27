import { MESSAGE_NAMES, PARTY } from '../source/config'
import {
  buildAskForCtnMockVariables,
  buildOutboundCtnToDepotMockVariables,
  parseArgs,
  publishFollowupInboundMessages,
  publishMockInboundMessages,
  publishStartMessage
} from '../source/mock-inbound'

describe('Depot mock inbound helpers', () => {
  test('parseArgs reads --orderId from argv', () => {
    const args = parseArgs(['node', 'mock-inbound.ts', '--orderId=ORDER-20260507-101'])
    expect(args).toEqual({ orderId: 'ORDER-20260507-101' })
  })

  test('buildAskForCtnMockVariables creates a formal ask-for-ctn payload', () => {
    const payload = buildAskForCtnMockVariables('ORDER-20260507-102')

    expect(payload).toEqual(expect.objectContaining({
      orderId: 'ORDER-20260507-102',
      senderId: PARTY.shippingAgency.id,
      containerId: 'MSKU1234567',
      vesselId: 'VESSEL-042'
    }))
    expect(typeof payload.timestamp).toBe('string')
  })

  test('buildOutboundCtnToDepotMockVariables creates a formal outbound payload', () => {
    const payload = buildOutboundCtnToDepotMockVariables('ORDER-20260507-103')

    expect(payload).toEqual(expect.objectContaining({
      orderId: 'ORDER-20260507-103',
      senderId: PARTY.transport.id,
      ctnNumber: 'MSKU1234567',
      vesselId: 'VESSEL-042',
      receiptId: 'RECEIPT-20260507-001',
      driverName: 'Zhang San',
      carLicense: 'HU-A-12345'
    }))
    expect(typeof payload.timestamp).toBe('string')
    expect(typeof payload.handOverTime).toBe('string')
  })

  test('publishStartMessage emits the start message only', async () => {
    const publisher = {
      publishMessage: jest.fn(async () => undefined)
    }

    await publishStartMessage(publisher, 'ORDER-20260507-104')

    expect(publisher.publishMessage).toHaveBeenCalledTimes(1)
    expect(publisher.publishMessage).toHaveBeenCalledWith(
      MESSAGE_NAMES.askForCtn,
      'ORDER-20260507-104',
      expect.objectContaining({
        senderId: PARTY.shippingAgency.id,
        containerId: 'MSKU1234567'
      })
    )
  })

  test('publishFollowupInboundMessages emits the follow-up inbound message', async () => {
    const publisher = {
      publishMessage: jest.fn(async () => undefined)
    }
    const sleep = jest.fn(async () => undefined)

    await publishFollowupInboundMessages(publisher, 'ORDER-20260507-105', sleep)

    expect(publisher.publishMessage).toHaveBeenCalledTimes(1)
    expect(publisher.publishMessage).toHaveBeenCalledWith(
      MESSAGE_NAMES.outboundCtnToDepot,
      'ORDER-20260507-105',
      expect.objectContaining({
        senderId: PARTY.transport.id,
        ctnNumber: 'MSKU1234567',
        receiptId: 'RECEIPT-20260507-001'
      })
    )
    expect(sleep).toHaveBeenCalledWith(1500)
  })

  test('publishMockInboundMessages emits start and follow-up inbound messages in order', async () => {
    const publisher = {
      publishMessage: jest.fn(async () => undefined)
    }
    const sleep = jest.fn(async () => undefined)

    await publishMockInboundMessages(publisher, 'ORDER-20260507-106', sleep)

    expect(publisher.publishMessage).toHaveBeenCalledTimes(2)
    expect(publisher.publishMessage).toHaveBeenNthCalledWith(
      1,
      MESSAGE_NAMES.askForCtn,
      'ORDER-20260507-106',
      expect.objectContaining({
        senderId: PARTY.shippingAgency.id,
        containerId: 'MSKU1234567'
      })
    )
    expect(publisher.publishMessage).toHaveBeenNthCalledWith(
      2,
      MESSAGE_NAMES.outboundCtnToDepot,
      'ORDER-20260507-106',
      expect.objectContaining({
        senderId: PARTY.transport.id,
        ctnNumber: 'MSKU1234567',
        receiptId: 'RECEIPT-20260507-001'
      })
    )
    expect(sleep).toHaveBeenCalledWith(1500)
  })
})
