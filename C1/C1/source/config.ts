type CamundaAuthStrategy = 'NONE' | 'BASIC'

function normalizeCamundaRestBaseUrl(rawUrl: string) {
    return rawUrl.replace(/\/+$/, '').replace(/\/v2$/, '')
}

const rawCamundaRestAddress =
    process.env.CAMUNDA_REST_ADDRESS ||
    process.env.ZEEBE_REST_ADDRESS ||
    'http://localhost:8080'

export const CAMUNDA_AUTH_STRATEGY = (process.env.CAMUNDA_AUTH_STRATEGY as CamundaAuthStrategy) || 'NONE'
export const CAMUNDA_BASIC_AUTH_USERNAME = process.env.CAMUNDA_BASIC_AUTH_USERNAME
export const CAMUNDA_BASIC_AUTH_PASSWORD = process.env.CAMUNDA_BASIC_AUTH_PASSWORD

export const BASE_URL = normalizeCamundaRestBaseUrl(rawCamundaRestAddress)
export const CAMUNDA_REST_V2_BASE_URL = `${BASE_URL}/v2`
export const ZEEBE_GRPC_ADDRESS =
    process.env.CAMUNDA_GRPC_ADDRESS ||
    process.env.ZEEBE_GRPC_ADDRESS ||
    'grpc://localhost:26500'
export const RABBITMQ_MANAGEMENT_URL =
    process.env.RABBITMQ_MANAGEMENT_URL || 'http://localhost:15672'

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
