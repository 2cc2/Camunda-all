import path from 'node:path'
import { Camunda8 } from '@camunda8/sdk'
import { BASE_URL, CUSTOMS_PROCESS_ID, CB_PROCESS_ID, CT_PROCESS_ID, SA_PROCESS_ID, ZEEBE_GRPC_ADDRESS } from './config'

async function main() {
    const camunda = new Camunda8({
        CAMUNDA_AUTH_STRATEGY: 'NONE',
        ZEEBE_REST_ADDRESS: BASE_URL,
        ZEEBE_GRPC_ADDRESS,
    }).getCamundaRestClient()

    const bpmnDir = path.resolve(__dirname, '..', 'bpmn')
    const bpmnFiles = [
        path.join(bpmnDir, 'Customs_camunda8.bpmn'),
        path.join(bpmnDir, 'CustomsBroker.bpmn'),
        path.join(bpmnDir, 'ContainerTerminal.bpmn'),
        path.join(bpmnDir, 'ShippingAgency.bpmn'),
    ]

    console.log(`开始部署 ${bpmnFiles.length} 个 BPMN 文件...`)
    for (const f of bpmnFiles) {
        console.log(`  - ${path.basename(f)}`)
    }

    const result = await camunda.deployResourcesFromFiles(bpmnFiles)

    console.log('\n部署成功。')
    console.log(`目标流程 ID:`)
    console.log(`  - ${CUSTOMS_PROCESS_ID} (Customs)`)
    console.log(`  - ${CB_PROCESS_ID} (Customs Broker)`)
    console.log(`  - ${CT_PROCESS_ID} (Container Terminal)`)
    console.log(`  - ${SA_PROCESS_ID} (Shipping Agency)`)

    const processes = (result as unknown as { processes?: Array<Record<string, unknown>> }).processes
    if (Array.isArray(processes)) {
        for (const process of processes) {
            const processId = String(process.bpmnProcessId ?? process.processDefinitionId ?? 'UNKNOWN_PROCESS')
            const version = String(process.version ?? 'UNKNOWN_VERSION')
            console.log(`  - 已部署流程: ${processId} (version=${version})`)
        }
    }
}

main().catch((error) => {
    console.error('部署失败:', error)
    process.exit(1)
})
