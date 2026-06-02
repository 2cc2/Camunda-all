const { getConfig } = require("./config");
const { deployResources } = require("./api");

async function main() {
  const config = getConfig();
  const result = await deployResources(config.camundaRestAddress, config.bpmnFiles);

  console.log("Deployment succeeded.");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
