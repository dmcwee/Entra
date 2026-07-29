'use strict';

// ─── App State ───────────────────────────────────────────────────────────────────

const state = {
  accessToken: null,
  nextLink:    null,
};

// ─── Initialization ───────────────────────────────────────────────────────────────

(function init() {
  const unconfigured =
    authConfig.clientId     === 'YOUR_CLIENT_ID_HERE'     ||
    authConfig.tenantId     === 'YOUR_TENANT_ID_HERE'     ||
    authConfig.clientSecret === 'YOUR_CLIENT_SECRET_HERE';

  if (unconfigured) {
    hideSpinner();
    showStatus('loading-status', 'error',
      'App is not configured. Return to the home page and set the <b>Client ID</b> and <b>Client Secret</b>.');
    return;
  }

  document.getElementById('btn-load-more').addEventListener('click',
    () => loadUsers(state.nextLink));

  acquireToken()
    .then(() => loadUsers())
    .catch(err => {
      hideSpinner();
      showStatus('loading-status', 'error', `Authentication failed: ${err.message}`);
    });
})();

// ─── View Routing ─────────────────────────────────────────────────────────────────

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  const target = document.getElementById(`view-${name}`);
  if (target) target.classList.remove('hidden');

  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const navLink = document.getElementById(`nav-${name}`);
  if (navLink) navLink.classList.add('active');
}

// ─── Status Messages ──────────────────────────────────────────────────────────────

function showStatus(id, type, message) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `status-message status-${type}`;
  el.textContent = message;
  el.classList.remove('hidden');
}

function hideStatus(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

function hideSpinner() {
  const el = document.getElementById('loading-spinner');
  if (el) el.classList.add('hidden');
}

// ─── Authentication ───────────────────────────────────────────────────────────────

async function acquireToken() {
  // Token acquisition is proxied through the local server because the
  // Microsoft identity platform /token endpoint does not send CORS headers
  // for the client_credentials grant, blocking direct browser fetch calls.
  var uri = "https://davidmcweeproxy.azurewebsites.net/api/entra/token"
  var uri2 = '/ClientSecret/proxy/token'
  const res = await fetch(uri, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      TenantId:     authConfig.tenantId,
      ClientId:     authConfig.clientId,
      ClientSecret: authConfig.clientSecret,
      Scope:        authConfig.scope,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.error || `HTTP ${res.status}`);
  }
  state.accessToken = data.access_token;
}

// ─── Graph API — Users ────────────────────────────────────────────────────────────

async function loadUsers(nextLink = null) {
  const loadMoreBtn = document.getElementById('btn-load-more');
  loadMoreBtn.disabled = true;

  // Validate nextLink to prevent open-redirect — must be a Graph URL
  let url;
  if (nextLink) {
    try {
      const parsed = new URL(nextLink);
      if (parsed.hostname !== 'graph.microsoft.com') throw new Error('Invalid nextLink host');
      url = nextLink;
    } catch {
      showStatus('users-status', 'error', 'Invalid pagination link.');
      loadMoreBtn.disabled = false;
      return;
    }
  } else {
    url =
      'https://graph.microsoft.com/v1.0/users' +
      '?$select=displayName,userPrincipalName,mail,jobTitle,department,accountEnabled' +
      '&$top=100';
  }

  try {
    const res  = await fetch(url, {
      headers: { Authorization: `Bearer ${state.accessToken}` },
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error?.message || `HTTP ${res.status}`);
    }

    state.nextLink = data['@odata.nextLink'] || null;

    if (!nextLink) {
      renderUsersTable(data.value);
      hideSpinner();
      showView('users');
    } else {
      appendUserRows(data.value);
    }

    updateRowCount();
    hideStatus('users-status');

  } catch (err) {
    if (!nextLink) {
      hideSpinner();
      showStatus('loading-status', 'error', `Failed to load users: ${err.message}`);
    } else {
      showStatus('users-status', 'error', `Failed to load users: ${err.message}`);
    }
  } finally {
    if (state.nextLink) {
      loadMoreBtn.disabled = false;
      loadMoreBtn.classList.remove('hidden');
    } else {
      loadMoreBtn.classList.add('hidden');
    }
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = '';
  appendUserRows(users);
}

function appendUserRows(users) {
  const tbody = document.getElementById('users-tbody');
  for (const user of users) {
    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td>${escapeHtml(user.displayName || '—')}</td>` +
      `<td class="cell-mono">${escapeHtml(user.userPrincipalName || '—')}</td>` +
      `<td class="cell-mono">${escapeHtml(user.mail || '—')}</td>` +
      `<td>${escapeHtml(user.jobTitle || '—')}</td>` +
      `<td>${escapeHtml(user.department || '—')}</td>` +
      `<td><span class="badge ${user.accountEnabled ? 'badge-success' : 'badge-muted'}">${user.accountEnabled ? 'Enabled' : 'Disabled'}</span></td>`;
    tbody.appendChild(tr);
  }
}

function updateRowCount() {
  const count = document.getElementById('users-tbody').querySelectorAll('tr').length;
  document.getElementById('user-count').textContent = `${count} user${count !== 1 ? 's' : ''}`;
}

// ─── Utilities ────────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
