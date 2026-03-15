type RelayPayload = Record<string, unknown>;

type RelayListener = (payload: RelayPayload) => void;

const listeners = new Set<RelayListener>();
const queuedMessages: string[] = [];

let socket: WebSocket | null = null;
let reconnectTimer: number | null = null;

const MAX_QUEUE_SIZE = 100;
const RECONNECT_DELAY_MS = 1500;

const getRelayUrl = () => {
  if (typeof window === "undefined") return "";
  const fromEnv = (process.env.NEXT_PUBLIC_RELAY_WS_URL || "").trim();
  if (fromEnv) return fromEnv;
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.hostname}:3001`;
};

const scheduleReconnect = () => {
  if (typeof window === "undefined") return;
  if (reconnectTimer !== null) return;
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    ensureSocket();
  }, RECONNECT_DELAY_MS);
};

const flushQueue = () => {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  while (queuedMessages.length > 0) {
    const next = queuedMessages.shift();
    if (!next) continue;
    socket.send(next);
  }
};

const ensureSocket = () => {
  if (typeof window === "undefined") return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const url = getRelayUrl();
  if (!url) return;

  try {
    socket = new WebSocket(url);
  } catch {
    scheduleReconnect();
    return;
  }

  socket.onopen = () => {
    flushQueue();
  };

  socket.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data as string);
      if (!parsed || typeof parsed !== "object") return;
      listeners.forEach((listener) => listener(parsed as RelayPayload));
    } catch {
      // Ignore malformed websocket messages.
    }
  };

  socket.onclose = () => {
    socket = null;
    scheduleReconnect();
  };

  socket.onerror = () => {
    if (socket && socket.readyState === WebSocket.OPEN) return;
    scheduleReconnect();
  };
};

export const relayPublish = (payload: RelayPayload) => {
  if (typeof window === "undefined") return;
  const encoded = JSON.stringify(payload);
  ensureSocket();

  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(encoded);
    return;
  }

  queuedMessages.push(encoded);
  if (queuedMessages.length > MAX_QUEUE_SIZE) {
    queuedMessages.splice(0, queuedMessages.length - MAX_QUEUE_SIZE);
  }
};

export const relaySubscribe = (listener: RelayListener) => {
  listeners.add(listener);
  ensureSocket();
  return () => {
    listeners.delete(listener);
  };
};
