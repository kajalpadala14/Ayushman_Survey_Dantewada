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
