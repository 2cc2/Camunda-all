import { RabbitMQConsumer } from './consumer'
import { RabbitMQPublisher } from './publisher'

export class CamundaRabbitMQBridge {
  readonly publisher: RabbitMQPublisher
  readonly consumer: RabbitMQConsumer

  constructor() {
    this.publisher = new RabbitMQPublisher()
    this.consumer = new RabbitMQConsumer()
  }

  async connect(): Promise<void> {
    await this.publisher.connect()
    await this.consumer.connect()
  }

  async start(): Promise<void> {
    await this.consumer.startConsuming()
  }

  async close(): Promise<void> {
    await this.consumer.close()
    await this.publisher.close()
  }
}
