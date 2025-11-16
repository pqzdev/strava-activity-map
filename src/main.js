import L from 'leaflet';
import { decodePolyline } from './utils/polyline.js';
import { AnimationController } from './animation/AnimationController.js';

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

  // Create bounds
  const bounds = [];

  // Render each activity
  filtered.forEach(activity => {
    const polylineStr = activity.map?.summary_polyline;
    if (!polylineStr) return;

    const coords = decodePolyline(polylineStr);
    if (coords.length === 0) return;

    const color = ACTIVITY_COLORS[activity.type] || ACTIVITY_COLORS.default;

    const polyline = L.polyline(coords, {
      color: color,
      weight: 2,
      opacity: 0.6
    }).addTo(map);

    // Add popup with activity info
    polyline.bindPopup(`
      <strong>${activity.name}</strong><br>
      Type: ${activity.type}<br>
      Distance: ${(activity.distance / 1000).toFixed(2)} km<br>
      Date: ${new Date(activity.start_date).toLocaleDateString()}
    `);

    polylines.push(polyline);
    bounds.push(...coords);
  });

  // Fit map to bounds
  if (bounds.length > 0) {
    map.fitBounds(bounds);
  }

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

// Initial load
loadingEl.classList.add('hidden');
