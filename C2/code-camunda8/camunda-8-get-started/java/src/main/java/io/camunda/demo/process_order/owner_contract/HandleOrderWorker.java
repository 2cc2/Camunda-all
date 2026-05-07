package io.camunda.demo.process_order.owner_contract;

import io.camunda.client.annotation.JobWorker;
import io.camunda.client.annotation.Variable;
import io.camunda.client.api.response.ActivatedJob;
import jakarta.annotation.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@Component
public class HandleOrderWorker {
    private static final Logger LOG = LoggerFactory.getLogger(HandleOrderWorker.class);

    @JobWorker(type = OwnerContractConstants.JOB_HANDLE_ORDER)
    public Map<String, Object> handle(
            final ActivatedJob job,
            @Variable(name = "orderId") @Nullable final String orderId
    ) {
        final String effectiveOrderId = (orderId == null || orderId.isBlank())
                ? "ORDER-" + job.getProcessInstanceKey()
                : orderId;

        LOG.info("[OWN] handle order, orderId={}, jobKey={}", effectiveOrderId, job.getKey());

        final Map<String, Object> order = new HashMap<>();
        order.put("orderId", effectiveOrderId);
        order.put("timestamp", Instant.now().toString());
        order.put("senderId", OwnerContractConstants.SENDER_OWNER_ID);
        order.put("ffwId", OwnerContractConstants.DEFAULT_FFW_ID);
        order.put("transportId", OwnerContractConstants.DEFAULT_TRANSPORT_ID);
        order.put("goodsName", "demo-goods");

        final Map<String, Object> variables = new HashMap<>();
        variables.put("orderId", effectiveOrderId);
        variables.put("order", order);
        return variables;
    }
}
