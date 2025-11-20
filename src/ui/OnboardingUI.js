/**
 * Onboarding UI for setting up Strava API credentials
 */

export class OnboardingUI {
  constructor(auth, api, onComplete) {
    this.auth = auth;
    this.api = api;
    this.onComplete = onComplete;
    this.currentStep = 1;
  }

  /**
   * Show onboarding screen
   */
  show() {
    // Create onboarding container
    const container = document.createElement('div');
    container.id = 'onboarding';
    container.innerHTML = this.getOnboardingHTML();
    document.body.appendChild(container);

    // Attach event listeners
    this.attachEventListeners();

    // Show first step
    this.showStep(1);
  }

  /**
   * Hide onboarding screen
   */
  hide() {
    const container = document.getElementById('onboarding');
    if (container) {
      container.remove();
    }
  }

  /**
   * Get the correct domain for OAuth callback
   * For manual OAuth flow, we use a dummy localhost URL
   */
  getCallbackDomain() {
    return 'localhost:9999';
  }

  /**
   * Get the correct website URL for OAuth
   * For manual OAuth flow, we use a dummy localhost URL
   */
  getWebsiteURL() {
    return 'http://localhost:9999';
  }

  /**
   * Get onboarding HTML
   */
  getOnboardingHTML() {
    const websiteURL = this.getWebsiteURL();
    const callbackDomain = this.getCallbackDomain();

    return `
      <div class="onboarding-overlay">
        <div class="onboarding-modal">
          <div class="onboarding-header">
            <h1><i class="fas fa-map-marked-alt"></i> Strava Activity Map</h1>
            <p>Visualize and export your Strava activities as animated GIFs</p>
          </div>

          <!-- Step 1: Welcome & Privacy -->
          <div class="onboarding-step" data-step="1">
            <h2>Welcome! <i class="fas fa-hand-wave"></i></h2>
            <p>This tool visualizes your Strava activities on a map and exports them as animated GIFs.</p>

            <div class="privacy-notice">
              <h3><i class="fas fa-lock"></i> Privacy First</h3>
              <ul>
                <li><i class="fas fa-check-circle" style="color: #0066cc;"></i> <strong>100% client-side</strong> - runs entirely in your browser</li>
                <li><i class="fas fa-check-circle" style="color: #0066cc;"></i> <strong>No data sent to our servers</strong> - we don't have any servers!</li>
                <li><i class="fas fa-check-circle" style="color: #0066cc;"></i> <strong>Your credentials stay with you</strong> - stored only in your browser session</li>
                <li><i class="fas fa-check-circle" style="color: #0066cc;"></i> <strong>Use your own API quota</strong> - no shared limits</li>
                <li><i class="fas fa-check-circle" style="color: #0066cc;"></i> <strong>Auto-clears on browser close</strong> - nothing persists</li>
              </ul>
            </div>

            <div class="disclaimer-notice">
              <p><small><strong>Disclaimer:</strong> This project is not affiliated with, endorsed by, or connected to Strava, Inc. in any way. This is an independent, open-source visualization tool that uses the public Strava API.</small></p>
            </div>

            <button class="btn-primary" onclick="onboarding.nextStep()">Get Started</button>
          </div>

          <!-- Step 2: Create Strava API App -->
          <div class="onboarding-step" data-step="2" style="display: none;">
            <h2>Step 1: Create Strava API Application</h2>
            <p>You'll need to create a Strava API application to get your credentials.</p>

            <div class="instructions">
              <ol>
                <li>Go to <a href="https://www.strava.com/settings/api" target="_blank" rel="noopener">Strava API Settings</a></li>
                <li>Scroll to "My API Application"</li>
                <li>Fill in the form:
                  <ul>
                    <li><strong>Application Name:</strong> "My Activity Map" (or any name)</li>
                    <li><strong>Category:</strong> "Visualizer" (recommended, but any option works)</li>
                    <li><strong>Club:</strong> Leave blank</li>
                    <li><strong>Website:</strong> <code id="website-url">${websiteURL}</code>
                      <button class="btn-copy" onclick="onboarding.copyToClipboard('website-url')">Copy</button>
                    </li>
                    <li><strong>Authorization Callback Domain:</strong> <code id="callback-domain">${callbackDomain}</code>
                      <button class="btn-copy" onclick="onboarding.copyToClipboard('callback-domain')">Copy</button>
                    </li>
                  </ul>
                </li>
                <li>Click "Create"</li>
                <li>You'll see your <strong>Client ID</strong> and <strong>Client Secret</strong></li>
              </ol>
              <p><small><strong><i class="fas fa-clock"></i> This takes about 1 minute!</strong> Strava's API setup is quick and easy.</small></p>
            </div>

            <div class="button-row">
              <button class="btn-secondary" onclick="onboarding.prevStep()">Back</button>
              <button class="btn-primary" onclick="onboarding.nextStep()">Next</button>
            </div>
          </div>

          <!-- Step 3: Enter Credentials -->
          <div class="onboarding-step" data-step="3" style="display: none;">
            <h2>Step 2: Enter Your API Credentials</h2>
            <p>Copy your Client ID and Client Secret from the Strava API page.</p>

            <div class="form-group">
              <label for="client-id">Client ID</label>
              <input type="text" id="client-id" placeholder="e.g., 123456" />
            </div>

            <div class="form-group">
              <label for="client-secret">Client Secret</label>
              <input type="password" id="client-secret" placeholder="Your client secret" />
              <small>These are stored only in your browser session</small>
            </div>

            <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 12px; margin: 15px 0;">
              <p style="margin: 0; font-size: 13px; color: #856404; line-height: 1.5;">
                <i class="fas fa-info-circle" style="color: #ffc107;"></i> <strong>Note:</strong> If you grant access to private activities, they will be visible on the exported map. You'll choose which permissions to grant in the next step.
              </p>
            </div>

            <div id="credentials-error" class="error-message" style="display: none;"></div>

            <div class="button-row">
              <button class="btn-secondary" onclick="onboarding.prevStep()">Back</button>
              <button class="btn-primary" onclick="onboarding.saveCredentialsAndShowAuth()">Next</button>
            </div>
          </div>

          <!-- Step 4: Manual Authorization -->
          <div class="onboarding-step" data-step="4" style="display: none;">
            <h2>Step 3: Authorize with Strava</h2>

            <div class="instructions">
              <p><strong>Follow these steps:</strong></p>
              <ol>
                <li>Click the button below to open Strava authorization in a new tab</li>
                <li><strong>Important:</strong> On the Strava page, make sure to check <strong>BOTH permission boxes</strong>:
                  <ul style="margin: 8px 0;">
                    <li>"View data about your activities"</li>
                    <li>"View data about your private activities"</li>
                  </ul>
                </li>
                <li>Click "Authorize" on the Strava page</li>
                <li>You'll see an error page - <strong>that's expected!</strong></li>
                <li>Copy the <strong>entire URL</strong> from your browser's address bar</li>
                <li>Paste it below (we'll extract the code automatically)</li>
              </ol>
              <p><small><strong><i class="fas fa-info-circle" style="color: #2196f3;"></i> Privacy Note:</strong> Your activities are only shared with your own API - no one else can access them. You can control whether private activities appear on your map using the "Include private activities" checkbox in the app.</small></p>
            </div>

            <button class="btn-primary" onclick="onboarding.openAuthWindow()" style="margin-bottom: 20px;">
              Open Strava Authorization
            </button>

            <div class="form-group">
              <label for="auth-code">Paste the URL from the Error Page</label>
              <input type="text" id="auth-code" placeholder="Paste the entire URL here (e.g., http://localhost:9999/exchange_token?code=...)" />
              <small>Just copy-paste the full URL from your address bar - we'll handle the rest!</small>
            </div>

            <div id="auth-error" class="error-message" style="display: none;"></div>
            <div id="auth-progress" style="display: none; text-align: center; margin: 15px 0;">
              <div class="spinner"></div>
              <p>Exchanging code for access token...</p>
            </div>

            <div class="button-row">
              <button class="btn-secondary" onclick="onboarding.prevStep()">Back</button>
              <button class="btn-primary" onclick="onboarding.exchangeAuthCode()">Continue</button>
            </div>
          </div>

          <!-- Step 5: Fetch Activities -->
          <div class="onboarding-step" data-step="5" style="display: none;">
            <h2>Step 3: Load Your Activities</h2>
            <p id="athlete-welcome"></p>

            <div class="cache-info" id="cache-info" style="display: none;">
              <p><i class="fas fa-check-circle" style="color: #4caf50;"></i> Found cached activities: <strong id="cached-count">0</strong> activities</p>
              <p>Cached <span id="cache-age">0</span> minutes ago</p>
              <button class="btn-secondary" onclick="onboarding.clearCache()">Clear & Re-fetch</button>
            </div>

            <div class="fetch-controls" id="fetch-controls">
              <p>Click below to fetch your activities from Strava.</p>
              <p><small>This may take a minute if you have many activities...</small></p>

              <div class="progress-container" id="fetch-progress" style="display: none;">
                <div class="spinner"></div>
                <p>Fetching activities: <strong id="fetch-count">0</strong></p>
              </div>

              <div id="fetch-error" class="error-message" style="display: none;"></div>

              <button class="btn-primary" id="fetch-btn" onclick="onboarding.fetchActivities()">
                Fetch Activities from Strava
              </button>
            </div>

            <div class="button-row" style="margin-top: 20px;">
              <button class="btn-secondary" onclick="onboarding.startOver()">Start Over</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Make onboarding methods available globally for onclick handlers
    window.onboarding = this;
  }

  /**
   * Show specific step
   */
  showStep(step) {
    // Hide all steps
    document.querySelectorAll('.onboarding-step').forEach(el => {
      el.style.display = 'none';
    });

    // Show current step
    const stepEl = document.querySelector(`[data-step="${step}"]`);
    if (stepEl) {
      stepEl.style.display = 'block';
      this.currentStep = step;
    }

    // Special handling for step 5 (fetch activities)
    if (step === 5) {
      this.initializeStep5();
    }
  }

  /**
   * Next step
   */
  nextStep() {
    this.showStep(this.currentStep + 1);
  }

  /**
   * Previous step
   */
  prevStep() {
    this.showStep(this.currentStep - 1);
  }

  /**
   * Copy text to clipboard
   */
  copyToClipboard(elementId) {
    const el = document.getElementById(elementId);
    const text = el.textContent;

    navigator.clipboard.writeText(text).then(() => {
      // Show temporary success feedback
      const btn = event.target;
      const originalText = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => {
        btn.textContent = originalText;
      }, 2000);
    });
  }

  /**
   * Save credentials and show auth step
   */
  saveCredentialsAndShowAuth() {
    const clientId = document.getElementById('client-id').value.trim();
    const clientSecret = document.getElementById('client-secret').value.trim();
    const errorEl = document.getElementById('credentials-error');

    // Validate
    if (!clientId || !clientSecret) {
      errorEl.textContent = 'Please enter both Client ID and Client Secret';
      errorEl.style.display = 'block';
      return;
    }

    // Validate Client ID is numeric
    if (!/^\d+$/.test(clientId)) {
      errorEl.textContent = 'Client ID should be a number (e.g., 123456)';
      errorEl.style.display = 'block';
      return;
    }

    // Save credentials (request read_all by default, user can deny on Strava page)
    this.auth.saveCredentials(clientId, clientSecret, 'read_all');

    // Show manual auth step
    this.showStep(4);
  }

  /**
   * Open Strava authorization in new window
   */
  openAuthWindow() {
    try {
      const authUrl = this.auth.getAuthorizationUrl();
      window.open(authUrl, '_blank');
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  }

  /**
   * Exchange authorization code for token
   */
  async exchangeAuthCode() {
    const input = document.getElementById('auth-code').value.trim();
    const errorEl = document.getElementById('auth-error');
    const progressEl = document.getElementById('auth-progress');

    if (!input) {
      errorEl.textContent = 'Please paste the URL or authorization code';
      errorEl.style.display = 'block';
      return;
    }

    // Try to extract code and scope from URL if full URL was pasted
    let code = input;
    let grantedScope = 'read'; // Default to read-only

    // Check if input looks like a URL
    if (input.includes('code=')) {
      try {
        // Extract code parameter from URL
        const codeMatch = input.match(/code=([^&]+)/);
        if (codeMatch && codeMatch[1]) {
          code = codeMatch[1];
        } else {
          errorEl.textContent = 'Could not find authorization code in URL. Please paste the full URL from the error page.';
          errorEl.style.display = 'block';
          return;
        }

        // Extract scope parameter to determine what user granted
        const scopeMatch = input.match(/scope=([^&]+)/);
        if (scopeMatch && scopeMatch[1]) {
          const scopeString = decodeURIComponent(scopeMatch[1]);
          // Check if user granted read_all (private activities access) - this is REQUIRED
          if (scopeString.includes('activity:read_all')) {
            grantedScope = 'read_all';
          } else {
            // User didn't grant activity:read_all - this won't work with Strava's API
            errorEl.innerHTML = `
              <strong>Missing Required Permission</strong><br><br>
              You need to grant access to <strong>private activities</strong> for this app to work.<br><br>
              <strong>Important:</strong> Your activities are only shared with your own API - no one else can see them.
              You can control whether private activities appear on your map using the "Include private activities" checkbox in the app.<br><br>
              Please click "Open Strava Authorization" again and make sure to check <strong>both</strong> permission boxes on Strava's page.
            `;
            errorEl.style.display = 'block';
            return;
          }
        }
      } catch (e) {
        errorEl.textContent = 'Could not parse URL. Please paste the full URL from the error page.';
        errorEl.style.display = 'block';
        return;
      }
    }

    try {
      errorEl.style.display = 'none';
      progressEl.style.display = 'block';

      // Save the actual granted scope (what user approved on Strava)
      const { clientId, clientSecret } = this.auth.getCredentials();
      this.auth.saveCredentials(clientId, clientSecret, grantedScope);

      // Exchange code for token
      await this.auth.exchangeCode(code);

      // Success! Move to fetch activities step
      progressEl.style.display = 'none';
      this.showStep(5);

    } catch (error) {
      console.error('Auth code exchange failed:', error);
      errorEl.textContent = `Failed to exchange code: ${error.message}`;
      errorEl.style.display = 'block';
      progressEl.style.display = 'none';
    }
  }

  /**
   * Initialize step 5 (fetch activities)
   */
  initializeStep5() {
    // Show athlete info and scope granted
    const athlete = this.auth.getAthlete();
    const scope = sessionStorage.getItem(this.auth.storageKeys.scope);
    const hasPrivateAccess = scope === 'read_all';

    if (athlete) {
      const scopeMessage = hasPrivateAccess
        ? '<i class="fas fa-lock-open" style="color: #4caf50;"></i> You granted access to <strong>private activities</strong>'
        : '<i class="fas fa-lock" style="color: #666;"></i> You granted access to <strong>public activities only</strong>';

      document.getElementById('athlete-welcome').innerHTML =
        `Welcome, ${athlete.firstname} ${athlete.lastname}! <i class="fas fa-hand-wave" style="color: #fc4c02;"></i><br><small style="color: #666;">${scopeMessage}</small>`;
    }

    // Check for cached activities
    const cacheInfo = this.api.getCacheInfo();
    if (cacheInfo) {
      document.getElementById('cache-info').style.display = 'block';
      document.getElementById('cached-count').textContent = cacheInfo.count;
      document.getElementById('cache-age').textContent = cacheInfo.ageMinutes;

      // Hide fetch controls, show use cached button
      const fetchControls = document.getElementById('fetch-controls');
      fetchControls.innerHTML = `
        <p><i class="fas fa-check-circle" style="color: #4caf50;"></i> You have cached activities ready to use!</p>
        <button class="btn-primary" onclick="onboarding.useCachedActivities()">
          Use Cached Activities (${cacheInfo.count})
        </button>
        <p style="margin-top: 10px;"><small>or</small></p>
      ` + fetchControls.innerHTML;
    }
  }

  /**
   * Fetch activities from Strava
   */
  async fetchActivities() {
    const fetchBtn = document.getElementById('fetch-btn');
    const progressEl = document.getElementById('fetch-progress');
    const countEl = document.getElementById('fetch-count');
    const errorEl = document.getElementById('fetch-error');

    try {
      fetchBtn.disabled = true;
      progressEl.style.display = 'block';
      errorEl.style.display = 'none';

      // Fetch activities
      const activities = await this.api.fetchAllActivities((count) => {
        countEl.textContent = count;
      });

      // Cache activities
      this.api.cacheActivities(activities);

      // Complete onboarding
      this.complete(activities);

    } catch (error) {
      console.error('Failed to fetch activities:', error);
      errorEl.textContent = `Error: ${error.message}`;
      errorEl.style.display = 'block';
      fetchBtn.disabled = false;
      progressEl.style.display = 'none';
    }
  }

  /**
   * Use cached activities
   */
  useCachedActivities() {
    const activities = this.api.getCachedActivities();
    if (activities) {
      this.complete(activities);
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    if (confirm('This will delete your cached activities. Continue?')) {
      this.api.clearCache();
      // Reload step 5
      this.showStep(5);
    }
  }

  /**
   * Start over
   */
  startOver() {
    if (confirm('This will clear all your data and start over. Continue?')) {
      this.auth.clearAll();
      this.api.clearCache();
      this.showStep(1);
    }
  }

  /**
   * Complete onboarding
   */
  complete(activities) {
    this.hide();
    if (this.onComplete) {
      this.onComplete(activities);
    }
  }

  /**
   * Get onboarding CSS
   */
  static getCSS() {
    return `
      .onboarding-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        overflow-y: auto;
        padding: 20px;
      }

