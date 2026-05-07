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
public class FillOutCertificateOfEntrustmentWorker {
    private static final Logger LOG = LoggerFactory.getLogger(FillOutCertificateOfEntrustmentWorker.class);

    @JobWorker(type = OwnerContractConstants.JOB_FILL_OUT_CERTIFICATE)
    public Map<String, Object> handle(
            final ActivatedJob job,
            @Variable(name = "orderId") @Nullable final String orderId
    ) {
        final String effectiveOrderId = (orderId == null || orderId.isBlank())
                ? "ORDER-" + job.getProcessInstanceKey()
                : orderId;

        LOG.info("[OWN] fill out certificate of entrustment, orderId={}, jobKey={}", effectiveOrderId, job.getKey());

        final Map<String, Object> certificateOfEntrustment = new HashMap<>();
        certificateOfEntrustment.put("orderId", effectiveOrderId);
        certificateOfEntrustment.put("timestamp", Instant.now().toString());
        certificateOfEntrustment.put("senderId", OwnerContractConstants.SENDER_OWNER_ID);
        certificateOfEntrustment.put("exporterId", "EXP-01");
        certificateOfEntrustment.put("consigneeId", "CNE-01");

        final Map<String, Object> variables = new HashMap<>();
        variables.put("orderId", effectiveOrderId);
        variables.put("certificateOfEntrustment", certificateOfEntrustment);
        return variables;
    }
}
