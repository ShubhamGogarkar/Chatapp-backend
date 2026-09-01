import { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';


const wss = new WebSocketServer({ port: 3006 });

console.log('WebSocket server listening on ws://localhost:3006');

const clients = new Set();

wss.on('connection', (ws) => {
  console.log('Client connected');
  ws.id = randomUUID();
  
  clients.add(ws);

  ws.on('message', (data) => {
  if(data.toString().trim() === '')
  {
    return;
  }
  const message = data.toString();
  console.log('Received:', message);

  for (const client of clients) 
  {
    if(client !== ws && client.readyState === client.OPEN) 
    {
    client.send(message);
    }
  }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    const disconnectMessage = `A client has disconnected.${ws.id ? ` (Client ID: ${ws.id})` : ''}`;
     for (const client of clients) 
  {
    if(client !== ws && client.readyState === client.OPEN) 
    {
    client.send(disconnectMessage);
    }
  }
    clients.delete(ws);
  });
});