const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BPMN_DIR = path.resolve(ROOT, "..", "bpmn");

function getConfig() {
  return {
    camundaRestAddress: process.env.CAMUNDA_REST_ADDRESS || "http://localhost:8080",
    zeebeRestAddress: process.env.ZEEBE_REST_ADDRESS || "http://localhost:8080",
    bpmnFiles: [
      path.join(BPMN_DIR, "shipping-agency-c8.bpmn"),
      path.join(BPMN_DIR, "sbgs-c8.bpmn")
    ]
  };
}

module.exports = {
  getConfig
};
