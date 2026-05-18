/**
 * Standalone mock inbound message publisher for Depot.
 *
 * Usage (while workers are running in another terminal):
 *   CAMUNDA_REST_ADDRESS=http://localhost:8080 npx ts-node source/mock-inbound.ts --orderId=ORDER-20260507-001
 */
export declare function nowIso(): string;
export declare function buildAskForCtnMockVariables(orderId: string): {
    orderId: string;
    timestamp: string;
    senderId: "SHIPPING-AGENCY-01";
    containerId: string;
    vesselId: string;
};
export declare function buildOutboundCtnToDepotMockVariables(orderId: string): {
    orderId: string;
    timestamp: string;
    senderId: "TRANSPORT-FLEET-08";
    ctnNumber: string;
    vesselId: string;
    handOverTime: string;
    receiptId: string;
    driverName: string;
    carLicense: string;
};
export declare function parseArgs(argv?: string[]): {
    orderId: string;
};
type PublishMessageClient = {
    publishMessage: (payload: any) => Promise<unknown>;
};
export declare function publishStartMessage(client: PublishMessageClient, orderId: string): Promise<void>;
export declare function publishFollowupInboundMessages(client: PublishMessageClient, orderId: string, sleep?: (ms: number) => Promise<unknown>): Promise<void>;
export declare function publishMockInboundMessages(client: PublishMessageClient, orderId: string, sleep?: (ms: number) => Promise<unknown>): Promise<void>;
export declare function main(): Promise<void>;
export {};
//# sourceMappingURL=mock-inbound.d.ts.map