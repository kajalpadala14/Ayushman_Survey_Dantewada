const LOCAL_SURVEYS_STORAGE_KEY = 'ayushman_local_surveys_v1';

export function getLocalSurveys() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    const raw = window.localStorage.getItem(LOCAL_SURVEYS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function saveLocalSurvey(surveyData) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (!surveyData?.beneficiaryId) return;
    const current = getLocalSurveys();
    current[surveyData.beneficiaryId] = {
      ...surveyData,
      savedAt: Date.now()
    };
    window.localStorage.setItem(LOCAL_SURVEYS_STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    console.warn('Failed to save survey to local storage:', err);
  }
}

export function mergeWithLocalSurveys(beneficiaries) {
  if (!Array.isArray(beneficiaries) || beneficiaries.length === 0) {
    return beneficiaries;
  }

  const localSurveys = getLocalSurveys();
  const localKeys = Object.keys(localSurveys);
  if (localKeys.length === 0) {
    return beneficiaries;
  }

  return beneficiaries.map((b) => {
    const local = localSurveys[b.id];
    if (!local) return b;

    // If local survey exists, merge local edits to prevent stale backend data from overwriting
    const updatedStatus = local.status || (local.overallResult === 'VERIFIED' ? 'Completed' : b.status);

    return {
      ...b,
      status: updatedStatus,
      overallResult: local.overallResult || b.overallResult,
      surveyId: local.surveyId || b.surveyId,
      surveyDate: local.surveyDate || b.surveyDate,
      submittedBy: local.submittedBy || b.submittedBy,
      aadhaarInfo: {
        ...(b.aadhaarInfo || {}),
        ...(local.aadhaarInfo || {})
      },
      rationInfo: {
        ...(b.rationInfo || {}),
        ...(local.rationInfo || {})
      },
      mobileInfo: {
        ...(b.mobileInfo || {}),
        ...(local.mobileInfo || {})
      },
      parameterResponses: local.parameterResponses || b.parameterResponses,
      mobile: local.mobileInfo?.mobileNumber || b.mobile
    };
  });
}
