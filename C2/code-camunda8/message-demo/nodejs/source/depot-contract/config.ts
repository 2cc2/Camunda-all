export const CAMUNDA_AUTH_STRATEGY = 'NONE' as const
export const CAMUNDA_REST_ADDRESS = process.env.CAMUNDA_REST_ADDRESS ?? 'http://localhost:8080'

export const PARTY = {
  depot: { id: 'DEPOT-01', name: 'Depot' },
  freightForwarder: { id: 'FREIGHT-FORWARDER-01', name: 'Freight Forwarder' },
  shippingAgency: { id: 'SHIPPING-AGENCY-01', name: 'Shipping Agency' },
  transport: { id: 'TRANSPORT-01', name: 'Transport' },
  containerTerminal: { id: 'CONTAINER-TERMINAL-01', name: 'Container Terminal' }
} as const

export const JOB_TYPES = {
  sendEmptyCtnToTransport: 'send-empty-ctn-to-transport',
  sendCtnArrivalInfoToSa: 'send-ctn-arrival-info-to-sa',
  sendOutboundCtnToCt: 'send-outbound-ctn-to-ct'
} as const

export const MESSAGE_NAMES = {
  askForCtn: 'ask-for-ctn',
  emptyCtnToTransport: 'empty-ctn-to-transport',
  ctnArrivalInfoToSa: 'ctn-arrival-info-to-sa',
  outboundCtnAndReceiptReceived: 'outbound-ctn-and-receipt-received',
  outboundCtnToCt: 'outbound-ctn-to-ct'
} as const

export const PROCESS_IDS = {
  depot: 'depot-export-contract'
} as const
