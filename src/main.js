import L from 'leaflet';
import { decodePolyline } from './utils/polyline.js';
import { AnimationController } from './animation/AnimationController.js';
import { GifExporter } from './export/GifExporter.js';

// Initialize map
const map = L.map('map').setView([0, 0], 2);

// Add CartoDB Positron tiles (gray/minimal style perfect for activity visualization)
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: 'abcd',
  maxZoom: 20
}).addTo(map);

// State
let activities = [];
let polylines = [];
let animationController = null;
let gifExporter = null;

// Activity type colors
const ACTIVITY_COLORS = {
  'Run': '#fc4c02',
  'Ride': '#0066cc',
  'Swim': '#00cccc',
  'Walk': '#66cc00',
  'Hike': '#996600',
  'default': '#888888'
};

// DOM elements
const loadingEl = document.getElementById('loading');
const loadBtn = document.getElementById('load-btn');
const activityTypeSelect = document.getElementById('activity-type');
const statCount = document.getElementById('stat-count');
const statDistance = document.getElementById('stat-distance');
const statTypes = document.getElementById('stat-types');

// Animation controls
const animationControlsEl = document.getElementById('animation-controls');
const playBtn = document.getElementById('play-btn');
const pauseBtn = document.getElementById('pause-btn');
const resetBtn = document.getElementById('reset-btn');
const timelineSlider = document.getElementById('timeline-slider');
const speedSlider = document.getElementById('speed-slider');
const speedValue = document.getElementById('speed-value');
const timeDisplay = document.getElementById('time-display');

// Export controls
const exportControlsEl = document.getElementById('export-controls');
const exportBtn = document.getElementById('export-btn');
const exportStartDate = document.getElementById('export-start-date');
const exportEndDate = document.getElementById('export-end-date');
const exportDuration = document.getElementById('export-duration');
const exportWidth = document.getElementById('export-width');
const exportHeight = document.getElementById('export-height');
const exportFps = document.getElementById('export-fps');
const exportProgress = document.getElementById('export-progress');
const progressFill = document.getElementById('progress-fill');
const exportStatus = document.getElementById('export-status');
const exportComplete = document.getElementById('export-complete');
const downloadLink = document.getElementById('download-link');

// Load activities from cache
async function loadActivities() {
  try {
    loadingEl.classList.remove('hidden');

    const response = await fetch('/data/activities/all_activities.json');
    if (!response.ok) {
      throw new Error('Failed to load activities. Please run: npm run fetch');
    }

    activities = await response.json();

    // Update stats
    updateStats();

    // Populate activity type filter
    populateActivityTypes();

    // Render activities
    renderActivities();

    // Initialize animation
    initializeAnimation();

    loadingEl.classList.add('hidden');

  } catch (error) {
    loadingEl.classList.add('hidden');
    alert(`Error loading activities: ${error.message}\n\nPlease run: npm run fetch`);
  }
}

function updateStats() {
  const stats = activities.reduce((acc, activity) => {
    acc.types.add(activity.type);
    acc.totalDistance += activity.distance || 0;
    return acc;
  }, { types: new Set(), totalDistance: 0 });

  statCount.textContent = activities.length;
  statDistance.textContent = (stats.totalDistance / 1000).toFixed(2);
  statTypes.textContent = stats.types.size;
}

function populateActivityTypes() {
  const types = [...new Set(activities.map(a => a.type))].sort();

  types.forEach(type => {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = type;
    activityTypeSelect.appendChild(option);
  });
}

function renderActivities() {
  // Clear existing polylines
  polylines.forEach(p => p.remove());
  polylines = [];

  // Filter activities
  const selectedType = activityTypeSelect.value;
  const filtered = selectedType === 'all'
    ? activities
    : activities.filter(a => a.type === selectedType);

  // Render each activity
  filtered.forEach(activity => {
    const polylineStr = activity.map?.summary_polyline;
    if (!polylineStr) return;

    const coords = decodePolyline(polylineStr);
    if (coords.length === 0) return;

    const color = ACTIVITY_COLORS[activity.type] || ACTIVITY_COLORS.default;

    const polyline = L.polyline(coords, {
      color: color,
      weight: 1.5,
      opacity: 0.5
    }).addTo(map);

    // Add popup with activity info
    polyline.bindPopup(`
      <strong>${activity.name}</strong><br>
      Type: ${activity.type}<br>
      Distance: ${(activity.distance / 1000).toFixed(2)} km<br>
      Date: ${new Date(activity.start_date).toLocaleDateString()}
    `);

    polylines.push(polyline);
  });

  console.log(`Rendered ${polylines.length} activities`);
}

// Initialize animation
function initializeAnimation() {
  // Filter activities based on selected type
  const selectedType = activityTypeSelect.value;
  const filtered = selectedType === 'all'
    ? activities
    : activities.filter(a => a.type === selectedType);

  // Clear existing animation
  if (animationController) {
    animationController.destroy();
  }

  // Clear static polylines
  polylines.forEach(p => p.remove());
  polylines = [];

  // Create new animation controller
  animationController = new AnimationController(filtered, map);

  // Set up callbacks
  animationController.onTimeUpdate = (currentTime) => {
    updateTimeDisplay(currentTime);
    updateTimelineSlider();
  };

  animationController.onActivityAppear = (activity) => {
    console.log('New activity:', activity.name);
  };

  // Show animation controls
  animationControlsEl.style.display = 'block';

  // Update initial time display
  updateTimeDisplay(animationController.currentTime);

  // Initialize GIF exporter
  gifExporter = new GifExporter(animationController, map);

  // Set default export dates
  if (animationController.startTime && animationController.endTime) {
    exportStartDate.value = formatDateForInput(animationController.startTime);
    exportEndDate.value = formatDateForInput(animationController.endTime);
  }

  // Set default export dimensions based on current map size
  updateExportDimensions();

  // Show export controls
  exportControlsEl.style.display = 'block';
}

