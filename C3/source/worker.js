const { Client, logger, Variables } = require("camunda-external-task-client-js");
const fetch = require("node-fetch");


const CONFIG = {

  camundaUrl: "http://localhost:8080/engine-rest",

  pollingInterval: 5000,

  maxTasks: 10,

  lockDuration: 30000,
};

const client = new Client({
  baseUrl: CONFIG.camundaUrl,
  use: logger,                      
  asyncResponseTimeout: CONFIG.pollingInterval,
  maxTasks: CONFIG.maxTasks,
});

console.log("========================================");
console.log("Freight Forwarder Worker 已启动");
console.log(`连接到 Camunda: ${CONFIG.camundaUrl}`);
console.log("========================================\n");


/**
 * @param {string} messageName   
 * @param {string} businessKey   
 * @param {object} variables     
 */
async function sendMessage(messageName, businessKey, variables = {}) {
  const url = `${CONFIG.camundaUrl}/message`;

  const processVariables = {};
  for (const [key, value] of Object.entries(variables)) {
    processVariables[key] = {
      value: value,
      type: typeof value === "number" ? "Long" : "String",
    };
  }

  const requestBody = {
    messageName: messageName,
    businessKey: businessKey,
    processVariables: processVariables,
  };

  if (businessKey) {
    requestBody.correlationKeys = {
      businessKey: { value: businessKey, type: "String" },
    };
  }

  console.log(`  → 发送消息: ${messageName}`);
  console.log(`    业务键: ${businessKey || "(无)"}`);
  console.log(`    变量: ${JSON.stringify(variables)}`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (response.status === 204) {

      console.log(`  ✓ 消息 ${messageName} 发送成功\n`);
    } else {
      const errorText = await response.text();
      console.error(`  ✗ 消息发送失败 (HTTP ${response.status}): ${errorText}\n`);
      throw new Error(`消息发送失败: ${response.status} - ${errorText}`);
    }
  } catch (error) {
    console.error(`  ✗ 消息发送出错: ${error.message}\n`);
    throw error;
  }
}



client.subscribe("sendOrderToCB", { lockDuration: CONFIG.lockDuration }, async function ({ task, taskService }) {
  console.log("──────────────────────────────────────");
  console.log("[sendOrderToCB] 收到任务");
  console.log(`  任务ID: ${task.id}`);
  console.log(`  流程实例ID: ${task.processInstanceId}`);

  try {

    const businessKey = task.businessKey;
    const orderId = task.variables.get("orderId") || "DEFAULT_ORDER";
    const orderDetails = task.variables.get("orderDetails") || "出口货物订单";

    console.log(`  订单ID: ${orderId}`);
    console.log(`  业务键: ${businessKey}`);

    await sendMessage("Message_CB_order_received", businessKey, {
      orderId: orderId,
      orderDetails: orderDetails,
      senderProcess: "FreightForwarder",
    });

    await taskService.complete(task);
    console.log("[sendOrderToCB] ✓ 任务完成\n");

  } catch (error) {

    console.error(`[sendOrderToCB] ✗ 任务失败: ${error.message}`);
    await taskService.handleFailure(task, {
      errorMessage: error.message,
      errorDetails: error.stack,
      retries: (task.retries || 3) - 1,    
      retryTimeout: 5000,                 
    });
  }
});

client.subscribe("sendSOtoSA", { lockDuration: CONFIG.lockDuration }, async function ({ task, taskService }) {
  console.log("──────────────────────────────────────");
  console.log("[sendSOtoSA] 收到任务");
  console.log(`  任务ID: ${task.id}`);
  console.log(`  流程实例ID: ${task.processInstanceId}`);

  try {

    const businessKey = task.businessKey;
    const orderId = task.variables.get("orderId") || "DEFAULT_ORDER";
    const shippingDetails = task.variables.get("shippingDetails") || "标准海运出口";

    console.log(`  订单ID: ${orderId}`);
    console.log(`  业务键: ${businessKey}`);

    await sendMessage("Message_SO_received", businessKey, {
      orderId: orderId,
      shippingDetails: shippingDetails,
      senderProcess: "FreightForwarder",
    });

    await taskService.complete(task);
    console.log("[sendSOtoSA] ✓ 任务完成\n");

  } catch (error) {
    console.error(`[sendSOtoSA] ✗ 任务失败: ${error.message}`);
    await taskService.handleFailure(task, {
      errorMessage: error.message,
      errorDetails: error.stack,
      retries: (task.retries || 3) - 1,
      retryTimeout: 5000,
    });
  }
});


client.subscribe("sendEquipmentReceiptToTransport", { lockDuration: CONFIG.lockDuration }, async function ({ task, taskService }) {
  console.log("──────────────────────────────────────");
  console.log("[sendEquipmentReceiptToTransport] 收到任务");
  console.log(`  任务ID: ${task.id}`);
  console.log(`  流程实例ID: ${task.processInstanceId}`);

  try {

    const businessKey = task.businessKey;
    const orderId = task.variables.get("orderId") || "DEFAULT_ORDER";
    const equipmentReceiptId = task.variables.get("equipmentReceiptId") || "ER-DEFAULT";
    const manifestId = task.variables.get("manifestId") || "MF-DEFAULT";

    console.log(`  订单ID: ${orderId}`);
    console.log(`  设备收据ID: ${equipmentReceiptId}`);
    console.log(`  舱单ID: ${manifestId}`);
    console.log(`  业务键: ${businessKey}`);

    await sendMessage("Message_FF_Equipment_Receipt_received", businessKey, {
      orderId: orderId,
      equipmentReceiptId: equipmentReceiptId,
      manifestId: manifestId,
      senderProcess: "FreightForwarder",
    });

    await taskService.complete(task);
    console.log("[sendEquipmentReceiptToTransport] ✓ 任务完成（FF 流程结束）\n");

  } catch (error) {
    console.error(`[sendEquipmentReceiptToTransport] ✗ 任务失败: ${error.message}`);
    await taskService.handleFailure(task, {
      errorMessage: error.message,
      errorDetails: error.stack,
      retries: (task.retries || 3) - 1,
      retryTimeout: 5000,
    });
  }
});

client.on("error", (error) => {
  console.error("Worker 客户端出错:", error.message);
  console.error("请检查 Camunda 引擎是否正在运行");
});

process.on("SIGINT", () => {
  console.log("\n正在关闭 Worker...");
  client.stop();
  process.exit(0);
});
