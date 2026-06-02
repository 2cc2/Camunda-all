const amqp = require("amqplib");

let connection;
let channel;
let bridgeConnection;
let bridgeChannel;
let businessTopologyReady = false;

async function assertExchange(activeChannel, config) {
  await activeChannel.assertExchange(config.rabbitmqExchange, "topic", {
    durable: true
  });
}

async function assertBusinessQueues(activeChannel, config) {
  if (businessTopologyReady) {
    return;
  }

  const bindings = config.rabbitmqBusinessQueues || {};

  for (const [queueName, routingKeys] of Object.entries(bindings)) {
    await activeChannel.assertQueue(queueName, {
      durable: true
    });

    for (const routingKey of routingKeys) {
      await activeChannel.bindQueue(queueName, config.rabbitmqExchange, routingKey);
    }
  }

  businessTopologyReady = true;
}

async function getChannel(config) {
  if (channel) {
    return channel;
  }

  connection = await amqp.connect(config.rabbitmqUrl);
  channel = await connection.createChannel();
  await assertExchange(channel, config);
  await assertBusinessQueues(channel, config);

  return channel;
}

async function publishBusinessMessage(config, name, payload) {
  const activeChannel = await getChannel(config);
  const body = Buffer.from(JSON.stringify(payload));

  const accepted = activeChannel.publish(
    config.rabbitmqExchange,
    name,
    body,
    {
      contentType: "application/json",
      deliveryMode: 2,
      headers: {
        messageName: name,
        orderId: payload.orderId,
        senderId: payload.senderId
      },
      messageId: `${name}:${payload.orderId}:${Date.now()}`,
      timestamp: Math.floor(Date.now() / 1000),
      type: name
    }
  );

  if (!accepted) {
    await new Promise((resolve) => activeChannel.once("drain", resolve));
  }
}

function toCamundaMessage(config, name, payload) {
  return {
    name,
    correlationKey: payload.orderId,
    timeToLive: payload.timeToLive || 300000,
    variables: payload
  };
}

async function startCamundaMessageBridge(config, publishToCamunda) {
  if (bridgeChannel) {
    return bridgeChannel;
  }

  bridgeConnection = await amqp.connect(config.rabbitmqUrl);
  bridgeChannel = await bridgeConnection.createChannel();
  await assertExchange(bridgeChannel, config);
  await bridgeChannel.assertQueue(config.rabbitmqCamundaQueue, {
    durable: true
  });
  await assertBusinessQueues(bridgeChannel, config);

  for (const messageName of config.camundaMessageNames) {
    await bridgeChannel.bindQueue(
      config.rabbitmqCamundaQueue,
      config.rabbitmqExchange,
      messageName
    );
  }

  await bridgeChannel.consume(config.rabbitmqCamundaQueue, async (msg) => {
    if (!msg) {
      return;
    }

    try {
      const name = msg.properties.type || msg.fields.routingKey;
      const payload = JSON.parse(msg.content.toString("utf8"));
      const camundaMessage = toCamundaMessage(config, name, payload);

      await publishToCamunda(camundaMessage);
      bridgeChannel.ack(msg);
      console.log(
        `RabbitMQ bridge forwarded '${name}' for orderId=${payload.orderId} to Camunda`
      );
    } catch (error) {
      console.error(`RabbitMQ bridge failed: ${error.message}`);
      bridgeChannel.nack(msg, false, true);
    }
  });

  return bridgeChannel;
}

async function closeRabbitMQ() {
  if (channel) {
    await channel.close();
    channel = undefined;
  }

  if (connection) {
    await connection.close();
    connection = undefined;
  }
  businessTopologyReady = false;

  if (bridgeChannel) {
    await bridgeChannel.close();
    bridgeChannel = undefined;
  }

  if (bridgeConnection) {
    await bridgeConnection.close();
    bridgeConnection = undefined;
  }
}

module.exports = {
  closeRabbitMQ,
  publishBusinessMessage,
  startCamundaMessageBridge
};
