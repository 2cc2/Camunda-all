package io.camunda.demo.process_order.owner_contract;

import io.camunda.client.CamundaClient;
import io.camunda.client.api.response.ProcessInstanceEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Component
public class OwnerContractDemoRunner implements CommandLineRunner {
    private static final Logger LOG = LoggerFactory.getLogger(OwnerContractDemoRunner.class);

    private final CamundaClient client;

    @Value("${owner.contract.demo.enabled:false}")
    private boolean enabled;

    public OwnerContractDemoRunner(final CamundaClient client) {
        this.client = client;
    }

    @Override
    public void run(final String... args) throws Exception {
        if (!enabled) {
            return;
        }

        final String orderId = "ORDER-" + UUID.randomUUID();
        LOG.info("[DEMO] starting owner contract demo, orderId={}", orderId);

        client
                .newDeployResourceCommand()
                .addResourceFromClasspath("owner-export-contract.bpmn")
                .send()
                .join();

        final Map<String, Object> variables = Map.of(
                "orderId", orderId,
                "timestamp", Instant.now().toString(),
                "senderId", OwnerContractConstants.SENDER_OWNER_ID
        );

        final ProcessInstanceEvent pi = client
                .newCreateInstanceCommand()
                .bpmnProcessId(OwnerContractConstants.PROCESS_ID)
                .latestVersion()
                .variables(variables)
                .send()
                .join();

        LOG.info("[DEMO] process instance started, key={}", pi.getProcessInstanceKey());

        // Mock inbound messages; publish buffers (TTL) even if subscription isn't active yet.
        final Map<String, Object> ctnToOwner = new HashMap<>();
        ctnToOwner.put("orderId", orderId);
        ctnToOwner.put("timestamp", Instant.now().toString());
        ctnToOwner.put("senderId", OwnerContractConstants.DEFAULT_TRANSPORT_ID);
        ctnToOwner.put("ctnNumber", "CTN-10001");

        client
                .newPublishMessageCommand()
                .messageName(OwnerContractConstants.MSG_CTN_TO_OWNER)
                .correlationKey(orderId)
                .timeToLive(Duration.ofMinutes(10))
                .variables(ctnToOwner)
                .send()
                .join();

        final Map<String, Object> expenseNoteToOwner = new HashMap<>();
        expenseNoteToOwner.put("orderId", orderId);
        expenseNoteToOwner.put("timestamp", Instant.now().toString());
        expenseNoteToOwner.put("senderId", OwnerContractConstants.DEFAULT_FFW_ID);
        expenseNoteToOwner.put("expenseNote", Map.of(
                "amount", 123.45,
                "currency", "CNY",
                "noteId", "EN-10001"
        ));

        client
                .newPublishMessageCommand()
                .messageName(OwnerContractConstants.MSG_EXPENSE_NOTE_TO_OWNER)
                .correlationKey(orderId)
                .timeToLive(Duration.ofMinutes(10))
                .variables(expenseNoteToOwner)
                .send()
                .join();

        LOG.info("[DEMO] published inbound messages: {}, {}", OwnerContractConstants.MSG_CTN_TO_OWNER, OwnerContractConstants.MSG_EXPENSE_NOTE_TO_OWNER);
    }
}
