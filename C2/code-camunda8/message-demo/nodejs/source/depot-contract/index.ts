import { Camunda8 } from '@camunda8/sdk'
import { CAMUNDA_AUTH_STRATEGY, CAMUNDA_REST_ADDRESS } from './config'
import { startDepotContractWorkers } from './workers'

const client = new Camunda8({
  CAMUNDA_AUTH_STRATEGY,
  ZEEBE_REST_ADDRESS: CAMUNDA_REST_ADDRESS
}).getCamundaRestClient()

startDepotContractWorkers(client)

console.log('Depot contract workers started.')
console.log(`REST endpoint: ${CAMUNDA_REST_ADDRESS}`)
console.log('Workers registered:')
console.log('  - send-empty-ctn-to-transport')
console.log('  - send-ctn-arrival-info-to-sa')
console.log('  - send-outbound-ctn-to-ct')
console.log('Waiting for jobs...\n')
