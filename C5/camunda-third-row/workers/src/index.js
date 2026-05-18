const { startWorkers } = require("./workers");

startWorkers();
console.log("Camunda 8 third-row workers started. Waiting for jobs...");
