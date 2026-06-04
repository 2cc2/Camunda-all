import { CamundaRestClient } from '@camunda8/sdk'
import { startContainerTerminalWorkers } from './ContainerTerminal'
import { startCustomsWorkers } from './Customs'
import { startCustomsBrokerWorkers } from './CustomsBroker'
import { startShippingAgencyWorkers } from './ShippingAgency'
import { CamundaRabbitMQBridge, clearBridge, setBridge } from './rabbitmq'
import { createCamundaRestClient } from './sdk'

export type ApplicationRuntime = {
    client: CamundaRestClient
    bridge: CamundaRabbitMQBridge | null
}

function startParticipantWorkers(client: CamundaRestClient) {
    startCustomsWorkers(client)
    startCustomsBrokerWorkers(client)
    startContainerTerminalWorkers(client)
    startShippingAgencyWorkers(client)
}

export async function startApplicationRuntime(options: { requireRabbitMQ?: boolean } = {}): Promise<ApplicationRuntime> {
    const client = createCamundaRestClient()
    let bridge: CamundaRabbitMQBridge | null = null

    try {
        bridge = new CamundaRabbitMQBridge()
        await bridge.connect()
        await bridge.start()
        setBridge(bridge)
    } catch (error) {
        if (bridge) {
            await bridge.close().catch(() => undefined)
        }
        clearBridge()
        if (options.requireRabbitMQ) {
            throw error
        }
        bridge = null
    }

    startParticipantWorkers(client)
    return { client, bridge }
}

export async function stopApplicationRuntime(runtime: ApplicationRuntime) {
    runtime.client.stopWorkers()
    if (runtime.bridge) {
        await runtime.bridge.close()
    }
    clearBridge()
}
