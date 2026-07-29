'use strict';

// ─── App State ───────────────────────────────────────────────────────────────────

const state = {
  deviceCode:    null,
  accessToken:   null,
  pollInterval:  5,
  pollTimer:     null,
  countdownTimer: null,
  expiresAt:     null,
  nextLink:      null,
};

// ─── Initialization ───────────────────────────────────────────────────────────────

(function init() {
  const unconfigured =
    authConfig.clientId  === 'YOUR_CLIENT_ID_HERE' ||
    authConfig.tenantId  === 'YOUR_TENANT_ID_HERE';

  if (unconfigured) {
    document.getElementById('btn-signin-main').disabled = true;
    document.getElementById('btn-signin').disabled = true;
    showStatus('signin-status', 'error',
      'App is not configured. Return to the home page and set the <b>Tenant ID</b> and <b>Client ID</b>.');
  }

  showView('signin');

  document.getElementById('btn-signin-main').addEventListener('click', handleStart);
  document.getElementById('btn-signin').addEventListener('click', handleStart);
  document.getElementById('btn-cancel').addEventListener('click', handleCancel);
  document.getElementById('btn-signout').addEventListener('click', handleSignOut);
  document.getElementById('btn-load-more').addEventListener('click', () => loadUsers(state.nextLink));
  document.getElementById('nav-users').addEventListener('click', (e) => {
    e.preventDefault();
    if (state.accessToken) showView('users');
  });
  // document.getElementById('nav-about').addEventListener('click', (e) => {
  //   e.preventDefault();
  //   showView('about');
  // });
})();

// ─── View Routing ─────────────────────────────────────────────────────────────────

function showView(name) {
  document.querySelectorAll('.view').forEach(
    v => { if (!v.classList.contains('view-about')) v.classList.add('hidden'); });
  const target = document.getElementById(`view-${name}`);
  if (target) target.classList.remove('hidden');

  document.querySelectorAll('.nav-link').forEach(
    l => { if(!l.classList.contains('nav-about') && !l.classList.contains('nav-user')) l.classList.remove('active') });
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

// ─── Authentication ───────────────────────────────────────────────────────────────

async function handleStart() {
  document.getElementById('btn-signin-main').disabled = true;
  document.getElementById('btn-signin').disabled = true;
  hideStatus('signin-status');

  try {
    var uri = "https://davidmcweeproxy.azurewebsites.net/api/entra/devicecode";
    var uri2 = "/DeviceCodeFlow/proxy/devicecode";

    const res = await fetch(uri, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        tenantId:  authConfig.tenantId,
        clientId:  authConfig.clientId,
        scope:     authConfig.scopes.join(' '),
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error_description || data.error || `HTTP ${res.status}`);
    }

    state.deviceCode   = data.device_code;
    state.pollInterval = data.interval || 5;
    state.expiresAt    = Date.now() + (data.expires_in * 1000);

    document.getElementById('user-code-display').textContent     = data.user_code;
    document.getElementById('verification-uri-link').href        = data.verification_uri;
    document.getElementById('verification-uri-text').textContent = data.verification_uri;
    document.getElementById('spinner-container').classList.remove('hidden');
    document.getElementById('btn-cancel').textContent = 'Cancel';
    hideStatus('device-code-status');

    showView('device-code');
    startCountdown();
    startPolling();

  } catch (err) {
    document.getElementById('btn-signin-main').disabled = false;
    document.getElementById('btn-signin').disabled = false;
    showStatus('signin-status', 'error', `Failed to start authentication: ${err.message}`);
  }
}

// ─── Countdown ────────────────────────────────────────────────────────────────────

function startCountdown() {
  updateCountdown();
  state.countdownTimer = setInterval(updateCountdown, 1000);
}

function updateCountdown() {
  const remaining = Math.max(0, Math.floor((state.expiresAt - Date.now()) / 1000));
  const el = document.getElementById('expires-countdown');
  if (el) el.textContent = `Code expires in ${remaining}s`;
  if (remaining === 0) clearInterval(state.countdownTimer);
}

// ─── Token Polling ────────────────────────────────────────────────────────────────

function startPolling() {
  state.pollTimer = setInterval(pollToken, state.pollInterval * 1000);
}

