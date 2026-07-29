'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT ?? 3000;
const ROOT = __dirname;

// ─── Device Code Flow Proxy ─────────────────────────────────────────────────
// The Microsoft identity platform /devicecode and /token endpoints do not send
// CORS headers, so browser fetch calls are blocked. These thin proxy routes
// forward the requests server-side and return the Microsoft response unchanged.

app.use(express.json());

app.post('/DeviceCodeFlow/proxy/devicecode', async (req, res) => {
  const { tenantId, clientId, scope } = req.body ?? {};
  if (!tenantId || !clientId || !scope) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'Missing tenantId, clientId or scope.' });
  }
  try {
    const upstream = await fetch(
      `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/devicecode`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: clientId, scope }),
      }
    );
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ error: 'proxy_error', error_description: err.message });
  }
});

app.post('/DeviceCodeFlow/proxy/token', async (req, res) => {
  const { tenantId, clientId, deviceCode } = req.body ?? {};
  if (!tenantId || !clientId || !deviceCode) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'Missing tenantId, clientId or deviceCode.' });
  }
  try {
    const upstream = await fetch(
      `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id:   clientId,
          grant_type:  'urn:ietf:params:oauth:grant-type:device_code',
          device_code: deviceCode,
        }),
      }
    );
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ error: 'proxy_error', error_description: err.message });
  }
});

// ─── Client Secret Flow Proxy ──────────────────────────────────────────────
// The Microsoft identity platform /token endpoint does not send CORS headers
// for the client_credentials grant, so browser fetch calls are blocked. This
// thin proxy route forwards the request server-side and returns the Microsoft
// response unchanged.

app.post('/ClientSecret/proxy/token', async (req, res) => {
  const { tenantId, clientId, clientSecret, scope } = req.body ?? {};
  if (!tenantId || !clientId || !clientSecret || !scope) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'Missing tenantId, clientId, clientSecret or scope.' });
  }
  try {
    const upstream = await fetch(
      `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type:    'client_credentials',
          client_id:     clientId,
          client_secret: clientSecret,
          scope,
        }),
      }
    );
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ error: 'proxy_error', error_description: err.message });
  }
});

// ─── Static File Server ───────────────────────────────────────────────────────
// Serves each subfolder at its natural path, e.g.:
//   http://localhost:3000/RiskyPermissions/  →  RiskyPermissions/index.html

app.use(express.static(ROOT, { index: 'index.html', dotfiles: 'ignore' }));

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  const apps = getApps();
  const ready = apps.filter(a => a.hasIndex);

  console.log();
  console.log('  Entra ID Demo Server');
  console.log(`  http://localhost:${PORT}`);
  console.log();

  if (ready.length > 0) {
    ready.forEach(a => {
      console.log(`  /${a.name}/  →  http://localhost:${PORT}/${a.name}/`);
    });
    console.log();
  }

  console.log(`  NOTE: Update each demo's authConfig.js redirectUri to http://localhost:${PORT}`);
  console.log(`        and register http://localhost:${PORT} as a SPA redirect URI in your`);
  console.log('        Azure AD app registration.');
  console.log();
  console.log('  Press Ctrl+C to stop.');
  console.log();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns a sorted list of immediate subdirectories and whether each has an index.html.
 */
function getApps() {
  return fs.readdirSync(ROOT, { withFileTypes: true })
    .filter(d =>
      d.isDirectory() &&
      !d.name.startsWith('.') &&
      d.name !== 'node_modules'
    )
    .map(d => ({
      name: d.name,
      hasIndex: fs.existsSync(path.join(ROOT, d.name, 'index.html')),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}


