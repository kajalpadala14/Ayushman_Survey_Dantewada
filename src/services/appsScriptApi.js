import { appConfig } from '../config';
import { syncGoogleTime, getISTDateTimeString } from '../utils/dateTime';

const BOOTSTRAP_CACHE_KEY = 'dnt-bootstrap-cache-v1';
const BOOTSTRAP_CACHE_TTL_MS = 5 * 60 * 1000;
let bootstrapRequest = null;

export function readCachedBootstrapData() {
  try {
    const cached = window.localStorage.getItem(BOOTSTRAP_CACHE_KEY);
    if (!cached) return null;

    const payload = JSON.parse(cached);
    if (!payload?.data || Date.now() - Number(payload.savedAt || 0) > BOOTSTRAP_CACHE_TTL_MS) {
      return null;
    }

    return payload.data;
  } catch {
    return null;
  }
}

export function writeCachedBootstrapData(data) {
  try {
    window.localStorage.setItem(BOOTSTRAP_CACHE_KEY, JSON.stringify({
      data,
      savedAt: Date.now()
    }));
  } catch {
    // localStorage can be unavailable in private or constrained browser contexts.
  }
}

async function request(params, options = {}) {
  if (!appConfig.appsScriptUrl) {
    throw new Error('Missing VITE_APPS_SCRIPT_URL.');
  }

  if (!/\/exec(?:\?|$)/.test(appConfig.appsScriptUrl)) {
    throw new Error('VITE_APPS_SCRIPT_URL must be the deployed Google Apps Script /exec URL.');
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, appConfig.apiTimeoutMs);

  try {
    const url = new URL(appConfig.appsScriptUrl);
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value);
      }
    });

    let response;
    try {
      response = await fetch(url.toString(), {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
          ...(options.headers || {})
        }
      });
    } catch (error) {
      if (timedOut || error?.name === 'AbortError') {
        throw new Error(`Backend response timed out after ${appConfig.apiTimeoutMs / 1000} seconds. Check Apps Script deployment and spreadsheet access.`);
      }
      throw new Error(`Backend connection failed: ${error?.message || 'Network error'}`);
    }

    const rawText = await response.text();
    let payload = null;

    if (rawText) {
      try {
        payload = JSON.parse(rawText);
      } catch {
        let cleanError = 'Backend returned unexpected non-JSON response.';
        if (rawText.includes('Page not found') || rawText.includes('unable to open the file') || rawText.includes('404')) {
          cleanError = 'Google Apps Script डिप्लॉयमेंट प्रोसेस हो रहा है (404 Page not found). कृपया 5-10 सेकंड बाद पेज रिफ्रेश (Reload) करें।';
        } else if (rawText.includes('Authorization is required') || rawText.includes('accounts.google.com')) {
          cleanError = 'Google Apps Script एक्सेस अनुमति की आवश्यकता है। कृपया Apps Script में "Who has access" को "Anyone" सेट करें।';
        }
        payload = { ok: false, error: cleanError };
      }
    }

    if (!response.ok || payload?.ok === false) {
      const message = [payload?.error, payload?.details].filter(Boolean).join(' ') || 'Apps Script request failed';
      throw new Error(`${message} (HTTP ${response.status})`);
    }

    return payload;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function getBootstrapData() {
  if (!bootstrapRequest) {
    bootstrapRequest = request({ action: 'bootstrap' })
      .then((payload) => {
        const data = payload?.data || null;
        if (data) {
          if (data.serverTimestamp) {
            syncGoogleTime(data.serverTimestamp);
          }
          writeCachedBootstrapData(data);
        }
        return data;
      })
      .finally(() => {
        bootstrapRequest = null;
      });
  }

  return bootstrapRequest;
}

/**
 * Fetches current time directly from Google Apps Script server
 * Returns formatted IST date time string (YYYY-MM-DD HH:mm:ss)
 */
export async function fetchGoogleServerTime() {
  try {
    const response = await request({ action: 'getTime' });
    if (response?.data?.timestamp) {
      syncGoogleTime(response.data.timestamp);
      return response.data.surveyDate || getISTDateTimeString();
    }
  } catch (err) {
    console.warn('Direct Google time fetch warning, using calibrated time:', err);
  }
  return getISTDateTimeString();
}

export async function saveSurvey(payload) {
  const response = await request(null, {
    method: 'POST',
    body: JSON.stringify({
      action: 'submitSurvey',
      ...payload
    })
  });

  const data = response?.data || null;
  if (data?.surveyDate) {
    try {
      const parsed = new Date(data.surveyDate.replace(' ', 'T') + '+05:30');
      if (!isNaN(parsed.getTime())) {
        syncGoogleTime(parsed.getTime());
      }
    } catch {
      // ignore
    }
  }

  return data;
}
