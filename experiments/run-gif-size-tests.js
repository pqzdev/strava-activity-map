/**
 * Automated GIF Size Testing Script
 *
 * This script automates the process of generating GIFs with different parameters
 * and recording their file sizes to help derive an estimation formula.
 *
 * USAGE:
 * 1. Load the app and authenticate with Strava
 * 2. Open browser console
 * 3. Paste this script and run it
 * 4. Script will automatically:
 *    - Generate GIFs with different parameters
 *    - Record file sizes
 *    - Export results as CSV/JSON
 *
 * WARNING: This will take 10-20 minutes to complete all tests!
 */

class GifSizeExperiment {
  constructor() {
    this.results = [];
    this.currentTest = 0;
    this.testConfigs = this.generateTestMatrix();
  }

  generateTestMatrix() {
    const configs = [];

    // Set 1: Dimension Impact (10s, 15 FPS)
    const dimensions = [
      { w: 800, h: 600, name: 'Small' },
      { w: 1200, h: 800, name: 'Medium' },
      { w: 1600, h: 1200, name: 'Large' },
      { w: 1920, h: 1080, name: '1080p' }
    ];
    dimensions.forEach(dim => {
      configs.push({
        set: 'dimensions',
        width: dim.w,
        height: dim.h,
        fps: 15,
        duration: 10,
        name: `Dim-${dim.name}`
      });
    });

    // Set 2: FPS Impact (1200×800, 10s)
    const fpsValues = [10, 15, 20, 30];
    fpsValues.forEach(fps => {
      configs.push({
        set: 'fps',
        width: 1200,
        height: 800,
        fps: fps,
        duration: 10,
        name: `FPS-${fps}`
      });
    });

    // Set 3: Duration Impact (1200×800, 15 FPS)
    const durations = [5, 10, 15, 20];
    durations.forEach(dur => {
      configs.push({
        set: 'duration',
        width: 1200,
        height: 800,
        fps: 15,
        duration: dur,
        name: `Dur-${dur}s`
      });
    });

    return configs;
  }

  async runAllTests() {
    console.log(`🧪 Starting GIF Size Experiment`);
    console.log(`📊 Total tests to run: ${this.testConfigs.length}`);
    console.log(`⏱️  Estimated time: ${Math.ceil(this.testConfigs.length * 1.5)} minutes`);
    console.log(`\n⚠️  Do not close this tab or interact with the page during testing!\n`);

    for (let i = 0; i < this.testConfigs.length; i++) {
      const config = this.testConfigs[i];
      this.currentTest = i + 1;

      console.log(`\n[${this.currentTest}/${this.testConfigs.length}] Testing: ${config.name}`);
      console.log(`   Settings: ${config.width}×${config.height}, ${config.fps}fps, ${config.duration}s`);

      try {
        const result = await this.runSingleTest(config);
        this.results.push(result);
        console.log(`   ✅ Complete: ${(result.size / 1024 / 1024).toFixed(2)} MB`);
      } catch (error) {
        console.error(`   ❌ Failed: ${error.message}`);
        this.results.push({ ...config, size: null, error: error.message });
      }

      // Wait a bit between tests to let browser recover
      if (i < this.testConfigs.length - 1) {
        console.log(`   ⏸️  Waiting 3 seconds before next test...`);
        await this.sleep(3000);
      }
    }

    console.log(`\n✨ All tests complete!`);
    this.analyzeResults();
    this.exportResults();
  }

