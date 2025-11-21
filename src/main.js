import L from 'leaflet';
import { decodePolyline } from './utils/polyline.js';
import { AnimationController } from './animation/AnimationController.js';
import { GifExporter } from './export/GifExporter.js';
import { StravaAuth } from './auth/StravaAuth.js';
import { StravaAPI } from './api/StravaAPI.js';
import { OnboardingUI } from './ui/OnboardingUI.js';

// Initialize auth and API
const auth = new StravaAuth();
const api = new StravaAPI(auth);

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
let captureBox = {
  ratio: 'max',
  bounds: null
};

// Color palette for selection
const COLOR_PALETTE = [
  { name: 'Strava Orange', value: '#fc4c02' },
  { name: 'Strava Blue', value: '#0066cc' },
  { name: 'Cyan', value: '#00cccc' },
  { name: 'Green', value: '#66cc00' },
  { name: 'Brown', value: '#996600' },
  { name: 'Red', value: '#e74c3c' },
  { name: 'Purple', value: '#9b59b6' },
  { name: 'Pink', value: '#e91e63' },
  { name: 'Yellow', value: '#f1c40f' },
  { name: 'Lime', value: '#d4e157' },
  { name: 'Teal', value: '#00a8cc' },
  { name: 'Navy', value: '#006994' },
  { name: 'Forest', value: '#2d5016' },
  { name: 'Orange', value: '#ff6b35' },
  { name: 'Gray', value: '#888888' },
  { name: 'Black', value: '#1a1a1a' }
];

// Default colors for common activity types
const DEFAULT_ACTIVITY_COLORS = {
  'Run': '#fc4c02',
  'Ride': '#0066cc',
  'Swim': '#00cccc',
  'Walk': '#66cc00',
  'Hike': '#996600',
  'default': '#888888'
};

// Custom colors per activity type (user can change these)
let customActivityColors = {};

// Get current activity colors
function getActivityColors() {
  return customActivityColors;
}

// DOM elements
const loadingEl = document.getElementById('loading');
const loadBtn = document.getElementById('load-btn');
const refreshActivitiesBtn = document.getElementById('refresh-activities-btn');
const activityTypeAll = document.getElementById('activity-type-all');
const activityTypeList = document.getElementById('activity-type-list');
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

// Main initialization
async function init() {
  // Add onboarding CSS
  const style = document.createElement('style');
  style.textContent = OnboardingUI.getCSS();
  document.head.appendChild(style);

  // Check if we're handling OAuth callback
  if (window.location.search.includes('code=')) {
    try {
      loadingEl.classList.remove('hidden');
      loadingEl.querySelector('div:last-child').textContent = 'Completing authorization...';

      await auth.handleCallback();

      // Show onboarding to fetch activities
      showOnboarding();
    } catch (error) {
      console.error('OAuth callback error:', error);
      alert(`Authorization failed: ${error.message}\n\nPlease try again.`);
      auth.clearAll();
      showOnboarding();
    } finally {
      loadingEl.classList.add('hidden');
    }
    return;
  }

  // Check if user is authenticated
  const status = auth.getStatus();

  if (status.isAuthenticated && api.hasCachedActivities()) {
    // User has auth and cached data - load directly
    loadCachedActivities();
  } else if (status.isAuthenticated) {
    // User has auth but no cached data - show onboarding to fetch
    showOnboarding();
  } else {
    // No auth - show onboarding from start
    showOnboarding();
  }
}

// Show onboarding
function showOnboarding() {
  const onboarding = new OnboardingUI(auth, api, (activities) => {
    handleActivitiesLoaded(activities);
  });

  // Determine which step to start at
  const status = auth.getStatus();

  onboarding.show();

  if (status.isAuthenticated) {
    // Skip to fetch step
    onboarding.showStep(5);
  } else if (status.hasCredentials) {
    // Skip to authorization step
    onboarding.showStep(3);
  }
  // Otherwise starts at step 1 (welcome)
}

// Load cached activities
function loadCachedActivities() {
  try {
    loadingEl.classList.remove('hidden');

    activities = api.getCachedActivities();

    if (!activities || activities.length === 0) {
      throw new Error('No cached activities found');
    }

    handleActivitiesLoaded(activities);

  } catch (error) {
    console.error('Failed to load cached activities:', error);
    loadingEl.classList.add('hidden');
    showOnboarding();
  }
}

