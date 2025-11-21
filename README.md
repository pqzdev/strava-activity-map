# Strava Activity Map Visualizer

Visualize and animate your Strava activities on an interactive map. Export beautiful animated GIFs showing your fitness journey over time!

**🔒 100% Privacy-First**: Runs entirely in your browser using manual OAuth. No backend server. You use your own Strava API credentials.

**🌍 Live Demo**: [https://strava-gif.pages.dev](https://strava-gif.pages.dev)

**⚠️ Disclaimer**: This project is not affiliated with, endorsed by, or connected to Strava, Inc. in any way. This is an independent, open-source visualization tool that uses the public Strava API.

![Example animation](example.gif)

---

## ✨ Features

### Core Functionality
- **🗺️ Interactive Map Visualization** - View all your activities on a dynamic map with Leaflet
- **⏱️ Time-based Animation** - Watch your activities appear chronologically over time
- **🎨 Multi-Color Schemes** - Choose from 5 built-in color themes (Strava, Sunset, Ocean, Forest, Monochrome)
- **🎬 High-Quality GIF Export** - Export animations with custom dimensions, FPS, and date ranges
- **📱 Capture Presets** - Quick aspect ratios (Square, Vertical/Horizontal phone, Free drag)
- **🎯 Flexible Capture Box** - Visual capture area with shaded overlay for precise framing
- **🔄 Activity Type Filtering** - Show/hide specific activity types (Run, Ride, Swim, etc.)
- **📊 Real-time Stats** - Activity count, total distance, and activity type breakdown

### Privacy & Security
- **🔒 100% Client-Side** - All processing happens in your browser
- **🔐 Manual OAuth Flow** - Secure authorization without redirect server
- **💾 Session Storage** - Credentials and data auto-clear when tab closes
- **🚫 No Backend** - Deploy as static site to any CDN
- **🔓 Open Source** - Audit the code yourself

### User Experience
- **🧭 Guided Onboarding** - Step-by-step setup wizard
- **📍 Smart Map Positioning** - Auto-fits all your activities or restores from URL
- **💡 Helpful Instructions** - Interactive popup explaining all features
- **♻️ Refresh Activities** - Re-fetch from Strava anytime
- **🚪 Logout Function** - Clear all data with one click

---

## 🚀 Quick Start

### For End Users (Using Deployed Site)

1. **Visit** [https://strava-gif.pages.dev](https://strava-gif.pages.dev)
2. **Create Strava API App** (guided in app, takes 1-2 minutes):
   - Go to [Strava API Settings](https://www.strava.com/settings/api)
   - Fill in form with provided values
   - Get your Client ID and Secret
3. **Authorize** - Follow manual OAuth flow (copy/paste callback URL)
4. **Explore** - Your activities appear on the map!
5. **Export GIFs** - Customize and download animated GIFs

**Everything runs in your browser. Your credentials and data never leave your device.**

### For Developers (Local Development)

```bash
# Clone the repository
git clone https://github.com/pqzdev/strava-activity-map.git
cd strava-activity-map

# Install dependencies
npm install

# Run development server
npm run dev
# Opens at http://localhost:5173

# Build for production
npm run build

# Preview production build
npm run preview
```

**Strava API Setup for Local Dev:**
- Create Strava API app with:
  - Website: `http://localhost:9999`
  - Callback Domain: `localhost:9999`

---

## 🏗️ Architecture

### System Design

This is a **fully static single-page application** with no backend server:

```
┌─────────────────┐
│  User's Browser │
│                 │
│  ┌───────────┐  │
│  │sessionStorage│ ←─ Credentials, tokens, activities
│  └───────────┘  │
│                 │
│  ┌───────────┐  │
│  │  Leaflet  │  │ ←─ Map rendering
│  └───────────┘  │
│                 │
│  ┌───────────┐  │
│  │  gif.js   │  │ ←─ GIF encoding (Web Worker)
│  └───────────┘  │
└────────┬────────┘
         │
         │ HTTPS (direct API calls)
         ↓
   ┌─────────────┐
   │ Strava API  │
   └─────────────┘
```

### Key Components

**Authentication & Data (`/src/auth`, `/src/api`):**
- `StravaAuth.js` - Manual OAuth flow, credential management
- `StravaAPI.js` - Strava API client, activity fetching with pagination
- `OnboardingUI.js` - Multi-step setup wizard with visual styling

**Visualization (`/src/animation`):**
- `AnimationController.js` - Time-based activity animation engine
- Supports play/pause, speed control, timeline scrubbing
- Real-time date display and progress tracking

**Export (`/src/export`):**
- `GifExporter.js` - Browser-based GIF generation
- Uses html2canvas for map capture
- gif.js Web Worker for encoding (doesn't block UI)
- Custom dimensions, FPS, duration, date ranges

**Utilities (`/src/utils`):**
- `polyline.js` - Google Polyline decoding (Strava's format)

### Technology Stack

- **[Vite](https://vitejs.dev/)** - Build tool & dev server (fast HMR)
- **[Leaflet](https://leafletjs.com/)** - Interactive maps
- **[CARTO](https://carto.com/)** - Map tiles (light gray style)
- **[gif.js](https://github.com/jnordberg/gif.js)** - Client-side GIF encoding
- **[html2canvas](https://html2canvas.hertzen.com/)** - DOM-to-Canvas rendering
- **[Font Awesome](https://fontawesome.com/)** - Icons

---

## 📋 Strava API Setup (Step-by-Step)

Users need their own Strava API application. The app guides them through this:

### Step 1: Create API Application

1. Visit [Strava API Settings](https://www.strava.com/settings/api)
2. Scroll to "My API Application"
3. Fill in the form:
   - **Application Name**: `My Activity Map` (or any name)
   - **Category**: `Visualizer` (recommended)
   - **Club**: Leave blank
   - **Website**: `http://localhost:9999` (for manual OAuth)
   - **Authorization Callback Domain**: `localhost:9999`
4. Click **Create**

### Step 2: Get Credentials

After creation, you'll see:
- **Client ID**: A number (e.g., `123456`)
- **Client Secret**: A long string (e.g., `abc123def456...`)

Copy these - you'll enter them in the app.

### Step 3: Authorize

The app uses **manual OAuth flow**:
1. Click "Open Strava Authorization" (opens new tab)
2. **IMPORTANT**: You must grant "View data about your private activities" permission
   - Strava requires this to access ANY activities (public or private)
   - You can control visibility in the app later
3. Click "Authorize" on Strava's page
4. Browser shows error page - **this is expected!**
5. Copy the entire URL from address bar
6. Paste into the app - it extracts the authorization code automatically
7. App exchanges code for access token

### Step 4: Fetch Activities

Click "Fetch Activities from Strava":
- Fetches all your activities via API
- Shows progress (activities fetched so far)
- Caches in sessionStorage (clears on tab close)
- Typically takes 10-60 seconds depending on activity count

---

## 🚀 Deployment

Deploy as a **static website** to any CDN. No server configuration needed!

### Cloudflare Pages (Recommended - Production)

This repository is deployed to Cloudflare Pages at [https://strava-gif.pages.dev](https://strava-gif.pages.dev)

**Deploy via CLI:**
```bash
# Install Wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy
npm run deploy
# or: wrangler pages deploy dist
```

**Deploy via Dashboard:**
1. Push to GitHub
2. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
3. Pages → Create project → Connect to Git
4. Select repository
5. Build settings:
   - **Build command**: `npm run build`
   - **Build output**: `dist`
6. Deploy!

**Benefits:**
- ✅ Free tier: Unlimited requests, 500 builds/month
- ✅ Global CDN with 300+ locations
- ✅ Automatic HTTPS
- ✅ Instant cache invalidation
- ✅ Git integration (auto-deploy on push)

See [CLOUDFLARE_DEPLOYMENT.md](CLOUDFLARE_DEPLOYMENT.md) for detailed guide.

### GitHub Pages

```bash
# Install gh-pages
npm install --save-dev gh-pages

# Build and deploy
npm run build
npx gh-pages -d dist
```

Your site: `https://yourusername.github.io/strava-activity-map`

**Configure Strava API:**
- Website: `https://yourusername.github.io`
- Callback: `yourusername.github.io`

### Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
npm run build
netlify deploy --prod --dir=dist
```

Or connect your GitHub repo in Netlify dashboard for auto-deploys.

### Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel
```

Or import from GitHub in Vercel dashboard.

### Any Static Host

Build and upload `dist` folder to:
- AWS S3 + CloudFront
- Google Cloud Storage
- Azure Static Web Apps
- Surge.sh
- Render
- Firebase Hosting

---

## 🔒 Privacy & Security

### Data Storage (Client-Side Only)

**Stored in sessionStorage** (auto-cleared when tab closes):
- Strava Client ID & Client Secret
- OAuth access token & refresh token
- Athlete profile (name, ID)
- Fetched activities data (polylines, timestamps, metadata)

**Never stored:**
- ❌ No permanent storage (localStorage is not used)
- ❌ No cookies
- ❌ No server-side storage
- ❌ No analytics or tracking (by default)

### Data Flow

```
1. User creates Strava API app → Gets credentials
2. User enters credentials → Stored in sessionStorage
3. User authorizes → Manual OAuth (copy/paste URL)
4. App exchanges code → Gets access token from Strava
5. App fetches activities → Direct from Strava API to browser
6. App renders map → Client-side with Leaflet.js
7. User exports GIF → Generated in-browser with gif.js
8. User closes tab → All sessionStorage cleared automatically
```

### Security Best Practices

**What the app does:**
- ✅ Uses HTTPS for all API calls
- ✅ Never sends credentials to any server (there is no server!)
- ✅ Clears sensitive data on logout
- ✅ Uses sessionStorage (not localStorage)
- ✅ Open source (audit the code)

**What users should know:**
- 🔐 Your Client Secret is sensitive - don't share it
- 🔐 Anyone with your credentials can access your Strava data
- 🔐 Strava rate limits: 100 requests/15min, 1000 requests/day
- 🔐 Refresh tokens expire after 6 hours (Strava limitation)
- 🔐 App does NOT store or transmit your data anywhere

---

## 🎨 Features In Detail

### Color Schemes

Choose from 5 professionally designed themes:

1. **Strava** - Official Strava colors (orange, blue, cyan, green, brown)
2. **Sunset** - Warm palette (orange, yellow, red, coral)
3. **Ocean** - Cool palette (blues, teals, navy)
4. **Forest** - Nature palette (greens, browns, earth tones)
5. **Monochrome** - Grayscale (black, grays, for minimalist look)

Each scheme has activity type-specific colors that maintain visual distinction.

### Capture Box

Visual framing for GIF exports:

- **Aspect Ratio Presets**:
  - Max - Entire visible map
  - Square - 1:1 (Instagram posts)
  - Vertical - 9:16 (Instagram stories, TikTok)
  - Horizontal - 16:9 (YouTube, presentations)
  - Free - Drag to any size/ratio

- **Visual Overlay**: Shades area outside capture box for precise framing
- **Handles**: Drag corners to resize in Free mode

### Animation Controls

- **Play/Pause**: Watch activities appear chronologically
- **Timeline Slider**: Scrub to any point in time
- **Speed Control**: 1-100 days per second (adjustable while playing)
- **Date Display**: Shows current date in animation
- **Reset**: Jump back to start

### Activity Filtering

- **"All" Toggle**: Select/deselect all activity types
- **Individual Types**: Click pills to show/hide (Run, Ride, Swim, Walk, etc.)
- **Visual Feedback**: Selected pills highlighted in Strava orange
- **Real-time Updates**: Map and stats update immediately

### GIF Export

- **Date Range**: Export specific time periods (start/end date pickers)
- **Custom Dimensions**: Width 400-3840px, Height 300-2160px
- **Frame Rate**: 10/15/20/30 FPS (higher = smoother but larger file)
- **Duration**: 1-60 seconds
- **Size Estimate**: Real-time file size prediction
- **Progress Bar**: Visual feedback during generation
- **Download Link**: Direct download when complete

---

## 📦 Development

### Project Structure

```
strava-activity-map/
├── src/
│   ├── auth/
│   │   └── StravaAuth.js          # OAuth & session management
│   ├── api/
│   │   └── StravaAPI.js           # Strava API client
│   ├── ui/
│   │   └── OnboardingUI.js        # Setup wizard (5 steps)
│   ├── animation/
│   │   └── AnimationController.js # Time-based animation engine
│   ├── export/
│   │   └── GifExporter.js         # GIF generation with gif.js
│   ├── utils/
│   │   └── polyline.js            # Polyline decoding utility
│   └── main.js                    # App initialization & UI logic
├── public/
│   └── gif.worker.js              # GIF encoder Web Worker
├── experiments/
│   ├── gif-size-estimation.md     # GIF size experiment protocol
│   └── run-gif-size-tests.js      # Automated testing script
├── index.html                     # Single page app
├── vite.config.js                 # Vite build configuration
├── package.json                   # Dependencies & scripts
├── CLOUDFLARE_DEPLOYMENT.md       # Cloudflare Pages guide
└── README.md                      # This file
```

### npm Scripts

```bash
# Development
npm run dev          # Start dev server (localhost:5173)
npm run build        # Build for production (outputs to dist/)
npm run preview      # Preview production build locally

# Deployment
npm run deploy       # Deploy to Cloudflare Pages (requires wrangler)

# Legacy scripts (not used in browser app)
npm run auth         # CLI authentication (creates .tokens file)
npm run fetch        # CLI activity fetch (creates activities.json)
```

### Environment Variables

None required! The app uses manual OAuth, so no environment variables or `.env` files are needed.

### Browser Compatibility

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Opera 76+

**Required browser features:**
- ES2020+ JavaScript
- Web Workers
- Canvas API
- Fetch API
- sessionStorage

---

## 🐛 Troubleshooting

### OAuth / Authorization Issues

**"You need to grant access to view activities"**
- Strava requires "View data about your private activities" permission to access ANY activities
- This is a Strava API requirement, not an app choice
- You can control which activities appear on the map using in-app filters
- The app runs entirely in your browser - data stays with you

**"Authorization Error" or "Failed to exchange code"**
- ✅ Verify Client ID and Secret are correct (no spaces)
- ✅ Check that you copied the ENTIRE callback URL
- ✅ Make sure callback domain matches (for deployed sites)
- ✅ Try generating a new Client Secret on Strava

### Activity Fetching Issues

**"Failed to fetch activities"**
- ✅ Check browser console (F12) for detailed error
- ✅ Verify authorization succeeded (check sessionStorage in DevTools)
- ✅ Check Strava rate limits: 100 requests/15min, 1000/day
- ✅ Try again in 15 minutes if rate limited

**"No activities appear on map"**
- ✅ Make sure you have GPS activities (with polylines)
- ✅ Virtual activities (Zwift, treadmill) don't have GPS data
- ✅ Check activity type filters - may be hidden
- ✅ Try refreshing activities

### GIF Export Issues

**"Export failed" or slow generation**
- ✅ Reduce dimensions (try 800×600)
- ✅ Lower FPS (try 10 FPS)
- ✅ Shorter duration (try 5 seconds)
- ✅ Use Chrome/Edge (best Canvas performance)
- ✅ Close other tabs to free memory
- ✅ Don't interact with page during export

**"Out of memory" error**
- ✅ Too many activities in date range (reduce range)
- ✅ Dimensions too large (max 1920×1080 recommended)
- ✅ Duration too long (max 15s recommended)
- ✅ Try incognito mode (no extensions)

### Storage Issues

**"sessionStorage full"**
- ✅ Rare but possible with 10,000+ activities
- ✅ Try exporting smaller date ranges
- ✅ Refresh page to clear and re-fetch
- ✅ App will try to compress data if needed

---

## 🎯 Future Ideas

Potential features for contributions:

- [ ] Import from GPX/FIT files (no Strava account needed)
- [ ] Heatmap mode (highlight most-traveled routes)
- [ ] 3D terrain visualization
- [ ] Video export (WebM/MP4)
- [ ] Custom map styles (satellite, terrain)
- [ ] Activity type statistics (charts, graphs)
- [ ] Route comparison tool
- [ ] Share links (save map state in URL)
- [ ] Multiple athlete comparison
- [ ] Kudos/comments overlay

---

## 🙏 Credits & Attributions

- **[Strava API](https://developers.strava.com/)** - Activity data
- **[OpenStreetMap](https://www.openstreetmap.org/)** - Map data
- **[CARTO](https://carto.com/)** - Map tile rendering
- **[Leaflet](https://leafletjs.com/)** - Map library by Vladimir Agafonkin
- **[gif.js](https://github.com/jnordberg/gif.js)** - GIF encoding by Johan Nordberg
- **[html2canvas](https://html2canvas.hertzen.com/)** - DOM capture by Niklas von Hertzen
- **[Vite](https://vitejs.dev/)** - Build tool by Evan You
- **[Font Awesome](https://fontawesome.com/)** - Icons
- Built with **[Claude Code](https://claude.ai/code)** - Anthropic's AI-powered coding assistant

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file

Copyright (c) 2024

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software.

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**Before submitting:**
- Test locally with `npm run dev`
- Build without errors (`npm run build`)
- Follow existing code style
- Update README if adding features

---

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/pqzdev/strava-activity-map/issues)
- **Discussions**: [GitHub Discussions](https://github.com/pqzdev/strava-activity-map/discussions)
- **Strava API Docs**: [developers.strava.com](https://developers.strava.com/)

---

## ⭐ Star this repo if you find it useful!

**Found a bug?** Open an issue.
**Have a feature idea?** Open a discussion.
**Want to contribute?** PRs welcome!

---

Made with ❤️ by developers who love running, cycling, and open source.
