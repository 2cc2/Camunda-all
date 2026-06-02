const { getConfig } = require("./config");
const {
  deployResources,
  searchProcessInstances,
  startShippingAgencyDemo
} = require("./api");
const { closeRabbitMQ } = require("./rabbitmq");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const config = getConfig();
  const orderId = process.argv[2] || "ORDER-20260421-001";

  try {
    console.log(`Deploying BPMN files to ${config.camundaRestAddress} ...`);
    await deployResources(config.camundaRestAddress, config.bpmnFiles);

    console.log(`Publishing 'so-received' to RabbitMQ with orderId=${orderId} ...`);
    await startShippingAgencyDemo(orderId);

    console.log("Waiting for workers and message correlations...");
    await sleep(5000);

    const shippingAgencyInstances = await searchProcessInstances(
      config.camundaRestAddress,
      "Process_ShippingAgency",
      orderId
    );
    const sbgsInstances = await searchProcessInstances(
      config.camundaRestAddress,
      "Process_SBGS",
      orderId
    );

    console.log("Shipping Agency instances:");
    console.log(JSON.stringify(shippingAgencyInstances, null, 2));
    console.log("SBGS instances:");
    console.log(JSON.stringify(sbgsInstances, null, 2));
  } finally {
    await closeRabbitMQ();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