// Handle activities loaded (from cache or fresh fetch)
function handleActivitiesLoaded(loadedActivities) {
  activities = loadedActivities;

  // Update stats
  updateStats();

  // Populate activity type filter
  populateActivityTypes();

  // Populate color schemes
  populateColorSchemes();

  // Initialize animation
  initializeAnimation();

  // Initialize capture box
  initializeCaptureBox();

  // Hide loading
  loadingEl.classList.add('hidden');

  // Show refresh button and hide load button
  refreshActivitiesBtn.style.display = 'inline-block';
  loadBtn.style.display = 'none';

  // Show instructions popup
  document.getElementById('instructions-popup').classList.add('active');

  console.log(`Loaded ${activities.length} activities`);
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

  // Clear existing pills
  activityTypeList.innerHTML = '';

  // Get the parent pills container
  const pillsContainer = activityTypeList.parentElement;

  // Create pill for each activity type
  types.forEach(type => {
    const label = document.createElement('label');
    label.className = 'activity-pill';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'activity-type-checkbox';
    checkbox.value = type;
    checkbox.checked = false; // Start unselected (All is selected)

    const span = document.createElement('span');
    span.textContent = type;

    label.appendChild(checkbox);
    label.appendChild(span);

    // Toggle selected class on click
    label.addEventListener('click', (e) => {
      e.preventDefault();
      checkbox.checked = !checkbox.checked;
      label.classList.toggle('selected', checkbox.checked);
      handleActivityTypeChange();
    });

    pillsContainer.appendChild(label);
  });

  // Hide the placeholder div
  activityTypeList.style.display = 'none';
}

// Populate color pickers for each activity type
function populateColorSchemes() {
  const container = document.getElementById('color-schemes-list');
  container.innerHTML = '';

  // Get unique activity types from loaded activities
  const activityTypes = [...new Set(activities.map(a => a.type))].sort();

  // Initialize custom colors with defaults
  activityTypes.forEach(type => {
    if (!customActivityColors[type]) {
      customActivityColors[type] = DEFAULT_ACTIVITY_COLORS[type] || DEFAULT_ACTIVITY_COLORS.default;
    }
  });

  // Create color picker for each activity type
  activityTypes.forEach(type => {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin: 10px 0; padding: 8px; background: #f8f9fa; border-radius: 4px;';

    const typeLabel = document.createElement('span');
    typeLabel.textContent = type;
    typeLabel.style.cssText = 'font-weight: 500; min-width: 80px;';

    const colorSelect = document.createElement('select');
    colorSelect.style.cssText = 'flex: 1; margin: 0 10px; padding: 4px 8px; border-radius: 4px; border: 1px solid #ddd;';

    // Add color options
    COLOR_PALETTE.forEach(color => {
      const option = document.createElement('option');
      option.value = color.value;
      option.textContent = color.name;
      option.style.cssText = `background: ${color.value}; color: white;`;
      if (customActivityColors[type] === color.value) {
        option.selected = true;
      }
      colorSelect.appendChild(option);
    });

    // Color preview box
    const preview = document.createElement('div');
    preview.style.cssText = `width: 30px; height: 30px; background: ${customActivityColors[type]}; border-radius: 4px; border: 2px solid #ddd;`;

    // Update color when selection changes
    colorSelect.addEventListener('change', () => {
      const newColor = colorSelect.value;
      customActivityColors[type] = newColor;
      preview.style.background = newColor;

      // Re-render activities with new colors
      if (animationController) {
        initializeAnimation();
      } else {
        renderActivities();
      }
    });

    row.appendChild(typeLabel);
    row.appendChild(colorSelect);
    row.appendChild(preview);

    container.appendChild(row);
  });

  // Add default color picker
  const defaultRow = document.createElement('div');
  defaultRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin: 10px 0; padding: 8px; background: #f0f0f0; border-radius: 4px;';

  const defaultLabel = document.createElement('span');
  defaultLabel.textContent = 'Other';
  defaultLabel.style.cssText = 'font-weight: 500; min-width: 80px; font-style: italic;';

  const defaultSelect = document.createElement('select');
  defaultSelect.style.cssText = 'flex: 1; margin: 0 10px; padding: 4px 8px; border-radius: 4px; border: 1px solid #ddd;';

  COLOR_PALETTE.forEach(color => {
    const option = document.createElement('option');
    option.value = color.value;
    option.textContent = color.name;
    option.style.cssText = `background: ${color.value}; color: white;`;
    if ((customActivityColors.default || DEFAULT_ACTIVITY_COLORS.default) === color.value) {
      option.selected = true;
    }
    defaultSelect.appendChild(option);
  });

  const defaultPreview = document.createElement('div');
  defaultPreview.style.cssText = `width: 30px; height: 30px; background: ${customActivityColors.default || DEFAULT_ACTIVITY_COLORS.default}; border-radius: 4px; border: 2px solid #ddd;`;

  defaultSelect.addEventListener('change', () => {
    const newColor = defaultSelect.value;
    customActivityColors.default = newColor;
    defaultPreview.style.background = newColor;

    if (animationController) {
      initializeAnimation();
    } else {
      renderActivities();
    }
  });

  defaultRow.appendChild(defaultLabel);
  defaultRow.appendChild(defaultSelect);
  defaultRow.appendChild(defaultPreview);

  container.appendChild(defaultRow);
}

