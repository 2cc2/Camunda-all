import { CamundaRestClient, Dto } from '@camunda8/sdk'
import { JOB_TYPES, MESSAGE_NAMES, PARTY } from './config'

class OwnerVariables extends Dto.LosslessDto {
  orderId?: string

  // contract common fields
  timestamp?: string
  senderId?: string

  // business fields (minimal demo)
  certificateOfEntrustment?: {
    telephone?: string
    consignorName?: string
  }
  order?: {
    customsOrderNo?: string
    goodsDescription?: string
  }
  ctnNumber?: string
  expenseAmount?: number
  currency?: string
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
  const fillCertificateWorker = client.createJobWorker<OwnerVariables, OwnerVariables>({
    type: JOB_TYPES.fillOutCertificateOfEntrustment,
    timeout: 10000,
    maxJobsToActivate: 5,
    worker: 'own-fill-out-certificate-of-entrustment',
    jobHandler: async (job, log) => {
      const orderId = requireString(job.variables.orderId, 'orderId')

      const certificateOfEntrustment =
        (job.variables.certificateOfEntrustment as OwnerVariables['certificateOfEntrustment']) ??
        ({ telephone: '17798839621', consignorName: 'Owner' } as const)

      log.info(`[fill-out-certificate-of-entrustment] jobKey=${job.jobKey} orderId=${orderId}`)
      return job.complete({
        certificateOfEntrustment,
        timestamp: nowIso(),
        senderId: PARTY.owner.id
      })
    }
  })

  const handleOrderWorker = client.createJobWorker<OwnerVariables, OwnerVariables>({
    type: JOB_TYPES.handleOrder,
    timeout: 10000,
    maxJobsToActivate: 5,
    worker: 'own-handle-order',
    jobHandler: async (job, log) => {
      const orderId = requireString(job.variables.orderId, 'orderId')

      const order =
        (job.variables.order as OwnerVariables['order']) ??
        ({ customsOrderNo: 'CUS-ORDER-001', goodsDescription: 'General cargo' } as const)

      log.info(`[handle-order] jobKey=${job.jobKey} orderId=${orderId}`)
      return job.complete({
        order,
        timestamp: nowIso(),
        senderId: PARTY.owner.id
      })
    }
  })

  const sendOrderToFfwWorker = client.createJobWorker<OwnerVariables, OwnerVariables>({
    type: JOB_TYPES.sendOrderToFfw,
    timeout: 10000,
    maxJobsToActivate: 5,
    worker: 'own-send-order-to-ffw',
    jobHandler: async (job, log) => {
      const orderId = requireString(job.variables.orderId, 'orderId')
      const order = job.variables.order as OwnerVariables['order'] | undefined

      const payload: CorrelationPayload = {
        name: MESSAGE_NAMES.orderToFfw,
        correlationKey: orderId,
        variables: withCommonFields(orderId, PARTY.owner.id, {
          ffwId: PARTY.freightForwarder.id,
          order
        })
      }

      log.info(`[send-order-to-ffw] jobKey=${job.jobKey} payload=${JSON.stringify(payload)}`)
      const response = await client.publishMessage({
        ...payload,
        timeToLive: 600
      })
      log.info(`[send-order-to-ffw] publishResponse=${JSON.stringify(response)}`)

      return job.complete({
        orderSentToFfw: true
      })
    }
  })

  const sendOutboundCtnToTransportWorker = client.createJobWorker<OwnerVariables, OwnerVariables>({
    type: JOB_TYPES.sendOutboundCtnToTransport,
    timeout: 10000,
    maxJobsToActivate: 5,
    worker: 'own-send-outbound-ctn-to-transport',
    jobHandler: async (job, log) => {
      const orderId = requireString(job.variables.orderId, 'orderId')
      const ctnNumber = requireString(job.variables.ctnNumber, 'ctnNumber')

      const payload: CorrelationPayload = {
        name: MESSAGE_NAMES.outboundCtnToTransport,
        correlationKey: orderId,
        variables: withCommonFields(orderId, PARTY.owner.id, {
          transportId: PARTY.transport.id,
          ctnNumber,
          direction: 'outbound'
        })
      }

      log.info(`[send-outbound-ctn-to-transport] jobKey=${job.jobKey} payload=${JSON.stringify(payload)}`)
      const response = await client.publishMessage({
        ...payload,
        timeToLive: 600
      })
      log.info(`[send-outbound-ctn-to-transport] publishResponse=${JSON.stringify(response)}`)

      return job.complete({
        outboundCtnSentToTransport: true
      })
    }
  })

  const paymentWorker = client.createJobWorker<OwnerVariables, OwnerVariables>({
    type: JOB_TYPES.payment,
    timeout: 10000,
    maxJobsToActivate: 5,
    worker: 'own-payment',
    jobHandler: async (job, log) => {
      const orderId = requireString(job.variables.orderId, 'orderId')
      const expenseAmount = requireNumber(job.variables.expenseAmount, 'expenseAmount')
      const currency = requireString(job.variables.currency, 'currency')

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
