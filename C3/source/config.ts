export const CAMUNDA_AUTH_STRATEGY = 'NONE' as const
export const CAMUNDA_REST_ADDRESS = 'http://localhost:8080'

export const JOB_TYPES = {
  prepareRequest: 'prepare-request',
  publishRequestMessage: 'publish-request-message',
  handleResponse: 'handle-response',
  prepareReceiver: 'prepare-receiver',
  processRequest: 'process-request',
  publishResponseMessage: 'publish-response-message'
} as const

export const MESSAGE_NAMES = {
  request: 'demo-request-message',
  response: 'demo-response-message'
} as const
