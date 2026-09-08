import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarRange,
  Download,
  FileSpreadsheet,
  Filter,
  MapPinned,
  Printer,
  Search,
  Sparkles,
  UserRound,
  X
} from 'lucide-react';
import { appConfig } from '../config';

const REPORT_TABS = [
  'Survey Report',
  'Block-wise Report',
  'Verified Beneficiary Report',
  'Pending Survey Report',
  'Date-wise Report'
];

const STATUS_OPTIONS = ['', 'Completed', 'Pending'];
const TAB_KEY_MAP = {
  'Survey Report': 'survey',
  'Block-wise Report': 'block-wise',
  'Verified Beneficiary Report': 'verified',
  'Pending Survey Report': 'pending',
  'Date-wise Report': 'date'
};

const SkeletonText = ({ width = '100%', className = '' }) => (
  <span className={`skeleton-line ${className}`} style={{ width }} aria-hidden="true" />
);

const reportSkeletonRows = Array.from({ length: 8 }, (_, index) => index);

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Kolkata'
  });
};

const escapeCsv = (value) => {
  const stringValue = value == null ? '' : String(value);
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const formatBlockName = (blockName = '') => {
  if (!blockName) return 'Unknown';
  const clean = blockName.split('(')[0].trim();
  return clean || blockName;
};

// Document & issue detection helpers
export const hasAadhaarIssue = (beneficiary) => {
  if (beneficiary.aadhaarInfo?.type === 'remark' || Boolean(beneficiary.aadhaarInfo?.remark)) {
    return true;
  }
  const responses = beneficiary.parameterResponses || {};
  const issueText = Object.values(responses)
    .map((response) => response?.issueType || '')
    .join(' ')
    .toLowerCase();

  if (/aadhaar|आधार/.test(issueText) || /aadhaar|आधार/.test(String(beneficiary.aadhaarInfo?.remark || '').toLowerCase())) {
    return true;
  }
  if (beneficiary.status === 'Completed' && !beneficiary.aadhaarInfo?.aadhaarNumber && !beneficiary.aadhaarInfo?.enrollmentNumber) {
    return true;
  }
  return false;
};

export const hasRationIssue = (beneficiary) => {
  if (beneficiary.rationInfo?.hasRationCard === 'no') return true;
  const responses = beneficiary.parameterResponses || {};
  const issueText = Object.values(responses)
    .map((response) => response?.issueType || '')
    .join(' ')
    .toLowerCase();

  if (/ration|राशन/.test(issueText)) return true;
  if (beneficiary.status === 'Completed' && !beneficiary.rationInfo?.rationNumber && beneficiary.rationInfo?.hasRationCard !== 'yes') {
    return true;
  }
  return false;
};

export const hasValidAadhaar = (beneficiary) => {
  const aadhaar = beneficiary.aadhaarInfo || {};
  if (aadhaar.type === 'aadhaar' && aadhaar.aadhaarNumber) return true;
  if (aadhaar.aadhaarNumber && String(aadhaar.aadhaarNumber).replace(/\D/g, '').length === 12) return true;
  if (aadhaar.type === 'enrollment' && aadhaar.enrollmentNumber) return true;
  return false;
};

export const hasValidRation = (beneficiary) => {
  const ration = beneficiary.rationInfo || {};
  if (ration.hasRationCard === 'yes') return true;
  if (ration.rationNumber && String(ration.rationNumber).replace(/\D/g, '').length >= 10) return true;
  return false;
};

export const hasBothAadhaarAndRation = (beneficiary) => {
  return hasValidAadhaar(beneficiary) && hasValidRation(beneficiary);
};

export const isAyushmanCardMade = (beneficiary) => {
  return Boolean(
    beneficiary.hasAyushmanCard === true ||
    beneficiary.ayushmanCardStatus === 'Made' ||
    beneficiary.ayushmanCardStatus === 'Available' ||
    beneficiary.parameterResponses?.P3?.status === 'सही'
  );
};

export const hasBothDocsNoAyushman = (beneficiary) => {
  // Has BOTH Aadhaar & Ration Card, but Ayushman card is NOT yet made
  return hasBothAadhaarAndRation(beneficiary) && !isAyushmanCardMade(beneficiary);
};

export const hasOtherIssue = (beneficiary) => {
  const responses = beneficiary.parameterResponses || {};
  return Object.values(responses).some((r) => {
    const issue = String(r?.issueType || '').toLowerCase();
    return issue && !/aadhaar|आधार|ration|राशन/.test(issue);
  });
};

const buildTableRows = (beneficiaries, activeTabKey) => {
  if (activeTabKey === 'survey') {
    return beneficiaries.map((b) => ({
      id: b.id,
      name: b.name,
      janpad: b.block || 'Unknown',
      gp: b.gp || 'Unknown',
      gram: b.village || 'Unknown',
      status: b.status || 'Pending',
      date: b.surveyDate || '-'
    }));
  }

  if (activeTabKey === 'verified') {
    return beneficiaries.map((b) => {
      const hasAadhaar = hasValidAadhaar(b);
      const isVerified = hasBothAadhaarAndRation(b);

      return {
        id: b.id,
        name: b.name,
        janpad: b.block || 'Unknown',
        gp: b.gp || 'Unknown',
        gram: b.village || 'Unknown',
        aadhaarStatus: hasAadhaar ? 'Verified' : 'Pending',
        verifiedStatus: isVerified ? 'Verified Beneficiary' : 'Not Verified',
        status: b.status || 'Pending'
      };
    });
  }

  if (activeTabKey === 'pending') {
    return beneficiaries
      .filter((b) => b.status === 'Pending')
      .map((b) => ({
        id: b.id,
        name: b.name,
        janpad: b.block || 'Unknown',
        gp: b.gp || 'Unknown',
        gram: b.village || 'Unknown',
        status: b.status || 'Pending',
        date: b.surveyDate || '-'
      }));
  }

  if (activeTabKey === 'date') {
    return beneficiaries
      .filter((b) => b.surveyDate)
      .slice()
      .sort((a, b) => new Date(b.surveyDate) - new Date(a.surveyDate))
      .map((b) => ({
        id: b.id,
        name: b.name,
        janpad: b.block || 'Unknown',
        gp: b.gp || 'Unknown',
        gram: b.village || 'Unknown',
        date: formatDate(b.surveyDate),
        status: b.status || 'Pending'
      }));
  }

  return beneficiaries.map((b) => ({
    id: b.id,
    name: b.name,
    janpad: b.block || 'Unknown',
    gp: b.gp || 'Unknown',
    gram: b.village || 'Unknown',
    status: b.status || 'Pending',
    date: b.surveyDate || '-'
  }));
};

export default function ReportsDashboard({
  beneficiaries = [],
  currentUser = {},
  issueTypes = [],
  users = [],
  loading = false
}) {
  const [activeTab, setActiveTab] = useState('Survey Report');
  const [search, setSearch] = useState('');
  const [janpadFilter, setJanpadFilter] = useState('');
  const [gpFilter, setGpFilter] = useState('');
  const [gramFilter, setGramFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [issueTypeFilter, setIssueTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [blockReportModalOpen, setBlockReportModalOpen] = useState(false);
  const [exportMode, setExportMode] = useState('');
  const pageSize = 8;

  const distinctJanpads = useMemo(() => [...new Set(beneficiaries.map((b) => b.block).filter(Boolean))], [beneficiaries]);
  const distinctGps = useMemo(() => [...new Set(beneficiaries.filter((b) => !janpadFilter || b.block === janpadFilter).map((b) => b.gp).filter(Boolean))], [beneficiaries, janpadFilter]);
  const distinctGrams = useMemo(() => [...new Set(beneficiaries.filter((b) => (!janpadFilter || b.block === janpadFilter) && (!gpFilter || b.gp === gpFilter)).map((b) => b.village).filter(Boolean))], [beneficiaries, janpadFilter, gpFilter]);

  const issueTypeOptions = useMemo(() => [
    'Aadhaar Issue',
    'Ration Card Issue',
    'Survey Completed',
    'Survey Pending',
    'Verified Beneficiary'
  ], []);

  const issueMatchesSelectedType = (beneficiary, selectedIssueType) => {
    if (!selectedIssueType) return true;

    if (selectedIssueType === 'Aadhaar Issue') return hasAadhaarIssue(beneficiary);
    if (selectedIssueType === 'Ration Card Issue') return hasRationIssue(beneficiary);
    if (selectedIssueType === 'Survey Completed') return beneficiary.status === 'Completed';
    if (selectedIssueType === 'Survey Pending') return beneficiary.status === 'Pending';
    if (selectedIssueType === 'Verified Beneficiary') return hasBothAadhaarAndRation(beneficiary);

    const issueText = Object.values(beneficiary.parameterResponses || {})
      .map((response) => response?.issueType || '')
      .join(' ')
      .toLowerCase();
    const normalizedType = selectedIssueType.toLowerCase();

    return Object.values(beneficiary.parameterResponses || {})
      .some((response) => {
        const value = String(response?.issueType || '').toLowerCase();
        return value.includes(normalizedType) || normalizedType.includes(value);
      }) || issueText.includes(normalizedType);
  };

  const filteredBeneficiaries = useMemo(() => {
    const q = search.toLowerCase();
    return beneficiaries.filter((b) => {
      const text = `${b.name || ''} ${b.id || ''} ${b.fatherName || ''} ${b.headName || ''} ${b.gp || ''} ${b.village || ''}`.toLowerCase();
      const matchesSearch = !q || text.includes(q);
      const matchesJanpad = !janpadFilter || b.block === janpadFilter;
      const matchesGp = !gpFilter || b.gp === gpFilter;
      const matchesGram = !gramFilter || b.village === gramFilter;
      const matchesStatus = !statusFilter || b.status === statusFilter;
      const matchesIssueType = issueMatchesSelectedType(b, issueTypeFilter);

      const itemDate = b.surveyDate ? new Date(b.surveyDate) : null;
      const matchesFrom = !dateFrom || !itemDate || itemDate >= new Date(dateFrom);
      const matchesTo = !dateTo || !itemDate || itemDate <= new Date(`${dateTo}T23:59:59`);

      return matchesSearch && matchesJanpad && matchesGp && matchesGram && matchesStatus && matchesIssueType && matchesFrom && matchesTo;
    });
  }, [beneficiaries, search, janpadFilter, gpFilter, gramFilter, statusFilter, issueTypeFilter, dateFrom, dateTo]);

  // Aggregate Block-Wise Statistics for the detailed preview & report
  const blockWiseRows = useMemo(() => {
    const defaultBlocks = ['Kuakonda', 'Dantewada', 'Geedam', 'Katekalyan'];
    const presentBlocks = distinctJanpads.length > 0 ? distinctJanpads : defaultBlocks;

    const blockMap = new Map();
    presentBlocks.forEach((bName) => {
      const cleanName = formatBlockName(bName);
      if (!blockMap.has(cleanName)) {
        blockMap.set(cleanName, bName);
      }
    });

    const rows = Array.from(blockMap.entries()).map(([cleanBlock, rawBlock]) => {
      const blockBens = beneficiaries.filter((b) => {
        const bClean = formatBlockName(b.block);
        return bClean.toLowerCase() === cleanBlock.toLowerCase();
      });

      const total = blockBens.length;
      const pending = blockBens.filter((b) => b.status === 'Pending').length;
      const surveyDone = blockBens.filter((b) => b.status === 'Completed' || b.status === 'Issue Found').length;
      const registered = blockBens.filter((b) => b.overallResult === 'VERIFIED' || b.status === 'Completed').length;
      const surveyPercent = total > 0 ? ((surveyDone / total) * 100).toFixed(1) + '%' : '0%';
      const aadhaarIssue = blockBens.filter(hasAadhaarIssue).length;
      const rationIssue = blockBens.filter(hasRationIssue).length;
      const bothAvailable = blockBens.filter(hasBothAadhaarAndRation).length;
      const bothNoAyushman = blockBens.filter(hasBothDocsNoAyushman).length;
      const otherIssue = blockBens.filter(hasOtherIssue).length;

      const officers = (users || []).filter((u) => {
        const uBlock = formatBlockName(u.block);
        return uBlock && uBlock.toLowerCase() === cleanBlock.toLowerCase();
      }).length;

      return {
        block: cleanBlock,
        rawBlock,
        total,
        pending,
        surveyDone,
        registered,
        surveyPercent,
        aadhaarIssue,
        rationIssue,
        bothAvailable,
        bothNoAyushman,
        otherIssue,
        officers
      };
    });

    const order = { kuakonda: 1, dantewada: 2, geedam: 3, katekalyan: 4 };
    return rows.sort((a, b) => (order[a.block.toLowerCase()] || 99) - (order[b.block.toLowerCase()] || 99));
  }, [beneficiaries, distinctJanpads, users]);

  const blockWiseTotals = useMemo(() => {
    const total = blockWiseRows.reduce((acc, r) => acc + r.total, 0);
    const pending = blockWiseRows.reduce((acc, r) => acc + r.pending, 0);
    const surveyDone = blockWiseRows.reduce((acc, r) => acc + r.surveyDone, 0);
    const registered = blockWiseRows.reduce((acc, r) => acc + r.registered, 0);
    const surveyPercent = total > 0 ? ((surveyDone / total) * 100).toFixed(1) + '%' : '0%';
    const aadhaarIssue = blockWiseRows.reduce((acc, r) => acc + r.aadhaarIssue, 0);
    const rationIssue = blockWiseRows.reduce((acc, r) => acc + r.rationIssue, 0);
    const bothAvailable = blockWiseRows.reduce((acc, r) => acc + r.bothAvailable, 0);
    const bothNoAyushman = blockWiseRows.reduce((acc, r) => acc + r.bothNoAyushman, 0);
    const otherIssue = blockWiseRows.reduce((acc, r) => acc + r.otherIssue, 0);
    const officers = blockWiseRows.reduce((acc, r) => acc + r.officers, 0);

    return {
      block: 'TOTAL',
      total,
      pending,
      surveyDone,
      registered,
      surveyPercent,
      aadhaarIssue,
      rationIssue,
      bothAvailable,
      bothNoAyushman,
      otherIssue,
      officers
    };
  }, [blockWiseRows]);

  const reportRows = useMemo(() => {
    if (activeTab === 'Block-wise Report') {
      return blockWiseRows;
    }
    return buildTableRows(filteredBeneficiaries, TAB_KEY_MAP[activeTab]);
  }, [filteredBeneficiaries, activeTab, blockWiseRows]);

  const totalPages = Math.max(1, Math.ceil(reportRows.length / pageSize));
  const paginatedRows = activeTab === 'Block-wise Report'
    ? blockWiseRows
    : reportRows.slice((page - 1) * pageSize, page * pageSize);

  const resetFilters = () => {
    setSearch('');
    setJanpadFilter('');
    setGpFilter('');
    setGramFilter('');
    setStatusFilter('');
    setIssueTypeFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const exportCsv = (rows, fileName) => {
    if (!rows || rows.length === 0) return;
    const headers = Object.keys(rows[0] || {});
    const csv = [headers, ...rows.map((row) => headers.map((header) => escapeCsv(row[header])))]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Final Excel Download for Block Wise Detailed Report
  const handleDownloadBlockWiseExcel = () => {
    const headers = [
      'BLOCK',
      'TOTAL',
      'PENDING',
      'SURVEY DONE',
      'AADHAAR ISSUE',
      'RATION ISSUE',
      'BOTH (AADHAAR + RATION)',
      'DONO HAIN PAR AYUSHMAN NAHI BANA'
    ];

    const dataRows = blockWiseRows.map((r) => [
      r.block,
      r.total,
      r.pending,
      r.surveyDone,
      r.aadhaarIssue,
      r.rationIssue,
      r.bothAvailable,
      r.bothNoAyushman
    ]);

    dataRows.push([
      'TOTAL',
      blockWiseTotals.total,
      blockWiseTotals.pending,
      blockWiseTotals.surveyDone,
      blockWiseTotals.aadhaarIssue,
      blockWiseTotals.rationIssue,
      blockWiseTotals.bothAvailable,
      blockWiseTotals.bothNoAyushman
    ]);

    const csvString = [headers, ...dataRows]
      .map((row) => row.map(escapeCsv).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Block_Wise_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const openExportPreview = (mode) => {
    if (activeTab === 'Block-wise Report') {
      setBlockReportModalOpen(true);
      return;
    }
    setExportMode(mode);
    setPreviewOpen(true);
  };

  const handleExcelExport = () => {
    if (activeTab === 'Block-wise Report') {
      handleDownloadBlockWiseExcel();
      return;
    }
    exportCsv(reportRows, `${TAB_KEY_MAP[activeTab] || 'survey'}-report.csv`);
  };

  const handlePdfExport = () => {
    window.print();
  };

  const headersByTab = {
    survey: ['ID', 'Name', 'Block', 'Gram Panchayat', 'Gram', 'Status', 'Survey Date'],
    verified: ['ID', 'Name', 'Block', 'Gram Panchayat', 'Gram', 'Aadhaar Status', 'Verified Status'],
    pending: ['ID', 'Name', 'Block', 'Gram Panchayat', 'Gram', 'Status', 'Survey Date'],
    date: ['ID', 'Name', 'Block', 'Gram Panchayat', 'Gram', 'Survey Date', 'Status']
  };

  const renderCellValue = (row, header) => {
    const keyMap = {
      ID: 'id',
      Name: 'name',
      Block: 'janpad',
      'Gram Panchayat': 'gp',
      Gram: 'gram',
      Status: 'status',
      'Survey Date': 'date',
      'Aadhaar Status': 'aadhaarStatus',
      'Verified Status': 'verifiedStatus'
    };

    const key = keyMap[header];
    const value = row[key];
    if (header === 'Status' && value === 'Completed') return <span className="report-badge success">Completed</span>;
    if (header === 'Status' && value === 'Pending') return <span className="report-badge neutral">Pending</span>;
    if (header === 'Status' && value === 'Issue Found') return <span className="report-badge danger">Issue Found</span>;
    if (header === 'Aadhaar Status' && value === 'Verified') return <span className="report-badge success">Verified</span>;
    if (header === 'Aadhaar Status' && value === 'Issue') return <span className="report-badge danger">Aadhaar Issue</span>;
    if (header === 'Aadhaar Status') return <span className="report-badge neutral">Pending</span>;
    if (header === 'Verified Status' && value === 'Verified Beneficiary') return <span className="report-badge success">Verified Beneficiary</span>;
    if (header === 'Verified Status') return <span className="report-badge neutral">Not Verified</span>;
    return value ?? '—';
  };

  const tableHeaders = headersByTab[TAB_KEY_MAP[activeTab]] || headersByTab.survey;
  const issueFoundCount = filteredBeneficiaries.filter((b) => b.status === 'Issue Found').length;
  const completedCount = filteredBeneficiaries.filter((b) => b.status === 'Completed').length;
  const totalMembersCount = filteredBeneficiaries.length;
  const aadhaarIssueCount = filteredBeneficiaries.filter(hasAadhaarIssue).length;
  const verifiedBeneficiaryCount = filteredBeneficiaries.filter(hasBothAadhaarAndRation).length;
  const rationIssueCount = filteredBeneficiaries.filter(hasRationIssue).length;

  const summaryCards = [
    {
      key: 'total-members',
      label: 'कुल सदस्य',
      value: totalMembersCount,
      tone: 'slate',
      helper: 'All records'
    },
    {
      key: 'aadhaar-issue',
      label: 'Aadhaar Issue',
      value: aadhaarIssueCount,
      tone: 'rose',
      helper: 'Needs review'
    },
    {
      key: 'verified-beneficiary',
      label: 'Verified Beneficiary',
      value: verifiedBeneficiaryCount,
      tone: 'emerald',
      helper: 'Aadhaar + Ration'
    },
    {
      key: 'ration-issue',
      label: 'Ration Issue',
      value: rationIssueCount,
      tone: 'amber',
      helper: 'No ration card'
    },
    {
      key: 'completed-survey',
      label: 'Completed Survey',
      value: completedCount,
      tone: 'blue',
      helper: `Issue Found: ${issueFoundCount} • Completed: ${completedCount}`
    }
  ];

  const exportTiles = [
    {
      key: 'block-detailed-modal',
      label: 'Block Wise Detailed Report',
      icon: Sparkles,
      highlight: true,
      action: () => setBlockReportModalOpen(true)
    },
    {
      key: 'block-excel',
      label: 'Block Excel',
      icon: FileSpreadsheet,
      action: () => setBlockReportModalOpen(true)
    },
    {
      key: 'filtered-excel',
      label: 'Filtered Excel',
      icon: FileSpreadsheet,
      action: () => openExportPreview('excel')
    },
    {
      key: 'block-pdf',
      label: 'Block PDF',
      icon: Printer,
      action: () => {
        setActiveTab('Block-wise Report');
        setTimeout(() => window.print(), 200);
      }
    },
    {
      key: 'aadhaar-issue-excel',
      label: 'Aadhaar Issue',
      icon: FileSpreadsheet,
      isActive: issueTypeFilter === 'Aadhaar Issue',
      action: () => {
        setIssueTypeFilter('Aadhaar Issue');
        setPage(1);
        openExportPreview('excel');
      }
    },
    {
      key: 'ration-issue-excel',
      label: 'Ration Card Issue',
      icon: FileSpreadsheet,
      isActive: issueTypeFilter === 'Ration Card Issue',
      action: () => {
        setIssueTypeFilter('Ration Card Issue');
        setPage(1);
        openExportPreview('excel');
      }
    },
    {
      key: 'survey-completed-excel',
      label: 'Survey Completed',
      icon: FileSpreadsheet,
      isActive: statusFilter === 'Completed',
      action: () => {
        setStatusFilter('Completed');
        setPage(1);
        openExportPreview('excel');
      }
    },
    {
      key: 'survey-pending-excel',
      label: 'Survey Pending',
      icon: FileSpreadsheet,
      isActive: statusFilter === 'Pending',
      action: () => {
        setStatusFilter('Pending');
        setPage(1);
        openExportPreview('excel');
      }
    },
    {
      key: 'verified-beneficiary-excel',
      label: 'Verified Beneficiary',
      icon: FileSpreadsheet,
      isActive: issueTypeFilter === 'Verified Beneficiary',
      action: () => {
        setIssueTypeFilter('Verified Beneficiary');
        setPage(1);
        openExportPreview('excel');
      }
    }
  ];

  return (
    <div className="report-shell">
      <section className="report-summary-card">
        <div className="report-title-row">
          <BarChart3 size={32} />
          <h1>{appConfig.appName} Reports</h1>
        </div>
        <p className="report-subtitle">
          {currentUser.district || appConfig.currentUser.district || 'All'} District • {beneficiaries.length} Records
        </p>
      </section>

      {/* KPI Cards */}
      <div className="report-kpi-grid">
        {summaryCards.map((card) => (
          <div key={card.key} className={`report-kpi-card ${card.tone}`}>
            <div className="report-kpi-label">{card.label}</div>
            <div className="report-kpi-value">
              {loading ? <SkeletonText width="58px" className="skeleton-value" /> : card.value}
            </div>
            <div className="report-kpi-helper">
              {loading ? <SkeletonText width="112px" /> : card.helper}
            </div>
          </div>
        ))}
      </div>

      {/* Export & Quick Actions Bar */}
      <div className="report-export-grid" aria-label="Report export actions">
        {exportTiles.map(({ key, label, icon: Icon, action, highlight, isActive }) => (
          <button
            key={key}
            type="button"
            className={`report-export-tile ${highlight ? 'tile-highlight' : ''} ${isActive ? 'active' : ''}`}
            onClick={action}
          >
            {Icon && (
              <span className="report-export-icon">
                <Icon size={14} className={key === 'block-detailed-modal' ? 'tab-sparkle' : ''} />
              </span>
            )}
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Main Filter & Navigation Panel */}
      <div className="report-panel card">
        <div className="report-toolbar-header">
          <div className="report-tab-selector">
            {REPORT_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                className={`report-tab-pill ${activeTab === tab ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(tab);
                  setPage(1);
                }}
              >
                {tab === 'Block-wise Report' ? <Sparkles size={14} className="tab-sparkle" /> : null}
                <span>{tab}</span>
              </button>
            ))}
          </div>

          <div className="report-action-row">
            {activeTab === 'Block-wise Report' ? (
              <button
                type="button"
                className="report-action-btn primary"
                onClick={() => setBlockReportModalOpen(true)}
              >
                <FileSpreadsheet size={16} /> Block Wise Preview & Download
              </button>
            ) : null}
            <button type="button" className="report-action-btn light" onClick={resetFilters}>
              Reset Filter
            </button>
            <button type="button" className="report-action-btn light" onClick={() => openExportPreview('excel')}>
              <FileSpreadsheet size={16} /> Excel Export
            </button>
            <button type="button" className="report-action-btn light" onClick={() => openExportPreview('pdf')}>
              <Printer size={16} /> PDF Export
            </button>
          </div>
        </div>

        {activeTab !== 'Block-wise Report' && (
          <>
            <div className="report-search-row">
              <div className="report-search-box">
                <Search size={16} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search beneficiary, ID, GP, village..."
                />
              </div>
            </div>

            <div className="report-filter-grid">
              <label>
                <span>Block</span>
                <select value={janpadFilter} onChange={(e) => { setJanpadFilter(e.target.value); setGpFilter(''); setGramFilter(''); setPage(1); }}>
                  <option value="">All</option>
                  {distinctJanpads.map((janpad) => (
                    <option key={janpad} value={janpad}>{janpad}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Gram Panchayat</span>
                <select value={gpFilter} onChange={(e) => { setGpFilter(e.target.value); setGramFilter(''); setPage(1); }}>
                  <option value="">All</option>
                  {distinctGps.map((gp) => (
                    <option key={gp} value={gp}>{gp}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Gram</span>
                <select value={gramFilter} onChange={(e) => { setGramFilter(e.target.value); setPage(1); }}>
                  <option value="">All</option>
                  {distinctGrams.map((gram) => (
                    <option key={gram} value={gram}>{gram}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Survey Status</span>
                <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                  <option value="">All</option>
                  {STATUS_OPTIONS.filter(Boolean).map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Issue Type</span>
                <select value={issueTypeFilter} onChange={(e) => { setIssueTypeFilter(e.target.value); setPage(1); }}>
                  <option value="">All</option>
                  {issueTypeOptions.map((issueType) => (
                    <option key={issueType} value={issueType}>{issueType}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Date Range</span>
                <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
              </label>

              <label>
                <span>To</span>
                <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
              </label>
            </div>
          </>
        )}
      </div>

      {/* Main Data Table */}
      <div className="report-table-panel card">
        <div className="report-table-header">
          <div>
            <h3>{activeTab}</h3>
            <span>
              {loading ? (
                <SkeletonText width="78px" />
              ) : activeTab === 'Block-wise Report' ? (
                `${blockWiseRows.length} blocks • Total ${blockWiseTotals.total} beneficiaries`
              ) : (
                `${reportRows.length} records`
              )}
            </span>
          </div>

          {activeTab === 'Block-wise Report' && (
            <button
              type="button"
              className="report-preview-launch-btn"
              onClick={() => setBlockReportModalOpen(true)}
            >
              <Download size={15} /> Final Download Excel
            </button>
          )}
        </div>

        {activeTab === 'Block-wise Report' ? (
          /* Detailed Block-Wise Report Table */
          <div className="table-container block-table-container">
            <table className="custom-table block-report-table">
              <thead>
                <tr>
                  <th>BLOCK</th>
                  <th>TOTAL</th>
                  <th>PENDING</th>
                  <th>SURVEY DONE</th>
                  <th>AADHAAR ISSUE</th>
                  <th>RATION ISSUE</th>
                  <th>BOTH AVAILABLE</th>
                  <th className="th-highlight">DONO HAIN PAR AYUSHMAN NAHI BANA</th>
                </tr>
              </thead>
              <tbody>
                {blockWiseRows.map((row) => (
                  <tr key={row.block}>
                    <td className="cell-block-title">{row.block}</td>
                    <td className="cell-num">{row.total}</td>
                    <td className="cell-num">{row.pending}</td>
                    <td className="cell-num">{row.surveyDone}</td>
                    <td className="cell-num">{row.aadhaarIssue}</td>
                    <td className="cell-num">{row.rationIssue}</td>
                    <td className="cell-num">{row.bothAvailable}</td>
                    <td className="cell-num cell-highlight">{row.bothNoAyushman}</td>
                  </tr>
                ))}
                <tr className="block-report-total-row">
                  <td className="cell-block-title font-black">TOTAL</td>
                  <td className="cell-num">{blockWiseTotals.total}</td>
                  <td className="cell-num">{blockWiseTotals.pending}</td>
                  <td className="cell-num">{blockWiseTotals.surveyDone}</td>
                  <td className="cell-num">{blockWiseTotals.aadhaarIssue}</td>
                  <td className="cell-num">{blockWiseTotals.rationIssue}</td>
                  <td className="cell-num">{blockWiseTotals.bothAvailable}</td>
                  <td className="cell-num cell-highlight">{blockWiseTotals.bothNoAyushman}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          /* Standard Paginated Table for other tabs */
          <>
            <div className="table-container">
              <table className="custom-table report-table">
                <thead>
                  <tr>
                    {tableHeaders.map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    reportSkeletonRows.map((row) => (
                      <tr key={`report-skeleton-${row}`}>
                        {tableHeaders.map((header, index) => (
                          <td key={`report-skeleton-${row}-${header}`} data-label={header}>
                            <SkeletonText width={index === 1 ? '140px' : index === 0 ? '70px' : '96px'} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={tableHeaders.length} className="empty-state-table">
                        No records found for this filter.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row, index) => (
                      <tr key={`${activeTab}-${index}`}>
                        {tableHeaders.map((header) => (
                          <td key={`${activeTab}-${header}-${index}`} data-label={header}>
                            {renderCellValue(row, header)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="report-pagination">
              <button type="button" disabled={page === 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                Previous
              </button>
              <span>Page {page} of {totalPages}</span>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}>
                Next
              </button>
            </div>
          </>
        )}
      </div>

      {/* Standard Generic Preview Modal */}
      {previewOpen && (
        <div className="report-preview-overlay" onClick={() => setPreviewOpen(false)}>
          <div className="report-preview-card" onClick={(e) => e.stopPropagation()}>
            <div className="report-preview-header">
              <div>
                <h3>{activeTab}</h3>
                <span>{exportMode ? `${exportMode === 'excel' ? 'Excel' : 'PDF'} preview` : 'Printable preview'}</span>
              </div>
              <button
                type="button"
                className="report-close-button"
                onClick={() => { setPreviewOpen(false); setExportMode(''); }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="table-container preview-table-wrap">
              <table className="custom-table report-table">
                <thead>
                  <tr>
                    {tableHeaders.map((header) => (
                      <th key={`preview-${header}`}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={tableHeaders.length} className="empty-state-table">No preview data available.</td>
                    </tr>
                  ) : (
                    paginatedRows.map((row, index) => (
                      <tr key={`preview-row-${index}`}>
                        {tableHeaders.map((header) => (
                          <td key={`preview-cell-${header}-${index}`} data-label={header}>
                            {renderCellValue(row, header)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="report-preview-actions">
              <button type="button" className="report-action-btn light" onClick={() => { setPreviewOpen(false); setExportMode(''); }}>
                Close
              </button>
              <button
                type="button"
                className="report-action-btn"
                onClick={() => {
                  if (exportMode === 'pdf') {
                    handlePdfExport();
                  } else {
                    handleExcelExport();
                  }
                  setPreviewOpen(false);
                  setExportMode('');
                }}
              >
                {exportMode === 'pdf' ? <><Printer size={16} /> Download PDF</> : <><Download size={16} /> Download Excel</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIXEL-PERFECT BLOCK WISE REPORT MODAL MATCHING USER SCREENSHOT */}
      {blockReportModalOpen && (
        <div className="block-report-modal-overlay" onClick={() => setBlockReportModalOpen(false)}>
          <div className="block-report-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="block-report-modal-header">
              <div className="block-report-title-group">
                <h3 className="block-report-title">Block Wise Report</h3>
                <p className="block-report-subtitle">Excel download se pehle data preview</p>
              </div>
              <div className="block-report-header-right">
                <span className="block-report-count-badge">{blockWiseRows.length} rows</span>
                <button
                  type="button"
                  className="block-report-close-btn"
                  onClick={() => setBlockReportModalOpen(false)}
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="block-report-table-scroll">
              <table className="block-report-table">
                <thead>
                  <tr>
                    <th>BLOCK</th>
                    <th>TOTAL</th>
                    <th>PENDING</th>
                    <th>SURVEY DONE</th>
                    <th>AADHAAR ISSUE</th>
                    <th>RATION ISSUE</th>
                    <th>BOTH AVAILABLE</th>
                    <th className="th-highlight">DONO HAIN PAR AYUSHMAN NAHI BANA</th>
                  </tr>
                </thead>
                <tbody>
                  {blockWiseRows.map((row) => (
                    <tr key={`modal-${row.block}`}>
                      <td className="cell-block-title">{row.block}</td>
                      <td className="cell-num">{row.total}</td>
                      <td className="cell-num">{row.pending}</td>
                      <td className="cell-num">{row.surveyDone}</td>
                      <td className="cell-num">{row.aadhaarIssue}</td>
                      <td className="cell-num">{row.rationIssue}</td>
                      <td className="cell-num">{row.bothAvailable}</td>
                      <td className="cell-num cell-highlight">{row.bothNoAyushman}</td>
                    </tr>
                  ))}
                  <tr className="block-report-total-row">
                    <td className="cell-block-title font-black">TOTAL</td>
                    <td className="cell-num">{blockWiseTotals.total}</td>
                    <td className="cell-num">{blockWiseTotals.pending}</td>
                    <td className="cell-num">{blockWiseTotals.surveyDone}</td>
                    <td className="cell-num">{blockWiseTotals.aadhaarIssue}</td>
                    <td className="cell-num">{blockWiseTotals.rationIssue}</td>
                    <td className="cell-num">{blockWiseTotals.bothAvailable}</td>
                    <td className="cell-num cell-highlight">{blockWiseTotals.bothNoAyushman}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="block-report-modal-footer">
              <span className="block-report-footer-hint">Excel will include the rows shown here.</span>
              <button
                type="button"
                className="block-report-download-btn"
                onClick={handleDownloadBlockWiseExcel}
              >
                <Download size={17} strokeWidth={2.4} />
                <span>Final Download Excel</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
