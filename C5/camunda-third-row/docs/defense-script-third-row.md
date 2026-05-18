# 第三行答辩讲稿

下面这份讲稿按 3 到 5 分钟答辩节奏写，可以直接照着讲。

## 1. 开场

我们小组负责的是协作图第三行，也就是 `Shipping Agency` 和 `SBGS` 这两个参与方。

第三行在整个集装箱出口协作流程里的作用，可以理解为“船代负责协调和转发关键业务文件，边防负责船员信息登记”。其中船代是第三行的核心枢纽，边防是它的下游协作方。

## 2. 第三行业务逻辑

我们这部分的业务主线是顺序推进的。

首先，船代收到货代发送的 `S/O` 消息后启动流程。随后船代依次完成两个核心业务任务：一个是 `handle Manifest`，也就是处理舱单；另一个是 `Make Equipment Receipt`，也就是生成设备交接单。

然后船代会执行 `ask Depot for CTN`，向货场请求集装箱。请求发出后，流程会等待外部返回 `CTN arrival info` 消息。收到这个消息以后，船代继续执行 `ship arrive at CT`，向码头发送船到港相关通知。

在这之后，船代还要执行 `make Crew List to SBGS`，向边防发送船员名单。边防收到这个名单后会启动自己的流程，并执行 `Personnel information registration`，也就是人员信息登记。

最后，船代会等待码头发送的 `ship-departure-notification`。收到离港通知后，船代执行 `Issue an expense note to the Owner`，向货主开具费用单，整个第三行流程结束。

## 3. 建模思路

我们在 Camunda 8 中把这部分拆成了两个独立但通过消息协作的可执行流程：

1. `Shipping Agency` 流程
2. `SBGS` 流程

建模时，我们重点处理了三类元素：

1. 消息开始事件
   例如船代通过 `so-received` 启动，边防通过 `crew-list-to-sbgs` 启动。
2. 中间消息捕获事件
   例如船代要等待 `ctn-arrival-info` 和 `ship-departure-notification`。
3. 外部服务任务
   例如 `handle-manifest`、`make-equipment-receipt`、`personnel-information-registration` 等任务，都是交给 Worker 执行。

我们没有在第三行内部强行加入并行网关，因为这部分本身是顺序流。并行汇聚的理论主要体现在其他泳道，比如货代和海关，而不是第三行的本地逻辑。

## 4. Worker 实现

Camunda 8 只负责流程编排，不负责真正的业务处理，所以我们额外实现了一套 Node.js Worker。

这些 Worker 会监听对应的 task type，比如：

- `handle-manifest`
- `make-equipment-receipt`
- `ask-depot-for-ctn`
- `make-crew-list-to-sbgs`
- `personnel-information-registration`

其中有些 Worker 不只是完成任务，还会主动发布消息，驱动跨组织流程继续向前。例如：

- `ask-depot-for-ctn` 会发布 `ctn-arrival-info`
- `make-crew-list-to-sbgs` 会发布 `crew-list-to-sbgs`
- 同一个 Worker 还会发布 `ship-departure-notification`

这样就实现了“任务执行 + 消息协作”的闭环。

## 5. 规范对齐

我们实现时专门对齐了共享消息契约文档的三个要求：

1. 消息名统一使用 `全小写 + 中划线`
2. Worker 的 task type 也统一使用 `全小写 + 中划线`
3. 跨流程关联键统一使用 `orderId`

这样可以保证和其他小组后续联调时接口风格一致。

## 6. 演示结果

在本地 Camunda 8 Run 环境中，我们已经完成了：

1. BPMN 模型部署
2. Worker 启动
3. 通过消息启动船代流程
4. 自动触发边防流程
5. 在 Operate 中观察到两个流程实例均成功完成

所以我们的提交不仅有静态 BPMN 图，也有可以实际运行的流程和 Worker。

## 7. 收尾

总结来说，我们小组完成的是第三行两个参与方从建模、消息设计、Worker 开发到本地联调的完整实现，重点体现了 Camunda 8 在跨组织协作、消息驱动和服务任务编排方面的能力。
