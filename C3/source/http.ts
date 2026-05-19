import { CAMUNDA_REST_ADDRESS } from './config'

export interface CorrelateMessageRequest {
  name: string
  correlationKey: string
  variables?: Record<string, unknown>
  messageId?: string
}

export interface CorrelateMessageResponse {
  correlatedProcessInstanceKey?: string | number
  [key: string]: unknown
}

function buildUrl(path: string): string {
  return `${CAMUNDA_REST_ADDRESS.replace(/\/$/, '')}${path}`
}

export async function correlateMessage(body: CorrelateMessageRequest): Promise<CorrelateMessageResponse> {
  const url = buildUrl('/v2/messages/correlation')

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  const text = await response.text()
  const json = text ? JSON.parse(text) : {}

  if (!response.ok) {
    throw new Error(`Camunda correlate message failed. status=${response.status} body=${text}`)
  }

  return json as CorrelateMessageResponse
}
