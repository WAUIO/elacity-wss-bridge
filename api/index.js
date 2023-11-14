const arg = require('arg');
const express = require('express');
const net = require('net');
const http = require('http');
const WebSocket = require('ws');
const log = require('debug')('ws-proxy');

const args = arg({
  '--port': Number,
  '--addr': String,
  '--debug': Boolean,
}, {
  permissive: true
});

if (args['--debug']) {
  process.env.DEBUG = "*";
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const target_host = args['--addr'] || '0.0.0.0';
const target_port = args['--port'] || 8080;

const passThroughHeaders = [
  'content-type',
  'content-length',
  'vary',
  'etag',
  'set-cookie',
  'accept',
  'accept-ranges',
  'access-control-allow-origin',
  'access-control-allow-headers',
  'access-control-allow-methods',
  'access-control-expose-headers',
]

app.get('/:path*', async (req, res) => {
  const url = req.originalUrl;

  try {
    const r = await fetch(`https://${url}`, {
      responseType: 'arraybuffer',
    });

    r.headers?.forEach((value, name) => {
      if (passThroughHeaders.includes(name)) {
        res.setHeader(name, value);
      }
    })

    const body = await r.arrayBuffer();

    res.send(Buffer.from(body));
  } catch (err) {
    res.status(400).send(`Bad request: ${err.message}`);
  }
});

// Handle new WebSocket client
const handleConnection = function (client, req) {
  const clientAddr = client._socket.remoteAddress;

  log(`WebSocket connection, version=${client.protocolVersion || 'unknown'}, sub=${client.protocol}, addr=${clientAddr}`);

  const target = net.createConnection(target_port, target_host, function () {
    log('connected to target');
  });

  target.on('data', function (data) {
    try {
      client.send(data);
    } catch (e) {
      log("Client closed, cleaning up target");
      target.end();
    }
  });
  target.on('end', function () {
    log('target disconnected');
    client.close();
  });
  target.on('error', function () {
    log('target connection error');
    target.end();
    client.close();
  });

  client.on('message', function (msg) {
    target.write(msg);
  });
  client.on('close', function (code, reason) {
    log('WebSocket client disconnected: ' + code + ' [' + reason + ']');
    target.end();
  });
  client.on('error', function (a) {
    log('WebSocket client error: ' + a);
    target.end();
  });
};

wss.on('connection', handleConnection);

// Override the server.listen method to start both HTTP and WebSocket server on the same port
server.listen(target_port, () => {
  console.log(`serving at ${target_host}:${target_port}...`);
});

module.exports = app;