function stopPolling() {
  if (state.pollTimer)     { clearInterval(state.pollTimer);     state.pollTimer     = null; }
  if (state.countdownTimer){ clearInterval(state.countdownTimer); state.countdownTimer = null; }
}

async function pollToken() {
  try {
    const res = await fetch('/DeviceCodeFlow/proxy/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        tenantId:   authConfig.tenantId,
        clientId:   authConfig.clientId,
        deviceCode: state.deviceCode,
      }),
    });
    const data = await res.json();

    if (res.ok) {
      // Successfully authenticated
      stopPolling();
      state.accessToken = data.access_token;
      const displayName = parseDisplayName(data.access_token);
      updateNavAuthState(displayName || 'Authenticated');
      await loadUsers();
      return;
    }

    switch (data.error) {
      case 'authorization_pending':
        break; // Normal — user has not authenticated yet

      case 'slow_down':
        // Back off the polling interval by 5 seconds as required by the spec
        stopPolling();
        state.pollInterval += 5;
        startPolling();
        break;

      case 'expired_token':
        stopPolling();
        showDeviceCodeError('The device code has expired. Please start over.');
        break;

      case 'access_denied':
        stopPolling();
        showDeviceCodeError('Access was denied. The user declined to authenticate.');
        break;

      default:
        stopPolling();
        showDeviceCodeError(data.error_description || data.error || 'Authentication failed.');
    }

  } catch (err) {
    stopPolling();
    showDeviceCodeError(`Network error: ${err.message}`);
  }
}

function showDeviceCodeError(message) {
  document.getElementById('spinner-container').classList.add('hidden');
  showStatus('device-code-status', 'error', message);
  document.getElementById('btn-cancel').textContent = 'Start Over';
}

// ─── Cancel / Sign Out ────────────────────────────────────────────────────────────

function handleCancel() {
  stopPolling();
  state.deviceCode = null;
  document.getElementById('btn-signin-main').disabled = false;
  document.getElementById('btn-signin').disabled = false;
  hideStatus('device-code-status');
  document.getElementById('spinner-container').classList.remove('hidden');
  document.getElementById('btn-cancel').textContent = 'Cancel';
  showView('signin');
}

function handleSignOut() {
  stopPolling();
  state.deviceCode  = null;
  state.accessToken = null;
  state.nextLink    = null;

  document.getElementById('btn-signin').classList.remove('hidden');
  document.getElementById('nav-user').classList.add('hidden');
  document.getElementById('btn-signin-main').disabled = false;
  document.getElementById('btn-signin').disabled = false;

  const usersLink = document.getElementById('nav-users');
  usersLink.classList.add('nav-link-disabled');
  usersLink.setAttribute('aria-disabled', 'true');

  showView('signin');
}

// ─── Nav Auth State ───────────────────────────────────────────────────────────────

function updateNavAuthState(username) {
  document.getElementById('btn-signin').classList.add('hidden');
  const navUser = document.getElementById('nav-user');
  navUser.classList.remove('hidden');
  document.getElementById('nav-username').textContent = username;

  const usersLink = document.getElementById('nav-users');
  usersLink.classList.remove('nav-link-disabled');
  usersLink.removeAttribute('aria-disabled');
}

// ─── Graph API — Users ────────────────────────────────────────────────────────────

async function loadUsers(nextLink = null) {
  if (!state.accessToken) return;

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
      showView('users');
    } else {
      appendUserRows(data.value);
    }

    updateRowCount();
    hideStatus('users-status');

  } catch (err) {
    showStatus('users-status', 'error', `Failed to load users: ${err.message}`);
    if (!nextLink) showView('users');
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

// ─── JWT Utilities ───────────────────────────────────────────────────────────────

function parseDisplayName(accessToken) {
  try {
    const payload = JSON.parse(
      atob(accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
    );
    return payload.name || payload.preferred_username || payload.upn || null;
  } catch {
    return null;
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


// ─── Event Listeners ──────────────────────────────────────────────────────────────

// (All event listeners are registered in the init() IIFE above)

// document.getElementById('nav-about').addEventListener('click', e => {
//   e.preventDefault();
//   showView('about');
// });
