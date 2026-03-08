import { PublicClientApplication, Configuration, LogLevel } from "@azure/msal-browser";

const msalConfig: Configuration = {
  auth: {
    clientId: "7d3ad3e7-db72-4a5e-80da-469a164ed46d",
    authority: "https://login.microsoftonline.com/61e6f244-4754-4eca-adaf-86911ff3b1b5",
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
    },
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);

export const loginRequest = {
  scopes: ["Mail.Read", "Mail.Send", "User.Read"],
};

export async function getAccessToken(): Promise<string | null> {
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length === 0) return null;
  
  try {
    const response = await msalInstance.acquireTokenSilent({
      ...loginRequest,
      account: accounts[0],
    });
    return response.accessToken;
  } catch {
    try {
      const response = await msalInstance.acquireTokenPopup(loginRequest);
      return response.accessToken;
    } catch {
      return null;
    }
  }
}

export async function fetchGraphApi(endpoint: string, options?: RequestInit) {
  const token = await getAccessToken();
  if (!token) throw new Error("לא מחובר ל-Outlook");
  
  const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
  
  if (!response.ok) {
    throw new Error(`Graph API error: ${response.status}`);
  }
  
  return response.json();
}
