/**
 * Message flow functions for Depot contract.
 *
 * Provides typed builders for outbound messages and parsers for inbound messages.
 */

import {
  AskForCtnPayload,
  CommonFields,
  CtnArrivalInfoToSaPayload,
  EmptyCtnToTransportPayload,
  OutboundCtnToCtPayload,
  OutboundCtnToDepotPayload
} from './types'
import { PARTY } from './config'

function nowIso(): string {
  return new Date().toISOString()
}

function buildCommon(orderId: string, senderId: string): CommonFields {
  return {
    orderId,
    timestamp: nowIso(),
    senderId
  }
}

export function isValidOrderId(orderId: string): boolean {
  return /^ORDER-\d{8}-\d{3}$/.test(orderId)
}

export function isValidContainerId(containerId: string): boolean {
  return /^[A-Z]{4}\d{7}$/.test(containerId)
}

export function isValidVesselId(vesselId: string): boolean {
  return /^VESSEL-\d{3}$/.test(vesselId)
}

export function buildEmptyCtnToTransport(
  orderId: string,
  containerId: string,
  vesselId: string
): EmptyCtnToTransportPayload {
  validateOrderId(orderId)
  validateContainerId(containerId)
  validateVesselId(vesselId)

  return {
    ...buildCommon(orderId, PARTY.depot.id),
    transportId: PARTY.transport.id,
    containerId,
    vesselId
  }
}

export function buildCtnArrivalInfoToSa(
  orderId: string,
  containerId: string,
  vesselId: string,
  arrivalTime?: string,
  terminalLocation?: string
): CtnArrivalInfoToSaPayload {
  validateOrderId(orderId)
  validateContainerId(containerId)
  validateVesselId(vesselId)

  return {
    ...buildCommon(orderId, PARTY.depot.id),
    shippingAgencyId: PARTY.shippingAgency.id,
    containerId,
    vesselId,
    arrivalTime: arrivalTime ?? nowIso(),
    terminalLocation: terminalLocation ?? 'Shanghai Yangshan Terminal'
  }
}

export function buildOutboundCtnToCt(
  orderId: string,
  containerId: string,
  vesselId: string,
  receiptId: string,
  loadingCompletedTime?: string,
  terminalLocation?: string,
  handOverTime?: string,
  driverName?: string,
  carLicense?: string
): OutboundCtnToCtPayload {
  validateOrderId(orderId)
  validateContainerId(containerId)
  validateVesselId(vesselId)
  requireString(receiptId, 'receiptId')

  return {
    ...buildCommon(orderId, PARTY.depot.id),
    containerTerminalId: PARTY.containerTerminal.id,
    containerId,
    vesselId,
    receiptId,
    loadingCompletedTime: loadingCompletedTime ?? handOverTime ?? nowIso(),
    terminalLocation: terminalLocation ?? 'Shanghai Yangshan Terminal',
    handOverTime,
    driverName,
    carLicense
  }
}

export function parseAskForCtn(raw: Record<string, unknown>): AskForCtnPayload {
  const orderId = requireString(raw.orderId, 'orderId')
  const senderId = requireString(raw.senderId, 'senderId')
  const containerId = requireString(raw.containerId, 'containerId')
  const vesselId = requireString(raw.vesselId, 'vesselId')

  validateOrderId(orderId)
  validateContainerId(containerId)
  validateVesselId(vesselId)

  return {
    orderId,
    timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : nowIso(),
    senderId,
    containerId,
    vesselId
  }
}

export function parseOutboundCtnToDepot(raw: Record<string, unknown>): OutboundCtnToDepotPayload {
  const orderId = requireString(raw.orderId, 'orderId')
  const senderId = requireString(raw.senderId, 'senderId')
  const ctnNumber = requireString(raw.ctnNumber, 'ctnNumber')
  const vesselId = requireString(raw.vesselId, 'vesselId')
  const handOverTime = requireString(raw.handOverTime, 'handOverTime')
  const receiptId = requireString(raw.receiptId, 'receiptId')
  const driverName = requireString(raw.driverName, 'driverName')
  const carLicense = requireString(raw.carLicense, 'carLicense')

  validateOrderId(orderId)
  validateContainerId(ctnNumber)
  validateVesselId(vesselId)

  return {
    orderId,
    timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : nowIso(),
    senderId,
    ctnNumber,
    vesselId,
    handOverTime,
    receiptId,
    driverName,
    carLicense
  }
}

function validateOrderId(orderId: string): void {
  if (!isValidOrderId(orderId)) {
    throw new Error(`Invalid orderId format: ${orderId}`)
  }
}

function validateContainerId(containerId: string): void {
  if (!isValidContainerId(containerId)) {
    throw new Error(`Invalid containerId format: ${containerId}`)
  }
}

function validateVesselId(vesselId: string): void {
  if (!isValidVesselId(vesselId)) {
    throw new Error(`Invalid vesselId format: ${vesselId}`)
  }
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required string variable: ${fieldName}`)
  }
  return value
}
