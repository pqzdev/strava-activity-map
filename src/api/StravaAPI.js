/**
 * Client-side Strava API wrapper
 * Fetches activities directly from browser
 * Cache stored in IndexedDB (no size limit, unlike localStorage ~5MB)
 */

const DB_NAME = 'strava_activity_map';
const DB_VERSION = 1;
const STORE_NAME = 'cache';
const CACHE_KEY = 'activities';
// Lightweight metadata in localStorage for fast existence checks without opening IndexedDB
const META_KEY = 'strava_cache_meta';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

function idbGet(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

function idbPut(db, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}

function idbDelete(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}

export class StravaAPI {
  constructor(auth) {
    this.auth = auth;
    this.baseUrl = 'https://www.strava.com/api/v3';
    this._db = null;
  }

  async _getDB() {
    if (!this._db) {
      this._db = await openDB();
    }
    return this._db;
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
   * Cache activities in IndexedDB
   */
  async cacheActivities(activities) {
    try {
      const cachedAt = Date.now();
      const db = await this._getDB();
      await idbPut(db, CACHE_KEY, { activities, cachedAt, count: activities.length });

      // Write lightweight metadata to localStorage for fast existence checks
      localStorage.setItem(META_KEY, JSON.stringify({ count: activities.length, cachedAt }));
    } catch (e) {
      console.error('Failed to cache activities:', e);
    }
  }

  /**
   * Get cached activities from IndexedDB
   */
  async getCachedActivities() {
    try {
      const db = await this._getDB();
      const data = await idbGet(db, CACHE_KEY);
      return data ? data.activities : null;
    } catch (e) {
      console.error('Failed to read cached activities:', e);
      return null;
    }
  }

  /**
   * Check if cache exists (fast, uses localStorage metadata)
   */
  hasCachedActivities() {
    return !!localStorage.getItem(META_KEY);
  }

  /**
   * Get cache info (count + date range) — reads metadata fast, then full data for dates
   */
  async getCacheInfo() {
    try {
      const meta = localStorage.getItem(META_KEY);
      if (!meta) return null;

      const { count, cachedAt } = JSON.parse(meta);

      const db = await this._getDB();
      const data = await idbGet(db, CACHE_KEY);
      if (!data) return null;

      const activities = data.activities || [];
      let minDate = null;
      let maxDate = null;
      activities.forEach(a => {
        const d = new Date(a.start_date);
        if (!minDate || d < minDate) minDate = d;
        if (!maxDate || d > maxDate) maxDate = d;
      });

      return {
        count,
        cachedAt: new Date(cachedAt),
        ageMinutes: Math.round((Date.now() - cachedAt) / 1000 / 60),
        minDate,
        maxDate
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * Merge new activities into cache, deduplicating by id
   */
  async mergeAndCacheActivities(newActivities) {
    const existing = await this.getCachedActivities() || [];
    const existingIds = new Set(existing.map(a => a.id));
    const merged = [...existing, ...newActivities.filter(a => !existingIds.has(a.id))];
    await this.cacheActivities(merged);
    return merged;
  }

  /**
   * Clear cached activities
   */
  async clearCache() {
    try {
      const db = await this._getDB();
      await idbDelete(db, CACHE_KEY);
      localStorage.removeItem(META_KEY);
    } catch (e) {
      console.error('Failed to clear cache:', e);
    }
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
  async downloadActivitiesJSON(activities) {
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
