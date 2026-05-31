import { CamundaRestClient, Dto } from '@camunda8/sdk'
import { MESSAGE_NAMES, BUSINESS_MESSAGE_NAMES } from './config'
import { appendMockMessage } from './mockEnvironmentBus'
import { getBridge } from './rabbitmq'

class CTVariables extends Dto.LosslessDto {
    orderId?: string
    vesselId?: string
    containerId?: string
    arrivalTime?: string
}

export function startContainerTerminalWorkers(client: CamundaRestClient) {
    const sendArrivalWorker = client.createJobWorker<CTVariables, CTVariables>({
        type: 'send-arrival-to-customs',
        timeout: 10000,
        maxJobsToActivate: 5,
        worker: 'ct-send-arrival-worker',
        jobHandler: async (job, log) => {
            const orderId = job.variables.orderId ?? 'UNKNOWN_ORDER'
            const timestamp = new Date().toISOString()
            const vesselId = 'VESSEL-042'
            const containerId = 'MSKU1234567'

            log.info(`[ContainerTerminal] 订单 ${orderId} 船舶和集装箱已到港 (vessel=${vesselId}, ctn=${containerId})`, job.jobKey)

            const payload = {
                orderId,
                timestamp,
                senderId: 'CONTAINER-TERMINAL-01',
                vesselId,
                containerId,
                arrivalTime: timestamp,
            }

            appendMockMessage({
                direction: 'environment-to-customs',
                technicalName: MESSAGE_NAMES.ctnAndShipArrive,
                businessName: BUSINESS_MESSAGE_NAMES.ctnAndShipArrive,
                orderId,
                timestamp,
                payload,
            })

            const bridge = getBridge()
            if (bridge?.publisher.isReady()) {
                await bridge.publisher.publishArrival(orderId, payload)
            } else {
                const { publishMessage } = await import('./camundaApi')
                await publishMessage(MESSAGE_NAMES.ctnAndShipArrive, payload, orderId)
            }

            return job.complete({ vesselId, containerId, arrivalTime: timestamp })
        },
    })

    return { sendArrivalWorker }
}
