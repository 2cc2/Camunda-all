package io.camunda.demo.process_order.owner_contract;

import io.camunda.client.CamundaClient;
import io.camunda.client.annotation.JobWorker;
import io.camunda.client.annotation.Variable;
import io.camunda.client.api.response.ActivatedJob;
import jakarta.annotation.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@Component
public class SendOrderToFfwWorker {
    private static final Logger LOG = LoggerFactory.getLogger(SendOrderToFfwWorker.class);

    private final CamundaClient client;

    public SendOrderToFfwWorker(final CamundaClient client) {
        this.client = client;
    }

    @JobWorker(type = OwnerContractConstants.JOB_SEND_ORDER_TO_FFW)
    public Map<String, Object> handle(
            final ActivatedJob job,
            @Variable(name = "orderId") @Nullable final String orderId,
            @Variable(name = "order") @Nullable final Map<String, Object> order
    ) {
        final String effectiveOrderId = (orderId == null || orderId.isBlank())
                ? "ORDER-" + job.getProcessInstanceKey()
                : orderId;

        final Map<String, Object> payload = new HashMap<>();
        payload.put("orderId", effectiveOrderId);
        payload.put("timestamp", Instant.now().toString());
        payload.put("senderId", OwnerContractConstants.SENDER_OWNER_ID);
        payload.put("ffwId", OwnerContractConstants.DEFAULT_FFW_ID);
        payload.put("order", order == null ? Map.of("orderId", effectiveOrderId) : order);

        LOG.info("[OWN] publish message '{}' for orderId={}, jobKey={}", OwnerContractConstants.MSG_ORDER_TO_FFW, effectiveOrderId, job.getKey());

        client
                .newPublishMessageCommand()
                .messageName(OwnerContractConstants.MSG_ORDER_TO_FFW)
                .correlationKey(effectiveOrderId)
                .timeToLive(Duration.ofMinutes(10))
                .variables(payload)
                .send()
                .join();

        return Map.of("orderSentToFfw", true);
    }
}
