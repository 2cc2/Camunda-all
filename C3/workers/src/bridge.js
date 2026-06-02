const { getConfig } = require("./config");
const { publishMessage } = require("./api");
const { startCamundaMessageBridge } = require("./rabbitmq");

function startBridge() {
  const config = getConfig();

  return startCamundaMessageBridge(config, async (message) => {
    await publishMessage(config.camundaRestAddress, message);
  });
}

module.exports = {
  startBridge
};
