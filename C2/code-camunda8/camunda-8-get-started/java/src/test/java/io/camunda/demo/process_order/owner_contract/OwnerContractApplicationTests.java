package io.camunda.demo.process_order.owner_contract;

import io.camunda.client.CamundaClient;
import io.camunda.client.api.response.ProcessInstanceEvent;
import io.camunda.process.test.api.CamundaAssert;
import io.camunda.process.test.api.CamundaProcessTestContext;
import io.camunda.process.test.api.CamundaSpringProcessTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;

@SpringBootTest
@CamundaSpringProcessTest
public class OwnerContractApplicationTests {

    @Autowired
    private CamundaClient client;

    @Autowired
    private CamundaProcessTestContext processTestContext;

    @Test
    void shouldCompleteOwnerContractProcessInstance() {
        client
                .newDeployResourceCommand()
                .addResourceFromClasspath("owner-export-contract.bpmn")
                .send()
                .join();

        final String orderId = "ORDER-TEST-1";

        final ProcessInstanceEvent processInstance = client
                .newCreateInstanceCommand()
                .bpmnProcessId(OwnerContractConstants.PROCESS_ID)
                .latestVersion()
                .variables(Map.of(
                        "orderId", orderId,
                        "timestamp", Instant.now().toString(),
                        "senderId", OwnerContractConstants.SENDER_OWNER_ID
                ))
                .send()
                .join();

        client
                .newPublishMessageCommand()
                .messageName(OwnerContractConstants.MSG_CTN_TO_OWNER)
                .correlationKey(orderId)
                .timeToLive(Duration.ofMinutes(10))
                .variables(Map.of(
                        "orderId", orderId,
                        "timestamp", Instant.now().toString(),
                        "senderId", OwnerContractConstants.DEFAULT_TRANSPORT_ID,
                        "ctnNumber", "CTN-TEST-100"
                ))
                .send()
                .join();

        client
                .newPublishMessageCommand()
                .messageName(OwnerContractConstants.MSG_EXPENSE_NOTE_TO_OWNER)
                .correlationKey(orderId)
                .timeToLive(Duration.ofMinutes(10))
                .variables(Map.of(
                        "orderId", orderId,
                        "timestamp", Instant.now().toString(),
                        "senderId", OwnerContractConstants.DEFAULT_FFW_ID,
                        "expenseNote", Map.of(
                                "amount", 88.8,
                                "currency", "CNY",
                                "noteId", "EN-TEST-1"
                        )
                ))
                .send()
                .join();

        processTestContext.mockJobWorker(OwnerContractConstants.JOB_FILL_OUT_CERTIFICATE).thenComplete();
        processTestContext.mockJobWorker(OwnerContractConstants.JOB_HANDLE_ORDER).thenComplete();
        processTestContext.mockJobWorker(OwnerContractConstants.JOB_SEND_ORDER_TO_FFW).thenComplete();
        processTestContext.mockJobWorker(OwnerContractConstants.JOB_SEND_OUTBOUND_CTN_TO_TRANSPORT).thenComplete();
        processTestContext.mockJobWorker(OwnerContractConstants.JOB_PAYMENT).thenComplete();

        CamundaAssert.assertThat(processInstance).isCompleted();
    }
}
