# Strava Activity Map Visualizer

Visualize and animate your Strava activities on an interactive map over time. Export animations as animated GIFs.

## Features

- **Interactive Map Visualization**: View all your activities on a Leaflet-powered map with OpenStreetMap tiles
- **Time-based Animation**: Watch your activities appear chronologically with smooth playback
- **Activity Type Filtering**: Filter activities by type (Run, Ride, Swim, Walk, Hike, etc.)
- **Animation Controls**: Play, pause, reset, and seek through your activity timeline
- **Adjustable Speed**: Control animation playback speed from 1 to 100 days/second
- **GIF Export**: Export your activity animation as an animated GIF with customizable settings
- **Strava API Integration**: Authenticate with Strava and fetch all your activities automatically
- **Activity Statistics**: View total activities, distance, and activity type breakdown

## Prerequisites

- Node.js 18+ installed
- A Strava account with activities
- Strava API credentials (Client ID and Client Secret)

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

1. Go to [https://www.strava.com/settings/api](https://www.strava.com/settings/api) to access your API settings
2. Create an application if you haven't already
3. Your **Client ID** and **Client Secret** will be displayed on this page
4. Set the **Authorization Callback Domain** to `localhost`

### 4. Set up environment variables

Create a `.env` file in the project root:

```env
STRAVA_CLIENT_ID=your_client_id_here
STRAVA_CLIENT_SECRET=your_client_secret_here
```

### 5. Authenticate with Strava

Run the authentication script to connect your Strava account:

```bash
node src/scripts/authenticate.js
```

This will:
- Start a local server on port 3000
- Open your browser to Strava's authorization page
- Save your access tokens locally after you approve the application

### 6. Fetch your activities

Download all your Strava activities:

```bash
npm run fetch
```

This will fetch all activities and save them to `data/activities/all_activities.json`. The script shows progress and displays a summary when complete.

## Usage

### Interactive Visualization

Start the development server:

```bash
npm run dev
```

Then open your browser to `http://localhost:5173`

### Using the Web Interface

1. **Load Activities**: Click "Load Activities" to load your fetched activities onto the map
2. **Filter by Type**: Use the dropdown to filter by activity type (Run, Ride, etc.)
3. **Animation Controls**:
   - **Play/Pause**: Control animation playback
   - **Reset**: Return to the beginning
   - **Timeline Slider**: Seek to any point in time
   - **Speed Slider**: Adjust playback speed (1-100 days/second)
4. **Export GIF**:
   - Set start and end dates for the animation
   - Configure duration, dimensions, and frame rate
   - Click "Export GIF" to create an animated GIF
   - Download the generated file

### Export Options

When exporting a GIF, you can customize:

- **Date Range**: Select start and end dates for the animation
- **Duration**: Animation length in seconds (1-60s)
- **Dimensions**: Width and height in pixels (up to 4K)
- **Frame Rate**: Choose between 10, 15, 20, or 30 FPS
  - 10 FPS: Smaller file size
  - 15 FPS: Balanced (recommended)
  - 20-30 FPS: Smoother animation, larger file

## Project Structure

```
strava-activity-map/
├── src/
│   ├── animation/
│   │   └── AnimationController.js    # Time-based animation logic
│   ├── export/
│   │   └── GifExporter.js            # GIF export functionality
│   ├── scripts/
│   │   ├── authenticate.js           # OAuth authentication
│   │   └── fetchActivities.js        # Activity fetching
│   ├── utils/
│   │   ├── strava.js                 # Strava API client
│   │   └── polyline.js               # Polyline decoding
│   └── main.js                       # Main application logic
├── data/
│   ├── activities/                   # Cached activity data
│   └── tokens.json                   # OAuth tokens (gitignored)
├── index.html                        # Main HTML with UI
├── package.json                      # Dependencies and scripts
└── .env                              # Environment variables (gitignored)
```

## How It Works

1. **Authentication**: Uses OAuth 2.0 to authenticate with Strava API
2. **Data Fetching**: Retrieves all activities with automatic pagination and rate limiting
3. **Visualization**: Decodes polylines and renders them on a Leaflet map
4. **Animation**: Activities appear chronologically based on their start dates
5. **Export**: Captures frames using html2canvas and encodes them as GIF using gif.js

## Activity Colors

Activities are color-coded by type:
- **Run**: Orange (#fc4c02)
- **Ride**: Blue (#0066cc)
- **Swim**: Cyan (#00cccc)
- **Walk**: Green (#66cc00)
- **Hike**: Brown (#996600)
- **VirtualRide**: Purple (#8800cc)
- **Other**: Gray (#888888)

## Troubleshooting

### "Failed to load activities" error
- Make sure you've run `npm run fetch` to download your activities
- Check that `data/activities/all_activities.json` exists

### Authentication issues
- Verify your Client ID and Client Secret in `.env`
- Make sure the callback domain in Strava settings is set to `localhost`
- Try deleting `data/tokens.json` and re-authenticating

### GIF export issues
- Ensure you have enough RAM for large exports (high resolution + high FPS)
- Try reducing dimensions or frame rate for large date ranges
- Check browser console for detailed error messages

## Development

Build for production:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

## License

MIT
