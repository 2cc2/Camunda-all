import { CamundaRabbitMQBridge } from './bridge'

let bridgeInstance: CamundaRabbitMQBridge | null = null

export function getBridge(): CamundaRabbitMQBridge | null {
    return bridgeInstance
}

export function setBridge(bridge: CamundaRabbitMQBridge) {
    bridgeInstance = bridge
}

export function clearBridge() {
    bridgeInstance = null
}

export { CamundaRabbitMQBridge } from './bridge'
export { RabbitMQPublisher } from './publisher'
export { RabbitMQConsumer } from './consumer'
