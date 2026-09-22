import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDocumentationStatus } from '../src/utils/dashboardMetrics.js';

test('calculateDocumentationStatus - returns zeroes when list is empty or has zero completed surveys', () => {
  const result = calculateDocumentationStatus([]);
  assert.equal(result.completedCount, 0);
  assert.equal(result.aadhaarAvailableCount, 0);
  assert.equal(result.aadhaarAvailablePct, '0.0');
  assert.equal(result.aadhaarNotAvailableCount, 0);
  assert.equal(result.aadhaarNotAvailablePct, '0.0');
  assert.equal(result.aadhaarReviewPendingCount, 0);
  assert.equal(result.rationAvailableCount, 0);
  assert.equal(result.rationAvailablePct, '0.0');
  assert.equal(result.rationNotAvailableCount, 0);
  assert.equal(result.rationNotAvailablePct, '0.0');
  assert.equal(result.aadhaarPendingQuality, 0);
  assert.equal(result.rationPendingQuality, 0);
  assert.equal(result.mobileMissingQuality, 0);
});

test('calculateDocumentationStatus - ignores pending surveys and only counts completed / issue found records', () => {
  const mockBeneficiaries = [
    {
      id: 'BEN-1',
      status: 'Pending',
      aadhaarInfo: { type: 'aadhaar', aadhaarNumber: '123456789012' },
      rationInfo: { hasRationCard: 'yes', rationNumber: '123456789012' },
      mobile: '9876543210'
    },
    {
      id: 'BEN-2',
      status: 'Pending',
      aadhaarInfo: { type: 'remark', remark: 'मृत्यु' },
      rationInfo: { hasRationCard: 'no' },
      mobile: '9876543210'
    }
  ];

  const result = calculateDocumentationStatus(mockBeneficiaries);
  assert.equal(result.completedCount, 0);
  assert.equal(result.aadhaarAvailableCount, 0);
  assert.equal(result.rationAvailableCount, 0);
});

test('calculateDocumentationStatus - correctly counts Aadhaar available and percentage', () => {
  const mockBeneficiaries = [
    {
      id: 'BEN-1',
      status: 'Completed',
      aadhaarInfo: { type: 'aadhaar', aadhaarNumber: '123456789012' },
      rationInfo: { hasRationCard: 'yes', rationNumber: '123456789012' },
      mobile: '9876543210'
    },
    {
      id: 'BEN-2',
      status: 'Completed',
      aadhaarInfo: { aadhaarNumber: '999988887777' }, // Fallback 12-digit
      rationInfo: { hasRationCard: 'yes', rationNumber: '123456789012' },
      mobile: '9876543211'
    },
    {
      id: 'BEN-3',
      status: 'Completed',
      aadhaarInfo: { type: 'remark', remark: 'फिंगरप्रिंट नहीं आ रहा' },
      rationInfo: { hasRationCard: 'no' },
      mobile: '9876543212'
    },
    {
      id: 'BEN-4',
      status: 'Completed',
      aadhaarInfo: { type: 'enrollment', enrollmentNumber: '1234567890123456789012345678' },
      rationInfo: { hasRationCard: 'yes', rationNumber: '123456789013' },
      mobile: '9876543213'
    }
  ];

  const result = calculateDocumentationStatus(mockBeneficiaries);
  assert.equal(result.completedCount, 4);
  assert.equal(result.aadhaarAvailableCount, 2);
  assert.equal(result.aadhaarAvailablePct, '50.0');
});

test('calculateDocumentationStatus - correctly counts Aadhaar Not Available (Remark)', () => {
  const mockBeneficiaries = [
    {
      id: 'BEN-1',
      status: 'Completed',
      aadhaarInfo: { type: 'remark', remark: 'स्थलांतरित हो चुका है' },
      rationInfo: { hasRationCard: 'yes', rationNumber: '123456789012' },
      mobile: '9876543210'
    },
    {
      id: 'BEN-2',
      status: 'Completed',
      aadhaarInfo: { type: 'remark', remark: 'मृत्यु' },
      rationInfo: { hasRationCard: 'no' },
      mobile: '9876543211'
    }
  ];

  const result = calculateDocumentationStatus(mockBeneficiaries);
  assert.equal(result.completedCount, 2);
  assert.equal(result.aadhaarNotAvailableCount, 2);
  assert.equal(result.aadhaarNotAvailablePct, '100.0');
});

