import { WebSocketServer } from 'ws';


const wss = new WebSocketServer({ port: 3006 });

console.log('WebSocket server listening on ws://localhost:3006');

const clients = new Map();
const MAX_USERNAME_LENGTH = 20;
const MAX_MESSAGE_LENGTH = 500;
const RATE_LIMIT_WINDOW = 1000;
const RATE_LIMIT_MAX = 5;


const HEARTBEAT_INTERVAL = 30000; 

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

function handleTyping(ws, payload) {
  
  if (!ws.username) {
    ws.send(JSON.stringify({ type: 'error', payload: { message: 'You must join before typing' } }));
    return;
  }

  broadcast({ type: 'typing', payload: { username: ws.username } }, ws);
}



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

  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    ws.send(JSON.stringify({ type: 'error', payload: { message: 'Username is required' } }));
    return;
  }

  if (username.length > MAX_USERNAME_LENGTH) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: `Username must be ${MAX_USERNAME_LENGTH} characters or fewer` }
    }));
    return;
  }

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

  const now = Date.now();
  ws.messageTimestamps = ws.messageTimestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);

  if (ws.messageTimestamps.length >= RATE_LIMIT_MAX) {
    ws.send(JSON.stringify({ type: 'error', payload: { message: 'Sending too fast — slow down' } }));
    return;
  }

  ws.messageTimestamps.push(now);

  if (!payload.text || typeof payload.text !== 'string' || payload.text.trim().length === 0 || !ws.username) {
    return;
  }

  if (payload.text.length > MAX_MESSAGE_LENGTH) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer` }
    }));
    return;
  }

  broadcast({
    type: 'message',
    payload: { username: ws.username, text: payload.text }
  });
}

wss.on('connection', (ws) => {
  console.log('Client connected');
  ws.isAlive = true;
  ws.messageTimestamps = [];

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

  try{

  const { type, payload } = parsed;

  if (type === 'join') {
    handleJoin(ws, payload);
  } else if (type === 'message') {
    handleMessage(ws, payload);
  } else if (type === 'typing') {
  handleTyping(ws, payload);
  }
}catch  (err) {
    console.error('Error handling message:', err);
    ws.send(JSON.stringify({ type: 'error', payload: { message: 'Something went wrong' } }));
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