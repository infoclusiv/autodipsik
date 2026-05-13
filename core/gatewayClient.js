(function initGatewayClient(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const Telemetry = NewSiteCore.Telemetry;
  const Errors = NewSiteCore.Errors;
  const STORAGE_KEYS = NewSiteCore.STORAGE_KEYS;
  const Storage = NewSiteCore.Storage;
  const TELEMETRY_EVENTS = NewSiteCore.TELEMETRY_EVENTS;
  const gatewayConfig = NewSiteCore.GATEWAY_CONFIG;
  const protocol = NewSiteCore.GatewayProtocol;

  let socket = null;
  let pendingRequests = new Map();
  let reconnectTimer = null;
  let pingTimer = null;
  let reconnectAttempts = 0;
  let shouldReconnect = true;
  let currentStatus = {
    connected: false,
    state: "disconnected",
    lastError: null,
    selectedFile: null,
    serverCapabilities: [],
    updatedAt: new Date().toISOString()
  };

  function cloneStatus() {
    return JSON.parse(JSON.stringify(currentStatus));
  }

  async function persistStatus(extra) {
    currentStatus = Object.assign({}, currentStatus, extra || {}, {
      updatedAt: new Date().toISOString()
    });
    await Storage.setValue(STORAGE_KEYS.GATEWAY_STATUS, cloneStatus());
    if (Object.prototype.hasOwnProperty.call(currentStatus, "selectedFile")) {
      await Storage.setValue(STORAGE_KEYS.GATEWAY_SELECTED_FILE, currentStatus.selectedFile || null);
    }
    return cloneStatus();
  }

  async function emitGatewayEvent(eventName, message, data, level) {
    await Telemetry.emit({
      eventName: eventName,
      traceId: protocol.createRequestId("gwt"),
      siteId: "deepseek",
      component: "gateway",
      level: level || "info",
      message: message,
      data: data || {}
    });
  }

  function rejectAllPending(error) {
    pendingRequests.forEach(function rejectEntry(entry) {
      clearTimeout(entry.timeoutId);
      entry.reject(error);
    });
    pendingRequests = new Map();
  }

  function clearReconnectTimer() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function clearPingTimer() {
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
  }

  function scheduleReconnect() {
    clearReconnectTimer();
    if (!shouldReconnect) {
      return;
    }
    reconnectAttempts += 1;
    const delay = Math.min(
      gatewayConfig.reconnectBaseDelayMs * Math.max(1, reconnectAttempts),
      gatewayConfig.reconnectMaxDelayMs
    );
    persistStatus({ connected: false, state: "reconnecting" }).catch(function noop() {});
    emitGatewayEvent(TELEMETRY_EVENTS.GATEWAY_RECONNECTING, "Gateway reconnect scheduled", { delayMs: delay }).catch(function noop() {});
    reconnectTimer = setTimeout(function reconnectLater() {
      connect().catch(function noop() {});
    }, delay);
  }

  function startHeartbeat() {
    clearPingTimer();
    pingTimer = setInterval(function onPingInterval() {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return;
      }
      sendEnvelope(protocol.createEnvelope(protocol.GATEWAY_MESSAGE_TYPES.PING, {
        sentAt: new Date().toISOString()
      })).catch(function noop() {});
    }, gatewayConfig.pingIntervalMs);
  }

  async function sendEnvelope(envelope) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw Errors.createError("PYTHON_GATEWAY_NOT_RUNNING", "Python gateway is not connected.", {
        expected: "A WebSocket connection to the local gateway should be open.",
        actual: "No active WebSocket connection is available.",
        suggestedFix: "Start the Python gateway and reconnect from the side panel."
      });
    }
    socket.send(JSON.stringify(envelope));
    await emitGatewayEvent(TELEMETRY_EVENTS.GATEWAY_MESSAGE_SENT, "Gateway message sent", { type: envelope.type, id: envelope.id });
  }

  function parseIncomingMessage(raw) {
    try {
      return JSON.parse(raw);
    } catch (error) {
      return protocol.createEnvelope(protocol.GATEWAY_MESSAGE_TYPES.ERROR, {
        code: "INVALID_JSON",
        message: "Could not parse gateway message.",
        actual: error.message
      });
    }
  }

  async function handleIncomingMessage(raw) {
    const envelope = parseIncomingMessage(raw);
    await emitGatewayEvent(TELEMETRY_EVENTS.GATEWAY_MESSAGE_RECEIVED, "Gateway message received", {
      type: envelope.type,
      id: envelope.id,
      correlationId: envelope.correlationId
    });

    if (envelope.type === protocol.GATEWAY_MESSAGE_TYPES.HELLO_ACK) {
      await persistStatus({
        connected: true,
        state: "connected",
        lastError: null,
        serverCapabilities: envelope.payload && envelope.payload.capabilities ? envelope.payload.capabilities : []
      });
      return;
    }

    if (envelope.type === protocol.GATEWAY_MESSAGE_TYPES.FILE_SELECTED) {
      await persistStatus({ selectedFile: envelope.payload || null });
      await emitGatewayEvent(TELEMETRY_EVENTS.GATEWAY_FILE_SELECTED, "Gateway file selected", envelope.payload || {});
    }

    if (envelope.type === protocol.GATEWAY_MESSAGE_TYPES.ERROR && envelope.correlationId && pendingRequests.has(envelope.correlationId)) {
      const pending = pendingRequests.get(envelope.correlationId);
      pendingRequests.delete(envelope.correlationId);
      clearTimeout(pending.timeoutId);
      pending.reject(Errors.createError(envelope.payload.code || "UNKNOWN_ERROR", envelope.payload.message || "Gateway error", envelope.payload));
      return;
    }

    pendingRequests.forEach(function resolveMatching(entry, requestId) {
      if (protocol.isResponseFor({ id: requestId }, envelope)) {
        pendingRequests.delete(requestId);
        clearTimeout(entry.timeoutId);
        entry.resolve(envelope);
      }
    });
  }

  async function connect() {
    clearReconnectTimer();
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      return cloneStatus();
    }

    shouldReconnect = true;
    await persistStatus({ state: "connecting", lastError: null });
    await emitGatewayEvent(TELEMETRY_EVENTS.GATEWAY_CONNECTING, "Connecting to Python gateway", { url: gatewayConfig.url });

    await new Promise(function openPromise(resolve, reject) {
      try {
        socket = new WebSocket(gatewayConfig.url);
      } catch (error) {
        reject(error);
        return;
      }

      socket.onopen = async function onOpen() {
        reconnectAttempts = 0;
        startHeartbeat();
        await persistStatus({ connected: true, state: "connected", lastError: null });
        await emitGatewayEvent(TELEMETRY_EVENTS.GATEWAY_CONNECTED, "Connected to Python gateway", { url: gatewayConfig.url });
        await sendEnvelope(protocol.createEnvelope(protocol.GATEWAY_MESSAGE_TYPES.HELLO, {
          client: "autodipsik-extension",
          extensionVersion: chrome.runtime.getManifest().version,
          protocolVersion: gatewayConfig.protocolVersion
        }));
        resolve();
      };

      socket.onmessage = function onMessage(event) {
        handleIncomingMessage(event.data).catch(function noop() {});
      };

      socket.onerror = function onError() {
        reject(Errors.createError("WEBSOCKET_CONNECTION_FAILED", "Could not connect to Python gateway.", {
          expected: "The local WebSocket gateway should accept connections on ws://127.0.0.1:8765.",
          actual: "The browser could not establish the WebSocket connection.",
          suggestedFix: "Start the Python gateway and ensure the port is not blocked."
        }));
      };

      socket.onclose = async function onClose(event) {
        clearPingTimer();
        const closeError = event && event.code !== 1000 ? Errors.createError("WEBSOCKET_CONNECTION_FAILED", "Python gateway connection closed.", {
          actual: "Close code " + event.code + (event.reason ? ": " + event.reason : ""),
          suggestedFix: "Reconnect from the side panel after checking the gateway process."
        }) : null;
        await persistStatus({ connected: false, state: shouldReconnect ? "disconnected" : "closed", lastError: closeError });
        await emitGatewayEvent(TELEMETRY_EVENTS.GATEWAY_DISCONNECTED, "Gateway connection closed", {
          code: event.code,
          reason: event.reason || ""
        }, closeError ? "warn" : "info");
        rejectAllPending(closeError || Errors.createError("WEBSOCKET_CONNECTION_FAILED", "Gateway connection closed.", {}));
        socket = null;
        if (shouldReconnect) {
          scheduleReconnect();
        }
      };
    }).catch(async function onConnectError(error) {
      const structured = Errors.toStructuredError(error);
      await persistStatus({ connected: false, state: "error", lastError: structured });
      throw structured;
    });

    return cloneStatus();
  }

  async function disconnect() {
    shouldReconnect = false;
    clearReconnectTimer();
    clearPingTimer();
    if (socket) {
      socket.close(1000, "Disconnected by extension");
      socket = null;
    }
    await persistStatus({ connected: false, state: "disconnected" });
    return cloneStatus();
  }

  async function request(type, payload) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      await connect();
    }
    const envelope = protocol.createEnvelope(type, payload || {});
    return new Promise(function requestPromise(resolve, reject) {
      const timeoutId = setTimeout(function onTimeout() {
        pendingRequests.delete(envelope.id);
        reject(Errors.createError("WEBSOCKET_REQUEST_TIMEOUT", "Gateway request timed out.", {
          expected: "A response from the Python gateway within the configured timeout.",
          actual: "No response was received within " + gatewayConfig.requestTimeoutMs + "ms.",
          suggestedFix: "Retry the action or inspect the gateway logs."
        }));
      }, gatewayConfig.requestTimeoutMs);

      pendingRequests.set(envelope.id, {
        resolve: resolve,
        reject: reject,
        timeoutId: timeoutId
      });

      sendEnvelope(envelope).catch(function onSendError(error) {
        pendingRequests.delete(envelope.id);
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  async function getStatus() {
    const stored = await Storage.getValue(STORAGE_KEYS.GATEWAY_STATUS, null);
    if (stored) {
      currentStatus = Object.assign({}, currentStatus, stored);
    }
    return cloneStatus();
  }

  NewSiteCore.GatewayClient = {
    connect: connect,
    disconnect: disconnect,
    request: request,
    getStatus: getStatus,
    persistStatus: persistStatus
  };
})(globalThis);
