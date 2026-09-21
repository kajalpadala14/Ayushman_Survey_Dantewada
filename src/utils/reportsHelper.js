import { formatSurveyDateTime, formatSurveyTime } from './dateTime.js';

export const getBeneficiaryDate = (b) => {
  if (!b) return null;
  const raw = b.surveyDate || b.date || b.updatedAt || b.createdAt || b.timestamp;
  if (!raw || raw === '-') return null;
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw;
  const str = String(raw).trim();
  if (!str) return null;
  const gvizMatch = str.match(/Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)/);
  if (gvizMatch) {
    const d = new Date(
      Number(gvizMatch[1]),
      Number(gvizMatch[2]),
      Number(gvizMatch[3]),
      Number(gvizMatch[4] || 0),
      Number(gvizMatch[5] || 0),
      Number(gvizMatch[6] || 0)
    );
    if (!isNaN(d.getTime())) return d;
  }
  const parsed = new Date(str.includes(' ') ? str.replace(' ', 'T') : str);
  if (!isNaN(parsed.getTime())) return parsed;
  const parts = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (parts) {
    const d = new Date(Number(parts[3]), Number(parts[2]) - 1, Number(parts[1]));
    if (!isNaN(d.getTime())) return d;
  }
  return null;
};

export const formatDate = (value) => {
  if (!value || value === '-') return '-';
  const d = getBeneficiaryDate({ surveyDate: value });
  if (!d) return String(value);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Kolkata'
  });
};

