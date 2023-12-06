const arg = require('arg');
const express = require('express');
const fs = require('fs');
const net = require('net');
const http = require('http');
const https = require('https');
const WebSocket = require('ws');
const log = require('debug')('ws-proxy');

const args = arg({
  '--port': Number,
  '--addr': String,
  '--ipfs-node': String,
  '--ssl-cert': String,
  '--ssl-key': String,
  // When enable, we will serve unsecure connection
  // over HTTP, the port for this one is deducted
  // from --port + 1
  // ensure both successisve ports are available 
  '--serve-unsecure': Boolean,
  '--debug': Boolean,
}, {
  permissive: true
});

if (args['--debug']) {
  process.env.DEBUG = "*";
}

const target_host = args['--addr'] || '0.0.0.0';
const target_port = [args['--port'] || process.env.SERVER_PORT || 3000];
const ipfs_node = args['--ipfs-node'] || 'https://cdn.ela.city';

let sslEnabled = false;
const servers = [];

const app = express();
if (args['--ssl-cert'] && args['--ssl-key']) {
  servers.push(https.createServer({
    key: fs.readFileSync(args['--ssl-key']),
    cert: fs.readFileSync(args['--ssl-cert']),
  }, app));
  sslEnabled = true;
}

if (sslEnabled && args['--serve-unsecure']) {
  target_port.push((parseInt(target_port[0], 10) + 1));
}

if (servers.length === 0 || (sslEnabled && args['--serve-unsecure'])) {
  servers.push(http.createServer(app));
}

const wss = servers.map(
  (srv) => new WebSocket.Server({ server: srv })
);

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
];

const domainsWhitelist = JSON.parse(fs.readFileSync('domains.json', 'utf8'));

app.use(require('morgan')('short'));
app.use('/.well-known', express.static('.well-known'));

app.get('/:path*', async (req, res) => {
  const url = req.originalUrl;

  const targetHost = url.replaceAll(/^\//ig, '').split('/').shift();
  if (!url.startsWith('/ipfs/') && !domainsWhitelist.includes(targetHost)) {
    return res.status(406).send(`unsupported host ${targetHost}`);
  }

  let targetURL = '';
  if (url.startsWith('/ipfs/')) {
    targetURL = `${ipfs_node}${url}`;
  } else {
    targetURL = `https://${url}`;
  }

  try {
    const r = await fetch(targetURL, {
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
wss.forEach((ws, index) => {
  ws.on('connection', function (client, req) {
    client.isAlive = true;
    const clientAddr = client._socket.remoteAddress;

    log(`new connection, version=${client.protocolVersion || 'unknown'}, sub=${client.protocol}, addr=${clientAddr}`);

    const target = net.createConnection(target_port[index], target_host, function () {
      log('connected to target');
    });

    target.on('data', function (data) {
      try {
        log('target received data, sending to client', data);
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
      log('ws client received data, writting to target', msg);
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
  });
});

// Override the server.listen method to start both HTTP and WebSocket server on the same port
servers.forEach((server, index) => {
  server.listen(target_port[index], () => {
    console.log(`listener bound to ${target_host}:${target_port[index]}...`);
  });
})

process.on('exit', (code) => {
  console.log('exiting process, code=', code);
});

module.exports = app;