      .onboarding-modal {
        background: white;
        border-radius: 12px;
        max-width: 600px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      }

      .onboarding-header {
        background: linear-gradient(135deg, #fc4c02 0%, #e44402 100%);
        color: white;
        padding: 30px;
        text-align: center;
        border-radius: 12px 12px 0 0;
      }

      .onboarding-header h1 {
        margin: 0 0 10px 0;
        font-size: 28px;
      }

      .onboarding-header p {
        margin: 0;
        opacity: 0.9;
      }

      .onboarding-step {
        padding: 30px;
      }

      .onboarding-step h2 {
        margin: 0 0 15px 0;
        font-size: 22px;
        color: #333;
      }

      .onboarding-step p {
        margin: 0 0 15px 0;
        color: #666;
        line-height: 1.6;
      }

      .privacy-notice {
        background: #f0f9ff;
        border: 2px solid #0066cc;
        border-radius: 8px;
        padding: 20px;
        margin: 20px 0;
      }

      .privacy-notice h3 {
        margin: 0 0 10px 0;
        color: #0066cc;
        font-size: 18px;
      }

      .privacy-notice ul {
        margin: 0;
        padding-left: 20px;
      }

      .privacy-notice li {
        margin: 8px 0;
        color: #333;
      }

      .disclaimer-notice {
        background: #fff3cd;
        border: 2px solid #ffc107;
        border-radius: 8px;
        padding: 15px;
        margin: 20px 0;
        text-align: center;
      }

      .disclaimer-notice p {
        margin: 0;
        color: #856404;
        line-height: 1.4;
      }

      .instructions {
        background: #f5f5f5;
        border-radius: 8px;
        padding: 20px;
        margin: 20px 0;
      }

      .instructions ol {
        margin: 0;
        padding-left: 20px;
      }

      .instructions li {
        margin: 12px 0;
        line-height: 1.6;
      }

      .instructions ul {
        margin: 8px 0;
        padding-left: 20px;
      }

      .instructions code {
        background: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-family: monospace;
        font-size: 13px;
        border: 1px solid #ddd;
      }

      .btn-copy {
        background: #0066cc;
        color: white;
        border: none;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        cursor: pointer;
        margin-left: 8px;
      }

      .btn-copy:hover {
        background: #0052a3;
      }

      .form-group {
        margin: 20px 0;
      }

      .form-group label {
        display: block;
        margin-bottom: 8px;
        font-weight: 600;
        color: #333;
      }

      .form-group input {
        width: 100%;
        padding: 10px;
        border: 2px solid #ddd;
        border-radius: 6px;
        font-size: 14px;
        box-sizing: border-box;
      }

      .form-group input:focus {
        outline: none;
        border-color: #fc4c02;
      }

      .form-group small {
        display: block;
        margin-top: 5px;
        color: #999;
        font-size: 12px;
      }

      .btn-primary, .btn-secondary {
        padding: 12px 24px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn-primary {
        background: #fc4c02;
        color: white;
        width: 100%;
      }

      .btn-primary:hover:not(:disabled) {
        background: #e44402;
      }

      .btn-primary:disabled {
        background: #ccc;
        cursor: not-allowed;
      }

      .btn-secondary {
        background: #666;
        color: white;
      }

      .btn-secondary:hover {
        background: #555;
      }

      .button-row {
        display: flex;
        gap: 10px;
        margin-top: 20px;
      }

      .button-row button {
        flex: 1;
      }

      .spinner {
        border: 3px solid #f3f3f3;
        border-top: 3px solid #fc4c02;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
        margin: 20px auto;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .error-message {
        background: #fee;
        border: 1px solid #fcc;
        color: #c33;
        padding: 12px;
        border-radius: 6px;
        margin: 15px 0;
      }

      .cache-info {
        background: #e8f5e9;
        border: 2px solid #4caf50;
        border-radius: 8px;
        padding: 15px;
        margin: 15px 0;
      }

      .cache-info p {
        margin: 5px 0;
        color: #2e7d32;
      }

      .progress-container {
        text-align: center;
        margin: 20px 0;
      }

      .progress-container p {
        margin-top: 10px;
      }
    `;
  }
}