export const escapeCsv = (value) => {
  const stringValue = value == null ? '' : String(value);
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

export const formatBlockName = (blockName = '') => {
  if (!blockName) return 'Unknown';
  const clean = blockName.split('(')[0].trim();
  return clean || blockName;
};

// Document & issue detection helpers
export const hasAadhaarIssue = (beneficiary) => {
  if (!beneficiary) return false;
  if (beneficiary.aadhaarInfo?.type === 'remark' || Boolean(beneficiary.aadhaarInfo?.remark)) {
    return true;
  }
  const responses = beneficiary.parameterResponses || {};
  const issueText = Object.values(responses)
    .map((response) => response?.issueType || '')
    .join(' ')
    .toLowerCase();

  if (/aadhaar|आधार/.test(issueText) || /aadhaar|आधार/.test(String(beneficiary.aadhaarInfo?.remark || '').toLowerCase())) {
    return true;
  }
  if (beneficiary.status === 'Completed' && !beneficiary.aadhaarInfo?.aadhaarNumber && !beneficiary.aadhaarInfo?.enrollmentNumber) {
    return true;
  }
  return false;
};

export const hasRationIssue = (beneficiary) => {
  if (!beneficiary) return false;
  if (beneficiary.rationInfo?.hasRationCard === 'no') return true;
  const responses = beneficiary.parameterResponses || {};
  const issueText = Object.values(responses)
    .map((response) => response?.issueType || '')
    .join(' ')
    .toLowerCase();

  if (/ration|राशन/.test(issueText)) return true;
  if (beneficiary.status === 'Completed' && !beneficiary.rationInfo?.rationNumber && beneficiary.rationInfo?.hasRationCard !== 'yes') {
    return true;
  }
  return false;
};

export const hasValidAadhaar = (beneficiary) => {
  if (!beneficiary) return false;
  const aadhaar = beneficiary.aadhaarInfo || {};
  if (aadhaar.type === 'aadhaar' && aadhaar.aadhaarNumber) return true;
  if (aadhaar.aadhaarNumber && String(aadhaar.aadhaarNumber).replace(/\D/g, '').length === 12) return true;
  if (aadhaar.type === 'enrollment' && aadhaar.enrollmentNumber) return true;
  if (beneficiary.aadhaarNumber && String(beneficiary.aadhaarNumber).replace(/\D/g, '').length === 12) return true;
  if (beneficiary.hasAadhaar === true || beneficiary.aadhaarStatus === 'Verified') return true;
  return false;
};

export const hasValidRation = (beneficiary) => {
  if (!beneficiary) return false;
  const ration = beneficiary.rationInfo || {};
  if (ration.hasRationCard === 'yes') return true;
  if (ration.rationNumber && String(ration.rationNumber).replace(/\D/g, '').length >= 10) return true;
  if (beneficiary.rationNumber && String(beneficiary.rationNumber).replace(/\D/g, '').length >= 10) return true;
  if (beneficiary.hasRationCard === true || beneficiary.hasRationCard === 'yes') return true;
  return false;
};

export const hasBothAadhaarAndRation = (beneficiary) => {
  return hasValidAadhaar(beneficiary) && hasValidRation(beneficiary);
};

export const isAyushmanCardMade = (beneficiary) => {
  return Boolean(
    beneficiary.hasAyushmanCard === true ||
    beneficiary.ayushmanCardStatus === 'Made' ||
    beneficiary.ayushmanCardStatus === 'Available' ||
    beneficiary.parameterResponses?.P3?.status === 'सही'
  );
};

export const hasBothDocsNoAyushman = (beneficiary) => {
  return hasBothAadhaarAndRation(beneficiary) && !isAyushmanCardMade(beneficiary);
};

export const hasOtherIssue = (beneficiary) => {
  const responses = beneficiary.parameterResponses || {};
  return Object.values(responses).some((r) => {
    const issue = String(r?.issueType || '').toLowerCase();
    return issue && !/aadhaar|आधार|ration|राशन/.test(issue);
  });
};

export const mapBeneficiaryToTableRow = (b, activeTabKey = 'survey') => {
  const hasAadhaar = hasValidAadhaar(b);
  const isVerified = hasBothAadhaarAndRation(b) || b.overallResult === 'VERIFIED';

  const aadhaarNumber = b.aadhaarInfo?.aadhaarNumber || b.aadhaarNumber || '';
  const enrollmentNumber = b.aadhaarInfo?.enrollmentNumber || b.enrollmentNumber || '';
  const aadhaarRemark = b.aadhaarInfo?.remark || b.aadhaarRemark || '';
  const aadhaarType = b.aadhaarInfo?.type || '';

  const rationNumber = b.rationInfo?.rationNumber || b.rationNumber || '';
  const hasRationCard = b.rationInfo?.hasRationCard || (rationNumber ? 'yes' : '');
  const rationNotAvailable = b.rationInfo?.rationNotAvailable || (hasRationCard === 'no' ? 'हाँ' : (hasRationCard === 'yes' ? 'नहीं' : ''));

  const mobile = b.mobileInfo?.mobileNumber || b.mobile || '';

  let dateDisplay = '-';
  if (activeTabKey === 'pending') {
    dateDisplay = '-';
  } else if (b.surveyDate) {
    dateDisplay = formatSurveyDateTime(b.surveyDate) || formatDate(b.surveyDate);
  } else {
    const d = getBeneficiaryDate(b);
    if (d) dateDisplay = formatDate(d);
  }

  return {
    id: b.id,
    name: b.name,
    headName: b.headName || '',
    fatherName: b.fatherName || '',
    age: b.age !== undefined && b.age !== '' && b.age !== 0 ? b.age : (b.age === 0 ? '0' : '—'),
    gender: b.gender || '—',
    maritalStatus: b.maritalStatus || '—',
    district: b.district || 'दंतेवाडा',
    janpad: b.block || 'Unknown',
    gp: b.gp || 'Unknown',
    gram: b.village || 'Unknown',
    mobile: mobile || '—',
    // Survey details
    aadhaarNumber,
    enrollmentNumber,
    aadhaarRemark,
    aadhaarType,
    rationNumber,
    hasRationCard,
    rationNotAvailable,
    surveyId: b.surveyId || '',
    submittedBy: b.submittedBy || b.assignedSurveyorName || '',
    overallResult: b.overallResult || '',
    status: b.status || 'Pending',
    date: dateDisplay,
    aadhaarStatus: hasAadhaar ? 'Verified' : 'Pending',
    verifiedStatus: isVerified ? 'Verified Beneficiary' : 'Not Verified',
    rawBeneficiary: b
  };
};

export const buildTableRows = (beneficiariesList, activeTabKey = 'survey') => {
  if (activeTabKey === 'date') {
    const sorted = [...beneficiariesList].sort((a, b) => {
      const da = getBeneficiaryDate(a);
      const db = getBeneficiaryDate(b);
      if (da && db) return db.getTime() - da.getTime();
      if (da) return -1;
      if (db) return 1;
      return 0;
    });
    return sorted.map((b) => mapBeneficiaryToTableRow(b, activeTabKey));
  }

  return beneficiariesList.map((b) => mapBeneficiaryToTableRow(b, activeTabKey));
};

export const buildExcelExportRows = (reportRows) => {
  return reportRows.map((r, idx) => {
    let aadhaarTypeLabel = 'लंबित / दर्ज नहीं';
    if (r.aadhaarNumber) {
      aadhaarTypeLabel = 'आधार कार्ड उपलब्ध';
    } else if (r.enrollmentNumber) {
      aadhaarTypeLabel = 'एनरोलमेंट नंबर दर्ज';
    } else if (r.aadhaarRemark) {
      aadhaarTypeLabel = 'रिमार्क (आधार नहीं)';
    }

    let rationStatusLabel = 'लंबित / दर्ज नहीं';
    if (r.hasRationCard === 'yes' || r.rationNumber) {
      rationStatusLabel = 'उपलब्ध (हाँ)';
    } else if (r.hasRationCard === 'no' || r.rationNotAvailable === 'हाँ') {
      rationStatusLabel = 'उपलब्ध नहीं (नहीं)';
    }

    return {
      'क्र. (S.No.)': idx + 1,
      'हितग्राही ID (ID)': r.id,
      'हितग्राही का नाम (Beneficiary Name)': r.name,
      'मुखिया का नाम (Head of Family)': r.headName || '—',
      'पिता/पति का नाम (Father/Husband)': r.fatherName || '—',
      'आयु (Age)': r.age !== undefined && r.age !== '' ? r.age : '—',
      'लिंग (Gender)': r.gender || '—',
      'वैवाहिक स्थिति (Marital Status)': r.maritalStatus || '—',
      'जिला (District)': r.district || 'दंतेवाडा',
      'विकासखंड (Block)': r.janpad,
      'ग्राम पंचायत (Gram Panchayat)': r.gp,
      'ग्राम (Village)': r.gram,
      'मोबाइल नंबर (Mobile)': r.mobile && r.mobile !== '—' ? String(r.mobile) : '—',
      'आधार प्रकार (Aadhaar Type)': aadhaarTypeLabel,
      'आधार नंबर (Aadhaar Number)': r.aadhaarNumber ? String(r.aadhaarNumber) : '—',
      'एनरोलमेंट नंबर (Enrollment Number)': r.enrollmentNumber ? String(r.enrollmentNumber) : '—',
      'आधार रिमार्क / कारण (Aadhaar Remark)': r.aadhaarRemark || '—',
      'राशन कार्ड स्थिति (Ration Card Status)': rationStatusLabel,
      'राशन कार्ड नंबर (Ration Card Number)': r.rationNumber ? String(r.rationNumber) : '—',
      'सर्वे स्थिति (Status)': r.status,
      'सर्वे आईडी (Survey ID)': r.surveyId || '—',
      'सर्वे दिनांक (Survey Date)': r.date,
      'सर्वेक्षक (Surveyor)': r.submittedBy || '—'
    };
  });
};