  async runSingleTest(config) {
    // Set export parameters in the UI
    document.getElementById('export-width').value = config.width;
    document.getElementById('export-height').value = config.height;
    document.getElementById('export-fps').value = config.fps;
    document.getElementById('export-duration').value = config.duration;

    // Trigger change events to update UI
    document.getElementById('export-width').dispatchEvent(new Event('input'));
    document.getElementById('export-height').dispatchEvent(new Event('input'));

    // Wait for UI to update
    await this.sleep(100);

    // Start export
    const exportPromise = new Promise((resolve, reject) => {
      const originalExport = window.exportGif;
      let downloadLinkSet = false;

      // Monitor for download link
      const checkInterval = setInterval(() => {
        const downloadLink = document.getElementById('download-link');
        if (downloadLink && downloadLink.href && downloadLink.href.startsWith('blob:') && !downloadLinkSet) {
          downloadLinkSet = true;
          clearInterval(checkInterval);

          // Get blob size
          fetch(downloadLink.href)
            .then(response => response.blob())
            .then(blob => {
              resolve({
                ...config,
                size: blob.size,
                megapixels: config.width * config.height / 1000000,
                totalFrames: config.fps * config.duration,
                pixelFrames: config.width * config.height * config.fps * config.duration,
                timestamp: new Date().toISOString()
              });

              // Revoke blob URL to free memory
              URL.revokeObjectURL(downloadLink.href);
            })
            .catch(reject);
        }
      }, 200);

      // Timeout after 2 minutes
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Export timeout'));
      }, 120000);
    });

    // Click export button
    document.getElementById('export-btn').click();

    return exportPromise;
  }

  analyzeResults() {
    console.log(`\n📊 ANALYSIS RESULTS\n`);

    // Group by test set
    const sets = {};
    this.results.forEach(r => {
      if (!r.error) {
        if (!sets[r.set]) sets[r.set] = [];
        sets[r.set].push(r);
      }
    });

    // Analyze each set
    Object.entries(sets).forEach(([setName, results]) => {
      console.log(`\n${setName.toUpperCase()} SET:`);
      results.forEach(r => {
        const sizeMB = (r.size / 1024 / 1024).toFixed(2);
        const sizePerFrame = (r.size / r.totalFrames / 1024).toFixed(2);
        const sizePerMegapixel = (r.size / r.megapixels / 1024 / 1024).toFixed(2);
        console.log(`  ${r.name}: ${sizeMB} MB (${sizePerFrame} KB/frame, ${sizePerMegapixel} MB/MP)`);
      });
    });

    // Try to fit a simple linear model
    console.log(`\n📈 LINEAR REGRESSION ANALYSIS:`);
    this.performRegression();
  }

  performRegression() {
    const validResults = this.results.filter(r => !r.error && r.size);

    if (validResults.length < 3) {
      console.log('   ⚠️  Not enough data points for regression');
      return;
    }

    // Simple regression: Size = a + b × (W × H × F × D)
    const n = validResults.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    validResults.forEach(r => {
      const x = r.pixelFrames / 1e9; // Scale down to avoid overflow
      const y = r.size / 1024 / 1024; // Size in MB
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    });

    const b = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const a = (sumY - b * sumX) / n;

    console.log(`\n   Formula: Size (MB) ≈ ${a.toFixed(2)} + ${b.toFixed(2)} × (W × H × F × D / 1e9)`);
    console.log(`\n   Or simplified: Size (MB) ≈ ${a.toFixed(2)} + ${(b * 1e9).toFixed(0)} × W × H × F × D × 1e-9`);

    // Calculate R²
    const yMean = sumY / n;
    let ssTotal = 0, ssResidual = 0;
    validResults.forEach(r => {
      const x = r.pixelFrames / 1e9;
      const y = r.size / 1024 / 1024;
      const yPred = a + b * x;
      ssTotal += (y - yMean) ** 2;
      ssResidual += (y - yPred) ** 2;
    });
    const r2 = 1 - (ssResidual / ssTotal);
    console.log(`   R² = ${r2.toFixed(4)} (${(r2 * 100).toFixed(1)}% variance explained)`);

    // Show predictions vs actuals
    console.log(`\n   PREDICTIONS vs ACTUALS:`);
    validResults.forEach(r => {
      const x = r.pixelFrames / 1e9;
      const actual = r.size / 1024 / 1024;
      const predicted = a + b * x;
      const error = ((predicted - actual) / actual * 100);
      console.log(`   ${r.name}: Actual=${actual.toFixed(2)}MB, Predicted=${predicted.toFixed(2)}MB, Error=${error.toFixed(1)}%`);
    });
  }

  exportResults() {
    console.log(`\n💾 EXPORT RESULTS:\n`);

    // CSV format
    const csvRows = ['Set,Name,Width,Height,FPS,Duration,Megapixels,TotalFrames,PixelFrames,SizeBytes,SizeMB,Timestamp'];
    this.results.forEach(r => {
      if (!r.error) {
        csvRows.push([
          r.set,
          r.name,
          r.width,
          r.height,
          r.fps,
          r.duration,
          r.megapixels.toFixed(2),
          r.totalFrames,
          r.pixelFrames,
          r.size,
          (r.size / 1024 / 1024).toFixed(2),
          r.timestamp
        ].join(','));
      }
    });
    const csv = csvRows.join('\n');

    console.log('CSV Data (copy and paste into spreadsheet):');
    console.log('---');
    console.log(csv);
    console.log('---\n');

    // JSON format
    console.log('JSON Data:');
    console.log(JSON.stringify(this.results, null, 2));

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gif-size-experiment-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    console.log(`\n✅ CSV file downloaded automatically`);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Instructions
console.log(`
╔══════════════════════════════════════════════════════════════╗
║  GIF Size Estimation Experiment                              ║
╚══════════════════════════════════════════════════════════════╝

📋 SETUP CHECKLIST:
  ✓ Authenticated with Strava
  ✓ Activities loaded on map
  ✓ Export controls visible
  ✓ Browser console open

🚀 TO START EXPERIMENT:

  const experiment = new GifSizeExperiment();
  experiment.runAllTests();

⚠️  IMPORTANT:
  - This will take ~15-20 minutes
  - Do not close tab or interact with page
  - Keep console open to monitor progress
  - Results will download automatically as CSV

💡 AFTER COMPLETION:
  - Copy CSV data from console
  - Analyze results in spreadsheet
  - Use regression formula to implement estimator

Ready? Run: experiment = new GifSizeExperiment(); experiment.runAllTests();
`);
