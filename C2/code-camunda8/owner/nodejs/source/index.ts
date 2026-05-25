import { Camunda8 } from '@camunda8/sdk'
import { CAMUNDA_AUTH_STRATEGY, CAMUNDA_REST_ADDRESS } from './config'
import { startOwnerContractWorkers } from './workers'
import { RabbitMQPublisher } from './rabbitmq/publisher'

async function main() {
  const client = new Camunda8({
    CAMUNDA_AUTH_STRATEGY,
    ZEEBE_REST_ADDRESS: CAMUNDA_REST_ADDRESS
  }).getCamundaRestClient()

  const rabbitPublisher = new RabbitMQPublisher()
  await rabbitPublisher.connect()

  const workers = startOwnerContractWorkers(client, rabbitPublisher)

  console.log('Owner contract workers started.')
  console.log(`REST endpoint: ${CAMUNDA_REST_ADDRESS}`)
  console.log(`RabbitMQ publisher: ${rabbitPublisher.isReady() ? 'connected' : 'disconnected'}`)
  console.log('Workers registered:')
  console.log('  - fill-out-certificate-of-entrustment')
  console.log('  - handle-order')
  console.log('  - send-order-to-ffw (RabbitMQ -> C3 FFW)')
  console.log('  - send-outbound-ctn-to-transport (RabbitMQ -> C3 Transport)')
  console.log('  - payment')
  console.log('Waiting for jobs...\n')

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down...')
    workers.fillCertificateWorker.stop()
    workers.handleOrderWorker.stop()
    workers.sendOrderToFfwWorker.stop()
    workers.sendOutboundCtnToTransportWorker.stop()
    workers.paymentWorker.stop()
    await rabbitPublisher.close()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
