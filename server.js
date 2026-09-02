import { WebSocketServer } from 'ws';


const wss = new WebSocketServer({ port: 3006 });

console.log('WebSocket server listening on ws://localhost:3006');

const clients = new Map();

function handleJoin(ws, payload) {
  const { username } = payload;

  if (clients.has(username)) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: `Username "${username}" is already taken` }
    }));
    return;
  }

  ws.username = username;
  clients.set(username, ws);

  console.log(`${username} joined`);
}

function handleMessage(ws, payload) {
  const outgoing = JSON.stringify({
    type: 'message',
    payload: { username: ws.username, text: payload.text }
  });

  for (const [username, client] of clients) {
    if (client !== ws && client.readyState === client.OPEN) {
      client.send(outgoing);
    }
  }
}

wss.on('connection', (ws) => {
  console.log('Client connected');

 ws.on('message', (data) => {
  let parsed;
  try {
    parsed = JSON.parse(data.toString());
  } catch (err) {
    ws.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid JSON' } }));
    return;
  }

  const { type, payload } = parsed;

  if (type === 'join') {
    handleJoin(ws, payload);
  } else if (type === 'message') {
    handleMessage(ws, payload);
  }
});

 ws.on('close', () => {
  console.log(`${ws.username || 'A client'} disconnected`);
  if (ws.username) {
    clients.delete(ws.username);
  }
});
});