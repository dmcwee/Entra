/**
 * authConfig.js
 *
 * App Registration Requirements:
 *   - Platform:                Single-page application (SPA)
 *   - Redirect URI:            http://localhost:3000/RiskyPermissions/
 *   - Supported account types: Single tenant
 *   - API Permission:          Mail.Send (Delegated)
 */
const msalConfig = {
  auth: {
    clientId: localStorage.getItem('entra.RiskyPermissions.clientId') ?? 'YOUR_CLIENT_ID_HERE',
    authority: `https://login.microsoftonline.com/${ localStorage.getItem('entra.tenantId') ?? 'YOUR_TENANT_ID_HERE' }`,
    // Redirect URI — must be registered as a SPA redirect URI in your Azure AD app registration.
    redirectUri: localStorage.getItem('entra.RiskyPermissions.redirectUri') ?? 'http://localhost:3000/RiskyPermissions/',
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: true,
  },
};

const loginRequest = {
  scopes: ["Mail.Send"],
};
