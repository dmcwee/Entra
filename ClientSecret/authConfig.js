/**
 * authConfig.js
 *
 * App Registration Requirements:
 *   - Platform:           Web (no redirect URI is needed for this flow)
 *   - API Permission:     User.Read.All (Application) — requires admin consent
 *   - Client secret:      Created under Certificates & secrets
 *
 * NOTE: The Client Credentials flow uses Application permissions, not Delegated.
 *       There is no signed-in user; the application authenticates as itself.
 *
 * ⚠  SECURITY WARNING (Demo Only)
 *    Storing a client secret in browser JavaScript exposes it to anyone who can
 *    view the page source or network traffic. The page retrieves the secret from
 *    the local browser's storage but the secret is still exposable.  
 *    In production, token acquisition must be performed server-side and the 
 *    secret must never leave the server.
 */
const authConfig = {
  clientId:     localStorage.getItem('entra.ClientSecret.clientId')     ?? 'YOUR_CLIENT_ID_HERE',
  tenantId:     localStorage.getItem('entra.tenantId') ?? 'YOUR_TENANT_ID_HERE' ,
  clientSecret: localStorage.getItem('entra.ClientSecret.clientSecret') ?? 'YOUR_CLIENT_SECRET_HERE',
  scope:        'https://graph.microsoft.com/.default',
};
