# Using the App on Cloudflare Pages

## 🌍 Live URL

**https://strava-gif.pages.dev**

---

## 🚀 Quick Start Guide

### Step 1: Create Your Strava API App

1. Go to https://www.strava.com/settings/api
2. Scroll to "My API Application"
3. Fill in the form:
   - **Application Name:** "My Activity Map" (or any name you want)
   - **Category:** "Visualizer"
   - **Club:** Leave blank
   - **Website:** `http://localhost:9999`
   - **Authorization Callback Domain:** `localhost:9999`
4. Click "Create"
5. **Copy your Client ID and Client Secret**

### Step 2: Visit the App

Go to **https://strava-gif.pages.dev**

### Step 3: Enter Your Credentials

1. Click "Get Started"
2. Go through the onboarding wizard
3. Enter your **Client ID** and **Client Secret** (from Step 1)
4. Click "Next"

### Step 4: Manual Authorization

**This is the key part!**

1. Click **"Open Strava Authorization"** button
   - Opens Strava in a NEW TAB

2. On the Strava page, click **"Authorize"**
   - Strava will try to redirect to `http://localhost:9999/exchange_token?code=...`
   - Your browser will show an error page (this is expected!)

3. **Copy the entire URL from your browser's address bar**
   - It should look like: `http://localhost:9999/exchange_token?code=abc123def456...&scope=...`
   - Just copy the whole thing - don't worry about finding the code!

4. **Paste it back in the app**
   - Go back to the strava-gif.pages.dev tab
   - Paste the entire URL in the text field
   - We'll automatically extract the authorization code for you
   - Click "Continue"

### Step 5: Fetch Your Activities

1. Click "Fetch Activities from Strava"
2. Wait while it loads (may take a minute for many activities)
3. Your activities will be cached in your browser session

### Step 6: Create & Export GIFs!

1. View your activities on the map
2. Play the animation
3. Configure export settings (date range, dimensions, FPS)
4. Click "Export GIF"
5. Wait for it to process
6. Download your GIF!

---

## 🔒 Privacy

**Everything happens in your browser:**
- ✅ Your credentials stored in sessionStorage only
- ✅ Activities cached in your browser
- ✅ GIF processing done client-side
- ✅ Nothing sent to our servers (we don't have servers!)
- ✅ Close browser = all data cleared

---

## ❓ FAQ

### Why do I see an error page during authorization?

**This is expected!** The manual OAuth flow intentionally uses a dummy URL (`localhost:9999`) that doesn't exist. This is so you can copy the authorization code without needing any redirect URI configuration.

### Do I need to configure my Strava API app with strava-gif.pages.dev?

**No!** That's the beauty of the manual flow. Your Strava API app can be configured with ANY callback domain (we use `localhost:9999`). The app works regardless of what domain it's hosted on.

### Can I use my existing Strava API app?

**Yes!** If you already have a Strava API app for another project, you can use those same credentials. The manual OAuth flow doesn't interfere with your existing setup.

### How long does the authorization code last?

About 10 minutes. If you take too long to paste it, just click "Open Strava Authorization" again to get a fresh code.

### What if the code doesn't work?

Common issues:
- Code expired (>10 minutes old) → Get a new code
- Code already used → Get a new code
- Wrong Client ID/Secret → Double-check credentials
- Didn't copy the full URL → Copy the entire URL from the address bar

### Can I use this on mobile?

Yes! The manual OAuth flow works on mobile too:
1. Open the app on mobile
2. Click "Open Strava Authorization"
3. Authorize on Strava
4. Tap the URL bar and select all
5. Long-press to copy the entire URL
6. Paste it back in the app (we'll extract the code automatically)

---

## 🎬 Example Authorization URL

When you click "Open Strava Authorization", Strava will redirect to something like:

```
http://localhost:9999/exchange_token?code=1a2b3c4d5e6f7g8h9i0j&scope=read,activity:read_all
```

**What to copy:**
Just copy the entire URL above and paste it into the app. We'll automatically extract the code (`1a2b3c4d5e6f7g8h9i0j`) for you!

---

## 🔄 Data Persistence

### During Your Session
- ✅ Credentials stored (sessionStorage)
- ✅ Activities cached (sessionStorage/localStorage)
- ✅ Can export multiple GIFs
- ✅ Can refresh activities

### After You Close the Browser
- ❌ Credentials cleared
- ❌ Activities cleared
- ❌ Need to re-authorize next time

**This is intentional for privacy!**

---

## 🎨 Tips

### Export Quality

For best results:
- **Dimensions:** 1200x800 (good balance)
- **Duration:** 10 seconds
- **FPS:** 15 (balanced) or 20 (smoother)
- **Date range:** Pick a specific timeframe (not all-time)

### Performance

- The more activities, the longer the fetch
- Larger GIFs take longer to export
- Use Chrome or Edge for best performance
- Close other tabs during GIF export

### Caching

- Activities are cached after first fetch
- Click "Refresh Activities" to update
- Clear cache by closing the browser

---

## ⚠️ Disclaimer

**This project is not affiliated with, endorsed by, or connected to Strava, Inc. in any way.**

This is an independent, open-source visualization tool that uses the public Strava API.

---

## 🐛 Troubleshooting

### "Invalid authorization code"

The code may have expired or been used. Click "Open Strava Authorization" again.

### "Token exchange failed"

Check your Client ID and Client Secret are correct. Make sure you copied the entire code.

### "Failed to fetch activities"

Check the browser console for errors. Your access token may have expired - re-authorize.

### GIF export hangs

Try reducing the duration, FPS, or dimensions. Close other browser tabs.

---

## 💡 Advanced Usage

### Downloading Activities JSON

You can download your activities as a JSON file for backup:
- (Feature not yet implemented, but possible to add)

### Importing Activities

You can import previously downloaded activities:
- (Feature not yet implemented, but possible to add)

### Custom Export Settings

Experiment with different combinations:
- **Short & Sharp:** 5 seconds, 30 FPS, 800x600
- **Smooth & Long:** 15 seconds, 20 FPS, 1200x800
- **High Quality:** 10 seconds, 30 FPS, 1920x1080

---

## 🎉 Enjoy!

Create beautiful animated GIFs of your fitness journey!

Share them on social media, use them in presentations, or just enjoy watching your progress over time.

**Have fun!** 🏃‍♂️🚴‍♀️🏊‍♂️
