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
public class PaymentWorker {
    private static final Logger LOG = LoggerFactory.getLogger(PaymentWorker.class);

    @JobWorker(type = OwnerContractConstants.JOB_PAYMENT)
    public Map<String, Object> handle(
            final ActivatedJob job,
            @Variable(name = "orderId") @Nullable final String orderId,
            @Variable(name = "expenseNote") @Nullable final Map<String, Object> expenseNote
    ) {
        final String effectiveOrderId = (orderId == null || orderId.isBlank())
                ? "ORDER-" + job.getProcessInstanceKey()
                : orderId;

        LOG.info("[OWN] payment, orderId={}, jobKey={}", effectiveOrderId, job.getKey());

        final Map<String, Object> payment = new HashMap<>();
        payment.put("orderId", effectiveOrderId);
        payment.put("timestamp", Instant.now().toString());
        payment.put("senderId", OwnerContractConstants.SENDER_OWNER_ID);
        payment.put("status", "paid");
        payment.put("expenseNote", expenseNote);

        return Map.of("payment", payment);
    }
}
