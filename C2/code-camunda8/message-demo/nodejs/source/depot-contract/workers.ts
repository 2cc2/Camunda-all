import { CamundaRestClient, Dto } from '@camunda8/sdk'
import { JOB_TYPES, MESSAGE_NAMES, PARTY } from './config'

const ORDER_ID_PATTERN = /^ORDER-\d{8}-\d{3}$/
const CONTAINER_ID_PATTERN = /^[A-Z]{4}\d{7}$/
const VESSEL_ID_PATTERN = /^VESSEL-\d{3}$/

class DepotVariables extends Dto.LosslessDto {
  orderId?: string
  timestamp?: string
  senderId?: string
  containerId?: string
  vesselId?: string
  receiptId?: string
  arrivalTime?: string
  terminalLocation?: string
  loadingCompletedTime?: string
}

type CorrelationPayload = {
  name: string
  correlationKey: string
  variables: Record<string, any>
}

function nowIso(): string {
  return new Date().toISOString()
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required string variable: ${fieldName}`)
  }
  return value
}

function requirePattern(value: unknown, fieldName: string, pattern: RegExp): string {
  const text = requireString(value, fieldName)
  if (!pattern.test(text)) {
    throw new Error(`Invalid ${fieldName}: ${text}`)
  }
  return text
}

function withCommonFields(orderId: string, extra: Record<string, any> = {}) {
  return {
    orderId,
    timestamp: nowIso(),
    senderId: PARTY.depot.id,
    ...extra
  }
}

export function startDepotContractWorkers(client: CamundaRestClient) {
  const sendEmptyCtnToTransportWorker = client.createJobWorker<DepotVariables, DepotVariables>({
    type: JOB_TYPES.sendEmptyCtnToTransport,
    timeout: 10000,
    maxJobsToActivate: 5,
    worker: 'depot-send-empty-ctn-to-transport',
    jobHandler: async (job, log) => {
      const orderId = requirePattern(job.variables.orderId, 'orderId', ORDER_ID_PATTERN)
      const containerId = requirePattern(
        job.variables.containerId ?? 'MSKU1234567',
        'containerId',
        CONTAINER_ID_PATTERN
      )
      const vesselId = requirePattern(job.variables.vesselId ?? 'VESSEL-042', 'vesselId', VESSEL_ID_PATTERN)

      const payload: CorrelationPayload = {
        name: MESSAGE_NAMES.emptyCtnToTransport,
        correlationKey: orderId,
        variables: withCommonFields(orderId, {
          transportId: PARTY.transport.id,
          containerId,
          vesselId
        })
      }

      log.info(`[send-empty-ctn-to-transport] jobKey=${job.jobKey} payload=${JSON.stringify(payload)}`)
      const response = await client.publishMessage({
        ...payload,
        timeToLive: 600
      })
      log.info(`[send-empty-ctn-to-transport] publishResponse=${JSON.stringify(response)}`)

      return job.complete({
        containerId,
        vesselId,
        emptyCtnSentToTransport: true
      })
    }
  })

  const sendCtnArrivalInfoToSaWorker = client.createJobWorker<DepotVariables, DepotVariables>({
    type: JOB_TYPES.sendCtnArrivalInfoToSa,
    timeout: 10000,
    maxJobsToActivate: 5,
    worker: 'depot-send-ctn-arrival-info-to-sa',
    jobHandler: async (job, log) => {
      const orderId = requirePattern(job.variables.orderId, 'orderId', ORDER_ID_PATTERN)
      const containerId = requirePattern(job.variables.containerId, 'containerId', CONTAINER_ID_PATTERN)
      const vesselId = requirePattern(job.variables.vesselId, 'vesselId', VESSEL_ID_PATTERN)
      const arrivalTime = job.variables.arrivalTime ?? '2026-04-16T10:00:00Z'
      const terminalLocation = job.variables.terminalLocation ?? 'Shanghai Yangshan Terminal'

      const payload: CorrelationPayload = {
        name: MESSAGE_NAMES.ctnArrivalInfoToSa,
        correlationKey: orderId,
        variables: withCommonFields(orderId, {
          shippingAgencyId: PARTY.shippingAgency.id,
          containerId,
          vesselId,
          arrivalTime,
          terminalLocation
        })
      }

      log.info(`[send-ctn-arrival-info-to-sa] jobKey=${job.jobKey} payload=${JSON.stringify(payload)}`)
      const response = await client.publishMessage({
        ...payload,
        timeToLive: 600
      })
      log.info(`[send-ctn-arrival-info-to-sa] publishResponse=${JSON.stringify(response)}`)

      return job.complete({
        arrivalTime,
        terminalLocation,
        ctnArrivalInfoSentToSa: true
      })
    }
  })

  const sendOutboundCtnToCtWorker = client.createJobWorker<DepotVariables, DepotVariables>({
    type: JOB_TYPES.sendOutboundCtnToCt,
    timeout: 10000,
    maxJobsToActivate: 5,
    worker: 'depot-send-outbound-ctn-to-ct',
    jobHandler: async (job, log) => {
      const orderId = requirePattern(job.variables.orderId, 'orderId', ORDER_ID_PATTERN)
      const containerId = requirePattern(job.variables.containerId, 'containerId', CONTAINER_ID_PATTERN)
      const vesselId = requirePattern(job.variables.vesselId, 'vesselId', VESSEL_ID_PATTERN)
      const receiptId = requireString(job.variables.receiptId, 'receiptId')
      const terminalLocation = job.variables.terminalLocation ?? 'Shanghai Yangshan Terminal'
      const loadingCompletedTime = job.variables.loadingCompletedTime ?? nowIso()

      const payload: CorrelationPayload = {
        name: MESSAGE_NAMES.outboundCtnToCt,
        correlationKey: orderId,
        variables: withCommonFields(orderId, {
          containerTerminalId: PARTY.containerTerminal.id,
          containerId,
          vesselId,
          receiptId,
          loadingCompletedTime,
          terminalLocation
        })
      }

      log.info(`[send-outbound-ctn-to-ct] jobKey=${job.jobKey} payload=${JSON.stringify(payload)}`)
      const response = await client.publishMessage({
        ...payload,
        timeToLive: 600
      })
      log.info(`[send-outbound-ctn-to-ct] publishResponse=${JSON.stringify(response)}`)

      return job.complete({
        outboundCtnSentToCt: true,
        loadingCompletedTime
      })
    }
  })

  return {
    sendEmptyCtnToTransportWorker,
    sendCtnArrivalInfoToSaWorker,
    sendOutboundCtnToCtWorker
  }
}