// Get selected activity types
function getSelectedActivityTypes() {
  if (activityTypeAll.checked) {
    return 'all';
  }

  const checkboxes = document.querySelectorAll('.activity-type-checkbox:checked');
  return Array.from(checkboxes).map(cb => cb.value);
}

// Get filtered activities based on type
function getFilteredActivities() {
  // Filter by activity type
  const selectedTypes = getSelectedActivityTypes();
  const filtered = selectedTypes === 'all'
    ? activities
    : activities.filter(a => selectedTypes.includes(a.type));

  return filtered;
}

// Handle activity type checkbox changes
function handleActivityTypeChange() {
  const checkboxes = document.querySelectorAll('.activity-type-checkbox');
  const anyChecked = Array.from(checkboxes).some(cb => cb.checked);
  const allPill = document.querySelector('.activity-pill.all-pill');

  // If any individual type is checked, uncheck "All"
  if (anyChecked) {
    activityTypeAll.checked = false;
    allPill.classList.remove('selected');
  } else {
    // If no individual types are checked, check "All Activities"
    activityTypeAll.checked = true;
    allPill.classList.add('selected');
    // Reset all pills to unselected
    document.querySelectorAll('.activity-pill:not(.all-pill)').forEach(pill => {
      pill.classList.remove('selected');
    });
  }

  // Re-render activities with new filter
  if (animationController) {
    initializeAnimation();
  } else {
    renderActivities();
  }
}

