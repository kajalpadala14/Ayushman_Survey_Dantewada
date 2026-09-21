import test from 'node:test';
import assert from 'node:assert/strict';

test('Google Sheet column index resolution and row parsing', () => {
  const sampleCols = [
    { id: 'A', label: 'योजना: आयुष्मान भारत | प्रश्न: आयुष्मान भारत जिला' },
    { id: 'B', label: 'ब्लॉक' },
    { id: 'C', label: 'ग्राम पंचायत' },
    { id: 'D', label: 'ग्राम' },
    { id: 'E', label: 'सदस्य का नाम' },
    { id: 'F', label: 'आयु' },
    { id: 'G', label: 'लिंग' },
    { id: 'H', label: 'वैवाहिक स्थिति' },
    { id: 'I', label: 'मुखिया का नाम' },
    { id: 'J', label: 'पिता/पति का नाम' },
    { id: 'K', label: 'आधार नंबर' },
    { id: 'L', label: 'एनरोलमेंट नंबर' },
    { id: 'M', label: 'रिमार्क' },
    { id: 'N', label: 'राशन कार्ड नंबर' },
    { id: 'O', label: 'राशन कार्ड नहीं है' },
    { id: 'P', label: 'मोबाइल नंबर' },
    { id: 'Q', label: 'सर्वे स्थिति' },
    { id: 'R', label: 'सर्वे आईडी' },
    { id: 'S', label: 'सर्वे दिनांक' },
    { id: 'T', label: 'सर्वेक्षक' }
  ];

  const findColIndex = (exactLabels, includeKeywords, fallbackIndex = -1) => {
    let idx = sampleCols.findIndex((c) =>
      exactLabels.some((lbl) => (c?.label || '').trim().toLowerCase() === lbl.toLowerCase())
    );
    if (idx !== -1) return idx;

    idx = sampleCols.findIndex((c) => {
      const label = (c?.label || '').toLowerCase();
      return includeKeywords.some((kw) => label.includes(kw.toLowerCase()));
    });
    if (idx !== -1) return idx;

    return fallbackIndex;
  };

  const colIdx = {
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

  // Verify that village (Col 3) doesn't get confused with GP (Col 2)
  assert.equal(colIdx.gp, 2);
  assert.equal(colIdx.village, 3);

  // Verify that age (Col 5) doesn't get confused with Col 0 (आयुष्मान)
  assert.equal(colIdx.age, 5);

  // Verify survey fields
  assert.equal(colIdx.aadhaar, 10);
  assert.equal(colIdx.enrollment, 11);
  assert.equal(colIdx.remark, 12);
  assert.equal(colIdx.ration, 13);
  assert.equal(colIdx.rationNo, 14);
  assert.equal(colIdx.mobile, 15);
  assert.equal(colIdx.status, 16);
  assert.equal(colIdx.surveyId, 17);
  assert.equal(colIdx.date, 18);
  assert.equal(colIdx.surveyor, 19);
});
