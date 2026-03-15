const { WebSocketServer } = require("ws");

const port = Number.parseInt(process.env.RELAY_PORT || "3001", 10);
const host = process.env.RELAY_HOST || "0.0.0.0";

const wss = new WebSocketServer({ port, host });

wss.on("connection", (socket) => {
  socket.on("message", (raw) => {
    const message = raw.toString();
    if (!message || message.length > 200000) return;

    for (const client of wss.clients) {
      if (client === socket) continue;
      if (client.readyState !== 1) continue;
      client.send(message);
    }
  });
});

wss.on("listening", () => {
  console.log(`[relay] websocket relay listening on ws://${host}:${port}`);
});

wss.on("error", (error) => {
  console.error("[relay] websocket relay error", error);
});
