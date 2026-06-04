import { CamundaRestClient, Dto } from '@camunda8/sdk'
import { MESSAGE_NAMES, BUSINESS_MESSAGE_NAMES } from './config'
import { appendMockMessage } from './mockEnvironmentBus'
import { getBridge } from './rabbitmq'

class CBVariables extends Dto.LosslessDto {
    orderId?: string
    declarationId?: string
    appointmentId?: string
    appointmentTime?: string
    inspectionLocation?: string
}

export function startCustomsBrokerWorkers(client: CamundaRestClient) {
    const submitDeclarationWorker = client.createJobWorker<CBVariables, CBVariables>({
        type: 'submit-declaration',
        timeout: 10000,
        maxJobsToActivate: 5,
        worker: 'cb-submit-declaration-worker',
        jobHandler: async (job, log) => {
            const orderId = job.variables.orderId ?? 'UNKNOWN_ORDER'
            const timestamp = new Date().toISOString()
            const declarationId = `DECL-${Date.now()}`

            log.info(`[CustomsBroker] 订单 ${orderId} 提交报关申报，报关单号 ${declarationId}`, job.jobKey)

            const payload = {
                orderId,
                timestamp,
                declarationId,
                senderId: 'CUSTOMS-BROKER-05',
                cbId: 'CUSTOMS-BROKER-05',
                hsCode: '9503.00',
                declaredValue: 25000,
                currency: 'USD',
                quantity: 500,
                countryOfOrigin: 'CN',
                countryOfDestination: 'US',
                cargoDescription: 'Plush Toys',
                complianceChannel: 'STANDARD_EXPORT',
            }

            appendMockMessage({
                direction: 'environment-to-customs',
                technicalName: MESSAGE_NAMES.declarationReceived,
                businessName: BUSINESS_MESSAGE_NAMES.declarationSubmitted,
                orderId,
                timestamp,
                payload,
            })

            const bridge = getBridge()
            if (bridge?.publisher.isReady()) {
                await bridge.publisher.publishDeclaration(orderId, payload)
            } else {
                // fallback: 直接调 Camunda REST API
                const { publishMessage } = await import('./camundaApi')
                await publishMessage(MESSAGE_NAMES.declarationReceived, payload, orderId)
            }

            return job.complete({ declarationId })
        },
    })

    const appointInspectionWorker = client.createJobWorker<CBVariables, CBVariables>({
        type: 'appoint-inspection',
        timeout: 10000,
        maxJobsToActivate: 5,
        worker: 'cb-appoint-inspection-worker',
        jobHandler: async (job, log) => {
            const orderId = job.variables.orderId ?? 'UNKNOWN_ORDER'
            const timestamp = new Date().toISOString()
            const appointmentId = `APT-${Date.now()}`

            log.info(`[CustomsBroker] 订单 ${orderId} 预约查验，预约号 ${appointmentId}`, job.jobKey)

            const payload = {
                orderId,
                timestamp,
                appointmentId,
                senderId: 'CUSTOMS-BROKER-05',
                appointmentTime: new Date(Date.now() + 86400000).toISOString(),
                inspectionLocation: 'Shanghai Yangshan Inspection Area',
                contactPerson: 'Li Ming',
                contactPhone: '+86-21-12345678',
            }

            appendMockMessage({
                direction: 'environment-to-customs',
                technicalName: MESSAGE_NAMES.appointmentReceived,
                businessName: BUSINESS_MESSAGE_NAMES.inspectionAppointment,
                orderId,
                timestamp,
                payload,
            })

            const bridge = getBridge()
            if (bridge?.publisher.isReady()) {
                await bridge.publisher.publishAppointment(orderId, payload)
            } else {
                const { publishMessage } = await import('./camundaApi')
                await publishMessage(MESSAGE_NAMES.appointmentReceived, payload, orderId)
            }

            return job.complete({ appointmentId })
        },
    })

    return { submitDeclarationWorker, appointInspectionWorker }
}
