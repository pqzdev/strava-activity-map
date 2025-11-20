# Strava Activity Map Visualizer

Visualize and animate your Strava activities on an interactive map. Export beautiful animated GIFs showing your fitness journey over time!

**🔒 100% Privacy-First**: Runs entirely in your browser. No data sent to any server. You use your own Strava API credentials.

**🌍 Live Demo**: [https://strava-gif.pages.dev](https://strava-gif.pages.dev)

**⚠️ Disclaimer**: This project is not affiliated with, endorsed by, or connected to Strava, Inc. in any way. This is an independent, open-source visualization tool that uses the public Strava API.

![Example animation](example.gif)

## ✨ Features

- **🗺️ Interactive Map Visualization** - View all your activities on a dynamic map
- **⏱️ Time-based Animation** - Watch your activities appear chronologically
- **🎨 Activity Type Colors** - Different colors for runs, rides, walks, etc.
- **📊 Smart Heatmap** - Final frame shows your most-traveled routes
- **🎬 GIF Export** - Export animations as high-quality animated GIFs
- **🔒 Privacy-First** - All processing happens in your browser
- **💾 Session Cache** - Data cached locally (cleared on browser close)
- **🚫 No Backend Required** - Deploy to free static hosting

---

## 🚀 Quick Start

### For Users (Deployed Site)

1. Visit the deployed site
2. Click "Get Started"
3. Create your Strava API app (guided step-by-step)
4. Enter your Client ID and Secret
5. Authorize with Strava
6. Fetch your activities
7. Watch the animation and export GIFs!

**Everything runs in your browser. Your credentials and data never leave your device.**

### For Developers (Local Development)

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Open http://localhost:5173
```

**Note:** For local OAuth to work, create a Strava API app with callback domain `localhost`.

---

## 🏗️ Architecture

This is a **fully static website** with no backend:

```
User's Browser ←→ Strava API
      ↓
  sessionStorage (credentials + activities)
      ↓
  gif.js + html2canvas (GIF export)
```

**Client-Side Components:**

- `StravaAuth.js` - OAuth flow & credential management
- `StravaAPI.js` - Fetch activities from Strava API
- `OnboardingUI.js` - Step-by-step setup wizard
- `AnimationController.js` - Map animation engine
- `GifExporter.js` - Browser-based GIF generation

**Key Libraries:**

- [Leaflet](https://leafletjs.com/) - Interactive maps
- [gif.js](https://github.com/jnordberg/gif.js) - Client-side GIF encoding
- [html2canvas](https://html2canvas.hertzen.com/) - Map capture
- [Vite](https://vitejs.dev/) - Build tool

---

## 📋 Strava API Setup

Users need their own Strava API application (takes ~2 minutes):

### Step 1: Create API App

1. Go to [Strava API Settings](https://www.strava.com/settings/api)
2. Scroll to "My API Application"
3. Fill in the form:
   - **Application Name**: "My Activity Map"
   - **Category**: "Visualizer"
   - **Website**: Your deployed URL
   - **Authorization Callback Domain**: Your domain (e.g., `yourusername.github.io`)
4. Click "Create"

### Step 2: Get Credentials

You'll see your **Client ID** (a number) and **Client Secret** (a long string). Keep these handy!

### Step 3: Use the App

Enter these credentials in the app's onboarding wizard. That's it!

---

## 🚀 Deployment

Deploy this as a **static website** to any CDN. No server required!

### Cloudflare Pages (Recommended - This Repo)

This repository is deployed to Cloudflare Pages:

```bash
# One-command deploy
npm run deploy
```

**Live at:** https://strava-gif.pages.dev

See [CLOUDFLARE_DEPLOYMENT.md](CLOUDFLARE_DEPLOYMENT.md) for detailed instructions.

### GitHub Pages (Alternative)

```bash
npm install --save-dev gh-pages
npm run build
npx gh-pages -d dist
```

Your site: `https://yourusername.github.io/strava-activity-map`

### Netlify (Popular & Simple)

```bash
npm install -g netlify-cli
npm run build
netlify deploy --prod
```

Your site: `https://your-app.netlify.app`

### Vercel (Modern Platform)

```bash
npm install -g vercel
vercel
```

Your site: `https://strava-activity-map.vercel.app`

**See [STATIC_DEPLOYMENT.md](STATIC_DEPLOYMENT.md) for detailed deployment guide.**

---

## 🔒 Privacy & Security

### What Gets Stored (All Client-Side)

**In sessionStorage** (auto-cleared when tab closes):
- Strava Client ID & Client Secret
- OAuth access & refresh tokens
- Fetched activities data

**What NEVER happens:**
- ❌ No data sent to any backend server (there is no server!)
- ❌ No credentials stored permanently
- ❌ No tracking or analytics (unless you add them)
- ❌ No user accounts or databases

### Data Flow

```
1. User enters credentials → sessionStorage
2. OAuth redirect → Strava → Back to browser
3. Fetch activities → Direct from Strava API
4. Process & animate → In-browser (Leaflet.js)
5. Export GIF → In-browser (gif.js)
6. Close browser → All data deleted
```

---

## 📦 Build & Development

```bash
# Install dependencies
npm install

# Run dev server (with hot reload)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

**Legacy Node.js scripts** (not used in deployed app):
```bash
# Authenticate (creates .tokens file locally)
npm run auth

# Fetch activities to local JSON file
npm run fetch
```

---

## 🎨 Customization

### Change Colors

Edit activity type colors in [src/main.js](src/main.js:22-29):

```javascript
const ACTIVITY_COLORS = {
  'Run': '#fc4c02',      // Strava orange
  'Ride': '#0066cc',     // Blue
  'Swim': '#00cccc',     // Cyan
  // ... add more
};
```

### Customize Onboarding

Edit the wizard in [src/ui/OnboardingUI.js](src/ui/OnboardingUI.js) to change:
- Welcome message
- Step instructions
- Privacy notice
- Styling

### Add Analytics

Add your tracking code to [index.html](index.html) (e.g., Google Analytics, Plausible).

---

## 🐛 Troubleshooting

### "OAuth authorization failed"

- ✅ Double-check Client ID and Secret
- ✅ Verify callback domain matches exactly (no `http://` or trailing `/`)
- ✅ Make sure you're visiting the URL you configured

### "Failed to fetch activities"

- ✅ Check browser console for errors
- ✅ Ensure OAuth succeeded (check sessionStorage in DevTools)
- ✅ Strava rate limits: 100 req/15min, 1000 req/day

### "sessionStorage full"

- ✅ App automatically falls back to localStorage
- ✅ If you have 10,000+ activities, may hit browser limits
- ✅ Try filtering to a shorter date range

### GIF export is slow or fails

- ✅ Reduce duration (e.g., 5 seconds instead of 10)
- ✅ Lower frame rate (10 FPS instead of 15)
- ✅ Smaller dimensions (800x600 instead of 1200x800)
- ✅ Use Chrome or Edge (best Canvas performance)

---

## 📂 Project Structure

```
strava-activity-map/
├── src/
│   ├── auth/
│   │   └── StravaAuth.js          # OAuth & session management
│   ├── api/
│   │   └── StravaAPI.js           # Strava API client
│   ├── ui/
│   │   └── OnboardingUI.js        # Setup wizard
│   ├── animation/
│   │   └── AnimationController.js # Map animation
│   ├── export/
│   │   └── GifExporter.js         # GIF generation
│   ├── utils/
│   │   └── polyline.js            # Polyline decoding
│   └── main.js                    # App entry point
├── public/
│   └── gif.worker.js              # GIF encoder worker
├── index.html                     # Single page app
├── vite.config.js                 # Build config
└── package.json
```

---

## 🙏 Credits

- **Strava API** for activity data
- **OpenStreetMap** & **CARTO** for map tiles
- **Leaflet** for mapping library
- **gif.js** for browser-based GIF encoding

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file

---

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.

**Ideas for contributions:**
- Import from GPX/FIT files (no Strava account needed)
- More activity type colors
- Custom color themes
- Video export (WebM/MP4)
- Heatmap mode
- 3D terrain visualization

---

## ⭐ Star this repo if you find it useful!

Questions? Open an issue on GitHub.
