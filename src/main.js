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
const saveGifBtn = document.getElementById('save-gif-btn');
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

// Store the last exported GIF blob
let lastExportedGif = null;

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

  // Get selected activity types
  const selectedTypes = getSelectedActivityTypes();

  // Get activity types to show in color picker
  let activityTypes;
  if (selectedTypes === 'all') {
    // Show all activity types
    activityTypes = [...new Set(activities.map(a => a.type))].sort();
  } else {
    // Show only selected activity types
    activityTypes = selectedTypes.sort();
  }

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

  // Update color schemes to show only selected types
  populateColorSchemes();

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

// Setup capture box resize and drag functionality
function setupCaptureBoxResize() {
  const captureBoxEl = document.getElementById('capture-box');
  const handles = captureBoxEl.querySelectorAll('.capture-box-handle');
  const mapContainer = map.getContainer();

  // Buffer margin from map edges (in pixels)
  const MARGIN = 20;

  let isResizing = false;
  let isDragging = false;
  let currentHandle = null;
  let startX, startY, startWidth, startHeight, startLeft, startTop;

  // Handle resize from corner handles
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

  // Update cursor based on mouse position over the box
  captureBoxEl.addEventListener('mousemove', (e) => {
    // Skip if currently resizing or dragging
    if (isResizing || isDragging) return;

    // Don't change cursor for handles
    if (e.target.classList.contains('capture-box-handle')) return;

    const rect = captureBoxEl.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Define edge threshold
    const edgeThreshold = 15;
    const isNearLeftEdge = mouseX < edgeThreshold;
    const isNearRightEdge = mouseX > rect.width - edgeThreshold;
    const isNearTopEdge = mouseY < edgeThreshold;
    const isNearBottomEdge = mouseY > rect.height - edgeThreshold;

    const isNearEdge = isNearLeftEdge || isNearRightEdge || isNearTopEdge || isNearBottomEdge;

    // Change cursor based on position
    captureBoxEl.style.cursor = isNearEdge ? 'move' : 'default';
  });

  // Handle drag from box edges only
  captureBoxEl.addEventListener('mousedown', (e) => {
    // Don't start dragging if clicking on a handle
    if (e.target.classList.contains('capture-box-handle')) return;
    // Don't start dragging if clicking on the label
    if (e.target.id === 'capture-box-label' || e.target.closest('#capture-box-label')) return;

    // Calculate relative click position within the box
    const rect = captureBoxEl.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Define edge threshold - only allow dragging from edges (15px from border)
    const edgeThreshold = 15;
    const isNearLeftEdge = clickX < edgeThreshold;
    const isNearRightEdge = clickX > rect.width - edgeThreshold;
    const isNearTopEdge = clickY < edgeThreshold;
    const isNearBottomEdge = clickY > rect.height - edgeThreshold;

    // Only start dragging if click is near an edge
    const isNearEdge = isNearLeftEdge || isNearRightEdge || isNearTopEdge || isNearBottomEdge;

    if (!isNearEdge) {
      // Click is in the middle - don't intercept, let map handle it
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startLeft = captureBoxEl.offsetLeft;
    startTop = captureBoxEl.offsetTop;
    startWidth = captureBoxEl.offsetWidth;
    startHeight = captureBoxEl.offsetHeight;

    // Disable map dragging
    map.dragging.disable();

    // Change cursor to move
    document.body.style.cursor = 'move';

    // Set to free mode when manually dragging
    captureBox.ratio = 'free';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing && !isDragging) return;

    e.preventDefault();

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    let newWidth = startWidth;
    let newHeight = startHeight;
    let newLeft = startLeft;
    let newTop = startTop;

    if (isDragging) {
      // Dragging the box
      newLeft = startLeft + dx;
      newTop = startTop + dy;

      // Constrain to map bounds with margin
      const mapWidth = mapContainer.clientWidth;
      const mapHeight = mapContainer.clientHeight;

      newLeft = Math.max(MARGIN, Math.min(newLeft, mapWidth - startWidth - MARGIN));
      newTop = Math.max(MARGIN, Math.min(newTop, mapHeight - startHeight - MARGIN));

    } else if (isResizing) {
      // Resizing with handles
      // Determine if aspect ratio should be locked
      const lockAspectRatio = captureBox.ratio === 'square' || captureBox.ratio === 'vertical' || captureBox.ratio === 'horizontal';
      let targetAspectRatio = null;

      if (lockAspectRatio) {
        // Calculate target aspect ratio based on mode
        if (captureBox.ratio === 'square') {
          targetAspectRatio = 1; // 1:1
        } else if (captureBox.ratio === 'vertical') {
          targetAspectRatio = 9 / 16; // 9:16
        } else if (captureBox.ratio === 'horizontal') {
          targetAspectRatio = 16 / 9; // 16:9
        }
      }

      // Calculate new dimensions based on which handle is being dragged
      if (lockAspectRatio && targetAspectRatio) {
        // For locked aspect ratio, calculate based on the dominant dimension
        const totalDelta = Math.abs(dx) > Math.abs(dy) ? dx : dy;

        switch (currentHandle) {
          case 'se': // Bottom-right
            newWidth = startWidth + totalDelta;
            newHeight = newWidth / targetAspectRatio;
            break;
          case 'sw': // Bottom-left
            newWidth = startWidth - totalDelta;
            newHeight = newWidth / targetAspectRatio;
            newLeft = startLeft + totalDelta;
            break;
          case 'ne': // Top-right
            newWidth = startWidth + totalDelta;
            newHeight = newWidth / targetAspectRatio;
            newTop = startTop - (newHeight - startHeight);
            break;
          case 'nw': // Top-left
            newWidth = startWidth - totalDelta;
            newHeight = newWidth / targetAspectRatio;
            newLeft = startLeft + totalDelta;
            newTop = startTop - (newHeight - startHeight);
            break;
        }
      } else {
        // Free resize (no aspect ratio lock)
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
      }

      // Constrain to map bounds with margin
      const mapWidth = mapContainer.clientWidth;
      const mapHeight = mapContainer.clientHeight;

      newWidth = Math.max(100, Math.min(newWidth, mapWidth - newLeft - MARGIN));
      newHeight = Math.max(100, Math.min(newHeight, mapHeight - newTop - MARGIN));
      newLeft = Math.max(MARGIN, Math.min(newLeft, mapWidth - 100 - MARGIN));
      newTop = Math.max(MARGIN, Math.min(newTop, mapHeight - 100 - MARGIN));

      // Re-apply aspect ratio if locked (after constraints)
      if (lockAspectRatio && targetAspectRatio) {
        // Recalculate to maintain aspect ratio after constraints
        const constrainedWidth = newWidth;
        const constrainedHeight = constrainedWidth / targetAspectRatio;

        // Check if height fits
        if (constrainedHeight <= mapHeight - newTop - MARGIN) {
          newHeight = constrainedHeight;
        } else {
          // Height is constrained, recalculate width
          newHeight = Math.min(newHeight, mapHeight - newTop - MARGIN);
          newWidth = newHeight * targetAspectRatio;
        }
      }
    }

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
    if (isResizing || isDragging) {
      isResizing = false;
      isDragging = false;
      currentHandle = null;

      // Reset cursor
      captureBoxEl.style.cursor = '';
      document.body.style.cursor = '';

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

  // Buffer margin from map edges (in pixels)
  const MARGIN = 20;

  let width, height;

  // Common phone aspect ratios
  const VERTICAL_PHONE = 9 / 16;  // 9:16 (portrait)
  const HORIZONTAL_PHONE = 16 / 9; // 16:9 (landscape)

  switch (ratio) {
    case 'max':
      width = mapWidth - (MARGIN * 2);
      height = mapHeight - (MARGIN * 2);
      break;

    case 'square':
      const availableSize = Math.min(mapWidth, mapHeight) - (MARGIN * 2);
      width = availableSize;
      height = availableSize;
      break;

    case 'vertical':
      height = (mapHeight - MARGIN * 2) * 0.9; // 90% of available height
      width = height * VERTICAL_PHONE;
      if (width > (mapWidth - MARGIN * 2) * 0.9) {
        width = (mapWidth - MARGIN * 2) * 0.9;
        height = width / VERTICAL_PHONE;
      }
      break;

    case 'horizontal':
      width = (mapWidth - MARGIN * 2) * 0.9; // 90% of available width
      height = width / HORIZONTAL_PHONE;
      if (height > (mapHeight - MARGIN * 2) * 0.9) {
        height = (mapHeight - MARGIN * 2) * 0.9;
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

  // Center the box within available space (respecting margins)
  const left = MARGIN + ((mapWidth - MARGIN * 2) - width) / 2;
  const top = MARGIN + ((mapHeight - MARGIN * 2) - height) / 2;

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

  // Update color schemes to show selected types
  populateColorSchemes();

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
    exportBtn.textContent = 'Producing...';

    // Set up progress callback
    gifExporter.onProgress = (percent, message) => {
      progressFill.style.width = `${percent}%`;
      progressFill.textContent = `${Math.round(percent)}%`;
      exportStatus.textContent = message;
    };

    // Export GIF with capture box bounds
    const blob = await gifExporter.export({
      startDate,
      endDate,
      duration,
      width,
      height,
      fps,
      quality: 10,
      captureBox: captureBox.bounds // Pass the capture box bounds
    });

    // Store the blob and filename
    lastExportedGif = {
      blob,
      filename: `strava-activities-${formatDateForInput(startDate)}-to-${formatDateForInput(endDate)}.gif`
    };

    // Hide progress, show Save button
    exportProgress.style.display = 'none';
    exportComplete.style.display = 'none'; // Hide old download link

    // Make produce button grey but keep it active
    exportBtn.disabled = false;
    exportBtn.textContent = 'Produce GIF';
    exportBtn.style.background = '#999999';

    // Show Save GIF button
    saveGifBtn.style.display = 'flex';

    console.log(`GIF ready! Size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);

  } catch (error) {
    console.error('Export failed:', error);
    alert(`Export failed: ${error.message}`);
    exportProgress.style.display = 'none';
    exportBtn.disabled = false;
    exportBtn.textContent = 'Produce GIF';
    exportBtn.style.background = ''; // Reset background
  }
});

// Save GIF button click handler
saveGifBtn.addEventListener('click', () => {
  if (!lastExportedGif) return;

  // Create download link and trigger download
  const url = URL.createObjectURL(lastExportedGif.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = lastExportedGif.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log(`Downloaded: ${lastExportedGif.filename}`);
});

// Start the app
init();
