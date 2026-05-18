# 截图清单

下面这些截图基本就是你最终提交最稳妥的一套。

## 1. Camunda Modeler 截图

### 图 1：Shipping Agency BPMN 全图

要求：

- 能看到完整泳道
- 能看到开始消息事件 `S/O received`
- 能看到主要任务：
  - `handle Manifest`
  - `Make Equipment Receipt`
  - `ask Depot for CTN`
  - `ship arrive at CT`
  - `make Crew List to SBGS`
  - `Issue an expense note to the Owner`
- 能看到两个消息等待点：
  - `CTN arrival info received`
  - `Ship departure`

建议命名：

- `图1-ShippingAgency流程图.png`

### 图 2：SBGS BPMN 全图

要求：

- 能看到 `Crew List received`
- 能看到 `Personnel information registration`
- 能看到结束事件

建议命名：

- `图2-SBGS流程图.png`

### 图 3：Shipping Agency 任务配置截图

要求：

- 选中一个服务任务
- 右侧属性栏中能看到 `Task Definition`
- 最好能看到类似 `handle-manifest` 这样的 `type`

作用：

- 证明你们不是只画图，而是配置成了 Camunda 8 可执行流程

建议命名：

- `图3-ShippingAgency任务配置.png`

### 图 4：SBGS 任务配置截图

要求：

- 选中 `Personnel information registration`
- 右侧能看到 `task type = personnel-information-registration`

建议命名：

- `图4-SBGS任务配置.png`

## 2. Camunda Operate 截图

### 图 5：流程定义列表截图

要求：

- 能看到 `Shipping Agency` 和 `SBGS` 对应流程已经部署
- 最好能看到版本号

建议命名：

- `图5-Operate流程定义列表.png`

### 图 6：Shipping Agency 实例详情截图

要求：

- 能看到一个已完成实例
- 能看到状态是 `Completed`
- 最好能看到流程轨迹高亮

建议命名：

- `图6-ShippingAgency实例完成.png`

### 图 7：SBGS 实例详情截图

要求：

- 能看到边防实例也被成功触发
- 状态为 `Completed`

建议命名：

- `图7-SBGS实例完成.png`

### 图 8：Job/任务执行明细截图

要求：

- 最好选一个任务，例如 `handle-manifest` 或 `personnel-information-registration`
- 证明 Worker 真正处理过任务

建议命名：

- `图8-Worker任务执行记录.png`

## 3. 终端日志截图

### 图 9：Worker 日志截图

建议截你刚才这段输出，内容很有用：

- `handle-manifest started`
- `Manifest prepared`
- `ctn-arrival-info published`
- `personnel-information-registration started`
- `issue-expense-note-to-owner started`

作用：

- 证明任务被消费
- 证明消息发布成功
- 证明船代和边防都联动起来了

建议命名：

- `图9-Worker运行日志.png`

### 图 10：demo 脚本输出截图

要求：

- 能看到 `Deploying BPMN files`
- 能看到 `Starting shipping-agency-process`
- 能看到 `Shipping Agency instances`
- 能看到 `SBGS instances`

建议命名：

- `图10-demo运行结果.png`

## 4. 最少提交版

如果老师只看关键结果，最少保留这 6 张：

1. `Shipping Agency BPMN 全图`
2. `SBGS BPMN 全图`
3. `Operate 中 Shipping Agency 完成实例`
4. `Operate 中 SBGS 完成实例`
5. `Worker 日志`
6. `demo 运行结果`

## 5. 截图顺序建议

建议你最后在文档里按下面顺序排：

1. 流程建模图
2. 配置截图
3. 部署结果
4. 实例运行结果
5. Worker 日志

这样老师读起来最顺。
