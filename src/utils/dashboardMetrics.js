/**
 * Dashboard & Documentation Status (दस्तावेज़ स्थिति) Calculation Utilities
 */

/**
 * Calculates documentation status (दस्तावेज़ स्थिति) metrics and data quality stats
 * from an assigned list of beneficiaries.
 *
 * @param {Array} assignedList - List of beneficiaries
 * @returns {Object} Documentation status & data quality metrics
 */
export function calculateDocumentationStatus(assignedList = []) {
  const completedList = (assignedList || []).filter(
    (b) => b && (b.status === 'Completed' || b.status === 'Issue Found')
  );
  const completedCount = completedList.length;

  // 1. Aadhaar Available (आधार उपलब्ध)
  const aadhaarAvailableCount = completedList.filter((b) => {
    const a = b.aadhaarInfo || {};
    const num = String(a.aadhaarNumber || b.aadhaarNumber || '').replace(/\D/g, '');
    return a.type === 'aadhaar' || num.length === 12 || b.hasAadhaar === true;
  }).length;

  // 2. Aadhaar Not Available (आधार उपलब्ध नहीं)
  const aadhaarNotAvailableCount = completedList.filter((b) => {
    const a = b.aadhaarInfo || {};
    return a.type === 'remark' || Boolean(a.remark) || b.hasAadhaar === false;
  }).length;

  // 3. Aadhaar Review/Pending (आधार स्थिति समीक्षा)
  const aadhaarReviewPendingCount = completedList.filter((b) => {
    const a = b.aadhaarInfo || {};
    return (
      a.type === 'enrollment' ||
      (a.enrollmentNumber && String(a.enrollmentNumber).length > 0) ||
      (!a.type && !a.aadhaarNumber && !a.enrollmentNumber && !a.remark)
    );
  }).length;

  // 4. Ration Card Available (राशन कार्ड उपलब्ध)
  const rationAvailableCount = completedList.filter((b) => {
    const r = b.rationInfo || {};
    const num = String(r.rationNumber || b.rationNumber || '').trim();
    return (
      r.hasRationCard === 'yes' ||
      num.length >= 10 ||
      b.hasRationCard === true ||
      b.hasRationCard === 'yes'
    );
  }).length;

  // 5. Ration Not Available (राशन कार्ड नहीं है)
  const rationNotAvailableCount = completedList.filter((b) => {
    const r = b.rationInfo || {};
    return (
      r.hasRationCard === 'no' ||
      (!r.rationNumber &&
        r.hasRationCard !== 'yes' &&
        b.hasRationCard !== true &&
        b.hasRationCard !== 'yes')
    );
  }).length;

  // Percentages relative to completed surveys
  const aadhaarAvailablePct =
    completedCount > 0
      ? ((aadhaarAvailableCount / completedCount) * 100).toFixed(1)
      : '0.0';
  const aadhaarNotAvailablePct =
    completedCount > 0
      ? ((aadhaarNotAvailableCount / completedCount) * 100).toFixed(1)
      : '0.0';
  const rationAvailablePct =
    completedCount > 0
      ? ((rationAvailableCount / completedCount) * 100).toFixed(1)
      : '0.0';
  const rationNotAvailablePct =
    completedCount > 0
      ? ((rationNotAvailableCount / completedCount) * 100).toFixed(1)
      : '0.0';

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
    aadhaarAvailableCount,
    aadhaarAvailablePct,
    aadhaarNotAvailableCount,
    aadhaarNotAvailablePct,
    aadhaarReviewPendingCount,
    rationAvailableCount,
    rationAvailablePct,
    rationNotAvailableCount,
    rationNotAvailablePct,
    aadhaarPendingQuality,
    rationPendingQuality,
    mobileMissingQuality
  };
}
