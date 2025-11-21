/**
 * GIF Exporter
 * Captures animation frames and exports as animated GIF
 */
import GIF from 'gif.js';
import html2canvas from 'html2canvas';

export class GifExporter {
  constructor(animationController, map) {
    this.animationController = animationController;
    this.map = map;
    this.isExporting = false;
    this.onProgress = null;
    this.onComplete = null;
  }

  /**
   * Export animation as GIF
   */
  async export(options = {}) {
    if (this.isExporting) {
      throw new Error('Export already in progress');
    }

    const {
      startDate,
      endDate,
      duration = 10, // seconds
      width = 1200,
      height = 800,
      fps = 15,
      quality = 10, // 1-30, lower is better quality but slower
      captureBox = null // { left, top, width, height } in pixels
    } = options;

    console.log('Starting export with options:', { startDate, endDate, duration, width, height, fps, quality });

    this.isExporting = true;

    try {
      // Get unique activity dates within the range (to skip empty days)
      const activityDates = this._getActivityDatesInRange(startDate, endDate);
      console.log(`Found ${activityDates.length} days with activities`);

      // Calculate frame count based on activity days, not total time
      // Distribute frames across days with activities
      const frameCount = Math.floor(duration * fps);
      const frames = [];

      // If no activities, fall back to standard behavior
      if (activityDates.length === 0) {
        console.log('No activities found in range, using uniform time distribution');
      }

      console.log(`Will capture ${frameCount} frames`);

      // Update progress
      this._updateProgress(0, `Capturing ${frameCount} frames...`);

      // Save current animation state
      const wasPlaying = this.animationController.isPlaying;
      const originalTime = this.animationController.currentTime;
      this.animationController.pause();

      // Calculate frame times based on activity dates (skip empty periods)
      const frameTimes = this._calculateFrameTimes(startDate, endDate, frameCount, activityDates);

      // Calculate the actual lat/lng bounds for the capture box area
      // If no capture box specified, use full map bounds
      let exportBounds;
      if (captureBox) {
        exportBounds = this._getCaptureBoxBounds(captureBox);
        console.log('Using capture box bounds:', exportBounds);
      } else {
        exportBounds = this.map.getBounds();
        console.log('Using full map bounds:', exportBounds);
      }

      // Capture base map tiles once (reused for all frames)
      this._updateProgress(5, 'Capturing base map...');
      const baseMapCanvas = await this._captureBasemap(width, height, captureBox);
      console.log('Base map captured');

      // Capture frames using calculated times (skips empty periods)
      for (let i = 0; i < frameTimes.length; i++) {
        const currentTime = frameTimes[i];

        // Seek animation to this time (in background)
        this.animationController.seek(currentTime);

        // Small delay for state to update
        await this._waitForMapRender();

        // Capture frame (polylines only, then composite with base map)
        const canvas = await this._captureMapCanvas(width, height, baseMapCanvas, exportBounds, false);
        frames.push(canvas);

        // Update progress (5-50% for frame capture)
        const progress = 5 + ((i + 1) / frameTimes.length) * 45;
        this._updateProgress(progress, `Captured frame ${i + 1}/${frameTimes.length}`);
      }

      // Capture final "heatmap" frame showing all routes with equal opacity
      // This highlights the most common paths through overlapping
      // We draw ALL activities directly, bypassing the maxVisibleActivities limit
      const finalCanvas = await this._captureHeatmapFrame(width, height, baseMapCanvas, exportBounds);
      frames.push(finalCanvas);
      this._updateProgress(50, `Captured final heatmap frame`);

      // Restore animation state
      this.animationController.seek(originalTime);
      if (wasPlaying) {
        this.animationController.play();
      }

      // Create GIF
      this._updateProgress(50, 'Encoding GIF...');
      const gifBlob = await this._encodeGif(frames, fps, quality, width, height);

      // Complete
      this._updateProgress(100, 'Complete!');
      this.isExporting = false;

      if (this.onComplete) {
        this.onComplete(gifBlob);
      }

      return gifBlob;

    } catch (error) {
      this.isExporting = false;
      throw error;
    }
  }

  /**
   * Convert capture box pixel coordinates to lat/lng bounds
   */
  _getCaptureBoxBounds(captureBox) {
    const mapContainer = this.map.getContainer();
    const mapWidth = mapContainer.clientWidth;
    const mapHeight = mapContainer.clientHeight;

    // Convert pixel positions to lat/lng using Leaflet's containerPointToLatLng
    const topLeft = this.map.containerPointToLatLng([captureBox.left, captureBox.top]);
    const bottomRight = this.map.containerPointToLatLng([
      captureBox.left + captureBox.width,
      captureBox.top + captureBox.height
    ]);

    return L.latLngBounds(topLeft, bottomRight);
  }

