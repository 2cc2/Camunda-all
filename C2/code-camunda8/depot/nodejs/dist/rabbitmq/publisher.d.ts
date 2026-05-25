export interface DepotMessagePublisher {
    publishMessage(name: string, correlationKey: string, variables: Record<string, any>): Promise<void>;
}
export declare class RabbitMQPublisher implements DepotMessagePublisher {
    private connection;
    private channel;
    private ready;
    connect(): Promise<void>;
    publishMessage(camundaMessageName: string, correlationKey: string, variables: Record<string, any>): Promise<void>;
    close(): Promise<void>;
}
//# sourceMappingURL=publisher.d.ts.map