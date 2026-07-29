/**
 * authConfig.js
 *
 * Replace the placeholder values below with your Azure AD app registration details.
 *
 * App Registration Requirements:
 *   - Platform:                Single-page application (SPA)
 *   - Redirect URI:            http://localhost:3000/MultiTenant/
 *   - Supported account types: Accounts in any organizational directory
 *                              AND personal Microsoft accounts (multi-tenant + MSA)
 *   - API Permission:          User.Read (Delegated) — no admin consent required
 *   - Client Id:               The default client ID is for a public demo app. You 
 *                              can continue to use this ID, or register your own app 
 *                              in your Azure AD tenant and replace it in the setup.
 */
const msalConfig = {
  auth: {
    clientId: localStorage.getItem('entra.MultiTenant.clientId') ?? '40664342-8fff-4e5d-971d-b710b3336702',
    // "common" supports both M365 / Entra work-school accounts
    // and personal Microsoft accounts simultaneously.
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: localStorage.getItem('entra.MultiTenant.redirectUri') ?? 'http://localhost:3000/MultiTenant/',
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: true,
  },
};

const loginRequest = {
  scopes: ['User.Read'],
};
