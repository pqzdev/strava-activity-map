/**
 * Client-side Strava API wrapper
 * Fetches activities directly from browser
 */

export class StravaAPI {
  constructor(auth) {
    this.auth = auth;
    this.baseUrl = 'https://www.strava.com/api/v3';
    this.storageKey = 'strava_activities_cache';
  }

  /**
   * Fetch all activities from Strava API
   */
  async fetchAllActivities(onProgress = null) {
    return this._fetchActivities({ onProgress });
  }

  /**
   * Fetch activities after a given date (epoch seconds)
   */
  async fetchActivitiesAfter(afterEpochSeconds, onProgress = null) {
    return this._fetchActivities({ afterEpochSeconds, onProgress });
  }

  /**
   * Internal paginated fetch
   */
  async _fetchActivities({ afterEpochSeconds = null, onProgress = null } = {}) {
    const activities = [];
    let page = 1;
    const perPage = 200; // Max allowed by Strava

    while (true) {
      const token = await this.auth.getAccessToken();

      let url = `${this.baseUrl}/athlete/activities?per_page=${perPage}&page=${page}`;
      if (afterEpochSeconds) {
        url += `&after=${afterEpochSeconds}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        let errorMessage = response.statusText;
        try {
          const error = await response.json();
          errorMessage = error.message || error.errors?.[0]?.message || errorMessage;

          // Add helpful context for common errors
          if (response.status === 401) {
            errorMessage = `Authorization failed. Please try re-authorizing with Strava. (${errorMessage})`;
          } else if (response.status === 403) {
            errorMessage = `Access forbidden. You may need to grant additional permissions. (${errorMessage})`;
          }
        } catch (e) {
          // Response wasn't JSON, use status text
        }

        throw new Error(`Failed to fetch activities: ${errorMessage}`);
      }

      const batch = await response.json();

      if (batch.length === 0) {
        break; // No more activities
      }

      activities.push(...batch);

      if (onProgress) {
        onProgress(activities.length);
      }

      if (batch.length < perPage) {
        break; // Last page
      }

      page++;

      // Small delay to avoid rate limiting
      await this._delay(100);
    }

    return activities;
  }

  /**
   * Cache activities in localStorage
   */
  cacheActivities(activities) {
    try {
      const data = {
        activities,
        cachedAt: Date.now(),
        count: activities.length
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to cache activities:', e);
    }
  }

  /**
   * Get cached activities
   */
  getCachedActivities() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (!data) return null;

      const parsed = JSON.parse(data);
      return parsed.activities;
    } catch (e) {
      console.error('Failed to parse cached activities:', e);
      return null;
    }
  }

  /**
   * Check if cache exists and is recent
   */
  hasCachedActivities() {
    const data = localStorage.getItem(this.storageKey);
    return !!data;
  }

  /**
   * Get cache info
   */
  getCacheInfo() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (!data) return null;

      const parsed = JSON.parse(data);
      const activities = parsed.activities || [];

      let minDate = null;
      let maxDate = null;
      activities.forEach(a => {
        const d = new Date(a.start_date);
        if (!minDate || d < minDate) minDate = d;
        if (!maxDate || d > maxDate) maxDate = d;
      });

      return {
        count: parsed.count,
        cachedAt: new Date(parsed.cachedAt),
        ageMinutes: Math.round((Date.now() - parsed.cachedAt) / 1000 / 60),
        minDate,
        maxDate
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * Merge new activities into cache, deduplicating by id, keeping sorted by date desc
   */
  mergeAndCacheActivities(newActivities) {
    const existing = this.getCachedActivities() || [];
    const existingIds = new Set(existing.map(a => a.id));
    const merged = [...existing, ...newActivities.filter(a => !existingIds.has(a.id))];
    this.cacheActivities(merged);
    return merged;
  }

  /**
   * Clear cached activities
   */
  clearCache() {
    localStorage.removeItem(this.storageKey);
  }

  /**
   * Get athlete info
   */
  async getAthlete() {
    const token = await this.auth.getAccessToken();

    const response = await fetch(`${this.baseUrl}/athlete`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch athlete info');
    }

    return await response.json();
  }

  /**
   * Download activities as JSON file
   */
  downloadActivitiesJSON(activities) {
    const dataStr = JSON.stringify(activities, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `strava-activities-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Import activities from JSON file
   */
  async importActivitiesJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const activities = JSON.parse(e.target.result);
          if (!Array.isArray(activities)) {
            throw new Error('Invalid format: expected array of activities');
          }
          resolve(activities);
        } catch (error) {
          reject(new Error(`Failed to parse JSON: ${error.message}`));
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsText(file);
    });
  }

  /**
   * Delay helper
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
