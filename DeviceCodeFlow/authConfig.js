/**
 * authConfig.js
 *
 * App Registration Requirements:
 *   - Platform:                  Mobile and desktop applications (NOT SPA)
 *   - Redirect URI:              Not required for Device Code Flow
 *   - Supported account types:   Single tenant
 *   - API Permission:            User.Read.All (Delegated) — requires admin consent
 *   - Allow public client flows: Enabled (Authentication > Advanced settings)
 */
const authConfig = {
  clientId: localStorage.getItem('entra.DeviceCodeFlow.clientId') ?? 'YOUR_CLIENT_ID_HERE',
  tenantId: localStorage.getItem('entra.tenantId') ?? 'YOUR_TENANT_ID_HERE',
  scopes: ['https://graph.microsoft.com/User.Read.All'],
  //devicecodeEndpoint: '/DeviceCodeFlow/proxy/devicecode',
  //devicetokenEndpoint: '/DeviceCodeFlow/proxy/token',
  devicecodeEndpoint:  'https://davidmcweeproxy.azurewebsites.net/api/entra/devicecode',
  devicetokenEndpoint: 'https://davidmcweeproxy.azurewebsites.net/api/entra/devicetoken',
};
