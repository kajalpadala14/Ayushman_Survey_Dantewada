import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  FileX,
  HelpCircle,
  Phone,
  Search,
  Shield,
  TrendingUp,
  Users
} from 'lucide-react';
import { formatSurveyTime } from '../utils/dateTime';
import { calculateDocumentationStatus } from '../utils/dashboardMetrics';
import { exportToExcel } from '../utils/excelExport';

const hindiGender = {
  Male: 'पुरुष',
  Female: 'महिला',
  Other: 'अन्य'
};

const statusHindi = {
  Pending: 'खाली',
  Completed: 'भरा',
  'Issue Found': 'समस्या'
};

const getGroupStats = (items, key) => {
  const groups = items.reduce((acc, item) => {
    const label = item[key] || 'Unknown';

    if (!acc[label]) {
      acc[label] = {
        label,
        total: 0,
        villages: new Set(),
        completed: 0,
        pending: 0,
        issue: 0,
        returned: 0
      };
    }

    acc[label].total += 1;
    acc[label].villages.add(item.village || 'Unknown');

    if (item.status === 'Completed') {
      acc[label].completed += 1;
    } else if (item.status === 'Issue Found') {
      acc[label].issue += 1;

    } else {
      acc[label].pending += 1;
    }

    return acc;
  }, {});

  return Object.values(groups)
    .map((group) => ({
      ...group,
      villageCount: group.villages.size,
      filled: group.completed + group.issue,
      percent: group.total ? Math.round(((group.completed + group.issue) / group.total) * 1000) / 10 : 0
    }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
};

function DistributionTable({ title, rows, type }) {
  return (
    <article className="card detail-table-card no-section-header">
      {title && (
        <div className="distribution-table-caption">
          <span className="distribution-table-badge">📋</span>
          <span>{title}</span>
        </div>
      )}
      <div className="detail-table-wrap">
        <table className="detail-table">
          <thead>
            <tr>
              <th>{type === 'block' ? 'ब्लॉक' : 'ग्राम पंचायत'}</th>
              <th>कुल</th>
              <th>गांव</th>
              <th>भरे</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.label}>
                <td data-label={type === 'block' ? 'Block' : 'Gram Panchayat'}>
                  <span className={`name-pill pill-${index % 4}`}>{row.label}</span>
                </td>
                <td data-label="Total">{row.total.toLocaleString('en-IN')}</td>
                <td data-label="Villages">{row.villageCount.toLocaleString('en-IN')}</td>
                <td data-label="Filled" className="filled-count">{row.filled.toLocaleString('en-IN')}</td>
                <td data-label="Percent" className="percent-count">{row.percent.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

const SkeletonText = ({ width = '100%', className = '' }) => (
  <span className={`skeleton-line ${className}`} style={{ width }} aria-hidden="true" />
);

const dashboardSkeletonRows = Array.from({ length: 5 }, (_, index) => index);

export default function SurveyorDashboard({
  beneficiaries,
  currentUser,
  onSelectBeneficiary,
  showOverview = true,
  showQueue = true,
  loading = false
}) {
  const [search, setSearch] = useState('');
  const [blockFilter, setBlockFilter] = useState('');
  const [gpFilter, setGpFilter] = useState('');
  const [villageFilter, setVillageFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');

  const currentUserId = String(currentUser?.id || '').trim();
  const assignedList = useMemo(() => {
    const userAssignedList = currentUserId
      ? beneficiaries.filter((b) => String(b.assignedSurveyorId || '').trim() === currentUserId)
      : [];
    return currentUserId && userAssignedList.length ? userAssignedList : beneficiaries;
  }, [beneficiaries, currentUserId]);
  const blockOptions = useMemo(() => [...new Set(assignedList.map((b) => b.block).filter(Boolean))], [assignedList]);
  const gpOptions = useMemo(() => [...new Set(assignedList.filter((b) => !blockFilter || b.block === blockFilter).map((b) => b.gp).filter(Boolean))], [assignedList, blockFilter]);
  const villageOptions = useMemo(() => [...new Set(assignedList.filter((b) => (!blockFilter || b.block === blockFilter) && (!gpFilter || b.gp === gpFilter)).map((b) => b.village).filter(Boolean))], [assignedList, blockFilter, gpFilter]);

  const filteredList = useMemo(() => assignedList.filter((b) => {
    const query = search.toLowerCase();
    const matchesSearch =
      String(b.name || '').toLowerCase().includes(query) ||
      String(b.id || '').toLowerCase().includes(query) ||
      (b.fatherName || '').toLowerCase().includes(query) ||
      (b.headName || '').toLowerCase().includes(query) ||
      (b.gp || '').toLowerCase().includes(query) ||
      (b.village || '').toLowerCase().includes(query) ||
      String(b.mobile || '').includes(search);

    const matchesBlock = !blockFilter || b.block === blockFilter;
    const matchesGp = !gpFilter || b.gp === gpFilter;
    const matchesVillage = !villageFilter || b.village === villageFilter;
    const matchesStatus = !statusFilter || b.status === statusFilter;
    const matchesGender = !genderFilter || b.gender === genderFilter;

    return matchesSearch && matchesBlock && matchesGp && matchesVillage && matchesStatus && matchesGender;
  }), [assignedList, search, blockFilter, gpFilter, villageFilter, statusFilter, genderFilter]);

  const totalAssigned = assignedList.length;
  const completed = assignedList.filter((b) => b.status === 'Completed').length;
  const pending = assignedList.filter((b) => b.status === 'Pending').length;
  const completionRate = totalAssigned ? (completed / totalAssigned) * 100 : 0;

  // Documentation Status (दस्तावेज़ स्थिति) metrics
  const docMetrics = useMemo(() => calculateDocumentationStatus(assignedList), [assignedList]);
  const {
    completedCount,
    aadhaarAvailableCount,
    aadhaarAvailablePct,
    aadhaarNotAvailableCount,
    aadhaarNotAvailablePct,
    aadhaarReviewPendingCount,
    rationAvailableCount,
    rationAvailablePct,
    rationNotAvailableCount,
    rationNotAvailablePct
  } = docMetrics;

  const blockStats = getGroupStats(assignedList, 'block');

  const locationRows = assignedList.reduce((acc, item) => {
    const key = item.block || 'Unknown';
    if (!acc[key]) {
      acc[key] = {
        block: item.block || 'Unknown',
        totalSurvey: 0,
        completed: 0,
        pending: 0
      };
    }
    acc[key].totalSurvey += 1;
    if (item.status === 'Completed') {
      acc[key].completed += 1;
    } else {
      acc[key].pending += 1;
    }
    return acc;
  }, {});

  const locationTableRows = Object.values(locationRows).sort((a, b) => {
    return (b.totalSurvey + b.completed) - (a.totalSurvey + a.completed) || a.block.localeCompare(b.block);
  });

  const locationTotals = locationTableRows.reduce(
    (acc, row) => ({
      totalSurvey: acc.totalSurvey + row.totalSurvey,
      completed: acc.completed + row.completed,
      pending: acc.pending + row.pending
    }),
    { totalSurvey: 0, completed: 0, pending: 0 }
  );

  const gpRows = assignedList.reduce((acc, item) => {
    const key = item.gp || 'Unknown';
    if (!acc[key]) {
      acc[key] = {
        gp: item.gp || 'Unknown',
        block: item.block || 'Unknown',
        totalSurvey: 0,
        completed: 0,
        pending: 0
      };
    }
    acc[key].totalSurvey += 1;
    if (item.status === 'Completed') {
      acc[key].completed += 1;
    } else {
      acc[key].pending += 1;
    }
    return acc;
  }, {});

  const gpTableRows = Object.values(gpRows).sort((a, b) => {
    return (b.totalSurvey + b.completed) - (a.totalSurvey + a.completed) || a.gp.localeCompare(b.gp);
  });

  const gpTotals = gpTableRows.reduce(
    (acc, row) => ({
      totalSurvey: acc.totalSurvey + row.totalSurvey,
      completed: acc.completed + row.completed,
      pending: acc.pending + row.pending
    }),
    { totalSurvey: 0, completed: 0, pending: 0 }
  );

  const handleDownloadGpReport = () => {
    if (!gpTableRows || gpTableRows.length === 0) {
      alert('डाउनलोड करने के लिए कोई डेटा उपलब्ध नहीं है।');
      return;
    }

    const headers = [
      'क्र. (S.No.)',
      'ग्राम पंचायत (Gram Panchayat)',
      'विकासखंड (Block)',
      'कुल सर्वे (Total Survey)',
      'पूर्ण (Completed)',
      'लंबित (Pending)'
    ];

    const dataRows = gpTableRows.map((r, idx) => [
      idx + 1,
      r.gp,
      r.block,
      r.totalSurvey,
      r.completed,
      r.pending
    ]);

    dataRows.push([
      '',
      'कुल योग (Total)',
      '—',
      gpTotals.totalSurvey,
      gpTotals.completed,
      gpTotals.pending
    ]);

    const dateStr = new Date().toISOString().slice(0, 10);
    exportToExcel(
      [headers, ...dataRows],
      `Gram_Panchayat_Wise_Report_${dateStr}.xlsx`,
      'GP_Wise_Report'
    );
  };

  const handleDownloadBlockReport = () => {
    if (!locationTableRows || locationTableRows.length === 0) {
      alert('डाउनलोड करने के लिए कोई डेटा उपलब्ध नहीं है।');
      return;
    }

    const headers = [
      'क्र. (S.No.)',
      'विकासखंड (Block)',
      'कुल सर्वे (Total Survey)',
      'पूर्ण (Completed)',
      'लंबित (Pending)'
    ];

    const dataRows = locationTableRows.map((r, idx) => [
      idx + 1,
      r.block,
      r.totalSurvey,
      r.completed,
      r.pending
    ]);

    dataRows.push([
      '',
      'कुल योग (Total)',
      locationTotals.totalSurvey,
      locationTotals.completed,
      locationTotals.pending
    ]);

    const dateStr = new Date().toISOString().slice(0, 10);
    exportToExcel(
      [headers, ...dataRows],
      `Block_Wise_Report_${dateStr}.xlsx`,
      'Block_Wise_Report'
    );
  };

  const villageRows = assignedList.reduce((acc, item) => {
    const key = `${item.block || 'Unknown'}___${item.gp || 'Unknown'}___${item.village || 'Unknown'}`;
    if (!acc[key]) {
      acc[key] = {
        village: item.village || 'Unknown',
        gp: item.gp || 'Unknown',
        block: item.block || 'Unknown',
        totalSurvey: 0,
        completed: 0,
        pending: 0
      };
    }
    acc[key].totalSurvey += 1;
    if (item.status === 'Completed') {
      acc[key].completed += 1;
    } else {
      acc[key].pending += 1;
    }
    return acc;
  }, {});

  const villageTableRows = Object.values(villageRows).sort((a, b) => {
    return (b.totalSurvey + b.completed) - (a.totalSurvey + a.completed) || a.village.localeCompare(b.village);
  });

  const villageTotals = villageTableRows.reduce(
    (acc, row) => ({
      totalSurvey: acc.totalSurvey + row.totalSurvey,
      completed: acc.completed + row.completed,
      pending: acc.pending + row.pending
    }),
    { totalSurvey: 0, completed: 0, pending: 0 }
  );

  const handleDownloadVillageReport = () => {
    if (!villageTableRows || villageTableRows.length === 0) {
      alert('डाउनलोड करने के लिए कोई डेटा उपलब्ध नहीं है।');
      return;
    }

    const headers = [
      'क्र. (S.No.)',
      'ग्राम (Village)',
      'ग्राम पंचायत (Gram Panchayat)',
      'विकासखंड (Block)',
      'कुल सर्वे (Total Survey)',
      'पूर्ण (Completed)',
      'लंबित (Pending)'
    ];

    const dataRows = villageTableRows.map((r, idx) => [
      idx + 1,
      r.village,
      r.gp,
      r.block,
      r.totalSurvey,
      r.completed,
      r.pending
    ]);

    dataRows.push([
      '',
      'कुल योग (Total)',
      '—',
      '—',
      villageTotals.totalSurvey,
      villageTotals.completed,
      villageTotals.pending
    ]);

    const dateStr = new Date().toISOString().slice(0, 10);
    exportToExcel(
      [headers, ...dataRows],
      `Village_Wise_Report_${dateStr}.xlsx`,
      'Village_Wise_Report'
    );
  };

  return (
    <div className="dashboard-shell">
      {showOverview && (
        <>
          {/* Top Executive Header Card */}
          <section className="dashboard-overview-card">
            <div className="dashboard-overview-header">
              <div>
                <div className="dashboard-overview-kicker">प्रशासनिक कमांड सेंटर • ADMINISTRATIVE COMMAND CENTER</div>
                <h1 className="dashboard-overview-title">आयुष्मान सर्वे दंतेवाड़ा</h1>
                <div className="dashboard-overview-subtitle">
                  {loading ? (
                    <SkeletonText width="180px" />
                  ) : (
                    `${completed.toLocaleString('en-IN')} / ${totalAssigned.toLocaleString('en-IN')} Surveys Completed`
                  )}
                </div>
              </div>
              <div className="dashboard-overview-badge">
                <span className="dashboard-overview-dot" />
                <span>{loading ? <SkeletonText width="82px" /> : `${completionRate.toFixed(1)}% Complete`}</span>
              </div>
            </div>
          </section>

          {/* 4 Main KPI Cards */}
          <section className="dashboard-kpi-grid">
            <div className="kpi-card">
              <div className="kpi-card-inner">
                <div className="kpi-icon-box">
                  <Users size={22} color="#1e40af" strokeWidth={2} />
                </div>
                <div className="kpi-content">
                  <div className="kpi-label-hi">कुल लक्ष्य</div>
                  <div className="kpi-label-en">Total Beneficiaries</div>
                  <div className="kpi-value">
                    {loading ? <SkeletonText width="58px" className="skeleton-value" /> : totalAssigned.toLocaleString('en-IN')}
                  </div>
                  <div className="kpi-footer">
                    {loading ? <SkeletonText width="80px" /> : `${totalAssigned.toLocaleString('en-IN')} कुल असाइन`}
                  </div>
                </div>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-card-inner">
                <div className="kpi-icon-box">
                  <CheckCircle2 size={22} color="#1e40af" strokeWidth={2} />
                </div>
                <div className="kpi-content">
                  <div className="kpi-label-hi">सर्वे पूर्ण</div>
                  <div className="kpi-label-en">Survey Completed</div>
                  <div className="kpi-value" style={{ color: '#16a34a' }}>
                    {loading ? <SkeletonText width="40px" className="skeleton-value" /> : completed.toLocaleString('en-IN')}
                  </div>
                  <div className="kpi-footer">
                    {loading ? <SkeletonText width="80px" /> : `${completed.toLocaleString('en-IN')} / ${totalAssigned.toLocaleString('en-IN')} पूर्ण`}
                  </div>
                </div>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-card-inner">
                <div className="kpi-icon-box">
                  <Clock size={22} color="#1e40af" strokeWidth={2} />
                </div>
                <div className="kpi-content">
                  <div className="kpi-label-hi">सर्वे लंबित</div>
                  <div className="kpi-label-en">Survey Pending</div>
                  <div className="kpi-value" style={{ color: '#d97706' }}>
                    {loading ? <SkeletonText width="58px" className="skeleton-value" /> : pending.toLocaleString('en-IN')}
                  </div>
                  <div className="kpi-footer">
                    {loading ? <SkeletonText width="80px" /> : `${pending.toLocaleString('en-IN')} शेष हितग्राही`}
                  </div>
                </div>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-card-inner">
                <div className="kpi-icon-box">
                  <TrendingUp size={22} color="#1e40af" strokeWidth={2} />
                </div>
                <div className="kpi-content">
                  <div className="kpi-label-hi">प्रगति</div>
                  <div className="kpi-label-en">Survey Progress</div>
                  <div className="kpi-value" style={{ color: '#2563eb' }}>
                    {loading ? <SkeletonText width="50px" className="skeleton-value" /> : `${completionRate.toFixed(1)}%`}
                  </div>
                  <div className="kpi-footer">
                    {loading ? <SkeletonText width="80px" /> : `${completionRate.toFixed(1)}% लक्ष्य पूर्ण`}
                  </div>
                </div>
              </div>
            </div>
          </section>


          {/* दस्तावेज़ स्थिति (Documentation Status) Section */}
          <section className="dashboard-doc-status-panel">
            <div className="dashboard-doc-status-header">
              <FileText size={20} color="#2563eb" strokeWidth={2.2} />
              <div>
                <h2 className="dashboard-doc-status-title">दस्तावेज़ स्थिति</h2>
                <div className="dashboard-doc-status-kicker">
                  DOCUMENTATION STATUS (COMPLETED SURVEYS: {loading ? '...' : completedCount.toLocaleString('en-IN')})
                </div>
              </div>
            </div>

            <div className="dashboard-doc-status-grid">
              {/* Card 1: आधार उपलब्ध */}
              <div className="doc-status-card">
                <div className="doc-status-icon-box">
                  <Shield size={18} color="#2563eb" strokeWidth={2.2} />
                </div>
                <div className="doc-status-body">
                  <div className="doc-status-title-hi">आधार उपलब्ध</div>
                  <div className="doc-status-title-en">Aadhaar Available</div>
                  <div className="doc-status-value" style={{ color: '#2563eb' }}>
                    {loading ? <SkeletonText width="28px" /> : aadhaarAvailableCount.toLocaleString('en-IN')}
                  </div>
                  <div className="doc-status-footer">
                    {loading ? <SkeletonText width="65px" /> : `${aadhaarAvailablePct}% मान्य आधार`}
                  </div>
                </div>
              </div>

              {/* Card 2: आधार उपलब्ध नहीं */}
              <div className="doc-status-card">
                <div className="doc-status-icon-box">
                  <AlertTriangle size={18} color="#2563eb" strokeWidth={2.2} />
                </div>
                <div className="doc-status-body">
                  <div className="doc-status-title-hi">आधार उपलब्ध नहीं</div>
                  <div className="doc-status-title-en">Aadhaar Not Available</div>
                  <div className="doc-status-value" style={{ color: '#dc2626' }}>
                    {loading ? <SkeletonText width="28px" /> : aadhaarNotAvailableCount.toLocaleString('en-IN')}
                  </div>
                  <div className="doc-status-footer">
                    {loading ? <SkeletonText width="65px" /> : `${aadhaarNotAvailablePct}% रिमार्क दर्ज`}
                  </div>
                </div>
              </div>

              {/* Card 3: आधार स्थिति समीक्षा */}
              <div className="doc-status-card">
                <div className="doc-status-icon-box">
                  <HelpCircle size={18} color="#2563eb" strokeWidth={2.2} />
                </div>
                <div className="doc-status-body">
                  <div className="doc-status-title-hi">आधार स्थिति समीक्षा</div>
                  <div className="doc-status-title-en">Aadhaar Review/Pending</div>
                  <div className="doc-status-value" style={{ color: '#16a34a' }}>
                    {loading ? <SkeletonText width="28px" /> : aadhaarReviewPendingCount.toLocaleString('en-IN')}
                  </div>
                  <div className="doc-status-footer">
                    {loading ? <SkeletonText width="65px" /> : (aadhaarReviewPendingCount === 0 ? 'सभी स्थिति दर्ज' : `${aadhaarReviewPendingCount} समीक्षा स्थिति`)}
                  </div>
                </div>
              </div>

              {/* Card 4: राशन कार्ड उपलब्ध */}
              <div className="doc-status-card">
                <div className="doc-status-icon-box">
                  <CheckCircle2 size={18} color="#2563eb" strokeWidth={2.2} />
                </div>
                <div className="doc-status-body">
                  <div className="doc-status-title-hi">राशन कार्ड उपलब्ध</div>
                  <div className="doc-status-title-en">Ration Card Available</div>
                  <div className="doc-status-value" style={{ color: '#16a34a' }}>
                    {loading ? <SkeletonText width="28px" /> : rationAvailableCount.toLocaleString('en-IN')}
                  </div>
                  <div className="doc-status-footer">
                    {loading ? <SkeletonText width="65px" /> : `${rationAvailablePct}% राशन कार्ड दर्ज`}
                  </div>
                </div>
              </div>

              {/* Card 5: राशन कार्ड नहीं है */}
              <div className="doc-status-card">
                <div className="doc-status-icon-box">
                  <FileX size={18} color="#2563eb" strokeWidth={2.2} />
                </div>
                <div className="doc-status-body">
                  <div className="doc-status-title-hi">राशन कार्ड नहीं है</div>
                  <div className="doc-status-title-en">Ration Not Available</div>
                  <div className="doc-status-value" style={{ color: '#ea580c' }}>
                    {loading ? <SkeletonText width="28px" /> : rationNotAvailableCount.toLocaleString('en-IN')}
                  </div>
                  <div className="doc-status-footer">
                    {loading ? <SkeletonText width="65px" /> : `${rationNotAvailablePct}% बिना राशन कार्ड`}
                  </div>
                </div>
              </div>
            </div>


          </section>

          <section className="dashboard-table-panel panel-card dashboard-location-panel">
            <div className="dashboard-recent-header">
              <div className="dashboard-panel-title dashboard-table-title">Block-wise Survey</div>
              <button
                type="button"
                className="dashboard-download-btn"
                onClick={handleDownloadBlockReport}
                title="ब्लॉक-वार रिपोर्ट एक्सेल डाउनलोड करें"
              >
                <Download size={14} />
                <span>Download Excel</span>
              </button>
            </div>
            <div className="dashboard-table-wrap">
              <table className="dashboard-table dashboard-location-table">
                <thead>
                  <tr>
                    <th style={{ width: '45px' }}>#</th>
                    <th>Block</th>
                    <th className="text-right">Total Survey</th>
                    <th className="text-right">Completed</th>
                    <th className="text-right">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? dashboardSkeletonRows.map((row) => (
                    <tr key={`block-skeleton-${row}`}>
                      <td data-label="#"><SkeletonText width="20px" /></td>
                      <td data-label="Block"><SkeletonText width="120px" /></td>
                      <td data-label="Total Survey" className="text-right"><SkeletonText width="42px" /></td>
                      <td data-label="Completed" className="text-right"><SkeletonText width="42px" /></td>
                      <td data-label="Pending" className="text-right"><SkeletonText width="42px" /></td>
                    </tr>
                  )) : (
                    <>
                      {locationTableRows.map((row, index) => (
                        <tr key={row.block}>
                          <td data-label="#" className="cell-num font-semibold">{index + 1}</td>
                          <td data-label="Block">{row.block}</td>
                          <td data-label="Total Survey" className="text-right strong-cell">{row.totalSurvey}</td>
                          <td data-label="Completed" className="text-right completed-cell">{row.completed}</td>
                          <td data-label="Pending" className="text-right pending-cell">{row.pending}</td>
                        </tr>
                      ))}
                      {locationTableRows.length > 0 && (
                        <tr className="dashboard-table-total-row">
                          <td data-label="#">—</td>
                          <td data-label="Block" className="strong-cell">Total</td>
                          <td data-label="Total Survey" className="text-right strong-cell">{locationTotals.totalSurvey}</td>
                          <td data-label="Completed" className="text-right completed-cell">{locationTotals.completed}</td>
                          <td data-label="Pending" className="text-right pending-cell">{locationTotals.pending}</td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="dashboard-table-panel panel-card dashboard-gp-panel">
            <div className="dashboard-recent-header">
              <div className="dashboard-panel-title">Gram Panchayat-wise Report</div>
              <button
                type="button"
                className="dashboard-download-btn"
                onClick={handleDownloadGpReport}
                title="ग्राम पंचायत-वार रिपोर्ट एक्सेल डाउनलोड करें"
              >
                <Download size={14} />
                <span>Download Excel</span>
              </button>
            </div>

            <div className="dashboard-table-wrap">
              <table className="dashboard-table dashboard-recent-table">
                <thead>
                  <tr>
                    <th style={{ width: '45px' }}>#</th>
                    <th>Gram Panchayat</th>
                    <th>Block</th>
                    <th className="text-right">Total Survey</th>
                    <th className="text-right">Completed</th>
                    <th className="text-right">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? dashboardSkeletonRows.map((row) => (
                    <tr key={`gp-skeleton-${row}`}>
                      <td data-label="#"><SkeletonText width="20px" /></td>
                      <td data-label="Gram Panchayat" className="dashboard-beneficiary-name"><SkeletonText width="150px" /></td>
                      <td data-label="Block"><SkeletonText width="110px" /></td>
                      <td data-label="Total Survey" className="text-right"><SkeletonText width="42px" /></td>
                      <td data-label="Completed" className="text-right"><SkeletonText width="42px" /></td>
                      <td data-label="Pending" className="text-right"><SkeletonText width="42px" /></td>
                    </tr>
                  )) : (
                    <>
                      {gpTableRows.map((row, index) => (
                        <tr key={row.gp}>
                          <td data-label="#" className="cell-num font-semibold">{index + 1}</td>
                          <td data-label="Gram Panchayat" className="dashboard-beneficiary-name">{row.gp}</td>
                          <td data-label="Block">{row.block}</td>
                          <td data-label="Total Survey" className="text-right strong-cell">{row.totalSurvey}</td>
                          <td data-label="Completed" className="text-right completed-cell">{row.completed}</td>
                          <td data-label="Pending" className="text-right pending-cell">{row.pending}</td>
                        </tr>
                      ))}
                      {gpTableRows.length > 0 && (
                        <tr className="dashboard-table-total-row">
                          <td data-label="#">—</td>
                          <td data-label="Gram Panchayat" className="dashboard-beneficiary-name strong-cell">Total</td>
                          <td data-label="Block">—</td>
                          <td data-label="Total Survey" className="text-right strong-cell">{gpTotals.totalSurvey}</td>
                          <td data-label="Completed" className="text-right completed-cell">{gpTotals.completed}</td>
                          <td data-label="Pending" className="text-right pending-cell">{gpTotals.pending}</td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="dashboard-table-panel panel-card dashboard-village-panel">
            <div className="dashboard-recent-header">
              <div className="dashboard-panel-title">Village-wise Report</div>
              <button
                type="button"
                className="dashboard-download-btn"
                onClick={handleDownloadVillageReport}
                title="ग्राम-वार रिपोर्ट एक्सेल डाउनलोड करें"
              >
                <Download size={14} />
                <span>Download Excel</span>
              </button>
            </div>

            <div className="dashboard-table-wrap" style={{ maxHeight: '420px', overflowY: 'auto' }}>
              <table className="dashboard-table dashboard-recent-table">
                <thead>
                  <tr>
                    <th style={{ width: '45px' }}>#</th>
                    <th>Village</th>
                    <th>Gram Panchayat</th>
                    <th>Block</th>
                    <th className="text-right">Total Survey</th>
                    <th className="text-right">Completed</th>
                    <th className="text-right">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? dashboardSkeletonRows.map((row) => (
                    <tr key={`village-skeleton-${row}`}>
                      <td data-label="#"><SkeletonText width="20px" /></td>
                      <td data-label="Village" className="dashboard-beneficiary-name"><SkeletonText width="140px" /></td>
                      <td data-label="Gram Panchayat"><SkeletonText width="120px" /></td>
                      <td data-label="Block"><SkeletonText width="100px" /></td>
                      <td data-label="Total Survey" className="text-right"><SkeletonText width="42px" /></td>
                      <td data-label="Completed" className="text-right"><SkeletonText width="42px" /></td>
                      <td data-label="Pending" className="text-right"><SkeletonText width="42px" /></td>
                    </tr>
                  )) : (
                    <>
                      {villageTableRows.map((row, index) => (
                        <tr key={`${row.block}-${row.gp}-${row.village}`}>
                          <td data-label="#" className="cell-num font-semibold">{index + 1}</td>
                          <td data-label="Village" className="dashboard-beneficiary-name">{row.village}</td>
                          <td data-label="Gram Panchayat">{row.gp}</td>
                          <td data-label="Block">{row.block}</td>
                          <td data-label="Total Survey" className="text-right strong-cell">{row.totalSurvey}</td>
                          <td data-label="Completed" className="text-right completed-cell">{row.completed}</td>
                          <td data-label="Pending" className="text-right pending-cell">{row.pending}</td>
                        </tr>
                      ))}
                      {villageTableRows.length > 0 && (
                        <tr className="dashboard-table-total-row">
                          <td data-label="#">—</td>
                          <td data-label="Village" className="dashboard-beneficiary-name strong-cell">Total</td>
                          <td data-label="Gram Panchayat">—</td>
                          <td data-label="Block">—</td>
                          <td data-label="Total Survey" className="text-right strong-cell">{villageTotals.totalSurvey}</td>
                          <td data-label="Completed" className="text-right completed-cell">{villageTotals.completed}</td>
                          <td data-label="Pending" className="text-right pending-cell">{villageTotals.pending}</td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {showQueue && (
      <section className="member-dashboard">
        <div className="member-filter-card">
          <div className="member-search-row">
            <Search size={22} />
            <input
              type="text"
              placeholder="नाम, गाँव, मोबाइल खोजें..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="member-filter-grid">
            <select value={blockFilter} onChange={(e) => setBlockFilter(e.target.value)}>
              <option value="">सभी ब्लॉक</option>
              {blockOptions.map((block) => (
                <option key={block} value={block}>{block}</option>
              ))}
            </select>

            <select value={gpFilter} onChange={(e) => setGpFilter(e.target.value)}>
              <option value="">सभी ग्राम पंचायत</option>
              {gpOptions.map((gp) => (
                <option key={gp} value={gp}>{gp}</option>
              ))}
            </select>

            <select value={villageFilter} onChange={(e) => setVillageFilter(e.target.value)}>
              <option value="">सभी गाँव</option>
              {villageOptions.map((village) => (
                <option key={village} value={village}>{village}</option>
              ))}
            </select>

            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">बाकी / खाली</option>
              <option value="Pending">खाली</option>
              <option value="Completed">भरा</option>
              <option value="Issue Found">समस्या</option>
            </select>

            <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)}>
              <option value="">सभी लिंग</option>
              <option value="Male">पुरुष</option>
              <option value="Female">महिला</option>
              <option value="Other">अन्य</option>
            </select>
          </div>
        </div>

        <div className="member-list-card">
          <div className="member-list-header">
            <h2>सदस्य सूची</h2>
            <span>{filteredList.length} रिकॉर्ड (पृष्ठ 1/1)</span>
          </div>

          <div className="member-table-wrap">
            <table className="member-table">
              <thead>
                <tr>
                  <th>क्र.</th>
                  <th>ब्लॉक</th>
                  <th>ग्राम पंचायत</th>
                  <th>गाँव</th>
                  <th>पिता/पति/मुखिया</th>
                  <th>सदस्य</th>
                  <th>लिंग / आयु</th>
                  <th>स्थिति</th>
                  <th>समय</th>
                  <th>कॉल</th>
                  <th>कार्य</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  dashboardSkeletonRows.map((row) => (
                    <tr key={`member-skeleton-${row}`}>
                      <td data-label="No."><SkeletonText width="24px" /></td>
                      <td data-label="Block"><SkeletonText width="92px" /></td>
                      <td data-label="Gram Panchayat"><SkeletonText width="140px" /></td>
                      <td data-label="Village"><SkeletonText width="112px" /></td>
                      <td data-label="Guardian">
                        <div className="guardian-cell">
                          <SkeletonText width="160px" />
                          <SkeletonText width="190px" />
                        </div>
                      </td>
                      <td data-label="Member" className="member-name"><SkeletonText width="130px" /></td>
                      <td data-label="Gender / Age"><SkeletonText width="82px" /></td>
                      <td data-label="Status"><SkeletonText width="74px" className="skeleton-pill" /></td>
                      <td data-label="Time"><SkeletonText width="42px" /></td>
                      <td data-label="Call"><SkeletonText width="54px" /></td>
                      <td data-label="Action"><SkeletonText width="72px" /></td>
                    </tr>
                  ))
                ) : filteredList.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="empty-state">
                      चयनित फिल्टर में कोई सदस्य नहीं मिला।
                    </td>
                  </tr>
                ) : (
                  filteredList.map((beneficiary, index) => (
                    <tr key={beneficiary.id}>
                      <td data-label="क्र.">{index + 1}</td>
                      <td data-label="ब्लॉक">{beneficiary.block}</td>
                      <td data-label="ग्राम पंचायत">{beneficiary.gp}</td>
                      <td data-label="गांव">{beneficiary.village}</td>
                      <td data-label="मुखिया">
                        <div className="guardian-cell">
                          <span>मुखिया: {beneficiary.headName || '-'}</span>
                          <strong>पिता/पति का नाम: {beneficiary.fatherName || '-'}</strong>
                        </div>
                      </td>
                      <td data-label="सदस्य" className="member-name">{beneficiary.name}</td>
                      <td data-label="Gender / Age">{hindiGender[beneficiary.gender] || beneficiary.gender} / {beneficiary.age} वर्ष</td>
                      <td data-label="Status">
                        <span className={`member-status ${beneficiary.status === 'Completed' ? 'filled' : ''}`}>
                          <span />
                          {statusHindi[beneficiary.status] || beneficiary.status}
                        </span>
                      </td>
                      <td data-label="Time">{formatSurveyTime(beneficiary.surveyDate)}</td>
                      <td data-label="Call">
                        <a className="call-btn" href={`tel:${beneficiary.mobile}`} aria-label={`${beneficiary.name} को कॉल करें`}>
                          <Phone size={16} />
                          <span>-</span>
                        </a>
                      </td>
                      <td data-label="Action">
                        <button
                          className="edit-member-btn"
                          type="button"
                          onClick={() => onSelectBeneficiary(beneficiary)}
                        >
                          संपादित
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      )}
    </div>
  );
}
