/**
 * Depot contract unit tests.
 *
 * Covers:
 * - Message payload builders
 * - Message payload parsers
 * - Naming rule validation helpers
 */

import {
  buildCtnArrivalInfoToSa,
  buildEmptyCtnToTransport,
  buildOutboundCtnToCt,
  isValidContainerId,
  isValidOrderId,
  isValidVesselId,
  parseAskForCtn,
  parseOutboundCtnToDepot
} from '../source/messages'
import { PARTY } from '../source/config'

describe('Naming rule validators', () => {
  test('isValidOrderId accepts ORDER-YYYYMMDD-NNN', () => {
    expect(isValidOrderId('ORDER-20260507-001')).toBe(true)
    expect(isValidOrderId('ORDER-19990101-999')).toBe(true)
  })

  test('isValidOrderId rejects bad formats', () => {
    expect(isValidOrderId('ORDER-20260507-01')).toBe(false)
    expect(isValidOrderId('ORDER-2026050-001')).toBe(false)
    expect(isValidOrderId('ORD-20260507-001')).toBe(false)
  })

  test('isValidContainerId accepts 4 letters + 7 digits', () => {
    expect(isValidContainerId('MSKU1234567')).toBe(true)
    expect(isValidContainerId('ABCD0000000')).toBe(true)
  })

  test('isValidContainerId rejects bad formats', () => {
    expect(isValidContainerId('MSKU123456')).toBe(false)
    expect(isValidContainerId('msku1234567')).toBe(false)
  })

  test('isValidVesselId accepts VESSEL-NNN', () => {
    expect(isValidVesselId('VESSEL-042')).toBe(true)
    expect(isValidVesselId('VESSEL-001')).toBe(true)
  })

  test('isValidVesselId rejects bad formats', () => {
    expect(isValidVesselId('VESSEL-42')).toBe(false)
    expect(isValidVesselId('VESSEL-1234')).toBe(false)
  })
})

describe('Outbound payload builders', () => {
  const orderId = 'ORDER-20260507-001'
  const containerId = 'MSKU1234567'
  const vesselId = 'VESSEL-042'

  test('buildEmptyCtnToTransport includes common fields and target id', () => {
    const payload = buildEmptyCtnToTransport(orderId, containerId, vesselId)
    expect(payload.orderId).toBe(orderId)
    expect(payload.senderId).toBe(PARTY.depot.id)
    expect(payload.transportId).toBe(PARTY.transport.id)
    expect(payload.containerId).toBe(containerId)
    expect(payload.vesselId).toBe(vesselId)
  })

  test('buildCtnArrivalInfoToSa uses defaults when optional args omitted', () => {
    const payload = buildCtnArrivalInfoToSa(orderId, containerId, vesselId)
    expect(payload.senderId).toBe(PARTY.depot.id)
    expect(payload.shippingAgencyId).toBe(PARTY.shippingAgency.id)
    expect(payload.terminalLocation).toBe('Shanghai Yangshan Terminal')
    expect(typeof payload.arrivalTime).toBe('string')
  })

  test('buildOutboundCtnToCt carries receipt and optional handover fields', () => {
    const payload = buildOutboundCtnToCt(
      orderId,
      containerId,
      vesselId,
      'RECEIPT-20260507-001',
      '2026-05-07T14:30:00Z',
      'Shanghai Yangshan Terminal',
      '2026-05-07T14:20:00Z',
      'Zhang San',
      'HU-A-12345'
    )

    expect(payload.senderId).toBe(PARTY.depot.id)
    expect(payload.containerTerminalId).toBe(PARTY.containerTerminal.id)
    expect(payload.receiptId).toBe('RECEIPT-20260507-001')
    expect(payload.handOverTime).toBe('2026-05-07T14:20:00Z')
    expect(payload.driverName).toBe('Zhang San')
  })

  test('builders throw on invalid orderId', () => {
    expect(() => buildEmptyCtnToTransport('BAD', containerId, vesselId)).toThrow('Invalid orderId format')
  })

  test('builders throw on invalid containerId and vesselId', () => {
    expect(() => buildCtnArrivalInfoToSa(orderId, 'BAD-ID', vesselId)).toThrow('Invalid containerId format')
    expect(() => buildOutboundCtnToCt(orderId, containerId, 'VESSEL-42', 'REC-1'))
      .toThrow('Invalid vesselId format')
  })

  test('buildOutboundCtnToCt falls back to handOverTime when loadingCompletedTime is omitted', () => {
    const payload = buildOutboundCtnToCt(
      orderId,
      containerId,
      vesselId,
      'RECEIPT-20260507-001',
      undefined,
      undefined,
      '2026-05-07T14:20:00Z'
    )

    expect(payload.loadingCompletedTime).toBe('2026-05-07T14:20:00Z')
  })
})

