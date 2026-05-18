/**
 * Camunda 8 Job Workers for Depot contract.
 *
 * Maps BPMN tasks from depot.bpmn to worker implementations:
 * 1. send-empty-ctn-to-transport
 * 2. send-ctn-arrival-info-to-sa
 * 3. send-outbound-ctn-to-ct
 */

import { CamundaRestClient, Dto } from '@camunda8/sdk'
import { JOB_TYPES, MESSAGE_NAMES } from './config'
import { DepotProcessVariables } from './types'
import {
  buildCtnArrivalInfoToSa,
  buildEmptyCtnToTransport,
  buildOutboundCtnToCt,
  parseAskForCtn,
  parseOutboundCtnToDepot
} from './messages'

class DepotVariables extends Dto.LosslessDto implements DepotProcessVariables {
  orderId?: string
  timestamp?: string
  senderId?: string
  containerId?: string
  ctnNumber?: string
  vesselId?: string
  receiptId?: string
  arrivalTime?: string
  terminalLocation?: string
  loadingCompletedTime?: string
  handOverTime?: string
  driverName?: string
  carLicense?: string
  emptyCtnSentToTransport?: boolean
  ctnArrivalInfoSentToSa?: boolean
  outboundCtnSentToCt?: boolean
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

type CorrelationPayload = {
  name: string
  correlationKey: string
  variables: Record<string, any>
}

export function startDepotContractWorkers(client: CamundaRestClient) {
  const sendEmptyCtnToTransportWorker = client.createJobWorker<DepotVariables, DepotVariables>({
    type: JOB_TYPES.sendEmptyCtnToTransport,
    timeout: 10000,
    maxJobsToActivate: 5,
    worker: 'dpt-send-empty-ctn-to-transport',
    jobHandler: async (job, log) => {
      const ask = parseAskForCtn(job.variables as unknown as Record<string, unknown>)

      const payload: CorrelationPayload = {
        name: MESSAGE_NAMES.emptyCtnToTransport,
        correlationKey: ask.orderId,
        variables: buildEmptyCtnToTransport(ask.orderId, ask.containerId, ask.vesselId)
      }

      log.info(`[send-empty-ctn-to-transport] jobKey=${job.jobKey} orderId=${ask.orderId}`)
      const response = await client.publishMessage({
        ...payload,
        timeToLive: 600
      })
      log.info(`[send-empty-ctn-to-transport] publishResponse=${JSON.stringify(response)}`)

      return job.complete({
        containerId: ask.containerId,
        vesselId: ask.vesselId,
        emptyCtnSentToTransport: true
      })
    }
  })

  const sendCtnArrivalInfoToSaWorker = client.createJobWorker<DepotVariables, DepotVariables>({
    type: JOB_TYPES.sendCtnArrivalInfoToSa,
    timeout: 10000,
    maxJobsToActivate: 5,
    worker: 'dpt-send-ctn-arrival-info-to-sa',
    jobHandler: async (job, log) => {
      const ask = parseAskForCtn(job.variables as unknown as Record<string, unknown>)
      const arrivalTime = optionalString(job.variables.arrivalTime)
      const terminalLocation = optionalString(job.variables.terminalLocation)

      const payload: CorrelationPayload = {
        name: MESSAGE_NAMES.ctnArrivalInfoToSa,
        correlationKey: ask.orderId,
        variables: buildCtnArrivalInfoToSa(
          ask.orderId,
          ask.containerId,
          ask.vesselId,
          arrivalTime,
          terminalLocation
        )
      }

      log.info(`[send-ctn-arrival-info-to-sa] jobKey=${job.jobKey} orderId=${ask.orderId}`)
      const response = await client.publishMessage({
        ...payload,
        timeToLive: 600
      })
      log.info(`[send-ctn-arrival-info-to-sa] publishResponse=${JSON.stringify(response)}`)

      return job.complete({
        arrivalTime: payload.variables.arrivalTime,
        terminalLocation: payload.variables.terminalLocation,
        ctnArrivalInfoSentToSa: true
      })
    }
  })

  const sendOutboundCtnToCtWorker = client.createJobWorker<DepotVariables, DepotVariables>({
    type: JOB_TYPES.sendOutboundCtnToCt,
    timeout: 10000,
    maxJobsToActivate: 5,
    worker: 'dpt-send-outbound-ctn-to-ct',
    jobHandler: async (job, log) => {
      const outbound = parseOutboundCtnToDepot(job.variables as unknown as Record<string, unknown>)
      const terminalLocation = optionalString(job.variables.terminalLocation)
      const loadingCompletedTime = optionalString(job.variables.loadingCompletedTime)

      const payload: CorrelationPayload = {
        name: MESSAGE_NAMES.outboundCtnToCt,
        correlationKey: outbound.orderId,
        variables: buildOutboundCtnToCt(
          outbound.orderId,
          outbound.ctnNumber,
          outbound.vesselId,
          outbound.receiptId,
          loadingCompletedTime,
          terminalLocation,
          outbound.handOverTime,
          outbound.driverName,
          outbound.carLicense
        )
      }

      log.info(`[send-outbound-ctn-to-ct] jobKey=${job.jobKey} orderId=${outbound.orderId}`)
      const response = await client.publishMessage({
        ...payload,
        timeToLive: 600
      })
      log.info(`[send-outbound-ctn-to-ct] publishResponse=${JSON.stringify(response)}`)

      return job.complete({
        outboundCtnSentToCt: true,
        loadingCompletedTime: payload.variables.loadingCompletedTime
      })
    }
  })

  return {
    sendEmptyCtnToTransportWorker,
    sendCtnArrivalInfoToSaWorker,
    sendOutboundCtnToCtWorker
  }
}
