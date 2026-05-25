export declare class RabbitMQConsumer {
    private connection;
    private channel;
    private ready;
    connect(): Promise<void>;
    startConsuming(): Promise<void>;
    private forwardToCamunda;
    private handleFailure;
    close(): Promise<void>;
}
//# sourceMappingURL=consumer.d.ts.map