describe('Inbound payload parsers', () => {
  test('parseAskForCtn parses valid shipping agency message', () => {
    const parsed = parseAskForCtn({
      orderId: 'ORDER-20260507-002',
      timestamp: '2026-05-07T10:00:00Z',
      senderId: PARTY.shippingAgency.id,
      containerId: 'MSKU1234567',
      vesselId: 'VESSEL-042'
    })

    expect(parsed.senderId).toBe(PARTY.shippingAgency.id)
    expect(parsed.containerId).toBe('MSKU1234567')
    expect(parsed.vesselId).toBe('VESSEL-042')
  })

  test('parseOutboundCtnToDepot parses valid transport message', () => {
    const parsed = parseOutboundCtnToDepot({
      orderId: 'ORDER-20260507-003',
      timestamp: '2026-05-07T11:00:00Z',
      senderId: PARTY.transport.id,
      ctnNumber: 'MSKU1234567',
      vesselId: 'VESSEL-042',
      handOverTime: '2026-05-07T11:10:00Z',
      receiptId: 'RECEIPT-20260507-002',
      driverName: 'Zhang San',
      carLicense: 'HU-A-12345'
    })

    expect(parsed.senderId).toBe(PARTY.transport.id)
    expect(parsed.ctnNumber).toBe('MSKU1234567')
    expect(parsed.receiptId).toBe('RECEIPT-20260507-002')
  })

  test('parseOutboundCtnToDepot accepts C3 handoverTime alias', () => {
    const parsed = parseOutboundCtnToDepot({
      orderId: 'ORDER-20260507-030',
      timestamp: '2026-05-07T11:00:00Z',
      senderId: PARTY.transport.id,
      ctnNumber: 'MSKU1234567',
      vesselId: 'VESSEL-042',
      handoverTime: '2026-05-07T11:10:00Z',
      receiptId: 'RECEIPT-20260507-002',
      driverName: 'Zhang San',
      carLicense: 'HU-A-12345'
    })

    expect(parsed.handOverTime).toBe('2026-05-07T11:10:00Z')
    expect(parsed.handoverTime).toBe('2026-05-07T11:10:00Z')
  })

  test('parsers throw on missing required fields', () => {
    expect(() => parseAskForCtn({})).toThrow('Missing required string variable: orderId')
    expect(() => parseOutboundCtnToDepot({ orderId: 'ORDER-20260507-003' }))
      .toThrow('Missing required string variable: senderId')
  })

  test('parsers reject invalid identifiers', () => {
    expect(() => parseAskForCtn({
      orderId: 'ORDER-20260507-002',
      timestamp: '2026-05-07T10:00:00Z',
      senderId: PARTY.shippingAgency.id,
      containerId: 'BAD-ID',
      vesselId: 'VESSEL-042'
    })).toThrow('Invalid containerId format')

    expect(() => parseOutboundCtnToDepot({
      orderId: 'ORDER-20260507-003',
      timestamp: '2026-05-07T11:00:00Z',
      senderId: PARTY.transport.id,
      ctnNumber: 'MSKU1234567',
      vesselId: 'VESSEL-42',
      handOverTime: '2026-05-07T11:10:00Z',
      receiptId: 'RECEIPT-20260507-002',
      driverName: 'Zhang San',
      carLicense: 'HU-A-12345'
    })).toThrow('Invalid vesselId format')
  })

  test('parseAskForCtn supplies a fallback timestamp when omitted', () => {
    const parsed = parseAskForCtn({
      orderId: 'ORDER-20260507-004',
      senderId: PARTY.shippingAgency.id,
      containerId: 'MSKU1234567',
      vesselId: 'VESSEL-042'
    })

    expect(typeof parsed.timestamp).toBe('string')
  })
})
