import { CamundaRestClient, Dto } from '@camunda8/sdk'
import { MESSAGE_NAMES, BUSINESS_MESSAGE_NAMES } from './config'
import { appendMockMessage } from './mockEnvironmentBus'
import { getBridge } from './rabbitmq'

class SAVariables extends Dto.LosslessDto {
    orderId?: string
    manifestId?: string
    vesselId?: string
}

export function startShippingAgencyWorkers(client: CamundaRestClient) {
    const sendManifestWorker = client.createJobWorker<SAVariables, SAVariables>({
        type: 'send-manifest-to-customs',
        timeout: 10000,
        maxJobsToActivate: 5,
        worker: 'sa-send-manifest-worker',
        jobHandler: async (job, log) => {
            const orderId = job.variables.orderId ?? 'UNKNOWN_ORDER'
            const timestamp = new Date().toISOString()
            const manifestId = `MNF-${Date.now()}`
            const vesselId = 'VESSEL-042'

            log.info(`[ShippingAgency] 订单 ${orderId} 发送舱单到海关 (manifest=${manifestId})`, job.jobKey)

            const payload = {
                orderId,
                timestamp,
                manifestId,
                senderId: 'SHIPPING-AGENCY-01',
                vesselId,
            }

            appendMockMessage({
                direction: 'environment-to-customs',
                technicalName: MESSAGE_NAMES.manifestReceived,
                businessName: BUSINESS_MESSAGE_NAMES.cbManifestReceived,
                orderId,
                timestamp,
                payload,
            })

            const bridge = getBridge()
            if (bridge?.publisher.isReady()) {
                await bridge.publisher.publishManifest(orderId, payload)
            } else {
                const { publishMessage } = await import('./camundaApi')
                await publishMessage(MESSAGE_NAMES.manifestReceived, payload, orderId)
            }

            return job.complete({ manifestId, vesselId })
        },
    })

    return { sendManifestWorker }
}
