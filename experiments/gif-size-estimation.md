# GIF Size Estimation Experiment

## Goal
Determine a formula to estimate GIF file size based on export parameters (width, height, FPS, duration, complexity).

## Variables
- **Width (W)**: Pixel width of the GIF
- **Height (H)**: Pixel height of the GIF
- **FPS (F)**: Frames per second
- **Duration (D)**: Duration in seconds
- **Activity Count (A)**: Number of activities visible in the frame

## Derived Metrics
- **Total Pixels**: W × H
- **Total Frames**: F × D
- **Total Pixel-Frames**: W × H × F × D

## Test Matrix

### Set 1: Dimension Impact
Fixed: 10s duration, 15 FPS, Medium complexity (~50 activities)

| Width | Height | Megapixels | Total Frames | Expected Size | Actual Size |
|-------|--------|------------|--------------|---------------|-------------|
| 800   | 600    | 0.48       | 150          | ?             | _____       |
| 1200  | 800    | 0.96       | 150          | ?             | _____       |
| 1600  | 1200   | 1.92       | 150          | ?             | _____       |
| 1920  | 1080   | 2.07       | 150          | ?             | _____       |

### Set 2: FPS Impact
Fixed: 1200×800, 10s duration, Medium complexity (~50 activities)

| FPS | Total Frames | Expected Size | Actual Size |
|-----|--------------|---------------|-------------|
| 10  | 100          | ?             | _____       |
| 15  | 150          | ?             | _____       |
| 20  | 200          | ?             | _____       |
| 30  | 300          | ?             | _____       |

### Set 3: Duration Impact
Fixed: 1200×800, 15 FPS, Medium complexity (~50 activities)

| Duration | Total Frames | Expected Size | Actual Size |
|----------|--------------|---------------|-------------|
| 5        | 75           | ?             | _____       |
| 10       | 150          | ?             | _____       |
| 15       | 225          | ?             | _____       |
| 20       | 300          | ?             | _____       |

### Set 4: Complexity Impact
Fixed: 1200×800, 15 FPS, 10s duration

| Complexity | Activities | Expected Size | Actual Size |
|------------|-----------|---------------|-------------|
| Low        | ~10       | ?             | _____       |
| Medium     | ~50       | ?             | _____       |
| High       | ~200      | ?             | _____       |

## Testing Procedure

1. Load a date range with known activity count for complexity control
2. For each test configuration:
   - Set the export parameters in the UI
   - Export the GIF
   - Record the file size in bytes
   - Record timestamp and any observations
3. Analyze the results to derive a formula

## Expected Formula Structure

Based on GIF compression characteristics:

```
Size (MB) ≈ Base + (k1 × W × H × F × D) + (k2 × A) + (k3 × ColorComplexity)
```

Where:
- Base: Baseline overhead (~100KB for headers)
- k1: Coefficient for pixel-frames contribution
- k2: Coefficient for activity complexity
- k3: Coefficient for color palette complexity

## Simplified Formula (First Attempt)

Since GIF uses LZW compression, we expect:
- Linear relationship with frame count
- Sub-linear relationship with pixel count (due to compression)
- Moderate impact from complexity

Initial hypothesis:
```
Size (MB) ≈ 0.1 + (W × H × F × D / C1) + (A / C2)
```

Where C1 and C2 are constants to be determined.

## Results

_To be filled in after running experiments_

### Analysis Notes
-
-
-

### Final Formula
```
_To be determined after analysis_
```

### Confidence Intervals
- ±X% for typical configurations (800-1920px, 10-20 FPS, 5-15s)
- ±Y% for extreme configurations

## Implementation

Once formula is validated, implement in:
- `/src/export/GifExporter.js` - Add `estimateFileSize(width, height, fps, duration, activityCount)` method
- `/src/main.js` - Update size estimate display when parameters change
