import { CamundaRestClient, Dto } from '@camunda8/sdk'
import { BUSINESS_MESSAGE_NAMES, CUSTOMS_OUT_MESSAGE_NAMES } from './config'
import { evaluateDeclarationPrecheck, evaluateSupervisionDecision } from './customsDecision'
import { appendMockMessage } from './mockEnvironmentBus'
import { getBridge } from './rabbitmq'

class CustomsVariables extends Dto.LosslessDto {
    orderId?: string
    hsCode?: string
    declaredValue?: number
    currency?: string
    quantity?: number
    countryOfOrigin?: string
    countryOfDestination?: string
    cargoDescription?: string
    declarationId?: string
    declareStatus?: string
    acceptedTime?: string
    manifestId?: string
    vesselId?: string
    containerId?: string
    manifestVesselId?: string
    manifestContainerId?: string
    manifestCargoDescription?: string
    manifestQuantity?: number
    manifestFiledAt?: string
    arrivalReportId?: string
    appointmentId?: string
    appointmentTime?: string
    inspectionLocation?: string
    terminalLocation?: string
    ciqStatus?: string
    ciqCheckedAt?: string
    riskScore?: number
    riskLevel?: string
    riskFlags?: string[]
    consistencyStatus?: string
    consistencyIssues?: string[]
    reviewStatus?: string
    manifestTimingStatus?: string
    inspectionRecommendedType?: string
    clearanceBasis?: string
    inspectionId?: string
    inspectionType?: string
    inspectionReason?: string
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
            const precheck = evaluateDeclarationPrecheck(job.variables)

            log.info(`[declareSuccess] 订单 ${orderId} 的报关申报已受理，报关单号 ${declarationId}`, job.jobKey)
            log.info(
                `[declareSuccess] 初步风险画像: score=${precheck.riskScore}, level=${precheck.riskLevel}, flags=${precheck.riskFlags.join(',') || 'NONE'}`,
                job.jobKey,
            )

            await sleep(1000)

            const payload = {
                orderId,
                timestamp: acceptedTime,
                senderId: 'CUSTOMS-SH-01',
                declarationId,
                declareStatus: 'ACCEPTED',
                riskLevel: precheck.riskLevel,
                riskScore: precheck.riskScore,
                recommendedInspectionType: precheck.recommendedInspectionType,
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
                riskScore: precheck.riskScore,
                riskLevel: precheck.riskLevel,
                riskFlags: precheck.riskFlags,
                inspectionRecommendedType: precheck.recommendedInspectionType,
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
            const decision = evaluateSupervisionDecision(job.variables)

            log.info(`[CIQ] 开始处理订单 ${orderId} 的联检环节`, job.jobKey)
            log.info(
                `[CIQ] 多源校验结果: consistency=${decision.consistencyStatus}, issues=${decision.consistencyIssues.join(',') || 'NONE'}, timing=${decision.manifestTimingStatus}`,
                job.jobKey,
            )
            log.info(
                `[CIQ] 风险评估结果: score=${decision.riskScore}, level=${decision.riskLevel}, review=${decision.reviewStatus}`,
                job.jobKey,
            )

            await sleep(1000)

            return job.complete({
                ciqStatus: decision.reviewStatus === 'MANUAL_REVIEW' ? 'REVIEW_REQUIRED' : 'PASSED',
                ciqCheckedAt,
                riskScore: decision.riskScore,
                riskLevel: decision.riskLevel,
                riskFlags: decision.riskFlags,
                consistencyStatus: decision.consistencyStatus,
                consistencyIssues: decision.consistencyIssues,
                reviewStatus: decision.reviewStatus,
                manifestTimingStatus: decision.manifestTimingStatus,
                inspectionRecommendedType: decision.recommendedInspectionType,
                clearanceBasis: decision.clearanceBasis,
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
            const decision = evaluateSupervisionDecision(job.variables)

            log.info(`[inspection] 开始处理订单 ${orderId} 的查验流程`, job.jobKey)
            log.info(
                `[inspection] 查验方案: type=${decision.recommendedInspectionType}, reason=${decision.riskFlags[0] ?? 'ROUTINE_REVIEW'}`,
                job.jobKey,
            )

            await sleep(1200)

            return job.complete({
                inspectionId,
                inspectionType: decision.recommendedInspectionType,
                inspectionReason: decision.riskFlags[0] ?? 'ROUTINE_REVIEW',
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
            const decision = evaluateSupervisionDecision(job.variables)
            const clearanceStatus = decision.reviewStatus === 'MANUAL_REVIEW' ? 'PENDING_REVIEW' : 'APPROVED'

            log.info(`[CustomsCearance] 订单 ${orderId} 已满足放行条件，执行海关放行`, job.jobKey)
            log.info(
                `[CustomsCearance] 放行依据: ${decision.clearanceBasis}`,
                job.jobKey,
            )

            await sleep(1200)

            const payload = {
                orderId,
                timestamp: clearanceTime,
                senderId: 'CUSTOMS-SH-01',
                clearanceId,
                vesselId: job.variables.vesselId ?? 'VESSEL-042',
                containerId: job.variables.containerId ?? 'MSKU1234567',
                clearanceStatus,
                clearanceTime,
                inspectionType: job.variables.inspectionType ?? decision.recommendedInspectionType,
                riskLevel: decision.riskLevel,
                riskScore: decision.riskScore,
                clearanceBasis: decision.clearanceBasis,
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
                clearanceStatus,
                clearanceTime,
                clearanceBasis: decision.clearanceBasis,
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
