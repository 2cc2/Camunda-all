const { startBridge } = require("./bridge");
const { startWorkers } = require("./workers");

async function main() {
  await startBridge();
  startWorkers();
  console.log("Camunda 8 third-row workers and RabbitMQ bridge started. Waiting for jobs...");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
