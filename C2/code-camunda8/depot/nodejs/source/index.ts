import { Camunda8 } from '@camunda8/sdk'
import { CAMUNDA_AUTH_STRATEGY, CAMUNDA_REST_ADDRESS } from './config'
import { startDepotContractWorkers } from './workers'
import { CamundaRabbitMQBridge } from './rabbitmq/bridge'

async function main() {
  const client = new Camunda8({
    CAMUNDA_AUTH_STRATEGY,
    ZEEBE_REST_ADDRESS: CAMUNDA_REST_ADDRESS
  }).getCamundaRestClient()
  const bridge = new CamundaRabbitMQBridge()

  await bridge.connect()
  await bridge.start()
  const workers = startDepotContractWorkers(client, bridge.publisher)

  const shutdown = async (signal: string) => {
    console.log(`\nShutting down Depot bridge on ${signal}...`)
    workers.sendEmptyCtnToTransportWorker.stop()
    workers.sendCtnArrivalInfoToSaWorker.stop()
    workers.sendOutboundCtnToCtWorker.stop()
    await bridge.close()
    const p: any = (globalThis as any).process
    if (p) p.exit(0)
  }

  process.once('SIGINT', () => {
    void shutdown('SIGINT')
  })
  process.once('SIGTERM', () => {
    void shutdown('SIGTERM')
  })

  console.log('Depot contract workers started with RabbitMQ bridge.')
  console.log(`REST endpoint: ${CAMUNDA_REST_ADDRESS}`)
  console.log('Workers registered:')
  console.log('  - send-empty-ctn-to-transport')
  console.log('  - send-ctn-arrival-info-to-sa')
  console.log('  - send-outbound-ctn-to-ct')
  console.log('Waiting for upstream RabbitMQ messages ask-for-ctn / outbound-ctn-to-depot...\n')
}

main().catch((error) => {
  console.error(error)
  const p: any = (globalThis as any).process
  if (p) p.exitCode = 1
})
