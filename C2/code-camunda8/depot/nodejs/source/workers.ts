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
import { DepotMessagePublisher } from './rabbitmq/publisher'

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

class DirectCamundaMessagePublisher implements DepotMessagePublisher {
  constructor(private readonly client: CamundaRestClient) {}

  async publishMessage(
    name: string,
    correlationKey: string,
    variables: Record<string, any>
  ): Promise<void> {
    await this.client.publishMessage({
      name,
      correlationKey,
      timeToLive: 600,
      variables
    })
  }
}

export function startDepotContractWorkers(
  client: CamundaRestClient,
  publisher: DepotMessagePublisher = new DirectCamundaMessagePublisher(client)
) {
  const sendEmptyCtnToTransportWorker = client.createJobWorker<DepotVariables, DepotVariables>({
    type: JOB_TYPES.sendEmptyCtnToTransport,
    timeout: 10000,
    maxJobsToActivate: 5,
    worker: 'dpt-send-empty-ctn-to-transport',
    jobHandler: async (job, log) => {
      const ask = parseAskForCtn(job.variables as unknown as Record<string, unknown>)

      const variables = buildEmptyCtnToTransport(ask.orderId, ask.containerId, ask.vesselId)

      log.info(`[send-empty-ctn-to-transport] jobKey=${job.jobKey} orderId=${ask.orderId}`)
      await publisher.publishMessage(MESSAGE_NAMES.emptyCtnToTransport, ask.orderId, variables)
      log.info(`[send-empty-ctn-to-transport] published=${MESSAGE_NAMES.emptyCtnToTransport}`)

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

      const variables = buildCtnArrivalInfoToSa(
        ask.orderId,
        ask.containerId,
        ask.vesselId,
        arrivalTime,
        terminalLocation
      )

      log.info(`[send-ctn-arrival-info-to-sa] jobKey=${job.jobKey} orderId=${ask.orderId}`)
      await publisher.publishMessage(MESSAGE_NAMES.ctnArrivalInfoToSa, ask.orderId, variables)
      log.info(`[send-ctn-arrival-info-to-sa] published=${MESSAGE_NAMES.ctnArrivalInfoToSa}`)

      return job.complete({
        arrivalTime: variables.arrivalTime,
        terminalLocation: variables.terminalLocation,
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

      const variables = buildOutboundCtnToCt(
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

      log.info(`[send-outbound-ctn-to-ct] jobKey=${job.jobKey} orderId=${outbound.orderId}`)
      await publisher.publishMessage(MESSAGE_NAMES.outboundCtnToCt, outbound.orderId, variables)
      log.info(`[send-outbound-ctn-to-ct] published=${MESSAGE_NAMES.outboundCtnToCt}`)

      return job.complete({
        outboundCtnSentToCt: true,
        loadingCompletedTime: variables.loadingCompletedTime
      })
    }
  })

  return {
    sendEmptyCtnToTransportWorker,
    sendCtnArrivalInfoToSaWorker,
    sendOutboundCtnToCtWorker
  }
}