function renderActivities() {
  // Clear existing polylines
  polylines.forEach(p => p.remove());
  polylines = [];

  // Filter activities based on selected types and privacy settings
  const filtered = getFilteredActivities();

  // Render each activity
  filtered.forEach(activity => {
    const polylineStr = activity.map?.summary_polyline;
    if (!polylineStr) return;

    const coords = decodePolyline(polylineStr);
    if (coords.length === 0) return;

    const colors = getActivityColors();
    const color = colors[activity.type] || colors.default;

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
  // Filter activities based on selected types and privacy settings
  const filtered = getFilteredActivities();

  // Preserve current time if controller exists
  let preservedTime = null;
  let wasPlaying = false;
  if (animationController) {
    preservedTime = animationController.currentTime;
    wasPlaying = animationController.isPlaying;
    animationController.destroy();
  }

  // Clear static polylines
  polylines.forEach(p => p.remove());
  polylines = [];

  // Create new animation controller with color function
  animationController = new AnimationController(filtered, map, getActivityColors);

  // Set up callbacks
  animationController.onTimeUpdate = (currentTime) => {
    updateTimeDisplay(currentTime);
    updateTimelineSlider();
  };

  animationController.onActivityAppear = (activity) => {
    console.log('New activity:', activity.name);
  };

  // Restore previous time position if it was set
  if (preservedTime && preservedTime >= animationController.startTime && preservedTime <= animationController.endTime) {
    animationController.seek(preservedTime);
    if (wasPlaying) {
      animationController.play();
      playBtn.disabled = true;
      pauseBtn.disabled = false;
    }
  }

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

// Initialize capture box
function initializeCaptureBox() {
  const captureBoxEl = document.getElementById('capture-box');
  const captureOverlay = document.getElementById('capture-overlay');
  updateCaptureBox('max');
  captureBoxEl.classList.add('active');
  captureOverlay.classList.add('active');
  setupCaptureBoxResize();
}

// Setup capture box resize functionality
function setupCaptureBoxResize() {
  const captureBoxEl = document.getElementById('capture-box');
  const handles = captureBoxEl.querySelectorAll('.capture-box-handle');
  const mapContainer = map.getContainer();

  let isResizing = false;
  let currentHandle = null;
  let startX, startY, startWidth, startHeight, startLeft, startTop;

  handles.forEach(handle => {
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();

      isResizing = true;
      currentHandle = handle.classList[1]; // Get the position class (nw, ne, sw, se)

      startX = e.clientX;
      startY = e.clientY;
      startWidth = captureBoxEl.offsetWidth;
      startHeight = captureBoxEl.offsetHeight;
      startLeft = captureBoxEl.offsetLeft;
      startTop = captureBoxEl.offsetTop;

      // Disable map dragging
      map.dragging.disable();

      // Set to free mode when manually resizing
      captureBox.ratio = 'free';
    });
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    e.preventDefault();

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    let newWidth = startWidth;
    let newHeight = startHeight;
    let newLeft = startLeft;
    let newTop = startTop;

    // Calculate new dimensions based on which handle is being dragged
    switch (currentHandle) {
      case 'se': // Bottom-right
        newWidth = startWidth + dx;
        newHeight = startHeight + dy;
        break;
      case 'sw': // Bottom-left
        newWidth = startWidth - dx;
        newHeight = startHeight + dy;
        newLeft = startLeft + dx;
        break;
      case 'ne': // Top-right
        newWidth = startWidth + dx;
        newHeight = startHeight - dy;
        newTop = startTop + dy;
        break;
      case 'nw': // Top-left
        newWidth = startWidth - dx;
        newHeight = startHeight - dy;
        newLeft = startLeft + dx;
        newTop = startTop + dy;
        break;
    }

    // Constrain to map bounds
    const mapWidth = mapContainer.clientWidth;
    const mapHeight = mapContainer.clientHeight;

    newWidth = Math.max(100, Math.min(newWidth, mapWidth - newLeft));
    newHeight = Math.max(100, Math.min(newHeight, mapHeight - newTop));
    newLeft = Math.max(0, Math.min(newLeft, mapWidth - 100));
    newTop = Math.max(0, Math.min(newTop, mapHeight - 100));

    // Apply new dimensions
    captureBoxEl.style.width = `${newWidth}px`;
    captureBoxEl.style.height = `${newHeight}px`;
    captureBoxEl.style.left = `${newLeft}px`;
    captureBoxEl.style.top = `${newTop}px`;

    // Update overlay to match box position
    const captureOverlay = document.getElementById('capture-overlay');
    captureOverlay.style.left = `${newLeft}px`;
    captureOverlay.style.top = `${newTop}px`;
    captureOverlay.style.width = `${newWidth}px`;
    captureOverlay.style.height = `${newHeight}px`;

    // Update label
    const labelEl = document.getElementById('capture-box-label');
    const aspectRatio = (newWidth / newHeight).toFixed(2);
    labelEl.textContent = `${Math.round(newWidth)}×${Math.round(newHeight)} (${aspectRatio}:1)`;

    // Update export dimensions to match capture box
    exportWidth.value = Math.round(newWidth);
    exportHeight.value = Math.round(newHeight);

    // Store bounds
    captureBox.bounds = {
      left: newLeft,
      top: newTop,
      width: newWidth,
      height: newHeight
    };
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      currentHandle = null;

      // Re-enable map dragging
      map.dragging.enable();
    }
  });
}

