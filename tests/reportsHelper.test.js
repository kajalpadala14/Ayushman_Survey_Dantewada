import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getBeneficiaryDate,
  formatDate,
  hasAadhaarIssue,
  hasRationIssue,
  hasValidAadhaar,
  hasValidRation,
  hasBothAadhaarAndRation,
  hasBothDocsNoAyushman,
  mapBeneficiaryToTableRow,
  buildTableRows,
  buildExcelExportRows
} from '../src/utils/reportsHelper.js';

test('getBeneficiaryDate parses various date formats including GViz Date(...)', () => {
  // Null or empty
  assert.equal(getBeneficiaryDate(null), null);
  assert.equal(getBeneficiaryDate({ surveyDate: '-' }), null);
  assert.equal(getBeneficiaryDate({}), null);

  // Native Date
  const nativeDate = new Date('2026-09-19T13:01:49');
  assert.equal(getBeneficiaryDate({ surveyDate: nativeDate }).getTime(), nativeDate.getTime());

  // ISO string
  const isoDate = getBeneficiaryDate({ surveyDate: '2026-09-19 13:01:49' });
  assert.ok(isoDate instanceof Date);
  assert.equal(isoDate.getFullYear(), 2026);
  assert.equal(isoDate.getMonth(), 8); // 8 = September
  assert.equal(isoDate.getDate(), 19);

  // GViz Date format Date(yyyy,m,d,h,m,s)
  const gvizDate = getBeneficiaryDate({ surveyDate: 'Date(2026,8,19,13,1,49)' });
  assert.ok(gvizDate instanceof Date);
  assert.equal(gvizDate.getFullYear(), 2026);
  assert.equal(gvizDate.getMonth(), 8);
  assert.equal(gvizDate.getDate(), 19);
  assert.equal(gvizDate.getHours(), 13);
  assert.equal(gvizDate.getMinutes(), 1);
  assert.equal(gvizDate.getSeconds(), 49);
});

test('hasValidAadhaar and hasAadhaarIssue detection', () => {
  // Valid Aadhaar with 12-digit number
  const benValid = {
    aadhaarInfo: { type: 'aadhaar', aadhaarNumber: '123456789012' }
  };
  assert.equal(hasValidAadhaar(benValid), true);
  assert.equal(hasAadhaarIssue(benValid), false);

  // Aadhaar with remark (issue found)
  const benWithRemark = {
    status: 'Completed',
    aadhaarInfo: { type: 'remark', remark: 'जन्म प्रमाण पत्र नहीं बनाया गया' }
  };
  assert.equal(hasValidAadhaar(benWithRemark), false);
  assert.equal(hasAadhaarIssue(benWithRemark), true);

  // Completed without any Aadhaar
  const benCompletedNoAadhaar = {
    status: 'Completed',
    aadhaarInfo: { aadhaarNumber: '', enrollmentNumber: '' }
  };
  assert.equal(hasAadhaarIssue(benCompletedNoAadhaar), true);
});

test('hasValidRation and hasRationIssue detection', () => {
  // Valid Ration card
  const benRationYes = {
    rationInfo: { hasRationCard: 'yes', rationNumber: '223763162825' }
  };
  assert.equal(hasValidRation(benRationYes), true);
  assert.equal(hasRationIssue(benRationYes), false);

  // No Ration card (issue)
  const benRationNo = {
    rationInfo: { hasRationCard: 'no', rationNumber: '' }
  };
  assert.equal(hasValidRation(benRationNo), false);
  assert.equal(hasRationIssue(benRationNo), true);
});

test('hasBothAadhaarAndRation and hasBothDocsNoAyushman', () => {
  const benBoth = {
    aadhaarInfo: { type: 'aadhaar', aadhaarNumber: '123456789012' },
    rationInfo: { hasRationCard: 'yes', rationNumber: '223763162825' },
    hasAyushmanCard: false
  };
  assert.equal(hasBothAadhaarAndRation(benBoth), true);
  assert.equal(hasBothDocsNoAyushman(benBoth), true);
});

