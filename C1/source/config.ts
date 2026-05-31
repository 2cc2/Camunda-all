export const BASE_URL = process.env.ZEEBE_REST_ADDRESS || 'http://localhost:8080'
export const ZEEBE_GRPC_ADDRESS = process.env.ZEEBE_GRPC_ADDRESS || 'localhost:26500'

// ==================== Process IDs ====================
export const CUSTOMS_PROCESS_ID = 'Process_Customs'
export const CB_PROCESS_ID = 'Process_CB'
export const CT_PROCESS_ID = 'Process_CT'
export const SA_PROCESS_ID = 'Process_SA'

export const ORDER_ID = process.env.ORDER_ID || 'ORDER-20260508-001'
export const CASE_ID = process.env.CASE_ID || ORDER_ID

// ==================== Message Names (Environment → Customs) ====================
export const MESSAGE_NAMES = {
    declarationReceived: 'Message_declaration_received',
    appointmentReceived: 'Message_Appointment_received',
    ctnAndShipArrive: 'Message_CTN_and_ship_arrive',
    manifestReceived: 'Message_CB_Manifest_received',
} as const

// ==================== Message Names (Customs → Environment) ====================
export const CUSTOMS_OUT_MESSAGE_NAMES = {
    declareSuccess: 'Message_declare_success_received',
    customsClearanceCT: 'Message_CT_customs_cearance',
    customsClearanceCB: 'Message_CB_customs_cearance',
} as const

// ==================== Business Message Names (for logging) ====================
export const BUSINESS_MESSAGE_NAMES = {
    declarationSubmitted: 'declaration-submitted',
    inspectionAppointment: 'inspection-appointment',
    ctnAndShipArrive: 'ctn-and-ship-arrive',
    cbManifestReceived: 'cb-manifest-received',
    declareSuccess: 'declare-success',
    customsClearance: 'customs-clearance',
} as const
