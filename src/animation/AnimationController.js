/**
 * Animation Controller
 * Manages time-based animation of activities on the map
 */
export class AnimationController {
  constructor(activities, map, getColorsFn, baseOpacity = 0.5) {
    this.activities = activities;
    this.map = map;
    this.getColorsFn = getColorsFn || (() => ({
      'Run': '#fc4c02',
      'Ride': '#0066cc',
      'Swim': '#00cccc',
      'Walk': '#66cc00',
      'Hike': '#996600',
      'default': '#888888'
    }));
    this.baseOpacity = baseOpacity; // Base opacity from activity density

    // Sort activities by date
    this.sortedActivities = [...activities].sort((a, b) =>
      new Date(a.start_date) - new Date(b.start_date)
    );

    // Animation state
    this.isPlaying = false;
    this.speed = 1; // Days per second
    this.currentTime = null;
    this.startTime = null;
    this.endTime = null;
    this.animationFrameId = null;
    this.lastFrameTime = null;

    // Visual state
    this.activePolylines = new Map(); // activityId -> { polyline, progress }
    this.fadeoutDuration = 5000; // ms to fade out old activities
    this.maxVisibleActivities = 100; // Limit for performance

    // Opacity settings (scaled by baseOpacity)
    this.recencyOpacityRange = {
      min: 0.15 * baseOpacity / 0.5, // Scale relative to default 0.5
      max: 1.0 * baseOpacity / 0.5
    };
    this.overlapOpacityRange = {
      min: 0.15 * baseOpacity / 0.5,
      max: 0.75 * baseOpacity / 0.5
    };
    this.fadeWindowMs = 90 * 24 * 60 * 60 * 1000; // 3 months in ms - activities fade over this period

    // Grid for overlap detection (rounded lat/lng to group nearby segments)
    this.overlapGrid = new Map(); // "lat,lng" -> count
    this.gridResolution = 0.0005; // ~50m cells

    // Callbacks
    this.onTimeUpdate = null;
    this.onActivityAppear = null;

    this._initialize();
  }

  _initialize() {
    if (this.sortedActivities.length === 0) return;

    // Set time range
    this.startTime = new Date(this.sortedActivities[0].start_date);
    this.endTime = new Date(this.sortedActivities[this.sortedActivities.length - 1].start_date);
    this.currentTime = new Date(this.startTime);

    // Pre-calculate overlap grid for all activities
    this._buildOverlapGrid();
  }

  /**
   * Build overlap grid by counting how many activities pass through each cell
   */
  _buildOverlapGrid() {
    this.overlapGrid.clear();

    this.sortedActivities.forEach(activity => {
      const polylineStr = activity.map?.summary_polyline;
      if (!polylineStr) return;

      const coords = this._decodePolyline(polylineStr);
      const visitedCells = new Set(); // Track cells for this activity to avoid double-counting

      coords.forEach(([lat, lng]) => {
        const cellKey = this._getCellKey(lat, lng);
        if (!visitedCells.has(cellKey)) {
          visitedCells.add(cellKey);
          this.overlapGrid.set(cellKey, (this.overlapGrid.get(cellKey) || 0) + 1);
        }
      });
    });

    // Find max overlap for normalization
    this.maxOverlap = Math.max(...this.overlapGrid.values(), 1);
  }

  /**
   * Get grid cell key for a coordinate
   */
  _getCellKey(lat, lng) {
    const gridLat = Math.round(lat / this.gridResolution) * this.gridResolution;
    const gridLng = Math.round(lng / this.gridResolution) * this.gridResolution;
    return `${gridLat.toFixed(4)},${gridLng.toFixed(4)}`;
  }

  /**
   * Calculate average overlap score for an activity's route
   */
  _getActivityOverlapScore(coords) {
    if (coords.length === 0) return 0;

    let totalOverlap = 0;
    const visitedCells = new Set();

    coords.forEach(([lat, lng]) => {
      const cellKey = this._getCellKey(lat, lng);
      if (!visitedCells.has(cellKey)) {
        visitedCells.add(cellKey);
        totalOverlap += this.overlapGrid.get(cellKey) || 1;
      }
    });

    // Average overlap normalized to 0-1
    const avgOverlap = totalOverlap / visitedCells.size;
    if (this.maxOverlap <= 1) return 0;
    return Math.min(1, (avgOverlap - 1) / (this.maxOverlap - 1));
  }

