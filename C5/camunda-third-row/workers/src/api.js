const fs = require("fs/promises");
const path = require("path");

function nowIso() {
  return new Date().toISOString();
}

function defaultVariables(orderId) {
  return {
    orderId,
    timestamp: nowIso(),
    senderId: "FREIGHT-FORWARDER-01",
    vesselId: "VESSEL-042",
    voyageNumber: "V2026-042E",
    containerId: "MSKU1234567",
    ownerId: "OWNER-01",
    manifestRequestId: `MANIFEST-REQ-${orderId}`,
    eirRequestId: `EIR-REQ-${orderId}`
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

async function startShippingAgencyDemo(baseUrl, orderId) {
  return publishMessage(baseUrl, {
    name: "so-received",
    correlationKey: orderId,
    timeToLive: 300000,
    variables: defaultVariables(orderId)
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
