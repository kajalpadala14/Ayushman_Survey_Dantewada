import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart3, Home, Moon, ShieldCheck, SunMedium, Users } from 'lucide-react';

import { appConfig } from './config';
import { getBootstrapData, readCachedBootstrapData, writeCachedBootstrapData, saveSurvey } from './services/appsScriptApi';
import ReportsDashboard from './components/ReportsDashboard';
import SurveyorDashboard from './components/SurveyorDashboard';
import SurveyWizard from './components/SurveyWizard';
import { getISTDateTimeString } from './utils/dateTime';

export default function App() {
  const [cachedBootstrapData] = useState(() => readCachedBootstrapData());
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('ayushman_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch (e) {
      /* ignore */
    }
    return appConfig.defaultTheme || 'light';
  });
  const [currentUser] = useState(appConfig.currentUser);
  const [activeView, setActiveView] = useState('dashboard');

  useEffect(() => {
    try {
      localStorage.setItem('ayushman_theme', theme);
    } catch (e) {
      /* ignore */
    }
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.body.setAttribute('data-theme', theme);
    document.body.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const [beneficiaries, setBeneficiaries] = useState(
    Array.isArray(cachedBootstrapData?.beneficiaries) ? cachedBootstrapData.beneficiaries : []
  );
  const [parameters, setParameters] = useState(
    Array.isArray(cachedBootstrapData?.parameters) ? cachedBootstrapData.parameters : []
  );
  const [issueTypes, setIssueTypes] = useState(
    Array.isArray(cachedBootstrapData?.issues) ? cachedBootstrapData.issues : []
  );
  const [users, setUsers] = useState(
    Array.isArray(cachedBootstrapData?.users) ? cachedBootstrapData.users : []
  );
  const [selectedBeneficiary, setSelectedBeneficiary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const hasBootstrapData = beneficiaries.length > 0 || parameters.length > 0 || issueTypes.length > 0;
  const hasBootstrapDataRef = useRef(hasBootstrapData);

  useEffect(() => {
    hasBootstrapDataRef.current = hasBootstrapData;
  }, [hasBootstrapData]);

  const loadBootstrapData = useCallback(async ({ showLoading = true } = {}) => {
    if (showLoading) setLoading(true);
    setLoadError('');

    try {
      const data = await getBootstrapData();
      setBeneficiaries(Array.isArray(data?.beneficiaries) ? data.beneficiaries : []);
      setParameters(Array.isArray(data?.parameters) ? data.parameters : []);
      setIssueTypes(Array.isArray(data?.issues) ? data.issues : []);
      setUsers(Array.isArray(data?.users) ? data.users : []);
    } catch (error) {
      console.error('Bootstrap API failed:', error);
      if (!hasBootstrapDataRef.current) {
        setBeneficiaries([]);
        setParameters([]);
        setIssueTypes([]);
        setUsers([]);
      }
      setLoadError(error instanceof Error && error.message
        ? `डेटा लोड नहीं हो सका: ${error.message}`
        : 'डेटा लोड नहीं हो सका। कृपया backend/API connection check करें।');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    loadBootstrapData()
      .catch((error) => {
        if (mounted) console.error('Unexpected bootstrap failure:', error);
      })

    return () => {
      mounted = false;
    };
  }, [loadBootstrapData]);

  const handleSelectBeneficiary = (beneficiary) => {
    setSelectedBeneficiary(beneficiary);
    setActiveView('beneficiaries');
  };

  const handleSubmitSurvey = async ({
    beneficiaryId,
    responses,
    aadhaarInfo,
    rationInfo,
    mobileInfo,
    overallResult
  }) => {
    const now = new Date();
    const surveyId = `${appConfig.surveyIdPrefix}-${now.getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const surveyDate = getISTDateTimeString(now);

    const submissionData = {
      beneficiaryId,
      beneficiaryName: selectedBeneficiary?.name || '',
      responses,
      aadhaarInfo,
      rationInfo,
      mobileInfo,
      overallResult,
      surveyId,
      surveyDate,
      submittedBy: currentUser.id
    };

    await saveSurvey(submissionData);

    const updatedStatus = overallResult === 'VERIFIED' ? 'Completed' : 'Issue Found';
    const beneficiaryPatch = {
      status: updatedStatus,
      overallResult,
      surveyId,
      surveyDate,
      aadhaarInfo,
      rationInfo,
      mobileInfo,
      parameterResponses: responses
    };

    setBeneficiaries((previous) =>
      previous.map((b) => (b.id === beneficiaryId ? { ...b, ...beneficiaryPatch } : b))
    );

    setSelectedBeneficiary((previous) => {
      if (!previous || previous.id !== beneficiaryId) return previous;
      return { ...previous, ...beneficiaryPatch };
    });

    const cached = readCachedBootstrapData();
    if (cached?.beneficiaries) {
      writeCachedBootstrapData({
        ...cached,
        beneficiaries: cached.beneficiaries.map((b) =>
          b.id === beneficiaryId ? { ...b, ...beneficiaryPatch } : b
        )
      });
    }

    window.setTimeout(() => {
      loadBootstrapData({ showLoading: false }).catch((err) =>
        console.warn('Background sync warning:', err)
      );
    }, 2000);

    return { surveyId, surveyDate };
  };

  const renderDataState = () => {
    if (loading && loadError === '__legacy_loading_panel__') {
      return (
        <div className="data-state-panel empty-state-table loading-state">
          <span className="loading-spinner" aria-hidden="true" />
          <span>डेटा लोड हो रहा है...</span>
        </div>
      );
    }

    if (loadError && !hasBootstrapData) {
      return <div className="data-state-panel empty-state-table">{loadError}</div>;
    }

    if (!loading && beneficiaries.length === 0) {
      return <div className="empty-state-table">कोई रिकॉर्ड नहीं मिला।</div>;
    }

    return null;
  };

  const isDark = theme === 'dark';
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'beneficiaries', label: 'Beneficiaries', icon: Users },
    { id: 'reports', label: 'Reports', icon: BarChart3 }
  ];

  return (
    <div
      className={`app-container ${isDark ? 'dark' : 'light'}`}
      data-theme={theme}
      style={{
        background: isDark ? '#0f172a' : '#f8fafc',
        color: isDark ? '#e2e8f0' : '#111827'
      }}
    >
      <main className="main-content" style={{ background: isDark ? '#0f172a' : '#f8fafc' }}>
        <header className="top-header">
          <div className="app-brand">
            <div className="brand-icon">
              <ShieldCheck size={18} color="white" strokeWidth={2.4} />
            </div>
            <div className="brand-copy">
              <span className="brand-title">{appConfig.appName}</span>
              <small className="brand-department">{appConfig.departmentName}</small>
            </div>
          </div>

          <nav className="app-nav desktop-nav">
            {navItems.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeView === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`app-nav-tab ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveView(tab.id)}
                >
                  <Icon size={18} strokeWidth={2.25} />
                  <span className="app-nav-label">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          <button
            className="theme-toggle"
            type="button"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            aria-label="Toggle theme"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <SunMedium size={18} /> : <Moon size={18} />}
          </button>
        </header>

        {/* Mobile Bottom Navigation Bar */}
        <nav className="app-nav mobile-bottom-nav">
          {navItems.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeView === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                className={`app-nav-tab ${isActive ? 'active' : ''}`}
                onClick={() => setActiveView(tab.id)}
              >
                <Icon size={18} strokeWidth={2.25} />
                <span className="app-nav-label">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="page-body" style={{ maxWidth: '100%', paddingLeft: 0, paddingRight: 0, margin: '0 auto' }}>
          {renderDataState() || (selectedBeneficiary ? (
            <div className="view-panel survey-view-panel" style={{ marginTop: '0.5rem' }}>
              <SurveyWizard
                beneficiary={selectedBeneficiary}
                parameters={parameters}
                issueTypes={issueTypes}
                onSubmitSurvey={handleSubmitSurvey}
                onCancel={() => setSelectedBeneficiary(null)}
              />
            </div>
          ) : (
            <>
              {activeView === 'dashboard' && (
                <div className="view-panel">
                  <SurveyorDashboard
                    beneficiaries={beneficiaries}
                    currentUser={currentUser}
                    onSelectBeneficiary={handleSelectBeneficiary}
                    showOverview={true}
                    showQueue={false}
                    loading={loading && !hasBootstrapData}
                  />
                </div>
              )}

              {activeView === 'beneficiaries' && (
                <div className="view-panel">
                  <SurveyorDashboard
                    beneficiaries={beneficiaries}
                    currentUser={currentUser}
                    onSelectBeneficiary={handleSelectBeneficiary}
                    showOverview={false}
                    showQueue={true}
                    loading={loading && !hasBootstrapData}
                  />
                </div>
              )}

              {activeView === 'reports' && (
                <div className="view-panel">
                  <ReportsDashboard
                    beneficiaries={beneficiaries}
                    currentUser={currentUser}
                    issueTypes={issueTypes}
                    users={users}
                    loading={loading && !hasBootstrapData}
                  />
                </div>
              )}
            </>
          ))}
        </div>
      </main>
    </div>
  );
}
