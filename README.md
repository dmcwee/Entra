# Entra ID Demo Applications

A collection of Microsoft Entra ID / Azure AD demo apps, each in its own subfolder.

## Running the Demo Server

Install dependencies (one-time):

```
npm install
```

Start the server:

```
npm start
```

Open your browser to **http://localhost:3000** — the landing page lists all available demos.

To use a different port:

```
PORT=8080 node server.js
```

---

## Demo Apps

### `ClientSecret/`

Demonstrates the **OAuth 2.0 Client Credentials Grant** (machine-to-machine authentication). The application authenticates as itself — using its own `client_id` and `client_secret` — with no signed-in user. It acquires an app-only token and calls Microsoft Graph to list all users in the tenant.

**Primary security lesson:** Placing a client secret in browser JavaScript exposes it to anyone who can view page source or network traffic. Unlike a delegated token, a client credentials token carries the full Application permission set and bypasses Conditional Access policies that rely on a user sign-in event (MFA, compliant device, trusted location). In production, token acquisition must be performed server-side.

**App registration requirements:**

| Setting | Value |
|---|---|
| Platform | Web (no redirect URI needed) |
| Supported account types | Single tenant |
| API permissions | `User.Read.All` — **Application** (requires admin consent) |
| Client secret | Required — created under *Certificates & secrets* |

**Settings panel** — open `http://localhost:3000` and fill in under *Settings*:

- **Shared → Entra Tenant ID**
- **ClientSecret → Client ID**
- **ClientSecret → Client Secret**

---

### `DeviceCodeFlow/`

Demonstrates the **OAuth 2.0 Device Authorization Grant** ([RFC 8628](https://datatracker.ietf.org/doc/html/rfc8628)), designed for input-constrained devices. The app requests a short user code, displays it with a verification URL, then polls the token endpoint until the user completes sign-in on a separate device. On success it calls Microsoft Graph to list directory users.

**Primary security lesson:** Device Code Phishing (MITRE ATT&CK T1528) exploits this flow by tricking a victim into entering an attacker-generated code at the legitimate `microsoft.com/devicelogin` page. The attacker's polling loop immediately receives a valid access and refresh token (valid up to 90 days), bypassing MFA since the victim completed it. The flow has no redirect URI restriction, meaning any application holding the correct `client_id` can initiate it.

**App registration requirements:**

| Setting | Value |
|---|---|
| Platform | Mobile and desktop applications |
| Supported account types | Single tenant |
| API permissions | `User.Read.All` — **Delegated** (requires admin consent) |
| Allow public client flows | **Enabled** (*Authentication → Advanced settings*) |

**Settings panel** — open `http://localhost:3000` and fill in under *Settings*:

- **Shared → Entra Tenant ID**
- **DeviceCodeFlow → Client ID**

---

### `MultiTenant/`

Demonstrates **multi-tenant authentication** using MSAL.js and the Authorization Code flow with PKCE. The app registration accepts accounts from any Microsoft 365 tenant or personal Microsoft account via the `common` authority endpoint. On sign-in it fetches and displays the signed-in user's profile and photo from Microsoft Graph.

**Primary security lesson:** Multi-tenant apps expose the application's identity to anyone on the internet. Key risks include illicit consent grant attacks (where an attacker crafts a phishing consent URL using your legitimate `client_id`), tenant isolation failures (if `tid`/`iss` token claims are not validated server-side), and a blast radius that scales with every consented tenant. A single leaked client secret or certificate compromises all tenants simultaneously.

**App registration requirements:**

| Setting | Value |
|---|---|
| Platform | Single-page application (SPA) |
| Redirect URI | `http://localhost:3000/MultiTenant/` |
| Supported account types | **Accounts in any organizational directory and personal Microsoft accounts** |
| API permissions | `User.Read` — Delegated (no admin consent required) |

**Settings panel** — open `http://localhost:3000` and fill in under *Settings*:

- **MultiTenant → Client ID**
- **MultiTenant → Redirect URI** (default: `http://localhost:3000/MultiTenant/`)

---

### `RiskyPermissions/`

Demonstrates **delegated permissions with high-privilege scopes** using MSAL.js. The app signs in a user and sends email on their behalf via the Microsoft Graph `Mail.Send` permission — a permission routinely abused in business email compromise (BEC) and data exfiltration scenarios.

**App registration requirements:**

| Setting | Value |
|---|---|
| Platform | Single-page application (SPA) |
| Redirect URI | `http://localhost:3000/RiskyPermissions/` |
| Supported account types | Single tenant |
| API permissions | `Mail.Send` — Delegated |

**Settings panel** — open `http://localhost:3000` and fill in under *Settings*:

- **Shared → Entra Tenant ID**
- **RiskyPermissions → Client ID**
- **RiskyPermissions → Redirect URI** (default: `http://localhost:3000/RiskyPermissions/`)

---

## Azure AD App Registration (per demo)

Each demo that uses MSAL requires its own App Registration in [Entra ID / Azure AD](https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps).

### Steps

1. **New registration** → give it a name → select the appropriate account types.
2. Under **Authentication** → **Add a platform** → choose **Single-page application**.
3. Set the **Redirect URI** to `http://localhost:3000` (matches the server default).
4. Under **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated** → add the scopes the demo requires (e.g. `Mail.Send`).
5. If your tenant requires it, click **Grant admin consent**.
6. Copy the **Application (client) ID** and **Directory (tenant) ID** from the app's Overview page.

### Configure the demo

Start the server (`npm start`) and open **http://localhost:3000**. Use the **Settings** panel to enter the values copied from the Azure portal. Settings are saved to browser `localStorage` and read automatically by each app at runtime — no file editing required.

| Value | Where to find it in the Azure portal |
|---|---|
| Tenant ID | Entra ID → Overview → *Directory (tenant) ID* |
| Client ID | App registration → Overview → *Application (client) ID* |
| Client Secret | App registration → *Certificates & secrets* → New client secret |
| Redirect URI | Must match the URI registered under *Authentication → Redirect URIs* |

---

## RiskyPermissions — Email Template Placeholders

After generating the page, open `RiskyPermissions/app.js` and update `buildEmailHtml()`:

| Placeholder | Replace with |
|---|---|
| `YOUR_LOGO_URL_HERE` | Public URL of your company logo image |
| `COMPANY NAME` | Your organization's display name |
| `DISCLAIMER TEXT PLACEHOLDER` | Legal disclaimer / confidentiality notice |