  /**
   * Capture base map tiles (called once per export)
   * If captureBox is provided, only capture that area
   */
  async _captureBasemap(width, height, captureBox = null) {
    const mapContainer = this.map.getContainer();

    // Use html2canvas to capture the map tiles
    const fullCanvas = await html2canvas(mapContainer, {
      scale: 1,
      useCORS: true,
      logging: false,
      backgroundColor: '#f5f5f5'
    });

    // If capture box specified, crop to that area
    if (captureBox) {
      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = width;
      croppedCanvas.height = height;
      const ctx = croppedCanvas.getContext('2d');

      // Draw the cropped portion of the map, scaled to export dimensions
      ctx.drawImage(
        fullCanvas,
        captureBox.left, captureBox.top, captureBox.width, captureBox.height, // Source rectangle
        0, 0, width, height // Destination rectangle
      );

      return croppedCanvas;
    }

    return fullCanvas;
  }

  /**
   * Capture map as canvas - composite base map with polylines
   * @param {boolean} isLastFrame - If true, render all routes with equal opacity to highlight overlaps
   */
  async _captureMapCanvas(width, height, baseMapCanvas, bounds, isLastFrame = false) {
    console.log(`Capturing frame: ${this.animationController.activePolylines.size} active polylines${isLastFrame ? ' (final heatmap frame)' : ''}`);
    console.log(`Export dimensions: ${width}x${height}`);
    console.log(`Base map canvas: ${baseMapCanvas.width}x${baseMapCanvas.height}`);
    console.log(`Bounds:`, bounds.toBBoxString());

    // Create an offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Draw base map first (scale it to export size)
    if (baseMapCanvas) {
      // Draw the captured base map, scaled to the export dimensions
      ctx.drawImage(baseMapCanvas, 0, 0, baseMapCanvas.width, baseMapCanvas.height, 0, 0, width, height);
    } else {
      // Fallback to gray background
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(0, 0, width, height);
    }

    // Draw all visible polylines on top
    let drawnCount = 0;
    this.animationController.activePolylines.forEach((data) => {
      const coords = data.coords;
      if (coords.length < 2) return;

      // Convert lat/lng to pixel coordinates using the export bounds
      const points = coords.map(([lat, lng]) => {
        const pixel = this._latLngToPixel(lat, lng, bounds, width, height);
        return pixel;
      });

      // Debug first point
      if (drawnCount === 0) {
        console.log(`First activity first point: lat/lng=${coords[0]}, pixel=${points[0].x},${points[0].y}`);
      }

      // Draw polyline
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }

      // Get the current style from the polyline (includes recency/overlap calculations)
      const polylineOptions = data.polyline.options;
      const baseColor = this._getActivityColor(data.activity.type);

      if (isLastFrame) {
        // Final frame: equal opacity for all routes to highlight overlapping paths
        // Using low opacity so overlaps become more visible through additive blending
        ctx.strokeStyle = baseColor;
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 0.3;
      } else {
        // Normal frame: use recency/overlap calculations
        const activityDate = new Date(data.activity.start_date);
        const style = this.animationController._calculateStyle(activityDate, coords, this.animationController.currentTime);
        const color = this.animationController._darkenColor(baseColor, style.recencyScore * 0.3);

        ctx.strokeStyle = color;
        ctx.lineWidth = style.weight * 1.5; // Scale up slightly for export
        ctx.globalAlpha = style.opacity;
      }
      ctx.stroke();
      drawnCount++;
    });

    ctx.globalAlpha = 1;

    console.log(`Drew ${drawnCount} polylines on canvas`);

