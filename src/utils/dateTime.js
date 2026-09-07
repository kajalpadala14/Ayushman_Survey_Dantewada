/**
 * Indian Standard Time (IST, UTC+5:30) Date and Time Utilities
 */

/**
 * Returns current timestamp formatted in Indian Standard Time: YYYY-MM-DD HH:mm:ss
 */
export function getISTDateTimeString(now = new Date()) {
  try {
    const istParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).formatToParts(now);

    const get = (type) => istParts.find((p) => p.type === type)?.value || '00';
    return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
  } catch (e) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }
}

/**
 * Formats a survey timestamp into clean 12-hour Indian Standard Time (e.g. "03:50 PM")
 */
export function formatSurveyTime(raw) {
  if (!raw || raw === '-') return '-';
  const str = String(raw).trim();
  if (!str || str === '-') return '-';

  try {
    // If it is an ISO UTC timestamp (ends with Z or includes +00:00)
    if (str.includes('T') && (str.endsWith('Z') || str.includes('+00:00'))) {
      return new Date(str).toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    }

    // If it is in format "YYYY-MM-DD HH:mm:ss" or "YYYY-MM-DD HH:mm"
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(str)) {
      const parts = str.replace('T', ' ').split(' ');
      const timePart = parts[1] || '';
      const [hh, mm] = timePart.split(':');
      if (hh !== undefined && mm !== undefined) {
        const hour = parseInt(hh, 10);
        const period = hour >= 12 ? 'PM' : 'AM';
        const h12 = hour % 12 || 12;
        return `${String(h12).padStart(2, '0')}:${mm} ${period}`;
      }
    }

    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    }
  } catch (e) {
    /* fallback */
  }

  return str;
}

/**
 * Formats a survey timestamp into readable Date & Time in IST (e.g. "07/09/2026, 03:50 PM")
 */
export function formatSurveyDateTime(raw) {
  if (!raw || raw === '-') return '-';
  const str = String(raw).trim();
  if (!str || str === '-') return '-';

  try {
    const time = formatSurveyTime(str);
    let datePart = '';
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      const [yyyy, mm, dd] = str.slice(0, 10).split('-');
      datePart = `${dd}/${mm}/${yyyy}`;
    } else {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        datePart = d.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' });
      }
    }
    return datePart ? `${datePart}, ${time}` : time;
  } catch (e) {
    return str;
  }
}
