import { Camunda8 } from '@camunda8/sdk'
import { startCustomsWorkers } from './Customs'
import { BASE_URL, ZEEBE_GRPC_ADDRESS } from './config'

const client = new Camunda8({
    CAMUNDA_AUTH_STRATEGY: 'NONE',
    ZEEBE_REST_ADDRESS: BASE_URL,
    ZEEBE_GRPC_ADDRESS,
}).getCamundaRestClient()

startCustomsWorkers(client)

console.log('Customs job workers started. Waiting for jobs...\n')
console.log('  - declareSuccess')
console.log('  - CIQ')
console.log('  - inspection')
console.log('  - CustomsCearance\n')
