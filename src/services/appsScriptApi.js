import { appConfig } from '../config';
import { syncGoogleTime, getISTDateTimeString } from '../utils/dateTime';

const BOOTSTRAP_CACHE_KEY = 'dnt-bootstrap-cache-v4';
const BOOTSTRAP_CACHE_TTL_MS = 5 * 60 * 1000;
const GOOGLE_SHEET_ID = '12Y_mtNqQfmxtS99KX82c75ArE9XWXeWNOusYcoplImw';
let bootstrapRequest = null;

export function readCachedBootstrapData() {
  try {
    const cached = window.localStorage.getItem(BOOTSTRAP_CACHE_KEY);
    if (!cached) return null;

    const payload = JSON.parse(cached);
    if (!payload?.data || Date.now() - Number(payload.savedAt || 0) > BOOTSTRAP_CACHE_TTL_MS) {
      return null;
    }

    const bens = payload.data.beneficiaries;
    if (Array.isArray(bens) && bens.length > 0 && !bens.some((b) => b.headName && b.headName.trim() !== '')) {
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

function fetchSheetViaJsonp(sheetId) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return reject(new Error('Browser required for JSONP'));
    }

    const callbackName = 'gvizCallback_' + Math.floor(Math.random() * 10000000);
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('Sheet data JSONP timeout'));
    }, 15000);

    function cleanup() {
      window.clearTimeout(timeout);
      try {
        delete window[callbackName];
      } catch {
        window[callbackName] = undefined;
      }
      const existing = document.getElementById(callbackName);
      if (existing && existing.parentNode) {
        existing.parentNode.removeChild(existing);
      }
    }

    window[callbackName] = function (response) {
      cleanup();
      resolve(response);
    };

    const script = document.createElement('script');
    script.id = callbackName;
    script.src = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=responseHandler:${callbackName}`;
    script.onerror = function () {
      cleanup();
      reject(new Error('Failed to load Google Sheet JSONP'));
    };

    document.body.appendChild(script);
  });
}

async function fetchSheetTable() {
  // Strategy 1: JSONP (bypasses CORS directly in any browser)
  try {
    const jsonpRes = await fetchSheetViaJsonp(GOOGLE_SHEET_ID);
    if (jsonpRes?.table?.rows) {
      return jsonpRes.table;
    }
  } catch (err) {
    console.warn('JSONP fetch attempt failed, trying proxy:', err);
  }

  // Strategy 2: Proxy via local server
  try {
    const res = await fetch(`/api/gviz/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:json`);
    if (res.ok) {
      const text = await res.text();
      const jsonStr = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
      const parsed = JSON.parse(jsonStr);
      if (parsed?.table?.rows) {
        return parsed.table;
      }
    }
  } catch (err) {
    console.warn('Proxy fetch attempt failed:', err);
  }

  return null;
}

async function enrichHeadNameFromSheet(beneficiaries) {
  if (!Array.isArray(beneficiaries) || beneficiaries.length === 0) return beneficiaries;
  if (beneficiaries.some((b) => b.headName && b.headName.trim() !== '')) {
    return beneficiaries;
  }

  try {
    const table = await fetchSheetTable();
    const rows = table?.rows;
    if (!Array.isArray(rows) || rows.length === 0) return beneficiaries;

    const cols = table?.cols || [];
    let headColIndex = cols.findIndex((c) => c?.label && (c.label.includes('मुखिया') || c.label.toLowerCase().includes('head')));
    let nameColIndex = cols.findIndex((c) => c?.label && (c.label.includes('सदस्य का नाम') || c.label.toLowerCase().includes('member')));
    let fatherColIndex = cols.findIndex((c) => c?.label && (c.label.includes('पिता/पति') || c.label.toLowerCase().includes('father')));

    if (headColIndex === -1) headColIndex = 8;
    if (nameColIndex === -1) nameColIndex = 4;
    if (fatherColIndex === -1) fatherColIndex = 9;

    const nameMap = new Map();
    rows.forEach((row, i) => {
      const cells = row?.c || [];
      const mukhiya = cells[headColIndex]?.v != null ? String(cells[headColIndex].v).trim() : '';
      const father = cells[fatherColIndex]?.v != null ? String(cells[fatherColIndex].v).trim() : '';
      const memberName = cells[nameColIndex]?.v != null ? String(cells[nameColIndex].v).trim() : '';

      if (mukhiya && memberName) {
        nameMap.set(memberName.toLowerCase(), { mukhiya, father });
      }

      if (beneficiaries[i]) {
        if (mukhiya) beneficiaries[i].headName = mukhiya;
        if (father && (!beneficiaries[i].fatherName || beneficiaries[i].fatherName === 'N/A' || beneficiaries[i].fatherName === '-')) {
          beneficiaries[i].fatherName = father;
        }
      }
    });

    beneficiaries.forEach((b) => {
      if ((!b.headName || b.headName === '-') && b.name) {
        const found = nameMap.get(b.name.toLowerCase());
        if (found?.mukhiya) {
          b.headName = found.mukhiya;
        }
        if (found?.father && (!b.fatherName || b.fatherName === 'N/A' || b.fatherName === '-')) {
          b.fatherName = found.father;
        }
      }
    });
  } catch (err) {
    console.warn('Unable to enrich mukhiya from sheet:', err);
  }

  return beneficiaries;
}

export async function getBootstrapData() {
  if (!bootstrapRequest) {
    bootstrapRequest = request({ action: 'bootstrap' })
      .then(async (payload) => {
        const data = payload?.data || null;
        if (data) {
          if (Array.isArray(data.beneficiaries)) {
            await enrichHeadNameFromSheet(data.beneficiaries);
          }
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
