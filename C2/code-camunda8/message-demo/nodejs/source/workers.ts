import { CamundaRestClient, Dto } from '@camunda8/sdk'
import { JOB_TYPES, MESSAGE_NAMES } from './config'
import { correlateMessage } from './http'

class DemoVariables extends Dto.LosslessDto {
  businessKey?: string
  customerId?: string
  requestText?: string
  senderName?: string
  receiverName?: string
  responseText?: string
  requestReceivedAt?: string
  responseReceivedAt?: string
  requestPreparedAt?: string
  responsePreparedAt?: string
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

export function startWorkers(client: CamundaRestClient) {
  const prepareRequestWorker = client.createJobWorker<DemoVariables, DemoVariables>({
    type: JOB_TYPES.prepareRequest,
    timeout: 10000,
    maxJobsToActivate: 5,
    worker: 'prepare-request-worker',
    jobHandler: async (job, log) => {
      const businessKey = requireString(job.variables.businessKey, 'businessKey')
      const customerId = (job.variables.customerId as string | undefined) ?? 'CUST-001'
      const senderName = (job.variables.senderName as string | undefined) ?? 'Requester'
      const requestText = (job.variables.requestText as string | undefined) ?? 'Please approve my request.'
      const requestPreparedAt = nowIso()

      log.info(`[prepare-request] jobKey=${job.jobKey}`)
      log.info(`[prepare-request] businessKey=${businessKey}`)
      log.info(`[prepare-request] customerId=${customerId}`)
      log.info(`[prepare-request] senderName=${senderName}`)
      log.info(`[prepare-request] requestText=${requestText}`)
      log.info(` `)

      return job.complete({
        businessKey,
        customerId,
        senderName,
        requestText,
        requestPreparedAt
      })
    }
  })

  const publishRequestMessageWorker = client.createJobWorker<DemoVariables, DemoVariables>({
    type: JOB_TYPES.publishRequestMessage,
    timeout: 10000,
    maxJobsToActivate: 5,
    worker: 'publish-request-message-worker',
    jobHandler: async (job, log) => {
      const businessKey = requireString(job.variables.businessKey, 'businessKey')
      const customerId = requireString(job.variables.customerId, 'customerId')
      const senderName = requireString(job.variables.senderName, 'senderName')
      const requestText = requireString(job.variables.requestText, 'requestText')

      const payload = {
        name: MESSAGE_NAMES.request,
        correlationKey: businessKey,
        variables: {
          businessKey,
          customerId,
          senderName,
          requestText,
          requestSentAt: new Date().toISOString(),
          fromProcess: 'requester-process'
        }
      }

      log.info(`[publish-request-message] jobKey=${job.jobKey}`)
      log.info(`[publish-request-message] payload=${JSON.stringify(payload)}`)

      const response = await correlateMessage(payload)
      log.info(`[publish-request-message] response=${JSON.stringify(response)}`)
      log.info(` `)

      return job.complete({
        requestMessageCorrelated: true
      })
    }
  })

  const handleResponseWorker = client.createJobWorker<DemoVariables, DemoVariables>({
    type: JOB_TYPES.handleResponse,
    timeout: 10000,
    maxJobsToActivate: 5,
    worker: 'handle-response-worker',
    jobHandler: async (job, log) => {
      const businessKey = requireString(job.variables.businessKey, 'businessKey')
      const responseText = requireString(job.variables.responseText, 'responseText')
      const receiverName = requireString(job.variables.receiverName, 'receiverName')
      const responseReceivedAt = nowIso()

      log.info(`[handle-response] jobKey=${job.jobKey}`)
      log.info(`[handle-response] businessKey=${businessKey}`)
      log.info(`[handle-response] receiverName=${receiverName}`)
      log.info(`[handle-response] responseText=${responseText}`)
      log.info(`[handle-response] allVariables=${JSON.stringify(job.variables)}`)
      log.info(` `)

      return job.complete({
        responseReceivedAt,
        requesterDone: true
      })
    }
  })

  const prepareReceiverWorker = client.createJobWorker<DemoVariables, DemoVariables>({
    type: JOB_TYPES.prepareReceiver,
    timeout: 10000,
    maxJobsToActivate: 5,
    worker: 'prepare-receiver-worker',
    jobHandler: async (job, log) => {
      const businessKey = requireString(job.variables.businessKey, 'businessKey')
      const receiverName = (job.variables.receiverName as string | undefined) ?? 'Responder'

      log.info(`[prepare-receiver] jobKey=${job.jobKey}`)
      log.info(`[prepare-receiver] businessKey=${businessKey}`)
      log.info(`[prepare-receiver] receiverName=${receiverName}`)
      log.info('[prepare-receiver] responder process is ready and will wait for the request message.')
      log.info(` `)

      return job.complete({
        receiverName,
        receiverReadyAt: nowIso()
      })
    }
  })

  const processRequestWorker = client.createJobWorker<DemoVariables, DemoVariables>({
    type: JOB_TYPES.processRequest,
    timeout: 10000,
    maxJobsToActivate: 5,
    worker: 'process-request-worker',
    jobHandler: async (job, log) => {
      const businessKey = requireString(job.variables.businessKey, 'businessKey')
      const senderName = requireString(job.variables.senderName, 'senderName')
      const requestText = requireString(job.variables.requestText, 'requestText')
      const receiverName = requireString(job.variables.receiverName, 'receiverName')

      const responseText = `Approved by ${receiverName}: ${requestText}`
      const requestReceivedAt = nowIso()
      const responsePreparedAt = nowIso()

      log.info(`[process-request] jobKey=${job.jobKey}`)
      log.info(`[process-request] businessKey=${businessKey}`)
      log.info(`[process-request] senderName=${senderName}`)
      log.info(`[process-request] requestText=${requestText}`)
      log.info(`[process-request] receiverName=${receiverName}`)
      log.info(`[process-request] responseText=${responseText}`)
      log.info(`[process-request] allVariables=${JSON.stringify(job.variables)}`)
      log.info(` `)

      return job.complete({
        requestReceivedAt,
        responsePreparedAt,
        responseText
      })
    }
  })

  const publishResponseMessageWorker = client.createJobWorker<DemoVariables, DemoVariables>({
    type: JOB_TYPES.publishResponseMessage,
    timeout: 10000,
    maxJobsToActivate: 5,
    worker: 'publish-response-message-worker',
    jobHandler: async (job, log) => {
      const businessKey = requireString(job.variables.businessKey, 'businessKey')
      const receiverName = requireString(job.variables.receiverName, 'receiverName')
      const responseText = requireString(job.variables.responseText, 'responseText')

      const payload = {
        name: MESSAGE_NAMES.response,
        correlationKey: businessKey,
        variables: {
          businessKey,
          receiverName,
          responseText,
          responseSentAt: new Date().toISOString(),
          fromProcess: 'responder-process'
        }
      }

      log.info(`[publish-response-message] jobKey=${job.jobKey}`)
      log.info(`[publish-response-message] payload=${JSON.stringify(payload)}`)

      const response = await correlateMessage(payload)
      log.info(`[publish-response-message] response=${JSON.stringify(response)}`)
      log.info(` `)

      return job.complete({
        responseMessageCorrelated: true,
        responderDone: true
      })
    }
  })

  return {
    prepareRequestWorker,
    publishRequestMessageWorker,
    handleResponseWorker,
    prepareReceiverWorker,
    processRequestWorker,
    publishResponseMessageWorker
  }
}
