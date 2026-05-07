package io.camunda.demo.process_order.owner_contract;

public final class OwnerContractConstants {
    private OwnerContractConstants() {
    }

    public static final String PROCESS_ID = "owner-export-contract";

    public static final String JOB_FILL_OUT_CERTIFICATE = "fill-out-certificate-of-entrustment";
    public static final String JOB_HANDLE_ORDER = "handle-order";
    public static final String JOB_SEND_ORDER_TO_FFW = "send-order-to-ffw";
    public static final String JOB_SEND_OUTBOUND_CTN_TO_TRANSPORT = "send-outbound-ctn-to-transport";
    public static final String JOB_PAYMENT = "payment";

    public static final String MSG_ORDER_TO_FFW = "order-to-ffw";
    public static final String MSG_OUTBOUND_CTN_TO_TRANSPORT = "outbound-ctn-to-transport";

    public static final String MSG_CTN_TO_OWNER = "ctn-to-owner";
    public static final String MSG_EXPENSE_NOTE_TO_OWNER = "expense-note-to-owner";

    public static final String SENDER_OWNER_ID = "OWNER-01";
    public static final String DEFAULT_FFW_ID = "FF-GLOBAL-LOGISTICS";
    public static final String DEFAULT_TRANSPORT_ID = "TRANSPORT-FLEET-08";
}
