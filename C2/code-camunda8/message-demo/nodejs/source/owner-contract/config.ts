export const CAMUNDA_AUTH_STRATEGY = 'NONE' as const
export const CAMUNDA_REST_ADDRESS = process.env.CAMUNDA_REST_ADDRESS ?? 'http://localhost:8080'

export const PARTY = {
  // Use senderId examples consistent with the contract doc
  owner: { id: 'OWNER-01', name: 'Owner (OWN)' },
  freightForwarder: { id: 'FF-GLOBAL-LOGISTICS', name: 'Freight Forwarder (FFW)' },
  transport: { id: 'TRANSPORT-FLEET-08', name: 'Transport (TRP)' }
} as const

// Task types must be lower-case-with-hyphens.
export const JOB_TYPES = {
  fillOutCertificateOfEntrustment: 'fill-out-certificate-of-entrustment',
  handleOrder: 'handle-order',
  sendOrderToFfw: 'send-order-to-ffw',
  sendOutboundCtnToTransport: 'send-outbound-ctn-to-transport',
  payment: 'payment'
} as const

// Message names must be lower-case-with-hyphens.
export const MESSAGE_NAMES = {
  // Owner -> FFW
  orderToFfw: 'order-to-ffw',

  // Transport -> Owner (document explicitly lists this)
  ctnToOwner: 'ctn-to-owner',

  // Owner -> Transport
  outboundCtnToTransport: 'outbound-ctn-to-transport',

  // (Not in your list, but matches your Owner flow step “expense note received”)
  expenseNoteToOwner: 'expense-note-to-owner'
} as const

export const PROCESS_IDS = {
  owner: 'owner-export-contract'
} as const