  /**
   * Calculate recency score based on current animation time (0 = faded, 1 = recent)
   */
  _getRecencyScore(activityDate, currentTime) {
    const age = currentTime - activityDate;
    if (age <= 0) return 1;
    if (age >= this.fadeWindowMs) return 0;
    return 1 - (age / this.fadeWindowMs);
  }

  /**
   * Calculate final opacity and weight based on recency and overlap
   */
  _calculateStyle(activityDate, coords, currentTime) {
    const recencyScore = this._getRecencyScore(activityDate, currentTime);
    const overlapScore = this._getActivityOverlapScore(coords);

    // Recency: 25% to 100%
    const recencyOpacity = this.recencyOpacityRange.min +
      recencyScore * (this.recencyOpacityRange.max - this.recencyOpacityRange.min);

    // Overlap: 25% to 75%
    const overlapOpacity = this.overlapOpacityRange.min +
      overlapScore * (this.overlapOpacityRange.max - this.overlapOpacityRange.min);

    // Combine: recency is primary, overlap adds bonus
    const opacity = Math.min(1, recencyOpacity * 0.7 + overlapOpacity * 0.3);

    // Weight: thicker for recent activities (2.5 -> 1)
    const weight = 1 + recencyScore * 1.5;

    return { opacity, weight, recencyScore };
  }

