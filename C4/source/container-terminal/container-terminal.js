require('dotenv').config();
const { ZBClient } = require('zeebe-node');

const zbc = new ZBClient();
const TERMINAL_ID = process.env.TERMINAL_ID || 'CONTAINER-TERMINAL-01';

console.log('Container Terminal Worker is starting...');

// Worker 1: load-ctn (装箱作业)
zbc.createWorker({
    taskType: 'load-ctn',
    taskHandler: async (job) => {
        try {
            const { 
                orderId, 
                vesselArrived, 
                outboundCtnReceived,
                manifestReceived,
                priority = 1,
                deadline
            } = job.variables;
            
            console.log(`[load-ctn] Handling job for orderId: ${orderId}`);

            // 1. 三要素校验
            if (!vesselArrived || !outboundCtnReceived || !manifestReceived) {
                console.warn(`[load-ctn] Missing prerequisites for orderId: ${orderId}. vesselArrived: ${vesselArrived}, outboundCtnReceived: ${outboundCtnReceived}, manifestReceived: ${manifestReceived}`);
                throw new Error("Terminal synchronization point failed: Missing one or more prerequisites (ship arrival, outbound CTN, manifest).");
            }

            // 2. 动态资源调度模拟
            let resourceProfit = 0;
            let agvAllocated = true;
            let expedited = false;
            
            if (deadline) {
                const timeToDeadline = new Date(deadline).getTime() - Date.now();
                // 如果时间窗宽松（大于24小时）且优先级低，可能出让资源
                if (timeToDeadline > 24 * 60 * 60 * 1000 && priority < 2) {
                    console.log(`[load-ctn] Time window is loose for orderId: ${orderId}. Yielding resources for profit.`);
                    resourceProfit += 500; // 模拟收益
                } else if (timeToDeadline < 12 * 60 * 60 * 1000 || priority >= 3) {
                    console.log(`[load-ctn] Expediting orderId: ${orderId} due to tight deadline or high priority.`);
                    expedited = true;
                    resourceProfit -= 200; // 模拟加急成本
                }
            }

            // 模拟装箱过程
            const loadingCompletedTime = new Date().toISOString();
            console.log(`[load-ctn] Loading completed at ${loadingCompletedTime}. Expedited: ${expedited}, Profit: ${resourceProfit}`);
            
            return job.complete({ 
                loadingCompletedTime,
                resourceProfit,
                agvAllocated,
                expedited
            });
        } catch (error) {
            console.error(`[load-ctn] Error: ${error.message}`);
            return job.fail(error.message, 0);
        }
    }
});

// Worker 2: send-arrival-to-customs (发送 M8 消息)
zbc.createWorker({
    taskType: 'send-arrival-to-customs',
    taskHandler: async (job) => {
        try {
            const { orderId, vesselId, containerId, arrivalTime, loadingCompletedTime } = job.variables;
            console.log(`[send-arrival-to-customs] Handling job for orderId: ${orderId}`);

            if (!orderId || !vesselId || !containerId) {
                throw new Error("Missing required variables: orderId, vesselId, or containerId");
            }

            const timestamp = new Date().toISOString();
            
            const payload = {
                orderId,
                timestamp,
                senderId: TERMINAL_ID,
                vesselId,
                containerId,
                arrivalTime: arrivalTime || timestamp,
                loadingCompletedTime: loadingCompletedTime || timestamp,
                terminalLocation: "Shanghai Yangshan Terminal"
            };

            await zbc.publishMessage({
                name: 'arrival-to-customs',
                correlationKey: orderId,
                variables: payload,
                timeToLive: 60000
            });

            console.log(`[send-arrival-to-customs] Published M8 message for orderId: ${orderId}`);
            return job.complete();
        } catch (error) {
            console.error(`[send-arrival-to-customs] Error: ${error.message}`);
            return job.fail(error.message, 0);
        }
    }
});

// Worker 3: departure (发送 M9 消息及结束)
zbc.createWorker({
    taskType: 'departure',
    taskHandler: async (job) => {
        try {
            const { orderId, vesselId } = job.variables;
            console.log(`[departure] Handling job for orderId: ${orderId}`);

            if (!orderId || !vesselId) {
                throw new Error("Missing required variables: orderId or vesselId");
            }

            const departureTime = new Date().toISOString();
            const timestamp = new Date().toISOString();
            
            const payload = {
                orderId,
                timestamp,
                senderId: TERMINAL_ID,
                vesselId,
                departureTime,
                voyageNumber: `V${new Date().getFullYear()}-${vesselId.replace('VESSEL-', '')}E`, // Mock voyage number
                nextPort: "USLAX"
            };

            await zbc.publishMessage({
                name: 'ship-departure-notification',
                correlationKey: orderId,
                variables: payload,
                timeToLive: 60000
            });

            console.log(`[departure] Published M9 message for orderId: ${orderId}`);
            return job.complete();
        } catch (error) {
            console.error(`[departure] Error: ${error.message}`);
            return job.fail(error.message, 0);
        }
    }
});

console.log('Workers registered successfully.');
