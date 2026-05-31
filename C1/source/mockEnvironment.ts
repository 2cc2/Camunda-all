import { BUSINESS_MESSAGE_NAMES, MESSAGE_NAMES, ORDER_ID } from './config'
import { publishMessage } from './camundaApi'
import { appendMockMessage, JsonRecord, waitForMockMessage } from './mockEnvironmentBus'

export async function runMockEnvironment(orderId: string = ORDER_ID) {
    console.log('\n[mock environment] 按 BPMN 消息流开始驱动外部环境')

    await sendDeclarationToCustoms(orderId)

    console.log('\n[mock environment] 等待 Customs 发出 declare success message to CB...')
    const declareSuccessMessage = await waitForMockMessage(
        (message) =>
            message.direction === 'customs-to-environment' &&
            message.orderId === orderId &&
            message.businessName === BUSINESS_MESSAGE_NAMES.declareSuccess,
        30000,
    )
    console.log('[mock environment] 已收到 declare-success:')
    console.log(JSON.stringify(declareSuccessMessage, null, 2))

    await sendAppointmentToCustoms(orderId)

    // 这两条消息在 BPMN 中与 appointment 一起作为并行前置条件，
    // mock environment 按剩余依赖继续补齐即可。
    await sendShipAndCtnArrivalToCustoms(orderId)
    await sendManifestToCustoms(orderId)

    console.log('\n[mock environment] 等待 Customs 发出 customs clearance message...')
    const customsClearanceMessage = await waitForMockMessage(
        (message) =>
            message.direction === 'customs-to-environment' &&
            message.orderId === orderId &&
            message.businessName === BUSINESS_MESSAGE_NAMES.customsClearance,
        30000,
    )
    console.log('[mock environment] 已收到 customs-clearance:')
    console.log(JSON.stringify(customsClearanceMessage, null, 2))
}

if (require.main === module) {
    runMockEnvironment().catch((error) => {
        console.error('mock environment 运行失败:', error)
        process.exit(1)
    })
}

async function sendDeclarationToCustoms(orderId: string) {
    const payload = {
        orderId,
        timestamp: new Date().toISOString(),
        declarationId: 'DECL-20260508-001',
        senderId: 'CUSTOMS-BROKER-05',
        hsCode: '9503.00',
        declaredValue: 25000,
        currency: 'USD',
        quantity: 500,
        countryOfOrigin: 'CN',
        countryOfDestination: 'US',
        cargoDescription: 'Plush Toys',
    }

    await recordAndPublish(
        'declaration to Customs',
        MESSAGE_NAMES.declarationReceived,
        BUSINESS_MESSAGE_NAMES.declarationSubmitted,
        payload,
    )
}

async function sendAppointmentToCustoms(orderId: string) {
    const payload = {
        orderId,
        timestamp: new Date().toISOString(),
        appointmentId: 'APT-20260508-001',
        senderId: 'CUSTOMS-BROKER-05',
        appointmentTime: '2026-05-09T09:00:00Z',
        inspectionLocation: 'Shanghai Yangshan Inspection Area',
        contactPerson: 'Li Ming',
        contactPhone: '+86-21-12345678',
    }

    await recordAndPublish(
        'Appointment to Customs',
        MESSAGE_NAMES.appointmentReceived,
        BUSINESS_MESSAGE_NAMES.inspectionAppointment,
        payload,
    )
}

async function sendShipAndCtnArrivalToCustoms(orderId: string) {
    const payload = {
        orderId,
        timestamp: new Date().toISOString(),
        senderId: 'CONTAINER-TERMINAL-01',
        vesselId: 'VESSEL-042',
        containerId: 'MSKU1234567',
        arrivalTime: '2026-05-08T10:00:00Z',
    }

    await recordAndPublish(
        'ship and CTN arrival message to Customs',
        MESSAGE_NAMES.ctnAndShipArrive,
        BUSINESS_MESSAGE_NAMES.ctnAndShipArrive,
        payload,
    )
}

async function sendManifestToCustoms(orderId: string) {
    const payload = {
        orderId,
        timestamp: new Date().toISOString(),
        manifestId: 'MNF-20260508-001',
        senderId: 'SHIPPING-AGENCY-01',
        vesselId: 'VESSEL-042',
    }

    await recordAndPublish(
        'Manifest Sent from SA',
        MESSAGE_NAMES.manifestReceived,
        BUSINESS_MESSAGE_NAMES.cbManifestReceived,
        payload,
    )
}

async function recordAndPublish(
    flowName: string,
    technicalName: string,
    businessName: string,
    payload: JsonRecord,
) {
    console.log(`[mock environment] 发送消息流: ${flowName}`)
    console.log('[mock environment] 发送数据:')
    console.log(JSON.stringify(payload, null, 2))

    appendMockMessage({
        direction: 'environment-to-customs',
        technicalName,
        businessName,
        orderId: String(payload.orderId),
        timestamp: String(payload.timestamp),
        payload,
    })

    await publishMessage(technicalName, payload, String(payload.orderId))
}
