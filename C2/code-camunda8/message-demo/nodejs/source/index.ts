import { Camunda8 } from '@camunda8/sdk'
import { CAMUNDA_AUTH_STRATEGY, CAMUNDA_REST_ADDRESS } from './config'
import { startWorkers } from './workers'

const client = new Camunda8({
  CAMUNDA_AUTH_STRATEGY,
  ZEEBE_REST_ADDRESS: CAMUNDA_REST_ADDRESS
}).getCamundaRestClient()

startWorkers(client)

console.log('Camunda message-pair demo workers started.')
console.log(`REST endpoint: ${CAMUNDA_REST_ADDRESS}`)
console.log('Workers registered:')
console.log('  - prepare-request')
console.log('  - publish-request-message')
console.log('  - handle-response')
console.log('  - prepare-receiver')
console.log('  - process-request')
console.log('  - publish-response-message')
console.log('Waiting for jobs...\n')