test('calculateDocumentationStatus - correctly counts Aadhaar Review / Pending', () => {
  const mockBeneficiaries = [
    {
      id: 'BEN-1',
      status: 'Completed',
      aadhaarInfo: { type: 'enrollment', enrollmentNumber: '1234567890123456789012345678' },
      rationInfo: { hasRationCard: 'yes', rationNumber: '123456789012' },
      mobile: '9876543210'
    },
    {
      id: 'BEN-2',
      status: 'Completed',
      aadhaarInfo: {}, // Unfilled aadhaar info
      rationInfo: { hasRationCard: 'yes', rationNumber: '123456789012' },
      mobile: '9876543211'
    }
  ];

  const result = calculateDocumentationStatus(mockBeneficiaries);
  assert.equal(result.aadhaarReviewPendingCount, 2);
});

test('calculateDocumentationStatus - correctly counts Ration Card Available and Not Available', () => {
  const mockBeneficiaries = [
    {
      id: 'BEN-1',
      status: 'Completed',
      aadhaarInfo: { type: 'aadhaar', aadhaarNumber: '123456789012' },
      rationInfo: { hasRationCard: 'yes', rationNumber: '123456789012' },
      mobile: '9876543210'
    },
    {
      id: 'BEN-2',
      status: 'Completed',
      aadhaarInfo: { type: 'aadhaar', aadhaarNumber: '123456789013' },
      rationInfo: { hasRationCard: 'yes', rationNumber: '123456789014' },
      mobile: '9876543211'
    },
    {
      id: 'BEN-3',
      status: 'Completed',
      aadhaarInfo: { type: 'aadhaar', aadhaarNumber: '123456789014' },
      rationInfo: { hasRationCard: 'no' },
      mobile: '9876543212'
    }
  ];

  const result = calculateDocumentationStatus(mockBeneficiaries);
  assert.equal(result.completedCount, 3);
  assert.equal(result.rationAvailableCount, 2);
  assert.equal(result.rationAvailablePct, '66.7');
  assert.equal(result.rationNotAvailableCount, 1);
  assert.equal(result.rationNotAvailablePct, '33.3');
});

test('calculateDocumentationStatus - computes Data Quality metrics accurately', () => {
  const mockBeneficiaries = [
    {
      id: 'BEN-1',
      status: 'Completed',
      aadhaarInfo: {}, // Missing aadhaar
      rationInfo: { hasRationCard: 'unknown' }, // Missing ration
      mobile: '' // Missing mobile
    },
    {
      id: 'BEN-2',
      status: 'Completed',
      aadhaarInfo: { type: 'aadhaar', aadhaarNumber: '123456789012' },
      rationInfo: { hasRationCard: 'yes', rationNumber: '123456789012' },
      mobile: '9876543210' // Full quality
    }
  ];

  const result = calculateDocumentationStatus(mockBeneficiaries);
  assert.equal(result.completedCount, 2);
  assert.equal(result.aadhaarPendingQuality, 1);
  assert.equal(result.rationPendingQuality, 1);
  assert.equal(result.mobileMissingQuality, 1);
});

