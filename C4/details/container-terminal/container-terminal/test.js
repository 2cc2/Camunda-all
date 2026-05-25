require('dotenv').config();
const { ZBClient } = require('zeebe-node');

const zbc = new ZBClient();

const PROCESS_ID = 'Terminal-Process';
const MESSAGE_TTL = 60_000;
const TERMINAL_ID = process.env.TERMINAL_ID || 'CONTAINER-TERMINAL-01';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function publishMessage(orderId, name, variables) {
    const message = {
        name,
        correlationKey: orderId,
        variables,
        timeToLive: MESSAGE_TTL
    };

    console.log('[message] 模拟发送消息体:');
    console.log(JSON.stringify(message, null, 2));
    await zbc.publishMessage(message);
}

function registerMockWorkers() {
    zbc.createWorker({
        taskType: 'load-ctn',
        taskHandler: async (job) => {
            const { orderId, vesselArrived, outboundCtnReceived, manifestReceived } = job.variables;
            console.log(`[worker:load-ctn] received job for orderId=${orderId}`);

            if (!vesselArrived || !outboundCtnReceived || !manifestReceived) {
                return job.fail(
                    `Missing prerequisites: vesselArrived=${vesselArrived}, outboundCtnReceived=${outboundCtnReceived}, manifestReceived=${manifestReceived}`,
                    0
                );
            }

            return job.complete({
                loadingCompletedTime: new Date().toISOString(),
                loadingStatus: 'LOADED'
            });
        }
    });

    zbc.createWorker({
        taskType: 'send-arrival-to-customs',
        taskHandler: async (job) => {
            const { orderId, vesselId, containerId, loadingCompletedTime } = job.variables;
            console.log(`[worker:send-arrival-to-customs] received job for orderId=${orderId}`);

            await publishMessage(orderId, 'arrival-to-customs', {
                orderId,
                vesselId,
                containerId,
                loadingCompletedTime,
                senderId: TERMINAL_ID,
                timestamp: new Date().toISOString()
            });

            return job.complete({
                arrivalMessageSent: true,
                arrivalMessageSentAt: new Date().toISOString()
            });
        }
    });

    zbc.createWorker({
        taskType: 'departure',
        taskHandler: async (job) => {
            const { orderId, vesselId } = job.variables;
            console.log(`[worker:departure] received job for orderId=${orderId}`);

            await publishMessage(orderId, 'ship-departure-notification', {
                orderId,
                vesselId,
                senderId: TERMINAL_ID,
                departureTime: new Date().toISOString()
            });

            return job.complete({
                departed: true,
                departureTime: new Date().toISOString()
            });
        }
    });
}

