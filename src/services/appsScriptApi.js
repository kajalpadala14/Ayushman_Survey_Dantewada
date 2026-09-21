import { appConfig } from '../config.js';
import { syncGoogleTime, getISTDateTimeString } from '../utils/dateTime.js';

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
        credentials: 'omit',
        redirect: 'follow',
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

function parseGvizDate(cell) {
  if (!cell) return '';
  if (cell.f) return String(cell.f).trim();
  const v = cell.v;
  if (!v) return '';
  if (v instanceof Date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())} ${pad(v.getHours())}:${pad(v.getMinutes())}:${pad(v.getSeconds())}`;
  }
  const str = String(v).trim();
  const match = str.match(/Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)/);
  if (match) {
    const y = match[1];
    const m = String(Number(match[2]) + 1).padStart(2, '0');
    const d = String(match[3]).padStart(2, '0');
    const hh = String(match[4] || '0').padStart(2, '0');
    const mm = String(match[5] || '0').padStart(2, '0');
    const ss = String(match[6] || '0').padStart(2, '0');
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
  }
  return str;
}

function resolveTableColumnIndices(cols = []) {
  const findColIndex = (exactLabels, includeKeywords, fallbackIndex = -1) => {
    // 1. Try exact label match
    let idx = cols.findIndex((c) =>
      exactLabels.some((lbl) => (c?.label || '').trim().toLowerCase() === lbl.toLowerCase())
    );
    if (idx !== -1) return idx;

    // 2. Try keyword match
    idx = cols.findIndex((c) => {
      const label = (c?.label || '').toLowerCase();
      return includeKeywords.some((kw) => label.includes(kw.toLowerCase()));
    });
    if (idx !== -1) return idx;

    return fallbackIndex;
  };

  return {
    district: findColIndex(['जिला'], ['district'], 0),
    block: findColIndex(['ब्लॉक'], ['block', 'विकासखंड'], 1),
    gp: findColIndex(['ग्राम पंचायत'], ['panchayat', 'gp'], 2),
    village: findColIndex(['ग्राम'], ['village'], 3),
    name: findColIndex(['सदस्य का नाम'], ['member name', 'name'], 4),
    age: findColIndex(['आयु'], ['age'], 5),
    gender: findColIndex(['लिंग'], ['gender'], 6),
    marital: findColIndex(['वैवाहिक स्थिति'], ['marital'], 7),
    head: findColIndex(['मुखिया का नाम', 'मुखिया'], ['head of family', 'head'], 8),
    father: findColIndex(['पिता/पति का नाम', 'पिता/पति'], ['father name', 'father'], 9),
    aadhaar: findColIndex(['आधार नंबर'], ['aadhaar number'], 10),
    enrollment: findColIndex(['एनरोलमेंट नंबर'], ['enrollment'], 11),
    remark: findColIndex(['रिमार्क', 'आधार रिमार्क'], ['remark'], 12),
    ration: findColIndex(['राशन कार्ड नंबर'], ['ration number'], 13),
    rationNo: findColIndex(['राशन कार्ड नहीं है'], ['ration not available'], 14),
    mobile: findColIndex(['मोबाइल नंबर', 'मोबाइल'], ['mobile'], 15),
    status: findColIndex(['सर्वे स्थिति', 'स्थिति'], ['status'], 16),
    surveyId: findColIndex(['सर्वे आईडी'], ['survey id'], 17),
    date: findColIndex(['सर्वे दिनांक'], ['survey date'], 18),
    surveyor: findColIndex(['सर्वेक्षक'], ['surveyor'], 19),
    id: findColIndex(['सदस्य आईडी', 'id'], ['beneficiaryid'], -1)
  };
}

async function enrichSurveyDataFromSheet(beneficiaries) {
  if (!Array.isArray(beneficiaries) || beneficiaries.length === 0) return beneficiaries;

  try {
    const table = await fetchSheetTable();
    const rows = table?.rows;
    if (!Array.isArray(rows) || rows.length === 0) return beneficiaries;

    const cols = table?.cols || [];
    const colIdx = resolveTableColumnIndices(cols);

    const sheetBeneficiaries = rows.map((row, i) => {
      const c = row?.c || [];
      const getVal = (idx) => (idx >= 0 && c[idx]?.v != null ? String(c[idx].v).trim() : '');
      const getFormatted = (idx) => (idx >= 0 ? parseGvizDate(c[idx]) : '');

      const aadhaarNum = getVal(colIdx.aadhaar);
      const enrollmentNum = getVal(colIdx.enrollment);
      const aadhaarRemark = getVal(colIdx.remark);
      const rationNum = getVal(colIdx.ration);
      const rationNo = getVal(colIdx.rationNo);
      const hasRationCard = (rationNo === 'हाँ' || rationNo.toLowerCase() === 'yes')
        ? 'no'
        : ((rationNum || rationNo === 'नहीं' || rationNo.toLowerCase() === 'no') ? 'yes' : 'unknown');

      let aadhaarType = 'unknown';
      if (aadhaarNum) aadhaarType = 'aadhaar';
      else if (enrollmentNum) aadhaarType = 'enrollment';
      else if (aadhaarRemark) aadhaarType = 'remark';

      const explicitStatus = getVal(colIdx.status);
      const surveyId = getVal(colIdx.surveyId);
      const surveyDate = getFormatted(colIdx.date);
      const surveyor = getVal(colIdx.surveyor);
      const mobile = getVal(colIdx.mobile);

      const status = explicitStatus || (aadhaarNum || enrollmentNum || aadhaarRemark || surveyId ? 'Completed' : 'Pending');

      return {
        index: i,
        name: getVal(colIdx.name),
        headName: getVal(colIdx.head),
        fatherName: getVal(colIdx.father),
        age: getVal(colIdx.age),
        gender: getVal(colIdx.gender),
        maritalStatus: getVal(colIdx.marital),
        district: getVal(colIdx.district),
        block: getVal(colIdx.block),
        gp: getVal(colIdx.gp),
        village: getVal(colIdx.village),
        aadhaarNumber: aadhaarNum,
        enrollmentNumber: enrollmentNum,
        aadhaarRemark,
        aadhaarType,
        rationNumber: rationNum,
        hasRationCard,
        rationNotAvailable: rationNo,
        mobile,
        status,
        surveyId,
        surveyDate,
        submittedBy: surveyor
      };
    });

    const nameMap = new Map();
    sheetBeneficiaries.forEach((s) => {
      if (s.name) {
        nameMap.set(s.name.toLowerCase().trim(), s);
      }
    });

    beneficiaries.forEach((b, i) => {
      const match = sheetBeneficiaries[i] || (b.name ? nameMap.get(b.name.toLowerCase().trim()) : null);
      if (!match) return;

      if (!b.headName || b.headName === '—' || b.headName === '-') {
        if (match.headName) b.headName = match.headName;
      }
      if (!b.fatherName || b.fatherName === 'N/A' || b.fatherName === '—' || b.fatherName === '-') {
        if (match.fatherName) b.fatherName = match.fatherName;
      }
      if (!b.maritalStatus && match.maritalStatus) b.maritalStatus = match.maritalStatus;
      if ((b.age === undefined || b.age === 0 || b.age === '') && match.age) b.age = match.age;
      if (!b.gender && match.gender) b.gender = match.gender;

      // Survey fields enrichment
      if (!b.surveyId && match.surveyId) b.surveyId = match.surveyId;
      if ((!b.surveyDate || b.surveyDate === '-') && match.surveyDate) b.surveyDate = match.surveyDate;
      if (!b.submittedBy && match.submittedBy) b.submittedBy = match.submittedBy;

      if (match.status && (b.status === 'Pending' || !b.status) && match.status !== 'Pending') {
        b.status = match.status;
      }

      // Aadhaar info enrichment
      if (!b.aadhaarInfo) b.aadhaarInfo = {};
      if (!b.aadhaarInfo.aadhaarNumber && match.aadhaarNumber) b.aadhaarInfo.aadhaarNumber = match.aadhaarNumber;
      if (!b.aadhaarInfo.enrollmentNumber && match.enrollmentNumber) b.aadhaarInfo.enrollmentNumber = match.enrollmentNumber;
      if (!b.aadhaarInfo.remark && match.aadhaarRemark) b.aadhaarInfo.remark = match.aadhaarRemark;
      if ((!b.aadhaarInfo.type || b.aadhaarInfo.type === 'unknown') && match.aadhaarType !== 'unknown') {
        b.aadhaarInfo.type = match.aadhaarType;
      }

      // Ration info enrichment
      if (!b.rationInfo) b.rationInfo = {};
      if (!b.rationInfo.rationNumber && match.rationNumber) b.rationInfo.rationNumber = match.rationNumber;
      if ((!b.rationInfo.hasRationCard || b.rationInfo.hasRationCard === 'unknown') && match.hasRationCard !== 'unknown') {
        b.rationInfo.hasRationCard = match.hasRationCard;
      }
      if (match.rationNotAvailable) b.rationInfo.rationNotAvailable = match.rationNotAvailable;

      // Mobile info enrichment
      if (!b.mobileInfo) b.mobileInfo = {};
      if (!b.mobileInfo.mobileNumber && match.mobile) b.mobileInfo.mobileNumber = match.mobile;
      if (!b.mobile && match.mobile) b.mobile = match.mobile;
    });
  } catch (err) {
    console.warn('Unable to enrich survey data from sheet:', err);
  }

  return beneficiaries;
}

function parseBeneficiariesFromTable(table) {
  if (!table?.rows || !Array.isArray(table.rows)) return [];
  const cols = table.cols || [];
  const colIdx = resolveTableColumnIndices(cols);

  return table.rows.map((row, idx) => {
    const c = row?.c || [];
    const getVal = (i) => (i >= 0 && c[i]?.v != null ? String(c[i].v).trim() : '');
    const getFormatted = (i) => (i >= 0 ? parseGvizDate(c[i]) : '');

    const name = getVal(colIdx.name);
    const id = (colIdx.id >= 0 && getVal(colIdx.id)) || `AYU-BEN-${String(idx + 1).padStart(6, '0')}`;
    const headName = getVal(colIdx.head);
    const fatherName = getVal(colIdx.father);
    const block = getVal(colIdx.block) || 'Dantewada';
    const gp = getVal(colIdx.gp) || '';
    const village = getVal(colIdx.village) || '';
    const explicitStatus = getVal(colIdx.status);
    const surveyDate = getFormatted(colIdx.date);
    const surveyId = getVal(colIdx.surveyId);
    const surveyor = getVal(colIdx.surveyor);

    const aadhaarNum = getVal(colIdx.aadhaar);
    const enrollmentNum = getVal(colIdx.enrollment);
    const aadhaarRemark = getVal(colIdx.remark);

    const rationNum = getVal(colIdx.ration);
    const rationNo = getVal(colIdx.rationNo);
    const hasRationCard = (rationNo === 'हाँ' || rationNo.toLowerCase() === 'yes')
      ? 'no'
      : ((rationNum || rationNo === 'नहीं' || rationNo.toLowerCase() === 'no') ? 'yes' : 'unknown');

    const mobileNum = getVal(colIdx.mobile);

    let aadhaarType = 'unknown';
    if (aadhaarNum) aadhaarType = 'aadhaar';
    else if (enrollmentNum) aadhaarType = 'enrollment';
    else if (aadhaarRemark) aadhaarType = 'remark';

    let status = 'Pending';
    if (explicitStatus) {
      status = explicitStatus;
    } else if (aadhaarNum || enrollmentNum || aadhaarRemark || surveyId) {
      status = 'Completed';
    }

    const overallResult = status === 'Completed' ? 'VERIFIED' : (status === 'Issue Found' ? 'ISSUE FOUND' : '');

    return {
      id,
      name: name || `Beneficiary ${idx + 1}`,
      headName: headName || '',
      fatherName: fatherName || '',
      district: getVal(colIdx.district) || 'दंतेवाडा',
      block,
      gp,
      village,
      status,
      surveyId,
      surveyDate,
      submittedBy: surveyor,
      assignedSurveyorId: surveyor,
      assignedSurveyorName: surveyor,
      gender: getVal(colIdx.gender),
      age: getVal(colIdx.age) ? Number(getVal(colIdx.age)) || getVal(colIdx.age) : '',
      maritalStatus: getVal(colIdx.marital),
      mobile: mobileNum,
      aadhaarInfo: {
        type: aadhaarType,
        aadhaarNumber: aadhaarNum,
        enrollmentNumber: enrollmentNum,
        remark: aadhaarRemark
      },
      rationInfo: {
        rationNumber: rationNum,
        hasRationCard,
        rationNotAvailable: rationNo
      },
      mobileInfo: {
        mobileNumber: mobileNum
      },
      overallResult
    };
  }).filter((b) => Boolean(b.name));
}

export async function getBootstrapData() {
  if (!bootstrapRequest) {
    bootstrapRequest = (async () => {
      // 1. First attempt: Direct Apps Script call with credentials: 'omit'
      try {
        const payload = await request({ action: 'bootstrap' });
        const data = payload?.data || null;
        if (data) {
          if (Array.isArray(data.beneficiaries)) {
            await enrichSurveyDataFromSheet(data.beneficiaries);
          }
          if (data.serverTimestamp) {
            syncGoogleTime(data.serverTimestamp);
          }
          writeCachedBootstrapData(data);
          return data;
        }
      } catch (err) {
        console.warn('Primary Apps Script bootstrap failed, attempting fallbacks:', err);
      }

      // 2. Fallback: Saved cached data in local storage
      try {
        const cachedRaw = window.localStorage.getItem(BOOTSTRAP_CACHE_KEY);
        if (cachedRaw) {
          const parsed = JSON.parse(cachedRaw);
          if (parsed?.data?.beneficiaries?.length > 0) {
            console.log('Serving from persistent local bootstrap cache.');
            return parsed.data;
          }
        }
      } catch (e) {
        console.warn('Local cache fallback warning:', e);
      }

      // 3. Fallback: Direct Google Sheet fetch via JSONP/GViz table
      try {
        console.log('Attempting direct Google Sheet table fallback...');
        const table = await fetchSheetTable();
        if (table?.rows?.length > 0) {
          const beneficiaries = parseBeneficiariesFromTable(table);
          if (beneficiaries.length > 0) {
            const fallbackData = {
              beneficiaries,
              parameters: [],
              issues: [],
              users: []
            };
            writeCachedBootstrapData(fallbackData);
            return fallbackData;
          }
        }
      } catch (e) {
        console.warn('Direct Google Sheet table fallback failed:', e);
      }

      // 4. If all channels fail, surface the clean friendly error
      throw new Error('Google Apps Script डिप्लॉयमेंट प्रोसेस हो रहा है (404 Page not found). कृपया 5-10 सेकंड बाद पेज रिफ्रेश (Reload) करें।');
    })().finally(() => {
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
