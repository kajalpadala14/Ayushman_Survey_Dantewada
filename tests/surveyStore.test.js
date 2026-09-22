import test from 'node:test';
import assert from 'node:assert/strict';
import { getLocalSurveys, saveLocalSurvey, mergeWithLocalSurveys } from '../src/utils/surveyStore.js';

// Setup mock window.localStorage for Node environment test
const createMockStorage = () => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => {
      store[key] = String(val);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
};

test('surveyStore - handles non-window or empty state safely', () => {
  const result = mergeWithLocalSurveys([]);
  assert.deepEqual(result, []);
  assert.equal(mergeWithLocalSurveys(null), null);
});

test('surveyStore - saves local survey and merges with beneficiaries list', () => {
  globalThis.window = {
    localStorage: createMockStorage()
  };

  const surveyData = {
    beneficiaryId: 'BEN-001',
    status: 'Completed',
    overallResult: 'VERIFIED',
    surveyId: 'SRV-2026-123456',
    surveyDate: '2026-09-22 14:30:00',
    aadhaarInfo: {
      type: 'aadhaar',
      aadhaarNumber: '123456789012'
    },
    rationInfo: {
      hasRationCard: 'yes',
      rationNumber: '987654321012'
    },
    mobileInfo: {
      mobileNumber: '9876543210'
    },
    parameterResponses: {
      P1: { status: 'सही' }
    }
  };

  saveLocalSurvey(surveyData);

  const localSurveys = getLocalSurveys();
  assert.ok(localSurveys['BEN-001']);
  assert.equal(localSurveys['BEN-001'].surveyId, 'SRV-2026-123456');

  // Simulate stale backend data where status is still 'Pending'
  const staleBeneficiaries = [
    {
      id: 'BEN-001',
      name: 'Ramesh',
      status: 'Pending',
      aadhaarInfo: {},
      rationInfo: {},
      mobileInfo: {}
    },
    {
      id: 'BEN-002',
      name: 'Suresh',
      status: 'Pending',
      aadhaarInfo: {},
      rationInfo: {},
      mobileInfo: {}
    }
  ];

  const merged = mergeWithLocalSurveys(staleBeneficiaries);

  // BEN-001 must have Completed status, surveyId, and all entered details preserved
  assert.equal(merged[0].status, 'Completed');
  assert.equal(merged[0].surveyId, 'SRV-2026-123456');
  assert.equal(merged[0].surveyDate, '2026-09-22 14:30:00');
  assert.equal(merged[0].aadhaarInfo.aadhaarNumber, '123456789012');
  assert.equal(merged[0].rationInfo.rationNumber, '987654321012');
  assert.equal(merged[0].mobile, '9876543210');

  // BEN-002 must remain Pending untouched
  assert.equal(merged[1].status, 'Pending');
  assert.equal(merged[1].surveyId, undefined);

  // Cleanup
  delete globalThis.window;
});
