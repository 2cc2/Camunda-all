import { CamundaRestClient, Dto } from '@camunda8/sdk'

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
