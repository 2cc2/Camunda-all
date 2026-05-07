import { Camunda8 } from '@camunda8/sdk'
import { startTransportWorkers } from './Transport'
import { startFreightForwarderWorkers } from './FreightForwarder'

const client = new Camunda8({
    CAMUNDA_AUTH_STRATEGY: 'NONE',
    ZEEBE_REST_ADDRESS: 'http://localhost:8080',
    ZEEBE_GRPC_ADDRESS: 'localhost:26500'
}).getCamundaRestClient()

/* We inject the client to allow the workers to be tested independently using @camunda8/process-test. */
startTransportWorkers(client)
startFreightForwarderWorkers(client)

console.log('Job workers started. Waiting for jobs...\n')
console.log('  - Transport workers: ctn-to-owner, outbound-ctn-to-depot')
console.log('  - FreightForwarder workers: so-to-sa, order-info-to-cb, equipment-receipt-to-transport\n')