function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function updateTimeDisplay(date) {
  if (!date) {
    timeDisplay.textContent = '--/--/----';
    return;
  }
  timeDisplay.textContent = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function updateTimelineSlider() {
  if (!animationController) return;
  const progress = animationController.getProgress() * 100;
  timelineSlider.value = progress;
}

function updateExportDimensions() {
  // Get current map size
  const mapSize = map.getSize();
  const aspectRatio = mapSize.x / mapSize.y;

  // Set width to 1200 and calculate height to maintain aspect ratio
  const targetWidth = 1200;
  const targetHeight = Math.round(targetWidth / aspectRatio);

  exportWidth.value = targetWidth;
  exportHeight.value = targetHeight;

  console.log(`Export dimensions set to ${targetWidth}x${targetHeight} (aspect ratio: ${aspectRatio.toFixed(2)})`);
}

// Event listeners
loadBtn.addEventListener('click', loadActivities);
activityTypeSelect.addEventListener('change', () => {
  if (activities.length > 0) {
    initializeAnimation();
  } else {
    renderActivities();
  }
});

// Animation controls
playBtn.addEventListener('click', () => {
  if (!animationController) return;
  animationController.play();
  playBtn.disabled = true;
  pauseBtn.disabled = false;
});

pauseBtn.addEventListener('click', () => {
  if (!animationController) return;
  animationController.pause();
  playBtn.disabled = false;
  pauseBtn.disabled = true;
});

resetBtn.addEventListener('click', () => {
  if (!animationController) return;
  animationController.reset();
  playBtn.disabled = false;
  pauseBtn.disabled = true;
});

timelineSlider.addEventListener('input', (e) => {
  if (!animationController) return;
  const progress = parseFloat(e.target.value) / 100;
  const totalTime = animationController.endTime - animationController.startTime;
  const newTime = new Date(animationController.startTime.getTime() + (totalTime * progress));
  animationController.seek(newTime);
});

speedSlider.addEventListener('input', (e) => {
  const speed = parseFloat(e.target.value);
  speedValue.textContent = `${speed} d/s`;
  if (animationController) {
    animationController.setSpeed(speed);
  }
});

// Export dimension controls - maintain aspect ratio
exportWidth.addEventListener('input', () => {
  if (!map) return;
  const mapSize = map.getSize();
  const aspectRatio = mapSize.x / mapSize.y;
  const newHeight = Math.round(parseInt(exportWidth.value) / aspectRatio);
  exportHeight.value = newHeight;
});

exportHeight.addEventListener('input', () => {
  if (!map) return;
  const mapSize = map.getSize();
  const aspectRatio = mapSize.x / mapSize.y;
  const newWidth = Math.round(parseInt(exportHeight.value) * aspectRatio);
  exportWidth.value = newWidth;
});

// Export controls
exportBtn.addEventListener('click', async () => {
  if (!gifExporter) return;

  try {
    // Get export parameters
    const startDate = new Date(exportStartDate.value);
    const endDate = new Date(exportEndDate.value);
    const duration = parseInt(exportDuration.value);
    const width = parseInt(exportWidth.value);
    const height = parseInt(exportHeight.value);
    const fps = parseInt(exportFps.value);

    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      alert('Please select valid start and end dates');
      return;
    }

    if (startDate >= endDate) {
      alert('Start date must be before end date');
      return;
    }

    // Hide previous download link
    exportComplete.style.display = 'none';

    // Show progress
    exportProgress.style.display = 'block';
    exportBtn.disabled = true;
    exportBtn.textContent = 'Exporting...';

    // Set up progress callback
    gifExporter.onProgress = (percent, message) => {
      progressFill.style.width = `${percent}%`;
      progressFill.textContent = `${Math.round(percent)}%`;
      exportStatus.textContent = message;
    };

    // Export GIF
    const blob = await gifExporter.export({
      startDate,
      endDate,
      duration,
      width,
      height,
      fps,
      quality: 10
    });

    // Create download link
    const filename = `strava-activities-${formatDateForInput(startDate)}-to-${formatDateForInput(endDate)}.gif`;
    const url = URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.download = filename;

    // Show download link
    exportProgress.style.display = 'none';
    exportComplete.style.display = 'block';
    exportBtn.disabled = false;
    exportBtn.textContent = 'Export GIF';

    console.log(`GIF ready! Size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);

  } catch (error) {
    console.error('Export failed:', error);
    alert(`Export failed: ${error.message}`);
    exportProgress.style.display = 'none';
    exportBtn.disabled = false;
    exportBtn.textContent = 'Export GIF';
  }
});

// Initial load
loadingEl.classList.add('hidden');
