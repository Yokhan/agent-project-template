/**
 * Claude Agent SDK Bridge — HTTP API for serve.py
 * Persistent sessions per project, streaming responses.
 * Usage: node claude-bridge.mjs [port]
 */
import { query } from '@anthropic-ai/claude-agent-sdk';
import { createServer } from 'http';

const PORT = parseInt(process.argv[2] || '3334');
const sessions = new Map(); // project → session history

const server = createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'POST' && req.url === '/query') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const { project, message, cwd } = JSON.parse(body);

    // SSE streaming response
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });

    const start = Date.now();
    let fullText = '';
    try {
      for await (const msg of query({
        prompt: message,
        cwd: cwd || process.cwd(),
        maxTurns: 5,
        permissionMode: 'bypassPermissions',
      })) {
        if (msg.type === 'assistant' && msg.message?.content) {
          for (const block of msg.message.content) {
            if (block.type === 'text' && block.text) {
              fullText += block.text;
              res.write(`data: ${JSON.stringify({ text: block.text })}\n\n`);
            }
          }
        } else if (msg.type === 'result') {
          const elapsed = ((Date.now() - start) / 1000).toFixed(1);
          res.write(`data: ${JSON.stringify({ done: true, elapsed, result: msg.result || fullText })}\n\n`);
        }
      }
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', sessions: sessions.size }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Claude bridge: http://localhost:${PORT}`);
  console.log('POST /query — {project, message, cwd} → SSE stream');
  console.log('GET /health — status check');
});
