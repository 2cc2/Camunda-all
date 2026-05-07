/**
 * Camunda 8 Job Workers for Owner (货主) contract.
 *
 * Maps BPMN tasks from owner.bpmn to worker implementations:
 * 1. fill-out-certificate-of-entrustment  (userTask in BPMN)
 * 2. handle-order                         (serviceTask -> external)
 * 3. send-order-to-ffw                    (sendTask -> external)
 * 4. send-outbound-ctn-to-transport       (serviceTask -> external)
 * 5. payment                              (serviceTask -> external)
 */

import { CamundaRestClient, Dto } from '@camunda8/sdk'
import { JOB_TYPES, MESSAGE_NAMES, PARTY } from './config'
import { OwnerProcessVariables } from './types'
import { buildOrderToFfw, buildOutboundCtnToTransport } from './messages'

// Re-export Dto for type reuse
class OwnerVariables extends Dto.LosslessDto implements OwnerProcessVariables {
  orderId?: string
  timestamp?: string
  senderId?: string
  certificateOfEntrustment?: OwnerProcessVariables['certificateOfEntrustment']
  order?: OwnerProcessVariables['order']
  ctnNumber?: string
  expenseAmount?: number
  currency?: string
  orderSentToFfw?: boolean
  outboundCtnSentToTransport?: boolean
  paymentDone?: boolean
  paidAt?: string
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

function requireNumber(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`Missing required number variable: ${fieldName}`)
  }
  return value
}

type CorrelationPayload = {
  name: string
  correlationKey: string
  variables: Record<string, any>
}

function withCommonFields(orderId: string, senderId: string, extra: Record<string, any> = {}) {
  return {
    orderId,
    timestamp: nowIso(),
    senderId,
    ...extra
  }
}

export function startOwnerContractWorkers(client: CamundaRestClient) {
  // --------------------------------------------------------------------------
  // 1. fill-out-certificate-of-entrustment
  // --------------------------------------------------------------------------
  const fillCertificateWorker = client.createJobWorker<OwnerVariables, OwnerVariables>({
    type: JOB_TYPES.fillOutCertificateOfEntrustment,
    timeout: 10000,
    maxJobsToActivate: 5,
    worker: 'own-fill-out-certificate-of-entrustment',
    jobHandler: async (job, log) => {
      const orderId = requireString(job.variables.orderId, 'orderId')

      const certificateOfEntrustment =
        job.variables.certificateOfEntrustment ?? {
          telephone: '17798839621',
          consignorName: '上海货主有限公司'
        }

      log.info(`[fill-out-certificate-of-entrustment] jobKey=${job.jobKey} orderId=${orderId}`)
      return job.complete({
        certificateOfEntrustment,
        timestamp: nowIso(),
        senderId: PARTY.owner.id
      })
    }
  })

  // --------------------------------------------------------------------------
  // 2. handle-order (includes Customs Order processing)
  // --------------------------------------------------------------------------
  const handleOrderWorker = client.createJobWorker<OwnerVariables, OwnerVariables>({
    type: JOB_TYPES.handleOrder,
    timeout: 10000,
    maxJobsToActivate: 5,
    worker: 'own-handle-order',
    jobHandler: async (job, log) => {
      const orderId = requireString(job.variables.orderId, 'orderId')

      const order = job.variables.order ?? {
        customsOrderNo: 'CUS-ORDER-001',
        goodsDescription: 'General cargo',
        pol: 'CNSHA',
        pod: 'CNSHA',
        cargoWeight: '1500kg',
        containerType: '1x40HQ'
      }

      log.info(`[handle-order] jobKey=${job.jobKey} orderId=${orderId}`)
      return job.complete({
        order,
        timestamp: nowIso(),
        senderId: PARTY.owner.id
      })
    }
  })

  // --------------------------------------------------------------------------
  // 3. send-order-to-ffw (M1: order-to-ffw)
  // --------------------------------------------------------------------------
  const sendOrderToFfwWorker = client.createJobWorker<OwnerVariables, OwnerVariables>({
    type: JOB_TYPES.sendOrderToFfw,
    timeout: 10000,
    maxJobsToActivate: 5,
    worker: 'own-send-order-to-ffw',
    jobHandler: async (job, log) => {
      const orderId = requireString(job.variables.orderId, 'orderId')
      const order = job.variables.order

      const payload: CorrelationPayload = {
        name: MESSAGE_NAMES.orderToFfw,
        correlationKey: orderId,
        variables: withCommonFields(orderId, PARTY.owner.id, {
          ffwId: PARTY.freightForwarder.id,
          pol: order?.pol ?? 'CNSHA',
          pod: order?.pod ?? 'CNSHA',
          cargoWeight: order?.cargoWeight ?? '1500kg',
          containerType: order?.containerType ?? '1x40HQ',
          order
        })
      }

      log.info(`[send-order-to-ffw] jobKey=${job.jobKey} orderId=${orderId}`)
      const response = await client.publishMessage({
        ...payload,
        timeToLive: 600
      })
      log.info(`[send-order-to-ffw] publishResponse=${JSON.stringify(response)}`)

      return job.complete({ orderSentToFfw: true })
    }
  })

  // --------------------------------------------------------------------------
  // 4. send-outbound-ctn-to-transport (M*: outbound-ctn-to-transport)
  // --------------------------------------------------------------------------
  const sendOutboundCtnToTransportWorker = client.createJobWorker<OwnerVariables, OwnerVariables>({
    type: JOB_TYPES.sendOutboundCtnToTransport,
    timeout: 10000,
    maxJobsToActivate: 5,
    worker: 'own-send-outbound-ctn-to-transport',
    jobHandler: async (job, log) => {
      const orderId = requireString(job.variables.orderId, 'orderId')
      const ctnNumber = job.variables.ctnNumber ?? 'CTN-884821'

      const payload: CorrelationPayload = {
        name: MESSAGE_NAMES.outboundCtnToTransport,
        correlationKey: orderId,
        variables: withCommonFields(orderId, PARTY.owner.id, {
          transportId: PARTY.transport.id,
          ctnNumber,
          direction: 'outbound',
          readyTime: nowIso(),
          pickupAddress: '上海市浦东新区临港装箱点A区',
          contactName: '李四',
          contactPhone: '13800138000'
        })
      }

      log.info(`[send-outbound-ctn-to-transport] jobKey=${job.jobKey} orderId=${orderId} ctn=${ctnNumber}`)
      const response = await client.publishMessage({
        ...payload,
        timeToLive: 600
      })
      log.info(`[send-outbound-ctn-to-transport] publishResponse=${JSON.stringify(response)}`)

      return job.complete({ outboundCtnSentToTransport: true })
    }
  })

  // --------------------------------------------------------------------------
  // 5. payment
  // --------------------------------------------------------------------------
  const paymentWorker = client.createJobWorker<OwnerVariables, OwnerVariables>({
    type: JOB_TYPES.payment,
    timeout: 10000,
    maxJobsToActivate: 5,
    worker: 'own-payment',
    jobHandler: async (job, log) => {
      const orderId = requireString(job.variables.orderId, 'orderId')
      const expenseAmount = job.variables.expenseAmount ?? 1234.56
      const currency = job.variables.currency ?? 'CNY'

      log.info(`[payment] jobKey=${job.jobKey} orderId=${orderId} amount=${expenseAmount} ${currency}`)
      return job.complete({
        paidAt: nowIso(),
        paymentDone: true
      })
    }
  })

  return {
    fillCertificateWorker,
    handleOrderWorker,
    sendOrderToFfwWorker,
    sendOutboundCtnToTransportWorker,
    paymentWorker
  }
}
