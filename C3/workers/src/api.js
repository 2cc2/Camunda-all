const fs = require("fs/promises");
const path = require("path");
const { getConfig } = require("./config");
const { publishBusinessMessage } = require("./rabbitmq");

function nowIso() {
  return new Date().toISOString();
}

function defaultVariables(orderId) {
  return {
    orderId,
    timestamp: nowIso(),
    senderId: "FFW",
    vesselId: "VESSEL-042",
    voyageNo: "VOY-2026-118",
    voyageNumber: "VOY-2026-118",
    containerId: "MSKU1234567",
    ownerId: "OWN-001",
    manifestNo: "MAN-20260416-001",
    soNo: "SO-20260416-001",
    loadingPortCode: "CNSHA",
    dischargePortCode: "JPTYO",
    eta: "2026-04-18T08:00:00Z",
    containerCount: 2,
    depotId: "DPT-SHA-01",
    requestedContainerType: "40HQ",
    requestedContainerCount: 2,
    terminalId: "CTE-TYO-01",
    manifestRequestId: `MANIFEST-REQ-${orderId}`,
    eirRequestId: `ER-${orderId}`
  };
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return { raw: text };
  }
}

async function ensureOk(response, label) {
  if (response.ok) {
    return parseResponse(response);
  }

  const payload = await parseResponse(response);
  throw new Error(`${label} failed (${response.status}): ${JSON.stringify(payload)}`);
}

async function deployResources(baseUrl, filePaths) {
  const form = new FormData();

  for (const filePath of filePaths) {
    const bytes = await fs.readFile(filePath);
    form.append(
      "resources",
      new Blob([bytes], { type: "application/xml" }),
      path.basename(filePath)
    );
  }

  const response = await fetch(`${baseUrl}/v2/deployments`, {
    method: "POST",
    body: form
  });

  return ensureOk(response, "deployment");
}

async function publishMessage(baseUrl, message) {
  const response = await fetch(`${baseUrl}/v2/messages/publication`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(message)
  });

  return ensureOk(response, `publishMessage(${message.name})`);
}

async function searchProcessInstances(baseUrl, processDefinitionId, orderId) {
  const response = await fetch(`${baseUrl}/v2/process-instances/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      filter: {
        processDefinitionId
      },
      page: {
        from: 0,
        limit: 20
      }
    })
  });

  const payload = await ensureOk(response, "searchProcessInstances");
  const items = payload.items || [];

  const processMatches = items.filter(
    (item) => item.processDefinitionId === processDefinitionId
  );

  if (!orderId) {
    return processMatches;
  }

  // The v2 search payload may omit variables depending on the server config.
  // Fall back to process-level filtering so the demo remains useful locally.
  return processMatches.filter((item) => {
    const vars = item.variables || [];
    if (!Array.isArray(vars) || vars.length === 0) {
      return true;
    }

    return vars.some(
      (variable) => variable.name === "orderId" && variable.value === orderId
    );
  });
}

async function startShippingAgencyDemo(orderId) {
  const config = getConfig();

  return publishBusinessMessage(config, "so-received", {
    ...defaultVariables(orderId),
    timeToLive: 300000
  });
}

module.exports = {
  defaultVariables,
  deployResources,
  nowIso,
  publishMessage,
  searchProcessInstances,
  startShippingAgencyDemo
};
