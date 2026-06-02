/**
 * 共享消息名常量 —— 与 bpmn/all.bpmn 中 <bpmn:message name="..."> 保持一一对应。
 * 所有消息使用 kebab-case，关联键统一为 orderId。
 */

export const MESSAGES = {
  // Owner → FFW
  ORDER_TO_FFW: 'order-to-ffw',

  // FFW → SAG / CUB / TRP
  SO_TO_SA: 'so-to-sa',
  ORDER_INFO_TO_CB: 'order-info-to-cb',
  EQUIPMENT_RECEIPT_TO_TRANSPORT: 'equipment-receipt-to-transport',

  // SAG → FFW / CTE / SBG / Owner / DPT
  FF_MANIFEST_RECEIVED: 'ff-manifest-received',
  CT_MANIFEST_RECEIVED: 'ct-manifest-received',
  CB_MANIFEST_RECEIVED: 'cb-manifest-received',
  SHIP_ARRIVE_AT_CT: 'ship-arrive-at-ct',
  CREWLIST_RECEIVED: 'crewlist-received',
  EXPENSE_NOTE_RECEIVED: 'expense-note-received',
  SA_EQUIPMENT_RECEIPT_RECEIVED: 'sa-equipment-receipt-received',

  // CUB → CUS
  DECLARATION_SUBMITTED: 'declaration-submitted',
  INSPECTION_APPOINTMENT: 'inspection-appointment',

  // CUS → CUB / CTE
  CLEARANCE_TO_BROKER: 'clearance-to-broker',
  CUSTOMS_CLEARANCE_TO_BROKER: 'customs-clearance-to-broker',
  CUSTOMS_CLEARANCE_TO_TERMINAL: 'customs-clearance-to-terminal',

  // CTE → CUS / SAG
  ARRIVAL_TO_CUSTOMS: 'arrival-to-customs',
  SHIP_DEPARTURE_NOTIFICATION: 'ship-departure-notification',
  CTN_ARRIVAL_INFO_TO_SA: 'ctn-arrival-info-to-sa',

  // TRP → Owner / DPT
  CTN_TO_OWNER: 'ctn-to-owner',
  OUTBOUND_CTN_TO_DEPOT: 'outbound-ctn-to-depot',
  OUTBOUND_CTN_TO_TRANSPORT: 'outbound-ctn-to-transport',
  EMPTY_CTN_TO_TRANSPORT: 'empty-ctn-to-transport',

  // DPT → CTE
  OUTBOUND_CTN_TO_CT: 'outbound-ctn-to-ct',
  ASK_FOR_CTN: 'ask-for-ctn',
} as const;

export type MessageName = typeof MESSAGES[keyof typeof MESSAGES];

/**
 * 所有消息必含的基础字段（命名规则 PDF 第 1 节）。
 */
export interface BaseMessagePayload {
  orderId: string;        // 关联键，格式 ORDER-YYYYMMDD-NNN
  timestamp: string;      // ISO 8601 UTC
  senderId: string;       // 发送方系统标识
  [extra: string]: unknown;
}
