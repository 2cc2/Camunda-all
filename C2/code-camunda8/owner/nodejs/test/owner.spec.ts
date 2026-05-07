/**
 * Owner contract unit tests.
 *
 * Covers:
 * - Message payload builders (naming-rule compliance, validation)
 * - Message payload parsers (inbound message validation)
 * - Worker variable transformations
 */

import {
  buildOrderToFfw,
  buildOutboundCtnToTransport,
  parseCtnToOwner,
  parseExpenseNoteToOwner,
  isValidOrderId,
  isValidContainerId,
  isValidVesselId
} from '../source/messages'
import { PARTY } from '../source/config'

describe('Naming rule validators', () => {
  test('isValidOrderId accepts ORDER-YYYYMMDD-NNN', () => {
    expect(isValidOrderId('ORDER-20260427-001')).toBe(true)
    expect(isValidOrderId('ORDER-19990101-999')).toBe(true)
  })

  test('isValidOrderId rejects bad formats', () => {
    expect(isValidOrderId('ORDER-20260427-01')).toBe(false)
    expect(isValidOrderId('ORDER-2026042-001')).toBe(false)
    expect(isValidOrderId('ORD-20260427-001')).toBe(false)
    expect(isValidOrderId('')).toBe(false)
  })

  test('isValidContainerId accepts 4 letters + 7 digits', () => {
    expect(isValidContainerId('MSKU1234567')).toBe(true)
    expect(isValidContainerId('ABCD0000000')).toBe(true)
  })

  test('isValidContainerId rejects bad formats', () => {
    expect(isValidContainerId('MSKU123456')).toBe(false)
    expect(isValidContainerId('MSK12345678')).toBe(false)
    expect(isValidContainerId('msku1234567')).toBe(false)
  })

  test('isValidVesselId accepts VESSEL-NNN', () => {
    expect(isValidVesselId('VESSEL-042')).toBe(true)
    expect(isValidVesselId('VESSEL-001')).toBe(true)
  })

  test('isValidVesselId rejects bad formats', () => {
    expect(isValidVesselId('VESSEL-42')).toBe(false)
    expect(isValidVesselId('VESSEL-1234')).toBe(false)
    expect(isValidVesselId('VESSEL-')).toBe(false)
  })
})

describe('buildOrderToFfw (M1)', () => {
  const validOrderId = 'ORDER-20260427-001'

  test('builds payload with all common fields', () => {
    const payload = buildOrderToFfw(validOrderId)

    expect(payload.orderId).toBe(validOrderId)
    expect(payload.senderId).toBe(PARTY.owner.id)
    expect(typeof payload.timestamp).toBe('string')
    expect(payload.ffwId).toBe(PARTY.freightForwarder.id)
  })

  test('uses defaults when order is omitted', () => {
    const payload = buildOrderToFfw(validOrderId)

    expect(payload.pol).toBe('CNSHA')
    expect(payload.pod).toBe('CNSHA')
    expect(payload.cargoWeight).toBe('1500kg')
    expect(payload.containerType).toBe('1x40HQ')
  })

  test('merges order details when provided', () => {
    const order = {
      customsOrderNo: 'CUS-2026-0427',
      goodsDescription: 'Mobile Accessories',
      pol: 'CNTAO',
      pod: 'USLAX',
      cargoWeight: '2000kg',
      containerType: '2x40HQ'
    }
    const payload = buildOrderToFfw(validOrderId, order)

    expect(payload.pol).toBe('CNTAO')
    expect(payload.pod).toBe('USLAX')
    expect(payload.cargoWeight).toBe('2000kg')
    expect(payload.containerType).toBe('2x40HQ')
    expect(payload.order).toEqual(order)
  })

  test('throws on invalid orderId', () => {
    expect(() => buildOrderToFfw('BAD-ID')).toThrow('Invalid orderId format')
  })
})

