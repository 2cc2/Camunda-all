/**
 * Entity definitions for Owner (货主) contract.
 *
 * Derived from:
 * - owner.bpmn task variables
 * - 并发理论大作业命名规则 message schemas
 * - Collaboration.txt message flow specifications
 */

// ============================================================================
// Common fields (all messages must carry these per naming rules)
// ============================================================================

export interface CommonFields {
  /** Order unique identifier, correlation key. Format: ORDER-YYYYMMDD-NNN */
  orderId: string
  /** Message generation time, ISO 8601 UTC */
  timestamp: string
  /** Sender system identifier, e.g. OWNER-01, TRANSPORT-FLEET-08 */
  senderId: string
}

// ============================================================================
// Owner internal entities
// ============================================================================

/** Certificate of Entrustment (委托书) */
export interface CertificateOfEntrustment {
  telephone: string
  consignorName: string
  consigneeName?: string
  cargoDescription?: string
  [key: string]: any
}

/** Owner order data produced by handle-order task */
export interface OwnerOrder {
  customsOrderNo?: string
  goodsDescription?: string
  pol?: string /** Port of Loading, e.g. CNSHA */
  pod?: string /** Port of Discharge, e.g. CNSHA */
  cargoWeight?: string /** e.g. 1500kg */
  containerType?: string /** e.g. 1x40HQ */
  [key: string]: any
}

/** Container information */
export interface ContainerInfo {
  ctnNumber: string
  containerId?: string /** 4 letters + 7 digits, e.g. MSKU1234567 */
  vesselId?: string /** e.g. VESSEL-042 */
}

// ============================================================================
// Message payloads
// ============================================================================

/**
 * M1: order-to-ffw
 * Owner -> Freight Forwarder
 * Trigger: after handle-order completes, send-order-to-ffw worker emits this.
 */
export interface OrderToFfwPayload extends CommonFields {
  ffwId: string
  pol: string
  pod: string
  cargoWeight: string
  containerType?: string
  order?: OwnerOrder
}

/**
 * M*: outbound-ctn-to-transport
 * Owner -> Transport
 * Trigger: after Owner receives empty CTN and completes loading,
 *          send-outbound-ctn-to-transport worker emits this.
 */
export interface OutboundCtnToTransportPayload extends CommonFields {
  transportId: string
  ctnNumber: string
  direction: 'outbound'
  readyTime: string
  pickupAddress: string
  contactName: string
  contactPhone: string
}

/**
 * M22: ctn-to-owner
 * Transport -> Owner
 * Trigger: when Transport delivers empty container to Owner.
 * Owner receives this via intermediateCatchEvent "CTN received".
 */
export interface CtnToOwnerPayload extends CommonFields {
  ctnNumber: string
  handOverTime: string
  driverName: string
  carLicense: string
}

/**
 * expense-note-to-owner
 * Freight Forwarder / Environment -> Owner
 * Trigger: after outbound CTN is sent, expense note arrives.
 * Owner receives this via intermediateCatchEvent "expense note received".
 */
export interface ExpenseNoteToOwnerPayload extends CommonFields {
  expenseId: string
  expenseAmount: number
  currency: string
}

// ============================================================================
// Process variable bag (used by workers)
// ============================================================================

export interface OwnerProcessVariables {
  orderId?: string
  timestamp?: string
  senderId?: string

  // Internal business data
  certificateOfEntrustment?: CertificateOfEntrustment
  order?: OwnerOrder
  ctnNumber?: string
  expenseAmount?: number
  currency?: string

  // Flags
  orderSentToFfw?: boolean
  outboundCtnSentToTransport?: boolean
  paymentDone?: boolean
  paidAt?: string
}
