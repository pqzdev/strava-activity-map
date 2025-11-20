/**
 * Client-side Strava OAuth Authentication
 * No server required - all credentials stored in sessionStorage
 */

export class StravaAuth {
  constructor() {
    this.storageKeys = {
      clientId: 'strava_client_id',
      clientSecret: 'strava_client_secret',
      scope: 'strava_scope',
      accessToken: 'strava_access_token',
      refreshToken: 'strava_refresh_token',
      expiresAt: 'strava_expires_at',
      athlete: 'strava_athlete'
    };
  }

  /**
   * Check if user has provided credentials
   */
  hasCredentials() {
    const clientId = sessionStorage.getItem(this.storageKeys.clientId);
    const clientSecret = sessionStorage.getItem(this.storageKeys.clientSecret);
    return !!(clientId && clientSecret);
  }

  /**
   * Check if user is authenticated (has valid token)
   */
  isAuthenticated() {
    const token = sessionStorage.getItem(this.storageKeys.accessToken);
    const expiresAt = sessionStorage.getItem(this.storageKeys.expiresAt);

    if (!token) return false;
    if (!expiresAt) return true; // No expiry info, assume valid

    return Date.now() < parseInt(expiresAt);
  }

  /**
   * Save API credentials (Client ID, Secret, and Scope)
   */
  saveCredentials(clientId, clientSecret, scope = 'read') {
    sessionStorage.setItem(this.storageKeys.clientId, clientId);
    sessionStorage.setItem(this.storageKeys.clientSecret, clientSecret);
    sessionStorage.setItem(this.storageKeys.scope, scope);
  }

  /**
   * Get stored credentials
   */
  getCredentials() {
    return {
      clientId: sessionStorage.getItem(this.storageKeys.clientId),
      clientSecret: sessionStorage.getItem(this.storageKeys.clientSecret)
    };
  }

  /**
   * Get OAuth authorization URL for manual flow
   * User opens this in new tab, authorizes, and copies the code
   */
  getAuthorizationUrl() {
    const { clientId } = this.getCredentials();
    if (!clientId) {
      throw new Error('Client ID not set. Please enter your credentials first.');
    }

    // Get scope preference (read or read_all)
    const scopeType = sessionStorage.getItem(this.storageKeys.scope) || 'read';
    const scopePermissions = scopeType === 'read_all' ? 'read,activity:read_all' : 'read,activity:read';

    // Use a localhost URL that won't work - user will copy code from the error page
    const redirectUri = 'http://localhost:9999/exchange_token';

    const authUrl = `https://www.strava.com/oauth/authorize?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `approval_prompt=force&` + // Always show auth screen
      `scope=${scopePermissions}`;

    return authUrl;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCode(code) {
    const { clientId, clientSecret } = this.getCredentials();
    if (!clientId || !clientSecret) {
      throw new Error('Credentials not found in session');
    }

    // Exchange code for token
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code'
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Token exchange failed: ${errorData.message || response.statusText}`);
    }

    const data = await response.json();

    // Store tokens and athlete info
    this.saveTokens(data);

    return data;
  }

  /**
   * Handle OAuth callback - exchange code for token
   */
  async handleCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');

    if (error) {
      throw new Error(`OAuth error: ${error}`);
    }

    if (!code) {
      return false; // No callback in progress
    }

    const { clientId, clientSecret } = this.getCredentials();
    if (!clientId || !clientSecret) {
      throw new Error('Credentials not found in session');
    }

    // Exchange code for token
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code'
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Token exchange failed: ${errorData.message || response.statusText}`);
    }

    const data = await response.json();

    // Store tokens and athlete info
    this.saveTokens(data);

    // Clean URL (remove OAuth params)
    window.history.replaceState({}, document.title, window.location.pathname);

    return true;
  }

  /**
   * Save OAuth tokens
   */
  saveTokens(data) {
    sessionStorage.setItem(this.storageKeys.accessToken, data.access_token);
    sessionStorage.setItem(this.storageKeys.refreshToken, data.refresh_token);
    sessionStorage.setItem(this.storageKeys.expiresAt, (Date.now() + data.expires_in * 1000).toString());

    if (data.athlete) {
      sessionStorage.setItem(this.storageKeys.athlete, JSON.stringify(data.athlete));
    }
  }

  /**
   * Get current access token (refresh if needed)
   */
  async getAccessToken() {
    // Check if token is still valid
    if (this.isAuthenticated()) {
      return sessionStorage.getItem(this.storageKeys.accessToken);
    }

    // Try to refresh token
    const refreshToken = sessionStorage.getItem(this.storageKeys.refreshToken);
    if (!refreshToken) {
      throw new Error('No refresh token available. Please authorize again.');
    }

    return await this.refreshAccessToken();
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken() {
    const { clientId, clientSecret } = this.getCredentials();
    const refreshToken = sessionStorage.getItem(this.storageKeys.refreshToken);

    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });

    if (!response.ok) {
      throw new Error('Token refresh failed. Please authorize again.');
    }

    const data = await response.json();
    this.saveTokens(data);

    return data.access_token;
  }

  /**
   * Get athlete info
   */
  getAthlete() {
    const athleteData = sessionStorage.getItem(this.storageKeys.athlete);
    return athleteData ? JSON.parse(athleteData) : null;
  }

  /**
   * Clear all stored data (logout)
   */
  clearAll() {
    Object.values(this.storageKeys).forEach(key => {
      sessionStorage.removeItem(key);
    });
  }

  /**
   * Get authorization status for UI
   */
  getStatus() {
    return {
      hasCredentials: this.hasCredentials(),
      isAuthenticated: this.isAuthenticated(),
      athlete: this.getAthlete()
    };
  }
}
