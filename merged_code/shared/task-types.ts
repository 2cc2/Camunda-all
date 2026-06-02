/**
 * 28 个 Service / Send Task 的 type 常量。
 * 与 bpmn/all.bpmn 中 <zeebe:taskDefinition type="..."> 一一对应。
 */

export const TASK_TYPES = {
  // Owner
  FILL_CERTIFICATE: 'fill-certificate',
  HANDLE_ORDER: 'handle-order',
  ORDER_TO_FFW: 'order-to-ffw',
  OUTBOUND_CTN_TO_TRANSPORT: 'outbound-ctn-to-transport',
  PAYMENT: 'payment',

  // Freight Forwarder
  SO_TO_SA: 'so-to-sa',
  EQUIPMENT_RECEIPT_TO_TRANSPORT: 'equipment-receipt-to-transport',
  ORDER_INFO_TO_CB: 'order-info-to-cb',
  EXPENSE_NOTE_RECEIVED: 'expense-note-received',
  CREWLIST_RECEIVED: 'crewlist-received',
  SHIP_ARRIVE_AT_CT: 'ship-arrive-at-ct',

  // Shipping Agency
  HANDLE_MANIFEST: 'handle-manifest',
  SA_EQUIPMENT_RECEIPT_RECEIVED: 'sa-equipment-receipt-received',
  CTN_ARRIVAL_INFO_TO_SA: 'ctn-arrival-info-to-sa',

  // Depot
  ASK_FOR_CTN: 'ask-for-ctn',
  OUTBOUND_CTN_TO_CT: 'outbound-ctn-to-ct',

  // SBGS
  PERSONNEL_INFO_REGISTRATION: 'personnel-info-registration',

  // Customs Broker
  DECLARATION_SUBMITTED: 'declaration-submitted',
  INSPECTION_APPOINTMENT: 'inspection-appointment',

  // Customs
  CUSTOMS_CLEARANCE_TO_TERMINAL: 'customs-clearance-to-terminal',
  INSPECTION: 'inspection',
  CIQ: 'ciq',
  CLEARANCE_TO_BROKER: 'clearance-to-broker',

  // Container Terminal
  LOAD_CTN: 'load-ctn',
  ARRIVAL_TO_CUSTOMS: 'arrival-to-customs',
  SHIP_DEPARTURE_NOTIFICATION: 'ship-departure-notification',

  // Transport
  CTN_TO_OWNER: 'ctn-to-owner',
  OUTBOUND_CTN_TO_DEPOT: 'outbound-ctn-to-depot',
  EMPTY_CTN_TO_TRANSPORT: 'empty-ctn-to-transport',
} as const;

export type TaskType = typeof TASK_TYPES[keyof typeof TASK_TYPES];
