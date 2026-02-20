import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let seq = 0;

function pad(n) {
  return String(n).padStart(2, "0");
}

function nowTimestamp() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function makeRow(from, to, amount) {
  seq += 1;
  const txId = `TX_${Date.now()}_${seq}`;
  const amt = Number(amount).toFixed(2);
  const ts = nowTimestamp();
  const row = `${txId},${from},${to},${amt},${ts}`;
  return { row, txId, ts, amt };
}

wss.on("connection", (ws) => {
  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
      return;
    }

    if (msg?.type !== "tx") {
      ws.send(JSON.stringify({ type: "error", message: "Unknown message type" }));
      return;
    }

    const from = msg.from;
    const to = msg.to;
    const amount = msg.amount ?? 0;

    if (!from || !to || from === to) {
      ws.send(JSON.stringify({ type: "error", message: "Invalid from/to" }));
      return;
    }

    const { row } = makeRow(from, to, amount);
    const payload = JSON.stringify({ type: "csv", row });

    // Broadcast to all clients
    wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) client.send(payload);
    });
  });
});

app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
const WSS_HOST = process.env.WSS_HOST || "localhost";
const WSS_PORT = process.env.WSS_PORT || PORT;

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`WebSocket URL: ws://${WSS_HOST}:${WSS_PORT}`);
});
