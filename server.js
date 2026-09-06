import { WebSocketServer } from 'ws';


const wss = new WebSocketServer({ port: 3006 });

console.log('WebSocket server listening on ws://localhost:3006');

const clients = new Map();


const HEARTBEAT_INTERVAL = 30000; 



function getOnlineUsers() {
  return Array.from(clients.keys());
}

function broadcast(messageObj, exclude = null) {
  const data = JSON.stringify(messageObj);
  for (const [username, client] of clients) {
    if (client !== exclude && client.readyState === client.OPEN) {
      client.send(data);
    }
  }
}

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

  broadcast({ type: 'system', payload: { text: `${username} joined the chat` } });
  broadcast({ type: 'users', payload: { users: getOnlineUsers() } });
}

function handleMessage(ws, payload) {
  broadcast({
    type: 'message',
    payload: { username: ws.username, text: payload.text }
  }, ws);
}

wss.on('connection', (ws) => {
  console.log('Client connected');
  setInterval(() => {
  for (const [username, client] of clients) {
    if (client.isAlive === false) {
      console.log(`${username} failed to respond to ping — terminating`);
      client.terminate();
      continue;
    }

    client.isAlive = false;
    client.ping();
  }
}, HEARTBEAT_INTERVAL);

  ws.isAlive = true;

ws.on('pong', () => {
  ws.isAlive = true;
});

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
  if (ws.username) {
    console.log(`${ws.username} disconnected`);
    clients.delete(ws.username);

    broadcast({ type: 'system', payload: { text: `${ws.username} left the chat` } });
    broadcast({ type: 'users', payload: { users: getOnlineUsers() } });
  }
});
});