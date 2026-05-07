/**
 * Owner contract configuration.
 *
 * Naming conventions (from 并发理论大作业命名规则):
 * - Message names: lower-case-with-hyphens, e.g. order-to-ffw
 * - Task types (job worker types): lower-case-with-hyphens, e.g. fill-out-certificate
 * - Correlation key: orderId (format ORDER-YYYYMMDD-NNN)
 * - All messages carry common fields: orderId, timestamp, senderId
 */

export const CAMUNDA_AUTH_STRATEGY = 'NONE' as const
export const CAMUNDA_REST_ADDRESS = process.env.CAMUNDA_REST_ADDRESS ?? 'http://localhost:8080'

/** Party identifiers per naming rules */
export const PARTY = {
  owner: { id: 'OWNER-01', name: 'Owner (OWN)' },
  freightForwarder: { id: 'FF-GLOBAL-LOGISTICS', name: 'Freight Forwarder (FFW)' },
  transport: { id: 'TRANSPORT-FLEET-08', name: 'Transport (TRP)' }
} as const

/**
 * Job worker types for Owner BPMN tasks.
 * Must match the task types defined in owner.bpmn.
 */
export const JOB_TYPES = {
  fillOutCertificateOfEntrustment: 'fill-out-certificate-of-entrustment',
  handleOrder: 'handle-order',
  sendOrderToFfw: 'send-order-to-ffw',
  sendOutboundCtnToTransport: 'send-outbound-ctn-to-transport',
  payment: 'payment'
} as const

/**
 * Message names for Owner outbound / inbound messages.
 * Lower-case-with-hyphens per naming rules.
 */
export const MESSAGE_NAMES = {
  // Owner -> Freight Forwarder (M1)
  orderToFfw: 'order-to-ffw',

  // Transport -> Owner (M22)
  ctnToOwner: 'ctn-to-owner',

  // Owner -> Transport (M*)
  outboundCtnToTransport: 'outbound-ctn-to-transport',

  // Environment/Freight Forwarder -> Owner (expense note)
  expenseNoteToOwner: 'expense-note-to-owner'
} as const

/** Process IDs used for deployment and instance creation */
export const PROCESS_IDS = {
  owner: 'Process_owner'
} as const
