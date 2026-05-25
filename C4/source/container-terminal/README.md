# 跨组织协作业务流程系统 - 码头 (Container Terminal)

本项目是并发理论课程大作业“跨组织协作业务流程系统”中 **码头（Container Terminal, 简称 CTE）** 参与方的 Node.js 实现。项目基于 Camunda 8 (Zeebe) 引擎，通过 `zeebe-node` SDK 实现了码头在集装箱出口协作流程中的核心业务逻辑、消息交互以及资源调度模拟。

---

## 📖 一、业务与系统概述

在集装箱出口流程中，码头是**信息流与物流的物理汇合点**。码头节点的核心在于控制**“码头汇聚点（Terminal Synchronization Point）”**，即必须同时满足以下三个条件，才能进行后续的装卸作业：
1. **船舶到港** (`vesselArrived`)
2. **出场箱到港** (`outboundCtnReceived`)
3. **舱单收到** (`manifestReceived`)

### 核心功能实现
- **标准化消息流交互**：实现了红框 BPMN 中码头与外部参与方的核心消息交互，包括 `Ship arrival message`、`Outbound CTN received`、`Manifest received`、`Customs Clearance received`。
- **动态资源调度模拟**：在 `load-ctn` (装箱作业) 中，根据集装箱的优先级 (`priority`) 和时间窗 (`deadline`)，模拟了 AGV 和桥吊的动态调度（如出让资源赚取收益，或扣除成本进行加急）。

---

## 📂 二、项目结构

```text
container-terminal/
├── container-terminal.bpmn   # 码头业务流程的 BPMN 2.0 模型文件
├── container-terminal.js                  # 核心 Worker 服务，包含所有的业务处理逻辑和消息发送
├── test-runner.js            # 自动化集成测试脚本，用于模拟外部消息驱动流程流转
├── package.json              # Node.js 项目依赖配置
├── .env                      # 环境变量配置文件（Zeebe 网关地址、终端 ID 等）
└── README.md                 # 本说明文档
```

---

## ⚙️ 三、环境配置与启动

### 1. 环境要求
- Node.js (v16 或更高版本)
- Camunda 8 Run (本地运行，默认暴露 26500 端口)
- Camunda Desktop Modeler (用于部署 BPMN)

### 2. 安装依赖
进入 `container-terminal` 目录，执行以下命令安装依赖：
```bash
npm install
```

### 3. 环境变量配置
项目根目录下的 `.env` 文件配置了 Zeebe 引擎的连接信息。默认配置如下（适用于本地 Camunda 8 Run）：
```env
ZEEBE_ADDRESS=10.176.56.233:26500
ZEEBE_INSECURE_CONNECTION=true
TERMINAL_ID=CONTAINER-TERMINAL-01
CAMUNDA_BASE_URL=http://10.176.56.233
```

### 4. 部署 BPMN 模型
1. 打开 Camunda Desktop Modeler。
2. 加载本项目中的 `container-terminal.bpmn` 文件。
3. 点击底部的 **Deploy** 按钮，将模型部署到本地的 Camunda 8 引擎中。

### 5. 启动 Worker 服务
在终端中运行以下命令启动码头的微服务：
```bash
npm start
```
*启动成功后，控制台会输出 `Container Terminal Worker is starting...` 和 `Workers registered successfully.`*

---

## 🧪 四、运行测试与结果观测

为了验证码头流程在不同场景下的流转情况，我们提供了一个自动化测试脚本 `test.js`。该脚本会**同时创建 3 个处于不同阶段的流程实例**，模拟外部参与方（如船代、车队、海关）的消息驱动。

### 1. 执行测试脚本
在保持 `npm start` (Worker 服务) 运行的前提下，打开一个**新的终端窗口**，运行：
```bash
node test.js
```

脚本将依次输出 3 个实例的创建和消息发送过程：
- **[Instance 1] WAIT-SYNC**：只发送 `ship-arrival-message`，故意不发送出场箱和舱单消息。
- **[Instance 2] WAIT-CUSTOMS**：发送全部三条入站消息，使其通过码头汇聚点并执行到 `Customs Clearance received`，但故意不发送海关放行消息。
- **[Instance 3] COMPLETED**：发送所有前置消息以及 `customs-clearance-received`，流程将完整执行至结束。

### 2. 在 Camunda Operate 中观测结果
测试脚本运行完毕后，请打开浏览器访问 Camunda Operate 控制台（通常为 `http://10.176.56.233:8080/operate` 或 `http://10.176.56.233:8081`）。

1. 在左侧 **Processes** 列表中选择 `Container Terminal Process` (Process ID: `Terminal-Process`)。
2. 在左侧的 **Instances States** 筛选器中，**请务必同时勾选 `Active` 和 `Completed`**。
3. 您将看到刚刚由脚本创建的 3 个流程实例：
   
   * 🔴 **实例 1 (Active)**：点击进入，您会看到流程停留在并行汇聚前，等待 `Outbound CTN received` 和 `Manifest received`。
   * 🟡 **实例 2 (Active)**：点击进入，您会看到流程已经完成 `load CTN` 和 `send arrival message to Customs`，目前停留在 `Customs Clearance received` 消息捕获事件上。
   * 🟢 **实例 3 (Completed)**：点击进入，您会看到一条贯穿始末的绿色完整执行轨迹，证明所有 Worker 和消息交互均已成功跑通。

---

## 🛠 五、已实现的 Worker 与消息契约清单

本项目 `container-terminal.js` 中与当前 BPMN 直接相关的 Worker 如下：

| Task Type (Worker)          | 业务含义 / 动作                          | 触发的对外消息 (Kebab-case)     | 接收方 |
| --------------------------- | ---------------------------------------- | ------------------------------- | ------ |
| `load-ctn`                  | 三条入站消息汇聚后，执行装箱作业与资源调度 | *(内部作业，更新流程变量)*      | -      |
| `send-arrival-to-customs`   | 装箱完成后，向海关发送到港消息           | `arrival-to-customs`            | 海关   |
| `departure`                 | 收到海关放行后，船舶离港                 | `ship-departure-notification`   | 船代/货代 |

*(注：所有对外发送的 JSON 消息载荷均严格遵守了《并发理论大作业命名规则.docx》中的数据契约，统一使用 `orderId` 作为关联键。)*