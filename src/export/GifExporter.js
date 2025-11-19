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
      quality = 10 // 1-30, lower is better quality but slower
    } = options;

    console.log('Starting export with options:', { startDate, endDate, duration, width, height, fps, quality });

    this.isExporting = true;

    try {
      // Calculate frame count
      const frameCount = Math.floor(duration * fps);
      const frames = [];

      console.log(`Will capture ${frameCount} frames`);

      // Update progress
      this._updateProgress(0, `Capturing ${frameCount} frames...`);

      // Save current animation state
      const wasPlaying = this.animationController.isPlaying;
      const originalTime = this.animationController.currentTime;
      this.animationController.pause();

      // Calculate time step between frames
      const totalTime = endDate - startDate;
      const timeStep = totalTime / frameCount;

      // Capture base map tiles once (reused for all frames)
      // Also save the map bounds/zoom for coordinate conversion
      this._updateProgress(5, 'Capturing base map...');
      const mapBounds = this.map.getBounds();
      const mapZoom = this.map.getZoom();
      const baseMapCanvas = await this._captureBasemap(width, height);
      console.log('Base map captured', { bounds: mapBounds, zoom: mapZoom });

      // Capture frames
      for (let i = 0; i < frameCount; i++) {
        // Calculate current time for this frame
        const currentTime = new Date(startDate.getTime() + (timeStep * i));

        // Seek animation to this time (in background)
        this.animationController.seek(currentTime);

        // Small delay for state to update
        await this._waitForMapRender();

        // Capture frame (polylines only, then composite with base map)
        const canvas = await this._captureMapCanvas(width, height, baseMapCanvas, mapBounds, mapZoom);
        frames.push(canvas);

        // Update progress (5-50% for frame capture)
        const progress = 5 + ((i + 1) / frameCount) * 45;
        this._updateProgress(progress, `Captured frame ${i + 1}/${frameCount}`);
      }

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
   * Capture base map tiles (called once per export)
   */
  async _captureBasemap(width, height) {
    const mapContainer = this.map.getContainer();

    // Use html2canvas to capture the map tiles at their current size
    const canvas = await html2canvas(mapContainer, {
      scale: 1,
      useCORS: true,
      logging: false,
      backgroundColor: '#f5f5f5'
    });

    return canvas;
  }

  /**
   * Capture map as canvas - composite base map with polylines
   */
  async _captureMapCanvas(width, height, baseMapCanvas, mapBounds, mapZoom) {
    console.log(`Capturing frame: ${this.animationController.activePolylines.size} active polylines`);
    console.log(`Export dimensions: ${width}x${height}`);
    console.log(`Base map canvas: ${baseMapCanvas.width}x${baseMapCanvas.height}`);
    console.log(`Map bounds:`, mapBounds.toBBoxString());

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

      // Convert lat/lng to pixel coordinates using the saved map bounds
      const points = coords.map(([lat, lng]) => {
        const pixel = this._latLngToPixel(lat, lng, mapBounds, width, height);
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

      // Use the darken color method from animation controller
      const activityDate = new Date(data.activity.start_date);
      const style = this.animationController._calculateStyle(activityDate, coords, this.animationController.currentTime);
      const color = this.animationController._darkenColor(baseColor, style.recencyScore * 0.3);

      ctx.strokeStyle = color;
      ctx.lineWidth = style.weight * 1.5; // Scale up slightly for export
      ctx.globalAlpha = style.opacity;
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
