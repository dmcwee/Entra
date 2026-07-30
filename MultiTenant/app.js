'use strict';

// ─── MSAL Instance ────────────────────────────────────────────────────────────

const msalInstance = new msal.PublicClientApplication(msalConfig);

// ─── App State ────────────────────────────────────────────────────────────────

let photoObjectUrl = null;

// ─── Initialization ───────────────────────────────────────────────────────────

(async function init() {
  if (msalConfig.auth.clientId === 'YOUR_CLIENT_ID_HERE' || msalConfig.auth.redirectUri === 'YOUR_REDIRECT_URI_HERE') {
    document.getElementById('btn-signin-main').disabled = true;
    document.getElementById('btn-signin').disabled = true;
    showView('signin');
    showStatus('signin-status', 'error',
      'App is not configured. Return to the home page and set the <b>Redirect URI</b> and <b>Client ID</b>.');
    return;
  }

  await msalInstance.initialize();

  // Process the auth code returned after loginRedirect completes.
  const redirectResponse = await msalInstance.handleRedirectPromise().catch(console.error);
  if (redirectResponse) {
    msalInstance.setActiveAccount(redirectResponse.account);
  }

  const account =
    msalInstance.getActiveAccount() ?? msalInstance.getAllAccounts()[0] ?? null;

  if (account) {
    msalInstance.setActiveAccount(account);
    updateNavAuthState(account);
    await fetchAndRenderProfile();
  } else {
    showView('signin');
  }
})();

// ─── View Routing ─────────────────────────────────────────────────────────────

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  const target = document.getElementById(`view-${name}`);
  if (target) target.classList.remove('hidden');

  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const navLink = document.getElementById(`nav-${name}`);
  if (navLink) navLink.classList.add('active');
}

// ─── Status Messages ──────────────────────────────────────────────────────────

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

// ─── Auth State ───────────────────────────────────────────────────────────────

function updateNavAuthState(account) {
  const signinBtn    = document.getElementById('btn-signin');
  const navUser      = document.getElementById('nav-user');
  const navUsername  = document.getElementById('nav-username');
  const profileLink  = document.getElementById('nav-profile');

  if (account) {
    signinBtn.classList.add('hidden');
    navUser.classList.remove('hidden');
    navUsername.textContent = account.name || account.username;
    profileLink.classList.remove('nav-link-disabled');
    profileLink.removeAttribute('aria-disabled');
  } else {
    signinBtn.classList.remove('hidden');
    navUser.classList.add('hidden');
    profileLink.classList.add('nav-link-disabled');
    profileLink.setAttribute('aria-disabled', 'true');
  }
}

// ─── Sign In / Sign Out ───────────────────────────────────────────────────────

async function handleSignIn() {
  try {
    await msalInstance.loginRedirect(loginRequest);
  } catch (error) {
    console.error('Sign-in error:', error);
    showStatus('signin-status', 'error', `Sign-in failed: ${error.message}`);
  }
}

async function handleSignOut() {
  const account = msalInstance.getActiveAccount();
  revokePhotoUrl();
  try {
    await msalInstance.logoutRedirect({ account });
  } catch (error) {
    console.error('Sign-out error:', error);
  }
}

// ─── Access Token ─────────────────────────────────────────────────────────────

async function getAccessToken() {
  const account = msalInstance.getActiveAccount();
  const tokenRequest = { ...loginRequest, account };
  try {
    const result = await msalInstance.acquireTokenSilent(tokenRequest);
    return result.accessToken;
  } catch (error) {
    if (error instanceof msal.InteractionRequiredAuthError) {
      await msalInstance.acquireTokenRedirect(tokenRequest);
    }
    throw error;
  }
}

// ─── Graph Calls ─────────────────────────────────────────────────────────────

