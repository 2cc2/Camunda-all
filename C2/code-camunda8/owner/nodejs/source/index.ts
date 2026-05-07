import { Camunda8 } from '@camunda8/sdk'
import { CAMUNDA_AUTH_STRATEGY, CAMUNDA_REST_ADDRESS } from './config'
import { startOwnerContractWorkers } from './workers'

const client = new Camunda8({
  CAMUNDA_AUTH_STRATEGY,
  ZEEBE_REST_ADDRESS: CAMUNDA_REST_ADDRESS
}).getCamundaRestClient()

startOwnerContractWorkers(client)

console.log('Owner contract workers started.')
console.log(`REST endpoint: ${CAMUNDA_REST_ADDRESS}`)
console.log('Workers registered:')
console.log('  - fill-out-certificate-of-entrustment')
console.log('  - handle-order')
console.log('  - send-order-to-ffw')
console.log('  - send-outbound-ctn-to-transport')
console.log('  - payment')
console.log('Waiting for jobs...\n')
