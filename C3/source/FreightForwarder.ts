/**
 * Freight Forwarder (货代) 流程的 Job Workers (Camunda 8)
 * 负责与船代、报关行、车队等多方系统进行数据交互
 */
import { CamundaRestClient, Dto } from '@camunda8/sdk'

// 定义在流程上下文中流转的全局变量 (与之前的 JSON 数据结构呼应)
class FreightForwarderVariables extends Dto.LosslessDto {
    orderId?: string;
    saId?: string;
    cbId?: string;
    transportId?: string;
    receiptId?: string;
    pol?: string;
    pod?: string;
}

export function startFreightForwarderWorkers(client: CamundaRestClient) {
    
    // Worker 1: 向船代 (SA) 发送订舱单 S/O (对应 Activity_1akkp2w)
    const sendSoToSaWorker = client.createJobWorker<FreightForwarderVariables, FreightForwarderVariables>({
        type: 'send-so-to-sa', 
        timeout: 10000,
        maxJobsToActivate: 5,
        worker: 'ff-send-so-worker',
        jobHandler: async (job, log) => {
            const orderId = job.variables.orderId ?? 'UNKNOWN_ORDER';
            log.info(`[S/O 分支] 开始为订单 [${orderId}] 向船代发送订舱申请...`, job.jobKey)
            
            // 模拟调用船代 (SA) 的 API 接口发送数据
            await new Promise((resolve) => setTimeout(resolve, 1500))
            
            log.info(`[S/O 分支] 订舱单发送完成: ${job.jobKey}`)
            
            // 可以选择将目标船代 ID 写回流程变量
            return job.complete({ saId: 'SA-MAERSK-01' })
        }
    })

    // Worker 2: 向报关行 (CB) 发送订单/报关信息 (对应 Activity_1h58qy9)
    // 注意：在流程图中，这个 Worker 和 Worker 1 是并行执行的 (Parallel Gateway)
    const sendOrderInfoToCbWorker = client.createJobWorker<FreightForwarderVariables, FreightForwarderVariables>({
        type: 'send-order-info-to-cb', 
        timeout: 10000,
        maxJobsToActivate: 5,
        worker: 'ff-send-cb-info-worker',
        jobHandler: async (job, log) => {
            const orderId = job.variables.orderId ?? 'UNKNOWN_ORDER';
            log.info(`[报关分支] 开始为订单 [${orderId}] 向报关行同步订单与箱单发票信息...`, job.jobKey)
            
            // 模拟调用报关行 (CB) 的 API 接口
            await new Promise((resolve) => setTimeout(resolve, 1000))
            
            log.info(`[报关分支] 报关信息同步完成: ${job.jobKey}`)
            
            // 完成任务
            return job.complete({ cbId: 'CB-EXPRESS-02' })
        }
    })

    // Worker 3: 将设备交接单 (Equipment Receipt) 下发给车队 (对应 Activity_015cl78)
    const sendReceiptToTransportWorker = client.createJobWorker<FreightForwarderVariables, FreightForwarderVariables>({
        type: 'send-equipment-receipt-to-transport', 
        timeout: 10000,
        maxJobsToActivate: 5,
        worker: 'ff-send-receipt-worker',
        jobHandler: async (job, log) => {
            const orderId = job.variables.orderId ?? 'UNKNOWN_ORDER';
            // 这里的 receiptId 是在前面的消息捕获节点中，由外部系统传入并保存到流程变量中的
            const receiptId = job.variables.receiptId ?? 'MISSING_RECEIPT';
            
            log.info(`[派车节点] 准备向车队下发提箱指令。订单: [${orderId}], 交接单号: [${receiptId}]`, job.jobKey)
            
            // 模拟调用你们车队 (Transport) 的调度 API
            await new Promise((resolve) => setTimeout(resolve, 2000))
            
            log.info(`[派车节点] 设备交接单已成功下发至车队: ${job.jobKey}`)
            return job.complete({ transportId: 'TRANSPORT-FLEET-08' })
        }
    })

    return {
        sendSoToSaWorker,
        sendOrderInfoToCbWorker,
        sendReceiptToTransportWorker
    }
}