async function fetchAndRenderProfile() {
  showView('profile');
  showStatus('profile-status', 'info', 'Loading profile\u2026');

  try {
    const token = await getAccessToken();
    const headers = { Authorization: `Bearer ${token}` };

    // Fire both requests in parallel
    const [profileRes, photoRes] = await Promise.allSettled([
      fetch(
        'https://graph.microsoft.com/v1.0/me' +
        '?$select=id,displayName,givenName,surname,mail,userPrincipalName,jobTitle,department,officeLocation',
        { headers }
      ),
      fetch('https://graph.microsoft.com/v1.0/me/photo/$value', { headers }),
    ]);

    if (profileRes.status === 'rejected' || !profileRes.value.ok) {
      const detail = profileRes.status === 'rejected'
        ? profileRes.reason.message
        : `HTTP ${profileRes.value.status}`;
      throw new Error(`Failed to load profile from Microsoft Graph (${detail}).`);
    }

    const profile = await profileRes.value.json();

    // Photo: convert blob to object URL if available; 404 = no photo (personal accounts)
    let photoUrl = null;
    if (photoRes.status === 'fulfilled' && photoRes.value.ok) {
      const blob = await photoRes.value.blob();
      revokePhotoUrl();
      photoObjectUrl = URL.createObjectURL(blob);
      photoUrl = photoObjectUrl;
    }

    hideStatus('profile-status');
    renderProfile(profile, photoUrl);
  } catch (error) {
    console.error('Profile load error:', error);
    showStatus('profile-status', 'error', `Could not load profile: ${error.message}`);
  }
}

// ─── Profile Rendering ────────────────────────────────────────────────────────

function renderProfile(profile, photoUrl) {
  const firstName     = profile.givenName        ?? '\u2014';
  const lastName      = profile.surname           ?? '\u2014';
  const email         = profile.mail
                          ?? profile.userPrincipalName
                          ?? '\u2014';
  const jobTitle      = profile.jobTitle          ?? '\u2014';
  const department    = profile.department        ?? '\u2014';
  const officeLocation = profile.officeLocation   ?? '\u2014';
  const displayName   = profile.displayName
                          ?? `${profile.givenName ?? ''} ${profile.surname ?? ''}`.trim()
                          ?? '\u2014';

  // Avatar
  const avatarImg      = document.getElementById('profile-avatar-img');
  const avatarInitials = document.getElementById('profile-avatar-initials');

  if (photoUrl) {
    avatarImg.src = photoUrl;
    avatarImg.classList.remove('hidden');
    avatarInitials.classList.add('hidden');
  } else {
    avatarInitials.textContent = buildInitials(
      profile.givenName, profile.surname, profile.displayName
    );
    avatarInitials.classList.remove('hidden');
    avatarImg.classList.add('hidden');
  }

  document.getElementById('profile-display-name').textContent = displayName;
  document.getElementById('profile-email-sub').textContent    = email;
  document.getElementById('field-first-name').textContent     = firstName;
  document.getElementById('field-last-name').textContent      = lastName;
  document.getElementById('field-email').textContent          = email;
  document.getElementById('field-job-title').textContent      = jobTitle;
  document.getElementById('field-department').textContent     = department;
  document.getElementById('field-office').textContent         = officeLocation;
}

function buildInitials(givenName, surname, displayName) {
  if (givenName && surname) {
    return `${givenName[0]}${surname[0]}`.toUpperCase();
  }
  if (displayName) {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    if (parts[0]) return parts[0][0].toUpperCase();
  }
  return '?';
}

function revokePhotoUrl() {
  if (photoObjectUrl) {
    URL.revokeObjectURL(photoObjectUrl);
    photoObjectUrl = null;
  }
}

// ─── Event Listeners ──────────────────────────────────────────────────────────

document.getElementById('btn-signin').addEventListener('click', handleSignIn);
document.getElementById('btn-signin-main').addEventListener('click', handleSignIn);
document.getElementById('btn-signout').addEventListener('click', handleSignOut);

document.getElementById('nav-profile').addEventListener('click', (e) => {
  e.preventDefault();
  if (msalInstance.getActiveAccount()) showView('profile');
});
