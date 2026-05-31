import { CamundaRestClient, Dto } from '@camunda8/sdk'
import { BUSINESS_MESSAGE_NAMES, CUSTOMS_OUT_MESSAGE_NAMES } from './config'
import { appendMockMessage } from './mockEnvironmentBus'
import { getBridge } from './rabbitmq'

class CustomsVariables extends Dto.LosslessDto {
    orderId?: string
    declarationId?: string
    declareStatus?: string
    acceptedTime?: string
    manifestId?: string
    vesselId?: string
    containerId?: string
    appointmentId?: string
    appointmentTime?: string
    inspectionLocation?: string
    ciqStatus?: string
    ciqCheckedAt?: string
    inspectionId?: string
    inspectionType?: string
    inspectionTime?: string
    clearanceId?: string
    clearanceStatus?: string
    clearanceTime?: string
}

export function startCustomsWorkers(client: CamundaRestClient) {
    const declareSuccessWorker = client.createJobWorker<CustomsVariables, CustomsVariables>({
        type: 'declareSuccess',
        timeout: 10000,
        maxJobsToActivate: 5,
        worker: 'customs-declare-success-worker',
        jobHandler: async (job, log) => {
            const orderId = job.variables.orderId ?? 'UNKNOWN_ORDER'
            const declarationId = job.variables.declarationId ?? 'DECL-MISSING'
            const acceptedTime = new Date().toISOString()

            log.info(`[declareSuccess] 订单 ${orderId} 的报关申报已受理，报关单号 ${declarationId}`, job.jobKey)

            await sleep(1000)

            const payload = {
                orderId,
                timestamp: acceptedTime,
                senderId: 'CUSTOMS-SH-01',
                declarationId,
                declareStatus: 'ACCEPTED',
            }

            appendMockMessage({
                direction: 'customs-to-environment',
                technicalName: 'Activity_0hmtv68',
                businessName: BUSINESS_MESSAGE_NAMES.declareSuccess,
                orderId,
                timestamp: acceptedTime,
                payload,
            })

            const bridge = getBridge()
            if (bridge?.publisher.isReady()) {
                await bridge.publisher.publishDeclareSuccess(orderId, payload)
            } else {
                const { publishMessage } = await import('./camundaApi')
                await publishMessage(CUSTOMS_OUT_MESSAGE_NAMES.declareSuccess, payload, orderId)
            }

            return job.complete({
                declareStatus: 'ACCEPTED',
                acceptedTime,
            })
        },
    })

    const ciqWorker = client.createJobWorker<CustomsVariables, CustomsVariables>({
        type: 'CIQ',
        timeout: 10000,
        maxJobsToActivate: 5,
        worker: 'customs-ciq-worker',
        jobHandler: async (job, log) => {
            const orderId = job.variables.orderId ?? 'UNKNOWN_ORDER'
            const ciqCheckedAt = new Date().toISOString()

            log.info(`[CIQ] 开始处理订单 ${orderId} 的联检环节`, job.jobKey)

            await sleep(1000)

            return job.complete({
                ciqStatus: 'PASSED',
                ciqCheckedAt,
            })
        },
    })

    const inspectionWorker = client.createJobWorker<CustomsVariables, CustomsVariables>({
        type: 'inspection',
        timeout: 10000,
        maxJobsToActivate: 5,
        worker: 'customs-inspection-worker',
        jobHandler: async (job, log) => {
            const orderId = job.variables.orderId ?? 'UNKNOWN_ORDER'
            const inspectionTime = new Date().toISOString()
            const inspectionId = `INSP-${Date.now()}`

            log.info(`[inspection] 开始处理订单 ${orderId} 的查验流程`, job.jobKey)

            await sleep(1200)

            return job.complete({
                inspectionId,
                inspectionType: 'PHYSICAL',
                inspectionTime,
            })
        },
    })

    const customsClearanceWorker = client.createJobWorker<CustomsVariables, CustomsVariables>({
        type: 'CustomsCearance',
        timeout: 10000,
        maxJobsToActivate: 5,
        worker: 'customs-clearance-worker',
        jobHandler: async (job, log) => {
            const orderId = job.variables.orderId ?? 'UNKNOWN_ORDER'
            const clearanceTime = new Date().toISOString()
            const clearanceId = `CLR-${Date.now()}`

            log.info(`[CustomsCearance] 订单 ${orderId} 已满足放行条件，执行海关放行`, job.jobKey)

            await sleep(1200)

            const payload = {
                orderId,
                timestamp: clearanceTime,
                senderId: 'CUSTOMS-SH-01',
                clearanceId,
                vesselId: job.variables.vesselId ?? 'VESSEL-042',
                containerId: job.variables.containerId ?? 'MSKU1234567',
                clearanceStatus: 'APPROVED',
                clearanceTime,
            }

            appendMockMessage({
                direction: 'customs-to-environment',
                technicalName: 'Activity_0st26zj',
                businessName: BUSINESS_MESSAGE_NAMES.customsClearance,
                orderId,
                timestamp: clearanceTime,
                payload,
            })

            const bridge = getBridge()
            if (bridge?.publisher.isReady()) {
                await bridge.publisher.publishClearanceCT(orderId, payload)
                await bridge.publisher.publishClearanceCB(orderId, payload)
            } else {
                const { publishMessage } = await import('./camundaApi')
                await publishMessage(CUSTOMS_OUT_MESSAGE_NAMES.customsClearanceCT, payload, orderId)
                await publishMessage(CUSTOMS_OUT_MESSAGE_NAMES.customsClearanceCB, payload, orderId)
            }

            return job.complete({
                clearanceId,
                clearanceStatus: 'APPROVED',
                clearanceTime,
            })
        },
    })

    return {
        declareSuccessWorker,
        ciqWorker,
        inspectionWorker,
        customsClearanceWorker,
    }
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}
