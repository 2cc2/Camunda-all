/**
 * Depot contract configuration.
 *
 * Naming conventions:
 * - Message names: lower-case-with-hyphens
 * - Task types (job worker types): lower-case-with-hyphens
 * - Correlation key: orderId (ORDER-YYYYMMDD-NNN)
 * - All messages carry common fields: orderId, timestamp, senderId
 */

export const CAMUNDA_AUTH_STRATEGY = 'NONE' as const
export const CAMUNDA_REST_ADDRESS = process.env.CAMUNDA_REST_ADDRESS ?? 'http://localhost:8080'
export const CAMUNDA_GRPC_ADDRESS = process.env.CAMUNDA_GRPC_ADDRESS ?? 'grpc://localhost:26500'

/** Party identifiers used by the Depot module */
export const PARTY = {
  depot: { id: 'DEPOT-01', name: 'Depot (DPT)' },
  shippingAgency: { id: 'SHIPPING-AGENCY-01', name: 'Shipping Agency (SAG)' },
  transport: { id: 'TRANSPORT-FLEET-08', name: 'Transport (TRP)' },
  containerTerminal: { id: 'CONTAINER-TERMINAL-01', name: 'Container Terminal (CTE)' }
} as const

/** Job worker types for Depot BPMN tasks */
export const JOB_TYPES = {
  sendEmptyCtnToTransport: 'send-empty-ctn-to-transport',
  sendCtnArrivalInfoToSa: 'send-ctn-arrival-info-to-sa',
  sendOutboundCtnToCt: 'send-outbound-ctn-to-ct'
} as const

/** Message names for Depot inbound / outbound integration */
export const MESSAGE_NAMES = {
  askForCtn: 'ask-for-ctn',
  emptyCtnToTransport: 'empty-ctn-to-transport',
  ctnArrivalInfoToSa: 'ctn-arrival-info-to-sa',
  outboundCtnToDepot: 'outbound-ctn-to-depot',
  outboundCtnToCt: 'outbound-ctn-to-ct'
} as const

/** Process IDs used for deployment and instance creation */
export const PROCESS_IDS = {
  depot: 'depot-export-contract'
} as const
