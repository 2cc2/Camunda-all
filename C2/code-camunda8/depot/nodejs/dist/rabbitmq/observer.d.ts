export type ObservedOutboundMessage = {
    queue: string;
    raw: string;
    payload: Record<string, any>;
};
export declare class RabbitMQOutboundObserver {
    private connection;
    private channel;
    private queueName;
    private readonly observed;
    private started;
    connect(): Promise<void>;
    start(): Promise<void>;
    private consumeQueue;
    private describeRoutingKey;
    waitForMessages(expectedCount: number, timeoutMs?: number): Promise<ObservedOutboundMessage[]>;
    getObservedMessages(): ObservedOutboundMessage[];
    close(): Promise<void>;
}
//# sourceMappingURL=observer.d.ts.map