  /**
   * Darken a color by a percentage
   */
  _darkenColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (num >> 16) * (1 - percent));
    const g = Math.max(0, ((num >> 8) & 0x00FF) * (1 - percent));
    const b = Math.max(0, (num & 0x0000FF) * (1 - percent));
    return `#${((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1)}`;
  }

  /**
   * Start or resume animation
   */
  play() {
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.lastFrameTime = performance.now();
    this._animate();
  }

  /**
   * Pause animation
   */
  pause() {
    this.isPlaying = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Reset to beginning
   */
  reset() {
    this.pause();
    this.currentTime = new Date(this.startTime);
    this._clearAllPolylines();
    if (this.onTimeUpdate) {
      this.onTimeUpdate(this.currentTime);
    }
  }

  /**
   * Seek to specific date
   */
  seek(date) {
    const wasPlaying = this.isPlaying;
    this.pause();

    this.currentTime = new Date(date);
    this._clearAllPolylines();

    // Render all activities up to this point
    this._renderActivitiesUpToTime(this.currentTime);

    if (this.onTimeUpdate) {
      this.onTimeUpdate(this.currentTime);
    }

    if (wasPlaying) {
      this.play();
    }
  }

  /**
   * Set animation speed (days per second)
   */
  setSpeed(daysPerSecond) {
    this.speed = Math.max(0.1, Math.min(daysPerSecond, 100));
  }

  /**
   * Main animation loop
   */
  _animate() {
    if (!this.isPlaying) return;

    const now = performance.now();
    const deltaTime = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // Update current time based on speed
    const msToAdvance = deltaTime * this.speed * 24 * 60 * 60 * 1000 / 1000; // Convert days/sec to ms
    this.currentTime = new Date(this.currentTime.getTime() + msToAdvance);

    // Check if animation is complete
    if (this.currentTime > this.endTime) {
      this.currentTime = new Date(this.endTime);
      this.pause();
      this._renderActivitiesUpToTime(this.currentTime);
      if (this.onTimeUpdate) {
        this.onTimeUpdate(this.currentTime);
      }
      return;
    }

    // Render activities
    this._updateVisibleActivities();

    // Notify time update
    if (this.onTimeUpdate) {
      this.onTimeUpdate(this.currentTime);
    }

    // Continue animation
    this.animationFrameId = requestAnimationFrame(() => this._animate());
  }

  /**
   * Update which activities are visible based on current time
   */
  _updateVisibleActivities() {
    // Find new activities that should appear
    this.sortedActivities.forEach(activity => {
      const activityDate = new Date(activity.start_date);

      if (activityDate <= this.currentTime && !this.activePolylines.has(activity.id)) {
        this._addActivity(activity);
      }
    });

    // Update style of all visible activities based on current time
    this.activePolylines.forEach((data) => {
      if (data.drawing && data.progress < 1) {
        // Draw instantly - show all completed activities
        data.progress = 1;
        this._updatePolylineProgress(data);
        data.drawing = false;
      }

      // Update style based on current time
      const activityDate = new Date(data.activity.start_date);
      const style = this._calculateStyle(activityDate, data.coords, this.currentTime);
      const baseColor = this._getActivityColor(data.activity.type);
      const color = this._darkenColor(baseColor, style.recencyScore * 0.3);
      data.polyline.setStyle({ opacity: style.opacity, weight: style.weight, color: color });
    });

    // Note: We keep all activities visible during animation
    // Only remove old ones if performance becomes an issue
  }

  /**
   * Add a new activity to the map
   */
  _addActivity(activity) {
    const polylineStr = activity.map?.summary_polyline;
    if (!polylineStr) return;

    const coords = this._decodePolyline(polylineStr);
    if (coords.length === 0) return;

    const baseColor = this._getActivityColor(activity.type);
    const activityDate = new Date(activity.start_date);
    const style = this._calculateStyle(activityDate, coords, this.currentTime);

    // Darken color for recent activities (up to 30% darker)
    const color = this._darkenColor(baseColor, style.recencyScore * 0.3);

    // Create polyline - will be drawn immediately
    const polyline = L.polyline(coords, {
      color: color,
      weight: style.weight,
      opacity: style.opacity,
      className: 'animated-activity'
    }).addTo(this.map);

    // Add popup
    polyline.bindPopup(`
      <strong>${activity.name}</strong><br>
      Type: ${activity.type}<br>
      Distance: ${(activity.distance / 1000).toFixed(2)} km<br>
      Date: ${new Date(activity.start_date).toLocaleDateString()}
    `);

    // Store with metadata - already fully drawn
    this.activePolylines.set(activity.id, {
      polyline,
      coords,
      progress: 1,
      drawing: false,
      activity
    });

    if (this.onActivityAppear) {
      this.onActivityAppear(activity);
    }
  }

  /**
   * Update polyline based on drawing progress
   */
  _updatePolylineProgress(data) {
    const numPoints = Math.floor(data.coords.length * data.progress);
    const visibleCoords = data.coords.slice(0, Math.max(1, numPoints));
    data.polyline.setLatLngs(visibleCoords);
  }

  /**
   * Render all activities up to a specific time (for seeking)
   */
  _renderActivitiesUpToTime(time) {
    this.sortedActivities.forEach(activity => {
      const activityDate = new Date(activity.start_date);
      if (activityDate <= time) {
        const polylineStr = activity.map?.summary_polyline;
        if (!polylineStr) return;

        const coords = this._decodePolyline(polylineStr);
        if (coords.length === 0) return;

        const baseColor = this._getActivityColor(activity.type);
        const style = this._calculateStyle(activityDate, coords, time);
        const color = this._darkenColor(baseColor, style.recencyScore * 0.3);

        const polyline = L.polyline(coords, {
          color: color,
          weight: style.weight,
          opacity: style.opacity
        }).addTo(this.map);

        polyline.bindPopup(`
          <strong>${activity.name}</strong><br>
          Type: ${activity.type}<br>
          Distance: ${(activity.distance / 1000).toFixed(2)} km<br>
          Date: ${new Date(activity.start_date).toLocaleDateString()}
        `);

        this.activePolylines.set(activity.id, {
          polyline,
          coords,
          progress: 1,
          drawing: false,
          activity
        });
      }
    });
  }

  /**
   * Remove oldest activities to maintain performance
   */
  _removeOldestActivities() {
    const toRemove = this.activePolylines.size - this.maxVisibleActivities;
    let removed = 0;

    for (const [activityId, data] of this.activePolylines) {
      if (removed >= toRemove) break;
      data.polyline.remove();
      this.activePolylines.delete(activityId);
      removed++;
    }
  }

  /**
   * Clear all polylines from map
   */
  _clearAllPolylines() {
    this.activePolylines.forEach(data => {
      data.polyline.remove();
    });
    this.activePolylines.clear();
  }

  /**
   * Get color for activity type
   */
  _getActivityColor(type) {
    const colors = this.getColorsFn();
    return colors[type] || colors.default;
  }

  /**
   * Decode polyline (using imported utility or inline)
   */
  _decodePolyline(encoded) {
    if (!encoded) return [];

    const points = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let shift = 0;
      let result = 0;
      let byte;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1);
      lat += deltaLat;

      shift = 0;
      result = 0;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const deltaLng = (result & 1) ? ~(result >> 1) : (result >> 1);
      lng += deltaLng;

      points.push([lat / 1e5, lng / 1e5]);
    }

    return points;
  }

  /**
   * Get animation progress (0-1)
   */
  getProgress() {
    if (!this.startTime || !this.endTime) return 0;
    const total = this.endTime - this.startTime;
    const current = this.currentTime - this.startTime;
    return Math.max(0, Math.min(1, current / total));
  }

  /**
   * Cleanup
   */
  destroy() {
    this.pause();
    this._clearAllPolylines();
  }
}
