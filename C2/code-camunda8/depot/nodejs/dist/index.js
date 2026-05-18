"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_1 = require("@camunda8/sdk");
const config_1 = require("./config");
const workers_1 = require("./workers");
const client = new sdk_1.Camunda8({
    CAMUNDA_AUTH_STRATEGY: config_1.CAMUNDA_AUTH_STRATEGY,
    ZEEBE_REST_ADDRESS: config_1.CAMUNDA_REST_ADDRESS
}).getCamundaRestClient();
(0, workers_1.startDepotContractWorkers)(client);
console.log('Depot contract workers started.');
console.log(`REST endpoint: ${config_1.CAMUNDA_REST_ADDRESS}`);
console.log('Workers registered:');
console.log('  - send-empty-ctn-to-transport');
console.log('  - send-ctn-arrival-info-to-sa');
console.log('  - send-outbound-ctn-to-ct');
console.log('Waiting for jobs and upstream messages ask-for-ctn / outbound-ctn-to-depot...\n');
//# sourceMappingURL=index.js.map