# Strava Activity Map Visualizer

Visualize and animate your Strava activities on an interactive map over time. Export the animation as a video or GIF.

![Example animation](example.gif)

## Features

- **Interactive Map Visualization**: View all your activities on a dynamic map
- **Time-based Animation**: Watch your activities animate chronologically with polyline drawing
- **Advanced Filtering**: Filter by activity type, distance, location, date range, and more
- **Export Options**: Export animations as MP4 videos or animated GIFs
- **Strava API Integration**: Fetch activities directly from your Strava account

## Prerequisites

- Node.js 18+ installed
- Strava API credentials (Client ID and Client Secret)
- A Mapbox account (free tier is sufficient) for map tiles

## Setup

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd strava-activity-map
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure Strava API

1. Go to [Strava API Settings](https://www.strava.com/settings/api)
2. Create an application if you haven't already
3. Note your Client ID and Client Secret
4. Set the Authorization Callback Domain to `localhost`

### 4. Set up environment variables

Create a `.env` file in the project root:

```env
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
```

### 5. Authenticate with Strava

```bash
npm run fetch
```

This will open a browser window for OAuth authentication.

## Usage

### Fetch Activities

```bash
npm run fetch
```

### Visualize Activities (Interactive Mode)

```bash
npm run dev
```

Open your browser to `http://localhost:5173`

### Export Animation

#### Via UI (Recommended)

The easiest way to export your animation is through the web interface:

1. Run `npm run dev` and open `http://localhost:5173`
2. Configure your filters and animation settings in the sidebar
3. Click the **Export** button in the controls panel
4. Choose your format (MP4 or GIF) and quality settings
5. Click **Start Export** to generate and download your animation

The UI provides a live preview and lets you fine-tune settings before exporting.

#### Via Command Line

For automated or scripted exports, you can use the CLI:

```bash
npm run export -- --format mp4 --duration 30
```

Options:
- `--format`: mp4 or gif (default: mp4)
- `--duration`: Duration in seconds (default: 30)
- `--filter-type`: Filter by activity type (e.g., Run, Ride, Swim)
- `--filter-distance-min`: Minimum distance in meters
- `--filter-distance-max`: Maximum distance in meters
- `--filter-date-start`: Start date (YYYY-MM-DD)
- `--filter-date-end`: End date (YYYY-MM-DD)
- `--filter-location`: Bounding box coordinates

## Project Structure

```
strava-activity-map/
├── src/
│   ├── components/          # UI components
│   ├── map/                 # Map rendering logic
│   ├── animation/           # Animation engine
│   ├── filters/             # Activity filtering
│   ├── export/              # Video/GIF export
│   ├── scripts/             # CLI scripts
│   └── utils/               # Helper functions
├── data/                    # Cached activity data
├── output/                  # Exported videos/GIFs
├── public/                  # Static assets
└── .env                     # Environment variables
```

## Roadmap

See [PROJECT_PLAN.md](PROJECT_PLAN.md) for detailed implementation phases.

## License

MIT
