/**
 * Transport 流程的 Job Workers (Camunda 8) - V2 (对齐详细 JSON 契约)
 * 处理分配集装箱和发送回执的任务
 */
import { CamundaRestClient, Dto } from '@camunda8/sdk'

// 1. 扩充全局变量字典，包含所有规范中定义的新字段
class TransportVariables extends Dto.LosslessDto {
    orderId?: string;
    ctnNumber?: string;
    handoverTime?: string;
    driverName?: string;
    carLicense?: string;
    receiptId?: string;
    depotId?: string;
}

export function startTransportWorkers(client: CamundaRestClient) {
    
    // Worker 1: 分配集装箱给货主 (对应 M1 消息前的动作)
    const provideCtnWorker = client.createJobWorker<TransportVariables, TransportVariables>({
        type: 'ctn-to-owner', 
        timeout: 10000,
        maxJobsToActivate: 5,
        worker: 'ctn-to-owner',
        jobHandler: async (job, log) => {
            const orderId = job.variables.orderId ?? 'UNKNOWN_ORDER';
            log.info(`[派箱任务] 开始为订单 [${orderId}] 分配空集装箱并安排派车...`, job.jobKey)
            
            // 模拟业务逻辑：从自有系统生成集装箱号和派车信息
            const generatedCtnNumber = `CTN-${new Date().getTime().toString().slice(-6)}`
            const nowIsoString = new Date().toISOString()
            
            // 模拟系统处理延迟
            await new Promise((resolve) => setTimeout(resolve, 1500))
            
            log.info(`[派箱任务] 成功分配。车牌: 沪A-12345, 箱号: ${generatedCtnNumber}`)
            
            // 2. 核心更新：把 M1 契约里需要的具体字段一并写回流程上下文中
            return job.complete({ 
                ctnNumber: generatedCtnNumber,
                handoverTime: nowIsoString,
                driverName: '张三',       // 实际业务中从数据库读取
                carLicense: '沪A-12345' // 实际业务中从车队调度系统读取
            })
        }
    })

    // Worker 2: 将出口集装箱和回执发送给堆场 (对应 M2 消息前的动作)
    const sendCtnReceiptWorker = client.createJobWorker<TransportVariables, TransportVariables>({
        type: 'outbound-ctn-to-depot', 
        timeout: 10000,
        maxJobsToActivate: 5,
        worker: 'outbound-ctn-to-depot',
        jobHandler: async (job, log) => {
            const orderId = job.variables.orderId ?? 'UNKNOWN_ORDER';
            const ctnNumber = job.variables.ctnNumber ?? 'UNKNOWN_CTN';
            // 这里的 receiptId 是上游流程(或货代发来的消息)传过来的
            const receiptId = job.variables.receiptId ?? 'MISSING_RECEIPT';
            
            log.info(`[重箱进港] 准备将集装箱 [${ctnNumber}] 送达堆场，关联设备单: [${receiptId}]...`)
            
            // 模拟实际运送和进场操作
            await new Promise((resolve) => setTimeout(resolve, 2000))
            
            const nowIsoString = new Date().toISOString()
            // 模拟打上铅封
            const generatedSeal = `SEAL-${ctnNumber.split('-')[1] || '000000'}`
            
            log.info(`[重箱进港] 任务完成: ${job.jobKey}`)
            
            // 3. 核心更新：把 M2 契约里需要的数据补充完整并写回
            return job.complete({
                receiptStatus: 'DELIVERED_TO_DEPOT',
                depotId: 'DEPOT-YANGSHAN-01',
                deliveryTime: nowIsoString,
            })
        }
    })

    return {
        provideCtnWorker,
        sendCtnReceiptWorker
    }
}