describe('buildOutboundCtnToTransport (M*)', () => {
  const validOrderId = 'ORDER-20260427-002'

  test('builds payload with all required fields', () => {
    const payload = buildOutboundCtnToTransport(
      validOrderId,
      'CTN-884821',
      '上海市浦东新区临港装箱点A区',
      '李四',
      '13800138000'
    )

    expect(payload.orderId).toBe(validOrderId)
    expect(payload.senderId).toBe(PARTY.owner.id)
    expect(payload.transportId).toBe(PARTY.transport.id)
    expect(payload.ctnNumber).toBe('CTN-884821')
    expect(payload.direction).toBe('outbound')
    expect(payload.pickupAddress).toBe('上海市浦东新区临港装箱点A区')
    expect(payload.contactName).toBe('李四')
    expect(payload.contactPhone).toBe('13800138000')
    expect(typeof payload.readyTime).toBe('string')
  })

  test('accepts custom readyTime', () => {
    const customTime = '2026-04-27T10:00:00Z'
    const payload = buildOutboundCtnToTransport(
      validOrderId,
      'CTN-884821',
      'Addr',
      'Name',
      'Phone',
      customTime
    )

    expect(payload.readyTime).toBe(customTime)
  })

  test('throws on invalid orderId', () => {
    expect(() =>
      buildOutboundCtnToTransport('BAD', 'CTN-1', 'Addr', 'Name', 'Phone')
    ).toThrow('Invalid orderId format')
  })
})

describe('parseCtnToOwner (M22 inbound)', () => {
  test('parses valid inbound message', () => {
    const raw = {
      orderId: 'ORDER-20260427-003',
      senderId: PARTY.transport.id,
      timestamp: '2026-04-27T08:00:00Z',
      ctnNumber: 'CTN-884821',
      handOverTime: '2026-04-27T08:00:00Z',
      driverName: '张三',
      carLicense: '沪A-12345'
    }

    const parsed = parseCtnToOwner(raw)

    expect(parsed.orderId).toBe('ORDER-20260427-003')
    expect(parsed.senderId).toBe(PARTY.transport.id)
    expect(parsed.ctnNumber).toBe('CTN-884821')
    expect(parsed.driverName).toBe('张三')
    expect(parsed.carLicense).toBe('沪A-12345')
  })

  test('uses fallback timestamp when missing', () => {
    const raw = {
      orderId: 'ORDER-20260427-003',
      senderId: PARTY.transport.id,
      ctnNumber: 'CTN-1',
      handOverTime: '2026-04-27T08:00:00Z',
      driverName: '张三',
      carLicense: '沪A-12345'
    }

    const parsed = parseCtnToOwner(raw)
    expect(typeof parsed.timestamp).toBe('string')
  })

  test('throws on missing required fields', () => {
    expect(() => parseCtnToOwner({})).toThrow('Missing required string variable: orderId')
    expect(() => parseCtnToOwner({ orderId: 'ORDER-20260427-003' }))
      .toThrow('Missing required string variable: senderId')
  })
})

describe('parseExpenseNoteToOwner (inbound)', () => {
  test('parses valid expense note', () => {
    const raw = {
      orderId: 'ORDER-20260427-004',
      senderId: PARTY.freightForwarder.id,
      timestamp: '2026-04-27T09:00:00Z',
      expenseId: 'EXP-20260427-001',
      expenseAmount: 1234.56,
      currency: 'CNY'
    }

    const parsed = parseExpenseNoteToOwner(raw)

    expect(parsed.orderId).toBe('ORDER-20260427-004')
    expect(parsed.expenseAmount).toBe(1234.56)
    expect(parsed.currency).toBe('CNY')
    expect(parsed.expenseId).toBe('EXP-20260427-001')
  })

  test('throws on missing expenseAmount', () => {
    const raw = {
      orderId: 'ORDER-20260427-004',
      senderId: PARTY.freightForwarder.id,
      expenseId: 'EXP-1',
      currency: 'CNY'
    }

    expect(() => parseExpenseNoteToOwner(raw)).toThrow('Missing required number variable: expenseAmount')
  })

  test('throws on missing currency', () => {
    const raw = {
      orderId: 'ORDER-20260427-004',
      senderId: PARTY.freightForwarder.id,
      expenseId: 'EXP-1',
      expenseAmount: 100
    }

    expect(() => parseExpenseNoteToOwner(raw)).toThrow('Missing required string variable: currency')
  })
})

describe('Common fields compliance', () => {
  test('every outbound message includes orderId, timestamp, senderId', () => {
    const orderId = 'ORDER-20260427-005'

    const m1 = buildOrderToFfw(orderId)
    expect(m1.orderId).toBeDefined()
    expect(m1.timestamp).toBeDefined()
    expect(m1.senderId).toBeDefined()

    const mStar = buildOutboundCtnToTransport(orderId, 'CTN-1', 'Addr', 'Name', 'Phone')
    expect(mStar.orderId).toBeDefined()
    expect(mStar.timestamp).toBeDefined()
    expect(mStar.senderId).toBeDefined()
  })
})