    return canvas;
  }

  /**
   * Convert lat/lng to pixel coordinates based on map bounds
   */
  _latLngToPixel(lat, lng, bounds, width, height) {
    const north = bounds.getNorth();
    const south = bounds.getSouth();
    const east = bounds.getEast();
    const west = bounds.getWest();

    // Calculate relative position within bounds (0-1)
    const x = (lng - west) / (east - west);
    const y = (north - lat) / (north - south);

    // Convert to pixel coordinates
    return {
      x: x * width,
      y: y * height
    };
  }

  /**
   * Wait for map tiles to load
   */
  _waitForMapRender() {
    return new Promise(resolve => {
      // Just a small delay to ensure state is updated
      setTimeout(resolve, 50);
    });
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
   * Capture heatmap frame showing ALL activities with equal opacity
   * Bypasses the maxVisibleActivities limit to show complete route coverage
   */
  async _captureHeatmapFrame(width, height, baseMapCanvas, bounds) {
    const activities = this.animationController.activities;
    console.log(`Capturing heatmap frame with ALL ${activities.length} activities`);

    // Create an offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Draw base map first
    if (baseMapCanvas) {
      ctx.drawImage(baseMapCanvas, 0, 0, baseMapCanvas.width, baseMapCanvas.height, 0, 0, width, height);
    } else {
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(0, 0, width, height);
    }

    // Draw ALL activities with equal opacity
    let drawnCount = 0;
    activities.forEach((activity) => {
      const polylineStr = activity.map?.summary_polyline;
      if (!polylineStr) return;

      // Decode polyline
      const coords = this._decodePolyline(polylineStr);
      if (coords.length < 2) return;

      // Convert lat/lng to pixel coordinates
      const points = coords.map(([lat, lng]) => {
        const pixel = this._latLngToPixel(lat, lng, bounds, width, height);
        return pixel;
      });

      // Draw polyline
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }

      // Equal style for all routes - low opacity for additive overlap effect
      const baseColor = this._getActivityColor(activity.type);
      ctx.strokeStyle = baseColor;
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = 0.3;
      ctx.stroke();
      drawnCount++;
    });

    ctx.globalAlpha = 1;
    console.log(`Drew ${drawnCount} activities on heatmap frame`);

    return canvas;
  }

  /**
   * Decode Google polyline format to array of [lat, lng] coordinates
   */
  _decodePolyline(encoded) {
    const points = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let b;
      let shift = 0;
      let result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push([lat / 1e5, lng / 1e5]);
    }

    return points;
  }

  /**
   * Get unique activity dates within a date range
   */
  _getActivityDatesInRange(startDate, endDate) {
    const activities = this.animationController.activities;
    const dateSet = new Set();

    activities.forEach(activity => {
      const activityDate = new Date(activity.start_date);
      if (activityDate >= startDate && activityDate <= endDate) {
        // Store date as YYYY-MM-DD string to get unique days
        const dateKey = activityDate.toISOString().split('T')[0];
        dateSet.add(dateKey);
      }
    });

    // Convert back to sorted Date objects (end of each day)
    const dates = Array.from(dateSet)
      .sort()
      .map(dateStr => {
        const d = new Date(dateStr);
        d.setHours(23, 59, 59, 999);
        return d;
      });

    return dates;
  }

  /**
   * Calculate frame times, skipping empty periods between activity days
   */
  _calculateFrameTimes(startDate, endDate, frameCount, activityDates) {
    // If no activities, fall back to uniform distribution
    if (activityDates.length === 0) {
      const totalTime = endDate - startDate;
      const timeStep = totalTime / frameCount;
      return Array.from({ length: frameCount }, (_, i) =>
        new Date(startDate.getTime() + (timeStep * i))
      );
    }

    // Map frames to activity dates - each frame shows progress through activity days
    // This skips periods with no activities
    const frameTimes = [];

    for (let i = 0; i < frameCount; i++) {
      // Calculate which activity day this frame corresponds to
      const progress = i / (frameCount - 1 || 1);
      const dateIndex = Math.min(
        Math.floor(progress * activityDates.length),
        activityDates.length - 1
      );
      frameTimes.push(activityDates[dateIndex]);
    }

    return frameTimes;
  }

  /**
   * Encode frames as GIF
   */
  _encodeGif(canvases, fps, quality, width, height) {
    return new Promise((resolve, reject) => {
      try {
        const gif = new GIF({
          workers: 2,
          quality: quality,
          width: width,
          height: height,
          workerScript: '/gif.worker.js'
        });

        console.log('GIF encoder created, adding frames...');

        // Add frames to GIF
        const frameDelay = 1000 / fps; // ms between frames
        canvases.forEach((canvas, index) => {
          console.log(`Adding frame ${index + 1}/${canvases.length}`);
          gif.addFrame(canvas, { delay: frameDelay, copy: true });
        });

        console.log('All frames added, starting render...');

        // Handle encoding progress
        gif.on('progress', (progress) => {
          const totalProgress = 50 + (progress * 50); // Second 50% is encoding
          this._updateProgress(totalProgress, `Encoding GIF... ${Math.round(progress * 100)}%`);
        });

        // Handle completion
        gif.on('finished', (blob) => {
          console.log('GIF encoding complete!', blob);
          resolve(blob);
        });

        // Handle errors
        gif.on('error', (error) => {
          console.error('GIF encoding error:', error);
          reject(error);
        });

        // Start encoding
        gif.render();
      } catch (error) {
        console.error('Error creating GIF encoder:', error);
        reject(error);
      }
    });
  }

  /**
   * Update progress callback
   */
  _updateProgress(percent, message) {
    if (this.onProgress) {
      this.onProgress(percent, message);
    }
  }

  /**
   * Download blob as file
   */
  static download(blob, filename = 'strava-animation.gif') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