// Update capture box based on aspect ratio
function updateCaptureBox(ratio) {
  captureBox.ratio = ratio;

  const mapContainer = map.getContainer();
  const mapWidth = mapContainer.clientWidth;
  const mapHeight = mapContainer.clientHeight;

  let width, height;

  // Common phone aspect ratios
  const VERTICAL_PHONE = 9 / 16;  // 9:16 (portrait)
  const HORIZONTAL_PHONE = 16 / 9; // 16:9 (landscape)

  switch (ratio) {
    case 'max':
      width = mapWidth;
      height = mapHeight;
      break;

    case 'square':
      const size = Math.min(mapWidth, mapHeight);
      width = size;
      height = size;
      break;

    case 'vertical':
      height = mapHeight * 0.9; // 90% of map height
      width = height * VERTICAL_PHONE;
      if (width > mapWidth * 0.9) {
        width = mapWidth * 0.9;
        height = width / VERTICAL_PHONE;
      }
      break;

    case 'horizontal':
      width = mapWidth * 0.9; // 90% of map width
      height = width / HORIZONTAL_PHONE;
      if (height > mapHeight * 0.9) {
        height = mapHeight * 0.9;
        width = height * HORIZONTAL_PHONE;
      }
      break;

    case 'free':
      // Keep current dimensions
      const captureBoxEl = document.getElementById('capture-box');
      width = parseInt(captureBoxEl.style.width) || mapWidth;
      height = parseInt(captureBoxEl.style.height) || mapHeight;
      break;
  }

  // Center the box
  const left = (mapWidth - width) / 2;
  const top = (mapHeight - height) / 2;

  const captureBoxEl = document.getElementById('capture-box');
  captureBoxEl.style.left = `${left}px`;
  captureBoxEl.style.top = `${top}px`;
  captureBoxEl.style.width = `${width}px`;
  captureBoxEl.style.height = `${height}px`;

  // Update overlay to match box position
  const captureOverlay = document.getElementById('capture-overlay');
  captureOverlay.style.left = `${left}px`;
  captureOverlay.style.top = `${top}px`;
  captureOverlay.style.width = `${width}px`;
  captureOverlay.style.height = `${height}px`;

  // Update label
  const labelEl = document.getElementById('capture-box-label');
  const aspectRatio = (width / height).toFixed(2);
  labelEl.textContent = `${Math.round(width)}×${Math.round(height)} (${aspectRatio}:1)`;

  // Store bounds for export
  captureBox.bounds = {
    left,
    top,
    width,
    height
  };

  // Update export dimensions to match capture box
  exportWidth.value = Math.round(width);
  exportHeight.value = Math.round(height);
}

// Event listeners
loadBtn.addEventListener('click', () => {
  // Re-fetch activities
  showOnboarding();
});

refreshActivitiesBtn.addEventListener('click', () => {
  // Re-fetch activities from Strava
  showOnboarding();
});

// "All Activities" pill handler
activityTypeAll.parentElement.addEventListener('click', (e) => {
  e.preventDefault();

  const checkboxes = document.querySelectorAll('.activity-type-checkbox');
  const pills = document.querySelectorAll('.activity-pill:not(.all-pill)');
  const allPill = activityTypeAll.parentElement;

  if (!activityTypeAll.checked) {
    // Selecting "All" - deselect individual types
    activityTypeAll.checked = true;
    allPill.classList.add('selected');
    checkboxes.forEach(cb => {
      cb.checked = false;
    });
    pills.forEach(pill => {
      pill.classList.remove('selected');
    });
  } else {
    // Deselecting "All" - select all individual types
    activityTypeAll.checked = false;
    allPill.classList.remove('selected');
    checkboxes.forEach(cb => {
      cb.checked = true;
    });
    pills.forEach(pill => {
      pill.classList.add('selected');
    });
  }

  // Re-render
  if (animationController) {
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

// Aspect ratio pill controls
document.querySelectorAll('.aspect-ratio-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    // Deselect all pills
    document.querySelectorAll('.aspect-ratio-pill').forEach(p => p.classList.remove('selected'));

    // Select this pill
    pill.classList.add('selected');

    // Update capture box
    const ratio = pill.getAttribute('data-ratio');
    updateCaptureBox(ratio);
  });
});

// Export dimension controls - update capture box when dimensions change
exportWidth.addEventListener('input', () => {
  if (captureBox.ratio !== 'free') return;
  const captureBoxEl = document.getElementById('capture-box');
  const newWidth = parseInt(exportWidth.value);
  const aspectRatio = parseInt(captureBoxEl.style.width) / parseInt(captureBoxEl.style.height);
  exportHeight.value = Math.round(newWidth / aspectRatio);
});

exportHeight.addEventListener('input', () => {
  if (captureBox.ratio !== 'free') return;
  const captureBoxEl = document.getElementById('capture-box');
  const newHeight = parseInt(exportHeight.value);
  const aspectRatio = parseInt(captureBoxEl.style.width) / parseInt(captureBoxEl.style.height);
  exportWidth.value = Math.round(newHeight * aspectRatio);
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

// Start the app
init();
