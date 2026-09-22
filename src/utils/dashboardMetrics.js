/**
 * Dashboard & Documentation Status (दस्तावेज़ स्थिति) Calculation Utilities
 */

/**
 * Checks if Aadhaar is available for a beneficiary.
 * Returns true if valid 12-digit Aadhaar number or type === 'aadhaar' exists.
 * Returns false if remark is recorded, enrollment number only, or explicitly no Aadhaar.
 */
export function isAadhaarAvailable(b) {
  if (!b) return false;
  const a = b.aadhaarInfo || {};

  // Explicit remark, enrollment slip, or marked false means Aadhaar card is not yet available
  if (a.type === 'remark' || Boolean(a.remark) || a.type === 'enrollment' || b.hasAadhaar === false) {
    return false;
  }

  const num = String(a.aadhaarNumber || b.aadhaarNumber || '').replace(/\D/g, '');
  if (a.type === 'aadhaar' || num.length === 12 || b.hasAadhaar === true) {
    return true;
  }

  return false;
}

/**
 * Checks if Ration Card is available for a beneficiary.
 * Returns true if ration card number exists (>=10 digits) or hasRationCard === 'yes'.
 * Returns false if explicitly marked no ration card.
 */
export function isRationAvailable(b) {
  if (!b) return false;
  const r = b.rationInfo || {};

  // Explicitly marked as not available
  if (
    r.hasRationCard === 'no' ||
    r.rationNotAvailable === 'हाँ' ||
    String(r.rationNotAvailable).toLowerCase() === 'yes' ||
    b.hasRationCard === false
  ) {
    return false;
  }

  // Ration card number check (at least 10 digits)
  const num = String(r.rationNumber || b.rationNumber || '').replace(/\D/g, '');
  if (num.length >= 10) return true;

  if (r.hasRationCard === 'yes' || b.hasRationCard === true || b.hasRationCard === 'yes') {
    return true;
  }

  return false;
}

/**
 * Calculates documentation status (दस्तावेज़ स्थिति) metrics and data quality stats
 * from an assigned list of beneficiaries.
 *
 * Base: ONLY Completed surveys (b.status === 'Completed' || b.status === 'Issue Found').
 *
 * @param {Array} assignedList - List of beneficiaries
 * @returns {Object} Documentation status & data quality metrics
 */
export function calculateDocumentationStatus(assignedList = []) {
  const completedList = (assignedList || []).filter(
    (b) => b && (b.status === 'Completed' || b.status === 'Issue Found')
  );
  const completedCount = completedList.length;

  let bothAvailableCount = 0;
  let onlyAadhaarCount = 0;
  let onlyRationCount = 0;
  let neitherAvailableCount = 0;
  let aadhaarNotAvailableCount = 0;
  let rationNotAvailableCount = 0;

  const bothAvailableList = [];
  const onlyAadhaarList = [];
  const onlyRationList = [];
  const neitherAvailableList = [];
  const aadhaarNotAvailableList = [];
  const rationNotAvailableList = [];

  for (const b of completedList) {
    const hasA = isAadhaarAvailable(b);
    const hasR = isRationAvailable(b);

    if (hasA && hasR) {
      bothAvailableCount++;
      bothAvailableList.push(b);
    } else if (hasA && !hasR) {
      onlyAadhaarCount++;
      onlyAadhaarList.push(b);
    } else if (!hasA && hasR) {
      onlyRationCount++;
      onlyRationList.push(b);
    } else {
      neitherAvailableCount++;
      neitherAvailableList.push(b);
    }

    if (!hasA) {
      aadhaarNotAvailableCount++;
      aadhaarNotAvailableList.push(b);
    }
    if (!hasR) {
      rationNotAvailableCount++;
      rationNotAvailableList.push(b);
    }
  }

  // Percentages strictly relative to completed surveys
  const toPct = (count) =>
    completedCount > 0 ? ((count / completedCount) * 100).toFixed(1) : '0.0';

  const bothAvailablePct = toPct(bothAvailableCount);
  const onlyAadhaarPct = toPct(onlyAadhaarCount);
  const onlyRationPct = toPct(onlyRationCount);
  const neitherAvailablePct = toPct(neitherAvailableCount);
  const aadhaarNotAvailablePct = toPct(aadhaarNotAvailableCount);
  const rationNotAvailablePct = toPct(rationNotAvailableCount);

  // Backward compatibility fields
  const aadhaarAvailableCount = bothAvailableCount + onlyAadhaarCount;
  const aadhaarAvailablePct = toPct(aadhaarAvailableCount);
  const rationAvailableCount = bothAvailableCount + onlyRationCount;
  const rationAvailablePct = toPct(rationAvailableCount);

  const aadhaarReviewPendingCount = completedList.filter((b) => {
    const a = b.aadhaarInfo || {};
    return (
      a.type === 'enrollment' ||
      (a.enrollmentNumber && String(a.enrollmentNumber).length > 0) ||
      (!a.type && !a.aadhaarNumber && !a.enrollmentNumber && !a.remark)
    );
  }).length;

  // Data Quality Metrics
  const aadhaarPendingQuality = completedList.filter((b) => {
    const a = b.aadhaarInfo || {};
    return !a.type && !a.aadhaarNumber && !a.enrollmentNumber && !a.remark;
  }).length;

  const rationPendingQuality = completedList.filter((b) => {
    const r = b.rationInfo || {};
    return !r.hasRationCard || r.hasRationCard === 'unknown';
  }).length;

  const mobileMissingQuality = completedList.filter((b) => {
    const m = String(b.mobile || b.mobileInfo?.mobileNumber || '').replace(/\D/g, '');
    return m.length < 10;
  }).length;

  return {
    completedList,
    completedCount,

    // 6 primary categories
    bothAvailableCount,
    bothAvailablePct,
    bothAvailableList,

    onlyAadhaarCount,
    onlyAadhaarPct,
    onlyAadhaarList,

    onlyRationCount,
    onlyRationPct,
    onlyRationList,

    neitherAvailableCount,
    neitherAvailablePct,
    neitherAvailableList,

    aadhaarNotAvailableCount,
    aadhaarNotAvailablePct,
    aadhaarNotAvailableList,

    rationNotAvailableCount,
    rationNotAvailablePct,
    rationNotAvailableList,

    // Legacy fields
    aadhaarAvailableCount,
    aadhaarAvailablePct,
    aadhaarReviewPendingCount,
    rationAvailableCount,
    rationAvailablePct,

    // Data quality
    aadhaarPendingQuality,
    rationPendingQuality,
    mobileMissingQuality
  };
}
