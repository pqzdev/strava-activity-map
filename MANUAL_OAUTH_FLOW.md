# Manual OAuth Flow

## Overview

This app uses a **manual OAuth flow** to avoid any redirect URI configuration issues. Users don't need to configure any specific callback domain in their Strava API app.

## How It Works

### Traditional OAuth Flow (Not Used)
```
1. User clicks "Authorize"
2. Redirected to Strava
3. Strava redirects back to your app
4. App exchanges code for token
```

**Problem:** Requires matching redirect URI in Strava API app settings.

### Manual OAuth Flow (Our Approach)
```
1. User clicks "Open Strava Authorization" button
2. Opens Strava in NEW TAB
3. User clicks "Authorize" on Strava
4. Strava redirects to http://localhost:9999/exchange_token (dummy URL)
5. Browser shows error page (expected!)
6. User copies code from URL bar
7. User pastes code back in our app
8. App exchanges code for token
```

**Benefit:** No redirect URI configuration needed! Works with ANY Strava API app.

---

## User Flow

### Step 1: Get Credentials
User creates a Strava API app (any callback domain works - we use `localhost:9999` dummy URL).

### Step 2: Enter Credentials
User enters their Client ID and Client Secret in the app.

### Step 3: Manual Authorization

**In the app:**
- Click "Open Strava Authorization"
- New tab opens with Strava auth page

**In Strava tab:**
- Click "Authorize"
- Browser tries to redirect to `http://localhost:9999/exchange_token?code=ABC123...`
- Shows error page (localhost:9999 not running - that's OK!)

**Copy the entire URL:**
```
URL: http://localhost:9999/exchange_token?code=1a2b3c4d5e6f7g8h9i0j&scope=read,activity:read_all
     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
     Copy the whole thing!
```

**Back in the app:**
- Paste the entire URL
- Click "Continue"
- App automatically extracts the code and exchanges it for access token
- Success!

---

## Implementation Details

### StravaAuth.js

**Get Authorization URL:**
```javascript
getAuthorizationUrl() {
  const { clientId } = this.getCredentials();
  const redirectUri = 'http://localhost:9999/exchange_token'; // Dummy URL
  const scope = 'read,activity:read_all';

  return `https://www.strava.com/oauth/authorize?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `approval_prompt=force&` +
    `scope=${scope}`;
}
```

**Exchange Code for Token:**
```javascript
async exchangeCode(code) {
  const { clientId, clientSecret } = this.getCredentials();

  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      grant_type: 'authorization_code'
    })
  });

  const data = await response.json();
  this.saveTokens(data);
  return data;
}
```

### OnboardingUI.js

**Open Auth Window:**
```javascript
openAuthWindow() {
  const authUrl = this.auth.getAuthorizationUrl();
  window.open(authUrl, '_blank');
}
```

**Exchange Code:**
```javascript
async exchangeAuthCode() {
  const code = document.getElementById('auth-code').value.trim();
  await this.auth.exchangeCode(code);
  this.showStep(5); // Proceed to fetch activities
}
```

---

## Why This Approach?

### Problem We Solved

You have an existing Strava API app configured for a different project. Changing the redirect URI would break that project.

**Traditional solutions:**
- ❌ Create a second Strava API app (extra complexity)
- ❌ Update existing app's redirect URI (breaks other project)
- ❌ Configure multiple redirect URIs (Strava only allows one!)

**Our solution:**
- ✅ Use ANY Strava API app (yours or theirs)
- ✅ No redirect URI configuration needed
- ✅ Works locally without localhost setup
- ✅ Works on any domain (production, preview, localhost)

### Benefits

1. **Zero Configuration**
   - User can use their existing API app
   - No need to match redirect URIs
   - No localhost server required

2. **Universal Compatibility**
   - Works on any domain
   - Works with any Strava API app
   - No environment detection needed

3. **Privacy-First**
   - User manually controls the auth flow
   - Clear what's happening at each step
   - No automatic redirects

4. **Debugging-Friendly**
   - Easy to see the authorization code
   - Can retry if something fails
   - Clear error messages

---

## Security

### Is This Secure?

**Yes!** The manual flow is just as secure as traditional OAuth:

1. **Authorization Code is Short-Lived**
   - Expires in ~10 minutes
   - Can only be used once
   - Must be exchanged with Client Secret

2. **Client Secret Required**
   - Code alone is useless without the secret
   - Secret stored in sessionStorage only
   - Never exposed in URLs

3. **Tokens Stored Safely**
   - sessionStorage (cleared on browser close)
   - Never sent to any server
   - HTTPS in production

### What If Someone Steals the Code?

They also need:
- Your Client Secret (in sessionStorage)
- To exchange it within ~10 minutes
- To exchange it before you do (codes are single-use)

In practice, this is no less secure than automatic redirects.

---

## Comparison

| Feature | Traditional OAuth | Manual OAuth (Ours) |
|---------|------------------|---------------------|
| Redirect URI Required | Yes, must match exactly | No, uses dummy URL |
| Localhost Setup | Yes, for local dev | No, works anywhere |
| Multiple Apps Support | No, one redirect per app | Yes, any app works |
| User Experience | Automatic (1 click) | Manual (copy-paste code) |
| Configuration | Medium complexity | Zero configuration |
| Error Prone | Yes (redirect mismatches) | No (no redirects) |
| Privacy | Automatic redirects | User controls flow |

---

## Troubleshooting

### "Invalid authorization code"

- Code may have expired (>10 minutes old)
- Code may have been used already
- **Solution:** Click "Open Strava Authorization" again to get a fresh code

### "Token exchange failed"

- Check Client ID and Secret are correct
- Make sure you copied the entire code
- **Solution:** Verify credentials, try again

### Can't find the code in URL

The URL should look like:
```
http://localhost:9999/exchange_token?code=ABC123...&scope=read,activity:read_all
```

Copy everything between `code=` and `&scope` (or end of URL if no `&`).

---

## Future Improvements

### ✅ URL Parser (Implemented!)

The app now automatically extracts the authorization code from the full URL! Users can paste the entire URL and we'll parse it for them:

```javascript
// Already implemented in OnboardingUI.js
if (input.includes('code=')) {
  const match = input.match(/code=([^&]+)/);
  if (match && match[1]) {
    code = match[1];
  }
}
```

This makes the flow even easier - no need to find the code manually!

### Optional: Add QR Code

For mobile users, we could generate a QR code of the auth URL:

```javascript
import QRCode from 'qrcode';

function showAuthQR() {
  const authUrl = auth.getAuthorizationUrl();
  QRCode.toCanvas(authUrl, (err, canvas) => {
    document.body.appendChild(canvas);
  });
}
```

Users scan QR code on phone, authorize, then manually enter code on desktop.

---

## Strava API Compliance

### Does This Follow Strava's Guidelines?

**Yes!** Strava's OAuth 2.0 documentation supports manual code entry:

> "The authorization code can be extracted from the redirect URL and exchanged for an access token."

Our approach:
1. User authorizes (required by Strava)
2. User receives authorization code (standard OAuth)
3. App exchanges code for token (standard OAuth)
4. Token used to access API (standard OAuth)

The only difference is HOW the code gets from Strava to our app (manual copy-paste vs automatic redirect). Both are valid OAuth flows.

---

## Summary

✅ **No redirect URI configuration needed**
✅ **Works with any Strava API app**
✅ **No localhost server required**
✅ **Secure (same as traditional OAuth)**
✅ **User controls the flow**
✅ **Easy to debug**
✅ **Strava API compliant**

This manual OAuth flow eliminates all redirect URI configuration headaches while maintaining full security and OAuth compliance!
