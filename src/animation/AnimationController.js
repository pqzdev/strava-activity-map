/**
 * Animation Controller
 * Manages time-based animation of activities on the map
 */
export class AnimationController {
  constructor(activities, map) {
    this.activities = activities;
    this.map = map;

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

    // Update progress of drawing activities
    this.activePolylines.forEach((data, activityId) => {
      if (data.drawing && data.progress < 1) {
        // Gradually draw the polyline
        data.progress = Math.min(1, data.progress + 0.02); // Adjust speed as needed
        this._updatePolylineProgress(data);
      }
    });

    // Remove old activities if we exceed max visible
    if (this.activePolylines.size > this.maxVisibleActivities) {
      this._removeOldestActivities();
    }
  }

  /**
   * Add a new activity to the map
   */
  _addActivity(activity) {
    const polylineStr = activity.map?.summary_polyline;
    if (!polylineStr) return;

    const coords = this._decodePolyline(polylineStr);
    if (coords.length === 0) return;

    const color = this._getActivityColor(activity.type);

    // Create polyline (initially hidden)
    const polyline = L.polyline([], {
      color: color,
      weight: 3,
      opacity: 0.8,
      className: 'animated-activity'
    }).addTo(this.map);

    // Add popup
    polyline.bindPopup(`
      <strong>${activity.name}</strong><br>
      Type: ${activity.type}<br>
      Distance: ${(activity.distance / 1000).toFixed(2)} km<br>
      Date: ${new Date(activity.start_date).toLocaleDateString()}
    `);

    // Store with metadata
    this.activePolylines.set(activity.id, {
      polyline,
      coords,
      progress: 0,
      drawing: true,
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

        const color = this._getActivityColor(activity.type);

        const polyline = L.polyline(coords, {
          color: color,
          weight: 2,
          opacity: 0.6
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
    const colors = {
      'Run': '#fc4c02',
      'Ride': '#0066cc',
      'Swim': '#00cccc',
      'Walk': '#66cc00',
      'Hike': '#996600',
      'VirtualRide': '#8800cc',
      'default': '#888888'
    };
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
