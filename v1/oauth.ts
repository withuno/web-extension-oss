interface OAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token?: string;
}

export function revokeAccessToken(accessToken: string): Promise<void> {
  return fetch(`https://accounts.google.com/o/oauth2/revoke?token=${accessToken}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      console.log("Access token successfully revoked");
    })
    .catch((error) => {
      console.error("Error revoking access token:", error);
    });
}

export async function refreshAccessToken(clientId: string, refreshToken: string): Promise<OAuthResponse | null> {
  const tokenEndpoint = "https://oauth2.googleapis.com/token";
  const data = new URLSearchParams();
  data.append("client_id", clientId);
  // @ts-expect-error: constant is overwritten by build script.
  // eslint-disable-next-line
  data.append("client_secret", WEB_CLIENT_SECRET);
  data.append("refresh_token", refreshToken);
  data.append("grant_type", "refresh_token");

  try {
    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: data,
    });
    const dataJson = await response.json();

    if (dataJson.access_token && dataJson.expires_in && dataJson.token_type && dataJson.scope) {
      const oauthResponse: OAuthResponse = {
        access_token: dataJson.access_token,
        token_type: dataJson.token_type,
        expires_in: dataJson.expires_in,
        scope: dataJson.scope,
      };

      if (dataJson.refresh_token) {
        oauthResponse.refresh_token = dataJson.refresh_token;
      }

      if (dataJson.id_token) {
        oauthResponse.id_token = dataJson.id_token;
      }

      return oauthResponse;
    }
    console.error("Error refreshing access token:", dataJson);
    return null;
  } catch (error) {
    console.error("Error fetching new access token:", error);
    return null;
  }
}

export async function getAuthCodeViaLaunchWebAuthFlow(clientId: string, interactive: boolean): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const redirectUri = encodeURIComponent(chrome.identity.getRedirectURL());
    const urlStringWithoutTrailingSlash = redirectUri.endsWith("/") ? redirectUri.slice(0, -1) : redirectUri;

    console.log("what is redirect uri", urlStringWithoutTrailingSlash);
    const scope = encodeURIComponent("https://www.googleapis.com/auth/gmail.modify");

    const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${clientId}&response_type=code&access_type=offline&scope=${scope}&redirect_uri=${urlStringWithoutTrailingSlash}`;

    chrome.identity.launchWebAuthFlow(
      {
        url: authUrl,
        interactive,
      },
      (responseUrl: string | undefined) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError.message);
          return;
        }

        if (!responseUrl) {
          reject("No response URL received");
          return;
        }

        const url = new URL(responseUrl);
        const code = url.searchParams.get("code");
        if (code) {
          resolve(code);
        } else {
          reject("No authorization code received");
        }
      },
    );
  });
}

export async function getAccessTokenFromAuthCode(
  code: string,
  clientId: string,
  refreshToken: string | null = null,
): Promise<OAuthResponse> {
  const tokenRequestData = new URLSearchParams({
    code,
    client_id: clientId,
    // @ts-expect-error: constant is overwritten by build script.
    // eslint-disable-next-line
    client_secret: WEB_CLIENT_SECRET,
    redirect_uri: chrome.identity.getRedirectURL(),
    grant_type: "authorization_code",
  });

  const response = await fetch("https://accounts.google.com/o/oauth2/token?access_type=offline", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: tokenRequestData,
  });

  if (!response.ok) {
    if (response.status === 401 && refreshToken) {
      // Attempt to refresh the access token
      console.log("going for refresh");
      const refreshedTokens = await refreshAccessToken(clientId, refreshToken);
      console.log("refreshed tokens", refreshedTokens);
      if (refreshedTokens) {
        return refreshedTokens;
      }
    } else {
      const errorResponse = await response.json();
      console.error("Error:", errorResponse);
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
  }

  const respJson = (await response.json()) as OAuthResponse;
  console.log(respJson);

  if (!respJson.access_token) {
    console.log("no access token");
  }
  return respJson;
}
