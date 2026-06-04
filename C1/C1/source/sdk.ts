import { Camunda8 } from '@camunda8/sdk'
import {
    BASE_URL,
    CAMUNDA_AUTH_STRATEGY,
    CAMUNDA_BASIC_AUTH_PASSWORD,
    CAMUNDA_BASIC_AUTH_USERNAME,
    ZEEBE_GRPC_ADDRESS,
} from './config'

function buildCamundaConfig() {
    const config: Record<string, string> = {
        CAMUNDA_AUTH_STRATEGY,
        ZEEBE_REST_ADDRESS: BASE_URL,
        ZEEBE_GRPC_ADDRESS,
    }

    if (CAMUNDA_AUTH_STRATEGY === 'BASIC') {
        if (CAMUNDA_BASIC_AUTH_USERNAME) {
            config.CAMUNDA_BASIC_AUTH_USERNAME = CAMUNDA_BASIC_AUTH_USERNAME
        }
        if (CAMUNDA_BASIC_AUTH_PASSWORD) {
            config.CAMUNDA_BASIC_AUTH_PASSWORD = CAMUNDA_BASIC_AUTH_PASSWORD
        }
    }

    return config
}

export function createCamunda8() {
    return new Camunda8(buildCamundaConfig())
}

export function createCamundaRestClient() {
    return createCamunda8().getCamundaRestClient()
}

export function createZeebeGrpcClient() {
    return createCamunda8().getZeebeGrpcApiClient()
}