test('mapBeneficiaryToTableRow preserves all surveyed details', () => {
  const beneficiary = {
    id: 'AYU-BEN-000425',
    name: 'Arun Lekhami',
    headName: 'Sushila Lekhami',
    fatherName: 'Gudduram Lekhami',
    age: 0,
    gender: 'Male',
    maritalStatus: 'Unmarried',
    district: 'दंतेवाडा',
    block: 'Geedam (गीदम)',
    gp: 'Cherpal (चेरपाल)',
    village: 'Chhote Karka (छोटेकरका)',
    status: 'Completed',
    surveyId: 'SURVEY-2026-232190',
    surveyDate: '2026-09-19 13:01:49',
    submittedBy: 'Surveyor-1',
    mobile: '9770221813',
    aadhaarInfo: {
      type: 'remark',
      aadhaarNumber: '',
      enrollmentNumber: '',
      remark: 'एनरोलमेंट करवाया गया है, परंतु आधार कार्ड नहीं मिला है'
    },
    rationInfo: {
      hasRationCard: 'no',
      rationNumber: '',
      rationNotAvailable: 'हाँ'
    }
  };

  const row = mapBeneficiaryToTableRow(beneficiary, 'survey');

  assert.equal(row.id, 'AYU-BEN-000425');
  assert.equal(row.name, 'Arun Lekhami');
  assert.equal(row.headName, 'Sushila Lekhami');
  assert.equal(row.fatherName, 'Gudduram Lekhami');
  assert.equal(row.age, '0');
  assert.equal(row.gender, 'Male');
  assert.equal(row.janpad, 'Geedam (गीदम)');
  assert.equal(row.gp, 'Cherpal (चेरपाल)');
  assert.equal(row.gram, 'Chhote Karka (छोटेकरका)');
  assert.equal(row.mobile, '9770221813');
  assert.equal(row.aadhaarRemark, 'एनरोलमेंट करवाया गया है, परंतु आधार कार्ड नहीं मिला है');
  assert.equal(row.hasRationCard, 'no');
  assert.equal(row.rationNotAvailable, 'हाँ');
  assert.equal(row.surveyId, 'SURVEY-2026-232190');
  assert.equal(row.status, 'Completed');
  assert.match(row.date, /19\/09\/2026/);
});

test('buildExcelExportRows includes all required survey columns', () => {
  const tableRows = [
    {
      id: 'AYU-BEN-000425',
      name: 'Arun Lekhami',
      headName: 'Sushila Lekhami',
      fatherName: 'Gudduram Lekhami',
      age: '0',
      gender: 'Male',
      maritalStatus: 'Unmarried',
      district: 'दंतेवाडा',
      janpad: 'Geedam (गीदम)',
      gp: 'Cherpal (चेरपाल)',
      gram: 'Chhote Karka (छोटेकरका)',
      mobile: '9770221813',
      aadhaarNumber: '',
      enrollmentNumber: '',
      aadhaarRemark: 'एनरोलमेंट करवाया गया है, परंतु आधार कार्ड नहीं मिला है',
      aadhaarType: 'remark',
      rationNumber: '',
      hasRationCard: 'no',
      rationNotAvailable: 'हाँ',
      surveyId: 'SURVEY-2026-232190',
      status: 'Completed',
      date: '19/09/2026, 01:01 PM',
      submittedBy: 'Surveyor-1'
    }
  ];

  const excelRows = buildExcelExportRows(tableRows);
  assert.equal(excelRows.length, 1);

  const r = excelRows[0];
  assert.equal(r['क्र. (S.No.)'], 1);
  assert.equal(r['हितग्राही ID (ID)'], 'AYU-BEN-000425');
  assert.equal(r['हितग्राही का नाम (Beneficiary Name)'], 'Arun Lekhami');
  assert.equal(r['मुखिया का नाम (Head of Family)'], 'Sushila Lekhami');
  assert.equal(r['पिता/पति का नाम (Father/Husband)'], 'Gudduram Lekhami');
  assert.equal(r['विकासखंड (Block)'], 'Geedam (गीदम)');
  assert.equal(r['ग्राम पंचायत (Gram Panchayat)'], 'Cherpal (चेरपाल)');
  assert.equal(r['मोबाइल नंबर (Mobile)'], '9770221813');
  assert.equal(r['आधार प्रकार (Aadhaar Type)'], 'रिमार्क (आधार नहीं)');
  assert.equal(r['आधार रिमार्क / कारण (Aadhaar Remark)'], 'एनरोलमेंट करवाया गया है, परंतु आधार कार्ड नहीं मिला है');
  assert.equal(r['राशन कार्ड स्थिति (Ration Card Status)'], 'उपलब्ध नहीं (नहीं)');
  assert.equal(r['सर्वे स्थिति (Status)'], 'Completed');
  assert.equal(r['सर्वे आईडी (Survey ID)'], 'SURVEY-2026-232190');
  assert.equal(r['सर्वे दिनांक (Survey Date)'], '19/09/2026, 01:01 PM');
  assert.equal(r['सर्वेक्षक (Surveyor)'], 'Surveyor-1');
});