async function runTests() {
    const baseOrderId = `ORDER-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

    console.log('================================================');
    console.log('🚀 开始执行跨组织协作系统 - 码头业务流程阶段测试');
    console.log('================================================\n');

    registerMockWorkers();

    // 给临时 Worker 一点注册时间，避免流程推进到服务任务时还未被拉取。
    await sleep(1000);

    try {
        // ==========================================
        // Instance 1: 仅发送消息1 (船舶到港)
        // ==========================================
        const orderId1 = `${baseOrderId}-STEP1-SHIP`;
        console.log(`>>> [Instance 1] 启动流程，仅发送消息1 (船舶到港) (orderId: ${orderId1})`);
        await zbc.createProcessInstance({
            bpmnProcessId: PROCESS_ID,
            variables: {
                orderId: orderId1,
                vesselId: 'VESSEL-042',
                containerId: 'MSKU1234567',
                priority: 2,
                deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
            }
        });
        await publishMessage(orderId1, 'ship-arrival-message', { vesselArrived: true, shipArrivalTime: new Date().toISOString() });
        console.log(`    ✅ Instance 1 已启动并发送消息1，目前挂起在并行汇聚点等待其他条件\n`);

        // ==========================================
        // Instance 2: 发送消息1-2 (船舶到港 + 出场箱到港)
        // ==========================================
        const orderId2 = `${baseOrderId}-STEP2-SHIP-CTN`;
        console.log(`>>> [Instance 2] 启动流程，发送消息1-2 (船舶到港 + 出场箱到港) (orderId: ${orderId2})`);
        await zbc.createProcessInstance({
            bpmnProcessId: PROCESS_ID,
            variables: {
                orderId: orderId2,
                vesselId: 'VESSEL-042',
                containerId: 'MSKU1234567',
                priority: 2,
                deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
            }
        });
        await publishMessage(orderId2, 'ship-arrival-message', { vesselArrived: true, shipArrivalTime: new Date().toISOString() });
        await publishMessage(orderId2, 'outbound-ctn-received', { outboundCtnReceived: true, outboundCtnReceivedAt: new Date().toISOString() });
        console.log(`    ✅ Instance 2 已启动并发送消息1-2，目前仍挂起在并行汇聚点等待舱单\n`);

        // ==========================================
        // Instance 3: 发送消息1-3 (三要素齐备)，停留在海关放行
        // ==========================================
        const orderId3 = `${baseOrderId}-STEP3-SYNC-DONE`;
        console.log(`>>> [Instance 3] 启动流程，发送消息1-3 (三要素齐备) (orderId: ${orderId3})`);
        await zbc.createProcessInstance({
            bpmnProcessId: PROCESS_ID,
            variables: {
                orderId: orderId3,
                vesselId: 'VESSEL-042',
                containerId: 'MSKU1234567',
                priority: 2,
                deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
            }
        });
        await publishMessage(orderId3, 'ship-arrival-message', { vesselArrived: true, shipArrivalTime: new Date().toISOString() });
        await publishMessage(orderId3, 'outbound-ctn-received', { outboundCtnReceived: true, outboundCtnReceivedAt: new Date().toISOString() });
        await publishMessage(orderId3, 'manifest-received', { manifestReceived: true, manifestReceivedAt: new Date().toISOString() });
        // 等待 load-ctn 和 send-arrival-to-customs 两个服务任务完成
        await sleep(3000);
        console.log(`    ✅ Instance 3 三条入站消息已发送，通过了汇聚点，目前挂起在 Customs Clearance received\n`);

        // ==========================================
        // Instance 4: 完整执行到结束
        // ==========================================
        const orderId4 = `${baseOrderId}-STEP4-COMPLETED`;
        console.log(`>>> [Instance 4] 启动流程，完整执行至结束 (orderId: ${orderId4})`);
        await zbc.createProcessInstance({
            bpmnProcessId: PROCESS_ID,
            variables: {
                orderId: orderId4,
                vesselId: 'VESSEL-042',
                containerId: 'MSKU1234567',
                priority: 2,
                deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
            }
        });
        await publishMessage(orderId4, 'ship-arrival-message', { vesselArrived: true, shipArrivalTime: new Date().toISOString() });
        await publishMessage(orderId4, 'outbound-ctn-received', { outboundCtnReceived: true, outboundCtnReceivedAt: new Date().toISOString() });
        await publishMessage(orderId4, 'manifest-received', { manifestReceived: true, manifestReceivedAt: new Date().toISOString() });
        
        // 等待 load-ctn 和 send-arrival-to-customs 两个服务任务完成
        await sleep(3000);
        
        // 发送海关放行消息
        await publishMessage(orderId4, 'customs-clearance-received', {
            clearanceStatus: 'APPROVED',
            customsClearanceReceived: true,
            customsClearanceReceivedAt: new Date().toISOString()
        });

        // 等待 departure 服务任务完成
        await sleep(3000);
        console.log(`    ✅ Instance 4 海关放行已发送，流程将执行至结束\n`);

    } catch (error) {
        console.error('测试执行过程中发生严重错误:', error);
        process.exitCode = 1;
    } finally {
        console.log('================================================');
        console.log('✅ 所有阶段测试实例已创建并发送对应消息！');
        console.log('👉 请在 Camunda Operate 中查看这 4 个不同状态的流程实例。');
        console.log('================================================');
        setTimeout(() => process.exit(process.exitCode || 0), 1000);
    }
}

runTests();
