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
      captureBox = null, // { left, top, width, height } in pixels
      dateOverlay = { enabled: false }, // { enabled, corner, color }
      includeHeatmapFrame = true
    } = options;

    console.log('Starting export with options:', { startDate, endDate, duration, width, height, fps, quality });

    this.isExporting = true;

    try {
      // Get unique activity dates within the range (to skip empty days)
      const activityDates = this._getActivityDatesInRange(startDate, endDate);
      console.log(`Found ${activityDates.length} days with activities`);

      // Sample activity dates down to at most (duration-1)*fps frames.
      // Each sampled date becomes exactly one frame so no date ever gets
      // duplicated (which would make it appear longer than others).
      const maxFrames = Math.max(1, Math.floor((duration - 1) * fps));
      const frameTimes = this._sampleDates(activityDates, maxFrames, startDate, endDate);
      const frameCount = frameTimes.length;

      console.log(`Will capture ${frameCount} frames`);

      // Update progress
      this._updateProgress(0, `Capturing ${frameCount} frames...`);

      // Pause animation during export (frames drawn directly, no seeking)
      const wasPlaying = this.animationController.isPlaying;
      const originalTime = this.animationController.currentTime;
      this.animationController.pause();


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

      // Each frame gets equal delay so every date appears for the same duration
      const frameDelayMs = Math.round((duration - 1) * 1000 / frameCount);
      const frames = [];

      // Capture frames — draw directly from activities array, no Leaflet seek needed
      for (let i = 0; i < frameTimes.length; i++) {
        const currentTime = frameTimes[i];
        const isLast = i === frameTimes.length - 1;

        const canvas = await this._captureMapCanvas(width, height, baseMapCanvas, exportBounds, currentTime, dateOverlay);
        frames.push({ canvas, delay: isLast ? 1000 : frameDelayMs });

        // Update progress (5-50% for frame capture)
        const progress = 5 + ((i + 1) / frameTimes.length) * 45;
        this._updateProgress(progress, `Captured frame ${i + 1}/${frameTimes.length}`);
      }

      // Optionally capture final "heatmap" frame showing all routes with equal opacity
      if (includeHeatmapFrame) {
        const finalCanvas = await this._captureHeatmapFrame(width, height, baseMapCanvas, exportBounds, endDate, dateOverlay);
        frames.push({ canvas: finalCanvas, delay: 1000 });
        this._updateProgress(50, `Captured final heatmap frame`);
      }

      // Restore animation state
      this.animationController.seek(originalTime);
      if (wasPlaying) {
        this.animationController.play();
      }

      // Create GIF
      this._updateProgress(50, 'Encoding GIF...');
      const gifBlob = await this._encodeGif(frames, quality, width, height);

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

    // Temporarily hide capture box UI elements
    const captureBoxEl = document.getElementById('capture-box');
    const captureOverlay = document.getElementById('capture-overlay');
    const originalBoxDisplay = captureBoxEl ? captureBoxEl.style.display : null;
    const originalOverlayDisplay = captureOverlay ? captureOverlay.style.display : null;

    if (captureBoxEl) captureBoxEl.style.display = 'none';
    if (captureOverlay) captureOverlay.style.display = 'none';

    // Use html2canvas to capture the map tiles
    const fullCanvas = await html2canvas(mapContainer, {
      scale: 1,
      useCORS: true,
      logging: false,
      backgroundColor: '#f5f5f5'
    });

    // Restore capture box UI elements
    if (captureBoxEl && originalBoxDisplay !== null) captureBoxEl.style.display = originalBoxDisplay;
    if (captureOverlay && originalOverlayDisplay !== null) captureOverlay.style.display = originalOverlayDisplay;

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
   * @param {Date} currentTime - Current animation time for date overlay
   * @param {Object} dateOverlay - Date overlay settings { enabled, corner, color }
   */
  async _captureMapCanvas(width, height, baseMapCanvas, bounds, currentTime, dateOverlay = { enabled: false }) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Draw base map
    if (baseMapCanvas) {
      ctx.drawImage(baseMapCanvas, 0, 0, baseMapCanvas.width, baseMapCanvas.height, 0, 0, width, height);
    } else {
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(0, 0, width, height);
    }

    // Clip to canvas bounds so off-screen polyline segments don't bleed in from edges
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();

    // Draw activities up to currentTime directly from the sorted activities array
    const ac = this.animationController;
    let drawnCount = 0;
    ac.sortedActivities.forEach((activity) => {
      if (new Date(activity.start_date) > currentTime) return;

      const polylineStr = activity.map?.summary_polyline;
      if (!polylineStr) return;
      const coords = this._decodePolyline(polylineStr);
      if (coords.length < 2) return;

      const points = coords.map(([lat, lng]) => this._latLngToPixel(lat, lng, bounds, width, height));

      const baseColor = this._getActivityColor(activity.type);
      const activityDate = new Date(activity.start_date);
      const style = ac._calculateStyle(activityDate, coords, currentTime);
      const color = ac._darkenColor(baseColor, style.recencyScore * 0.3);

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = style.weight * 1.5;
      ctx.globalAlpha = style.opacity;
      ctx.stroke();
      drawnCount++;
    });

    ctx.restore();
    console.log(`Drew ${drawnCount} polylines for time ${currentTime}`);

    // Render date overlay if enabled
    if (dateOverlay.enabled && currentTime) {
      this._renderDateOverlay(ctx, width, height, currentTime, dateOverlay.corner, dateOverlay.color, dateOverlay.format);
    }

    return canvas;
  }

  /**
   * Convert lat/lng to pixel coordinates using Web Mercator projection,
   * matching how Leaflet/CartoDB renders map tiles.
   */
  _latLngToPixel(lat, lng, bounds, width, height) {
    const toMercatorY = (latDeg) => {
      const latRad = latDeg * Math.PI / 180;
      return Math.log(Math.tan(Math.PI / 4 + latRad / 2));
    };

    const west = bounds.getWest();
    const east = bounds.getEast();
    const north = bounds.getNorth();
    const south = bounds.getSouth();

    const mercNorth = toMercatorY(north);
    const mercSouth = toMercatorY(south);
    const mercLat = toMercatorY(lat);

    const x = (lng - west) / (east - west) * width;
    const y = (mercNorth - mercLat) / (mercNorth - mercSouth) * height;

    return { x, y };
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
   * Get color for activity type - uses the color scheme from AnimationController
   */
  _getActivityColor(type) {
    // Get colors from AnimationController's color function
    const colors = this.animationController.getColorsFn();
    return colors[type] || colors['default'] || '#888888';
  }

  /**
   * Calculate dynamic opacity based on activity density in capture area
   * Uses logarithmic scaling for better visibility across all density levels
   */
  _calculateHeatmapOpacity(activityCount) {
    // Use logarithmic scaling to handle wide range of activity counts
    // Few activities (1-10): high opacity (0.5-0.35)
    // Medium activities (10-50): medium opacity (0.35-0.2)
    // Many activities (50-200): low opacity (0.2-0.12)
    // Very many activities (200+): very low opacity (0.12-0.08)

    if (activityCount <= 10) {
      // Linear scaling for very few activities
      return Math.max(0.35, 0.5 - (activityCount / 10) * 0.15);
    } else if (activityCount <= 50) {
      // Gentle decrease for medium density
      return Math.max(0.2, 0.35 - ((activityCount - 10) / 40) * 0.15);
    } else if (activityCount <= 200) {
      // Slower decrease for high density
      return Math.max(0.12, 0.2 - ((activityCount - 50) / 150) * 0.08);
    } else {
      // Logarithmic scaling for very high density to prevent oversaturation
      const logScale = Math.log10(activityCount / 200 + 1);
      return Math.max(0.06, 0.12 - logScale * 0.04);
    }
  }

  /**
   * Capture heatmap frame showing ALL activities with dynamic opacity
   * Bypasses the maxVisibleActivities limit to show complete route coverage
   * Uses same opacity calculation as screen animation for consistency
   * @param {Date} currentTime - Current animation time for date overlay
   * @param {Object} dateOverlay - Date overlay settings { enabled, corner, color }
   */
  async _captureHeatmapFrame(width, height, baseMapCanvas, bounds, currentTime = null, dateOverlay = { enabled: false }) {
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

    // Count activities in bounds for opacity calculation
    let activitiesInBounds = 0;
    activities.forEach((activity) => {
      const polylineStr = activity.map?.summary_polyline;
      if (!polylineStr) return;
      const coords = this._decodePolyline(polylineStr);
      if (coords.some(([lat, lng]) => bounds.contains([lat, lng]))) activitiesInBounds++;
    });

    const dynamicOpacity = this._calculateHeatmapOpacity(activitiesInBounds);

    // Clip to canvas so off-screen segments don't bleed in
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();

    let drawnCount = 0;
    activities.forEach((activity) => {
      const polylineStr = activity.map?.summary_polyline;
      if (!polylineStr) return;
      const coords = this._decodePolyline(polylineStr);
      if (coords.length < 2) return;

      const points = coords.map(([lat, lng]) => this._latLngToPixel(lat, lng, bounds, width, height));

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.strokeStyle = this._getActivityColor(activity.type);
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = dynamicOpacity;
      ctx.stroke();
      drawnCount++;
    });

    ctx.restore();
    console.log(`Drew ${drawnCount} activities on heatmap frame`);

    // Render date overlay if enabled
    if (dateOverlay.enabled && currentTime) {
      this._renderDateOverlay(ctx, width, height, currentTime, dateOverlay.corner, dateOverlay.color, dateOverlay.format);
    }

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

    // Extend endDate to end-of-day so activities at any time on the last day are included
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);

    activities.forEach(activity => {
      const activityDate = new Date(activity.start_date);
      if (activityDate >= startDate && activityDate <= endOfDay) {
        // Use local date parts so activities in non-UTC timezones land on the right day
        const y = activityDate.getFullYear();
        const m = String(activityDate.getMonth() + 1).padStart(2, '0');
        const d = String(activityDate.getDate()).padStart(2, '0');
        dateSet.add(`${y}-${m}-${d}`);
      }
    });

    // Convert back to sorted Date objects (local end-of-day)
    const dates = Array.from(dateSet)
      .sort()
      .map(dateStr => {
        const [y, m, d] = dateStr.split('-');
        return new Date(+y, +m - 1, +d, 23, 59, 59, 999); // local end-of-day
      });

    return dates;
  }

  /**
   * Sample activity dates down to at most maxFrames unique entries.
   * Returns one date per frame with no duplicates, so every date gets
   * exactly the same screen time in the GIF.
   */
  _sampleDates(activityDates, maxFrames, startDate, endDate) {
    if (activityDates.length === 0) {
      // No activities — fall back to uniform distribution across the range
      const totalMs = endDate - startDate;
      const count = Math.max(1, maxFrames);
      return Array.from({ length: count }, (_, i) =>
        new Date(startDate.getTime() + (totalMs * i / (count - 1 || 1)))
      );
    }

    if (activityDates.length <= maxFrames) {
      // Fewer (or equal) unique dates than frames — use every date once
      return activityDates;
    }

    // More dates than frames — sample evenly, first → last, no duplicates
    const sampled = [];
    for (let i = 0; i < maxFrames; i++) {
      const progress = i / (maxFrames - 1);
      const idx = Math.round(progress * (activityDates.length - 1));
      sampled.push(activityDates[idx]);
    }
    return sampled;
  }

  /**
   * Encode frames as GIF
   */
  _encodeGif(frames, quality, width, height) {
    return new Promise((resolve, reject) => {
      try {
        const gif = new GIF({
          workers: 2,
          quality: quality,
          width: width,
          height: height,
          workerScript: '/gif.worker.js'
        });

        console.log(`GIF encoder created, adding ${frames.length} frames...`);

        // Add frames — each carries its own delay
        frames.forEach(({ canvas, delay }, index) => {
          console.log(`Adding frame ${index + 1}/${frames.length} (delay ${delay}ms)`);
          gif.addFrame(canvas, { delay, copy: true });
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
   * Format date based on format string
   */
  _formatDate(date, format = 'D MMMM YYYY') {
    if (!date) return '';

    const day = date.getDate(); // No leading zero
    const monthIndex = date.getMonth();
    const year = date.getFullYear();
    const month2Digit = String(monthIndex + 1).padStart(2, '0');

    const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthsFull = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    switch (format) {
      case 'YYYY-MM-DD':
        const day2Digit = String(day).padStart(2, '0');
        return `${year}-${month2Digit}-${day2Digit}`;
      case 'D MMM YYYY':
        return `${day} ${monthsShort[monthIndex]} ${year}`;
      case 'D MMMM YYYY':
        return `${day} ${monthsFull[monthIndex]} ${year}`;
      case 'MMM YYYY':
        return `${monthsShort[monthIndex]} ${year}`;
      case 'MMMM YYYY':
        return `${monthsFull[monthIndex]} ${year}`;
      default:
        return `${day} ${monthsFull[monthIndex]} ${year}`;
    }
  }

  /**
   * Render date overlay on canvas
   */
  _renderDateOverlay(ctx, width, height, date, corner, color, format = 'DD MMMM YYYY') {
    if (!date) return;

    const dateText = this._formatDate(date, format);
    const padding = Math.max(15, width * 0.015); // Responsive padding (min 15px)
    const fontSize = Math.max(16, width * 0.02); // Responsive font size (min 16px)

    ctx.save();
    ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'top';

    // Calculate text dimensions
    const metrics = ctx.measureText(dateText);
    const textWidth = metrics.width;
    const textHeight = fontSize;

    // Position based on corner
    let x, y;
    switch (corner) {
      case 'top-left':
        x = padding;
        y = padding;
        ctx.textAlign = 'left';
        break;
      case 'top-right':
        x = width - padding;
        y = padding;
        ctx.textAlign = 'right';
        break;
      case 'bottom-left':
        x = padding;
        y = height - padding - textHeight;
        ctx.textAlign = 'left';
        break;
      case 'bottom-right':
        x = width - padding;
        y = height - padding - textHeight;
        ctx.textAlign = 'right';
        break;
      default:
        x = padding;
        y = padding;
        ctx.textAlign = 'left';
    }

    // Add subtle shadow for better visibility
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    ctx.fillText(dateText, x, y);
    ctx.restore();
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
