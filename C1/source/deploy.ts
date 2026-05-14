import path from 'node:path'
import { Camunda8 } from '@camunda8/sdk'
import { BASE_URL, CUSTOMS_PROCESS_ID, ZEEBE_GRPC_ADDRESS } from './config'

async function main() {
    const camunda = new Camunda8({
        CAMUNDA_AUTH_STRATEGY: 'NONE',
        ZEEBE_REST_ADDRESS: BASE_URL,
        ZEEBE_GRPC_ADDRESS,
    }).getCamundaRestClient()

    const bpmnPath = path.resolve(__dirname, '..', 'bpmn', 'Customs_camunda8.bpmn')

    console.log(`开始部署 BPMN: ${bpmnPath}`)

    const result = await camunda.deployResourcesFromFiles([bpmnPath])

    console.log('部署成功。')
    console.log(`目标流程 ID: ${CUSTOMS_PROCESS_ID}`)

    const processes = (result as unknown as { processes?: Array<Record<string, unknown>> }).processes
    if (Array.isArray(processes)) {
        for (const process of processes) {
            const processId = String(process.bpmnProcessId ?? process.processDefinitionId ?? 'UNKNOWN_PROCESS')
            const version = String(process.version ?? 'UNKNOWN_VERSION')
            console.log(`- 已部署流程: ${processId} (version=${version})`)
        }
    }
}

main().catch((error) => {
    console.error('部署失败:', error)
    process.exit(1)
})