test('calculateDocumentationStatus - 6 categories, base on completed surveys only, and 100% partition validation', () => {
  const dataset = [
    // 1. Pending survey (MUST be ignored from base count and all categories)
    { id: 'P-1', status: 'Pending', aadhaarInfo: { type: 'aadhaar', aadhaarNumber: '111122223333' }, rationInfo: { hasRationCard: 'yes', rationNumber: '9999888877' } },
    
    // 2. Both Available (Aadhaar + Ration) -> 3 records
    { id: 'BOTH-1', status: 'Completed', aadhaarInfo: { type: 'aadhaar', aadhaarNumber: '123456789012' }, rationInfo: { hasRationCard: 'yes', rationNumber: '123456789012' } },
    { id: 'BOTH-2', status: 'Completed', aadhaarInfo: { aadhaarNumber: '998877665544' }, rationInfo: { hasRationCard: 'yes', rationNumber: '987654321012' } },
    { id: 'BOTH-3', status: 'Issue Found', aadhaarInfo: { type: 'aadhaar', aadhaarNumber: '556677889900' }, rationInfo: { hasRationCard: 'yes', rationNumber: '1122334455' } },

    // 3. Only Aadhaar Available -> 2 records
    { id: 'ONLY-A-1', status: 'Completed', aadhaarInfo: { type: 'aadhaar', aadhaarNumber: '112233445566' }, rationInfo: { hasRationCard: 'no' } },
    { id: 'ONLY-A-2', status: 'Completed', aadhaarInfo: { aadhaarNumber: '665544332211' }, rationInfo: { rationNotAvailable: 'हाँ' } },

    // 4. Only Ration Available -> 4 records
    { id: 'ONLY-R-1', status: 'Completed', aadhaarInfo: { type: 'remark', remark: 'मृत्यु' }, rationInfo: { hasRationCard: 'yes', rationNumber: '4455667788' } },
    { id: 'ONLY-R-2', status: 'Completed', aadhaarInfo: { type: 'enrollment', enrollmentNumber: '1234567890123456789012345678' }, rationInfo: { hasRationCard: 'yes', rationNumber: '3344556677' } },
    { id: 'ONLY-R-3', status: 'Completed', aadhaarInfo: { remark: 'फिंगरप्रिंट नहीं आ रहा' }, rationInfo: { hasRationCard: 'yes', rationNumber: '2233445566' } },
    { id: 'ONLY-R-4', status: 'Completed', aadhaarInfo: { type: 'remark', remark: 'स्थानांतरित' }, rationInfo: { hasRationCard: 'yes', rationNumber: '7788990011' } },

    // 5. Neither Available -> 1 record
    { id: 'NEITHER-1', status: 'Completed', aadhaarInfo: { type: 'remark', remark: 'मृत्यु' }, rationInfo: { hasRationCard: 'no' } }
  ];

  const metrics = calculateDocumentationStatus(dataset);

  // Rule 1: Base is strictly completed surveys (3 + 2 + 4 + 1 = 10 records, P-1 ignored)
  assert.equal(metrics.completedCount, 10);

  // Rule 2: Partition counts
  assert.equal(metrics.bothAvailableCount, 3);
  assert.equal(metrics.bothAvailablePct, '30.0');
  assert.equal(metrics.bothAvailableList.length, 3);

  assert.equal(metrics.onlyAadhaarCount, 2);
  assert.equal(metrics.onlyAadhaarPct, '20.0');
  assert.equal(metrics.onlyAadhaarList.length, 2);

  assert.equal(metrics.onlyRationCount, 4);
  assert.equal(metrics.onlyRationPct, '40.0');
  assert.equal(metrics.onlyRationList.length, 4);

  assert.equal(metrics.neitherAvailableCount, 1);
  assert.equal(metrics.neitherAvailablePct, '10.0');
  assert.equal(metrics.neitherAvailableList.length, 1);

  // Individual counts:
  // Aadhaar Not Available = onlyRation (4) + neither (1) = 5 (50.0%)
  assert.equal(metrics.aadhaarNotAvailableCount, 5);
  assert.equal(metrics.aadhaarNotAvailablePct, '50.0');
  assert.equal(metrics.aadhaarNotAvailableList.length, 5);

  // Ration Not Available = onlyAadhaar (2) + neither (1) = 3 (30.0%)
  assert.equal(metrics.rationNotAvailableCount, 3);
  assert.equal(metrics.rationNotAvailablePct, '30.0');
  assert.equal(metrics.rationNotAvailableList.length, 3);

  // Rule 3: Exact 100% Partition Validation:
  // (bothAvailable + onlyAadhaar + onlyRation + neitherAvailable) === completedCount
  const partitionSum = metrics.bothAvailableCount + metrics.onlyAadhaarCount + metrics.onlyRationCount + metrics.neitherAvailableCount;
  assert.equal(partitionSum, metrics.completedCount);

  const pctSum = Number(metrics.bothAvailablePct) + Number(metrics.onlyAadhaarPct) + Number(metrics.onlyRationPct) + Number(metrics.neitherAvailablePct);
  assert.equal(pctSum, 100.0);
});

