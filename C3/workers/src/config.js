const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BPMN_DIR = path.resolve(ROOT, "..", "bpmn");

function getConfig() {
  return {
    camundaRestAddress: process.env.CAMUNDA_REST_ADDRESS || "http://localhost:8080",
    zeebeRestAddress: process.env.ZEEBE_REST_ADDRESS || "http://localhost:8080",
    rabbitmqUrl: process.env.RABBITMQ_URL || "amqp://localhost:5672",
    rabbitmqExchange: process.env.RABBITMQ_EXCHANGE || "logistics.events",
    rabbitmqCamundaQueue:
      process.env.RABBITMQ_CAMUNDA_QUEUE || "camunda.message.bridge",
    rabbitmqBusinessQueues: {
      "freight-forwarder.inbox": [
        "ff-manifest-received",
        "make-equipment-receipt"
      ],
      "container-terminal.inbox": [
        "ct-manifest-received",
        "ship-arrive-at-ct"
      ],
      "customs-broker.inbox": [
        "cb-manifest-received"
      ],
      "depot.inbox": [
        "ask-for-ctn"
      ],
      "owner.inbox": [
        "expense-note-received"
      ],
      "sbgs.inbox": [
        "crewlist-received"
      ]
    },
    camundaMessageNames: [
      "so-received",
      "ctn-arrival-info",
      "ship-departure-notification",
      "crewlist-received"
    ],
    bpmnFiles: [
      path.join(BPMN_DIR, "shipping-agency-c8.bpmn"),
      path.join(BPMN_DIR, "sbgs-c8.bpmn")
    ]
  };
}

module.exports = {
  getConfig
};
