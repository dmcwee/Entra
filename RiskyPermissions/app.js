// ─── MSAL Instance ──────────────────────────────────────────────────────────────

const msalInstance = new msal.PublicClientApplication(msalConfig);

// ─── Initialization ──────────────────────────────────────────────────────────────

(async function init() {
  if (
    msalConfig.auth.clientId === "YOUR_CLIENT_ID_HERE" ||
    msalConfig.auth.authority.includes("YOUR_TENANT_ID_HERE")
  ) {
    document.getElementById("btn-signin-main").disabled = true;
    document.getElementById("btn-signin").disabled = true;
    showView("signin");
    showStatus(
      "error",
      'App is not configured. Return to the home page and set the <b>Redirect URI</b> and <b>Client ID</b>.'
    );
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
    showView("compose");
  } else {
    showView("signin");
  }
})();

// ─── View Routing ─────────────────────────────────────────────────────────────────

function showView(name) {
  document.querySelectorAll(".view").forEach(
    v => { if(!v.classList.contains("view-about")) v.classList.add("hidden"); });
  const target = document.getElementById(`view-${name}`);
  if (target) target.classList.remove("hidden");

  document.querySelectorAll(".nav-link").forEach(
    l => { if(!l.classList.contains("nav-about")) l.classList.remove("active"); });
  const navLink = document.getElementById(`nav-${name}`);
  if (navLink) navLink.classList.add("active");
}

// ─── Auth State ──────────────────────────────────────────────────────────────────

function updateNavAuthState(account) {
  const signinBtn = document.getElementById("btn-signin");
  const signinMainBtn = document.getElementById("btn-signin-main");
  const navUser = document.getElementById("nav-user");
  const navUsername = document.getElementById("nav-username");
  const composeLink = document.getElementById("nav-compose");

  if (account) {
    signinBtn.classList.add("hidden");
    navUser.classList.remove("hidden");
    navUsername.textContent = account.name || account.username;
    composeLink.classList.remove("nav-link-disabled");
    composeLink.removeAttribute("aria-disabled");
  } else {
    signinBtn.classList.remove("hidden");
    navUser.classList.add("hidden");
    if (signinMainBtn) signinMainBtn.disabled = false;
    composeLink.classList.add("nav-link-disabled");
    composeLink.setAttribute("aria-disabled", "true");
  }
}

// ─── Sign In / Sign Out ────────────────────────────────────────────────────────────

async function handleSignIn() {
  try {
    await msalInstance.loginRedirect(loginRequest);
  } catch (error) {
    console.error("Sign-in error:", error);
    showStatus("error", `Sign-in failed: ${error.message}`);
  }
}

async function handleSignOut() {
  const account = msalInstance.getActiveAccount();
  try {
    await msalInstance.logoutRedirect({ account });
  } catch (error) {
    console.error("Sign-out error:", error);
  }
}

// ─── Navigation ────────────────────────────────────────────────────────────────────

document.getElementById("nav-compose").addEventListener("click", (e) => {
  e.preventDefault();
  const account = msalInstance.getActiveAccount();
  if (account) {
    showView("compose");
  } else {
    handleSignIn();
  }
});

// document.getElementById("nav-about").addEventListener("click", (e) => {
//   e.preventDefault();
//   showView("about");
// });

document.getElementById("btn-signin").addEventListener("click", handleSignIn);
document.getElementById("btn-signin-main").addEventListener("click", handleSignIn);
document.getElementById("btn-signout").addEventListener("click", handleSignOut);
document.getElementById("btn-send").addEventListener("click", handleSend);

// ─── Email Template ─────────────────────────────────────────────────────────────────

function buildEmailHtml(body) {
  // Escape user content before embedding in HTML to prevent injection
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br/>");

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background-color:#ffffff;">
    <!-- Header -->
    <tr>
      <td style="background-color:#0078d4;padding:24px 32px;text-align:center;">
        <img
          src="YOUR_LOGO_URL_HERE"
          alt="Company Logo"
          style="max-height:64px;display:block;margin:0 auto 12px;"
        />
        <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:600;">COMPANY NAME</h1>
      </td>
    </tr>
    <!-- Body -->
    <tr>
      <td style="padding:32px 40px;color:#333333;font-size:15px;line-height:1.7;">
        ${escaped}
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="background-color:#f0f0f0;padding:20px 40px;border-top:1px solid #dddddd;">
        <p style="margin:0;font-size:11px;color:#666666;line-height:1.5;">
          DISCLAIMER TEXT PLACEHOLDER — Replace this with your organization's disclaimer,
          confidentiality notice, or other required footer content.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function parseRecipients(str) {
  if (!str || !str.trim()) return [];
  return str
    .split(/[,;]+/)
    .map((addr) => addr.trim())
    .filter((addr) => addr.length > 0)
    .map((addr) => ({ emailAddress: { address: addr } }));
}

// ─── Send ───────────────────────────────────────────────────────────────────────────

async function handleSend() {
  const to = document.getElementById("field-to").value.trim();
  const cc = document.getElementById("field-cc").value.trim();
  const subject = document.getElementById("field-subject").value.trim();
  const body = document.getElementById("field-body").value.trim();

  if (!to) return showStatus("error", "Please provide at least one recipient in the To field.");
  if (!subject) return showStatus("error", "Subject is required.");
  if (!body) return showStatus("error", "Message body cannot be empty.");

  const toRecipients = parseRecipients(to);
  const ccRecipients = parseRecipients(cc);

  if (toRecipients.length === 0) {
    return showStatus("error", "No valid recipient addresses found in the To field.");
  }

  const btnSend = document.getElementById("btn-send");
  btnSend.disabled = true;
  btnSend.textContent = "Sending\u2026";
  showStatus("info", "Sending message\u2026");

  try {
    const account = msalInstance.getActiveAccount();
    let tokenResponse;

    try {
      tokenResponse = await msalInstance.acquireTokenSilent({ ...loginRequest, account });
    } catch (silentError) {
      if (silentError instanceof msal.InteractionRequiredAuthError) {
        tokenResponse = await msalInstance.acquireTokenPopup(loginRequest);
      } else {
        throw silentError;
      }
    }

    const mailPayload = {
      message: {
        subject,
        body: {
          contentType: "HTML",
          content: buildEmailHtml(body),
        },
        toRecipients,
        ...(ccRecipients.length > 0 && { ccRecipients }),
      },
      saveToSentItems: true,
    };

    const response = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenResponse.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(mailPayload),
    });

    if (response.status === 202) {
      showStatus("success", "Message sent successfully. It will appear in your Sent Items.");
      document.getElementById("compose-form").reset();
    } else {
      const errorData = await response.json().catch(() => ({}));
      const message =
        errorData?.error?.message || `HTTP ${response.status} ${response.statusText}`;
      showStatus("error", `Failed to send message: ${message}`);
    }
  } catch (error) {
    console.error("Send error:", error);
    showStatus("error", `An error occurred: ${error.message}`);
  } finally {
    btnSend.disabled = false;
    btnSend.textContent = "Send Message";
  }
}

// ─── Status Messages ──────────────────────────────────────────────────────────────

function showStatus(type, message) {
  const el = document.getElementById("status-message");
  el.className = `status-message status-${type}`;
  el.textContent = message;
  el.classList.remove("hidden");

  if (type === "success") {
    setTimeout(() => el.classList.add("hidden"), 6000);
  }
}
