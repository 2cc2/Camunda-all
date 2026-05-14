export const BASE_URL = process.env.ZEEBE_REST_ADDRESS || 'http://localhost:8080'
export const ZEEBE_GRPC_ADDRESS = process.env.ZEEBE_GRPC_ADDRESS || 'localhost:26500'

export const CUSTOMS_PROCESS_ID = 'Process_Customs'

export const ORDER_ID = process.env.ORDER_ID || 'ORDER-20260508-001'
export const CASE_ID = process.env.CASE_ID || ORDER_ID

export const MESSAGE_NAMES = {
    declarationReceived: 'Message_declaration_received',
    appointmentReceived: 'Message_Appointment_received',
    ctnAndShipArrive: 'Message_CTN_and_ship_arrive',
    manifestReceived: 'Message_CB_Manifest_received',
} as const
