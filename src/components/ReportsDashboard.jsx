import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  MapPinned,
  Printer,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  X
} from 'lucide-react';
import { appConfig } from '../config';

const REPORT_TABS = [
  { id: 'survey', label: 'सर्वे रिपोर्ट', subLabel: 'Survey Report' },
  { id: 'block-wise', label: 'ब्लॉक-वार रिपोर्ट', subLabel: 'Block-wise Report', isSpecial: true },
  { id: 'verified', label: 'सत्यापित हितग्राही', subLabel: 'Verified Beneficiaries' },
  { id: 'pending', label: 'लंबित सर्वेक्षण', subLabel: 'Pending Surveys' },
  { id: 'date', label: 'दिनांक-वार रिपोर्ट', subLabel: 'Date-wise Report' }
];

const STATUS_OPTIONS = ['', 'Completed', 'Pending'];

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
  if (!beneficiary) return false;
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
  if (!beneficiary) return false;
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
  if (!beneficiary) return false;
  const aadhaar = beneficiary.aadhaarInfo || {};
  if (aadhaar.type === 'aadhaar' && aadhaar.aadhaarNumber) return true;
  if (aadhaar.aadhaarNumber && String(aadhaar.aadhaarNumber).replace(/\D/g, '').length === 12) return true;
  if (aadhaar.type === 'enrollment' && aadhaar.enrollmentNumber) return true;
  if (beneficiary.aadhaarNumber && String(beneficiary.aadhaarNumber).replace(/\D/g, '').length === 12) return true;
  if (beneficiary.hasAadhaar === true || beneficiary.aadhaarStatus === 'Verified') return true;
  return false;
};

export const hasValidRation = (beneficiary) => {
  if (!beneficiary) return false;
  const ration = beneficiary.rationInfo || {};
  if (ration.hasRationCard === 'yes') return true;
  if (ration.rationNumber && String(ration.rationNumber).replace(/\D/g, '').length >= 10) return true;
  if (beneficiary.rationNumber && String(beneficiary.rationNumber).replace(/\D/g, '').length >= 10) return true;
  if (beneficiary.hasRationCard === true || beneficiary.hasRationCard === 'yes') return true;
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
      headName: b.headName || '',
      fatherName: b.fatherName || '',
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
        headName: b.headName || '',
        fatherName: b.fatherName || '',
        janpad: b.block || 'Unknown',
        gp: b.gp || 'Unknown',
        gram: b.village || 'Unknown',
        aadhaarStatus: hasAadhaar ? 'Verified' : 'Pending',
        verifiedStatus: isVerified ? 'Verified Beneficiary' : 'Not Verified',
        status: b.status || 'Pending',
        date: b.surveyDate || '-'
      };
    });
  }

  if (activeTabKey === 'pending') {
    return beneficiaries
      .filter((b) => b.status === 'Pending')
      .map((b) => ({
        id: b.id,
        name: b.name,
        headName: b.headName || '',
        fatherName: b.fatherName || '',
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
        headName: b.headName || '',
        fatherName: b.fatherName || '',
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
    headName: b.headName || '',
    fatherName: b.fatherName || '',
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
  const [activeTabKey, setActiveTabKey] = useState('survey');
  const [search, setSearch] = useState('');
  const [janpadFilter, setJanpadFilter] = useState('');
  const [gpFilter, setGpFilter] = useState('');
  const [gramFilter, setGramFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [issueTypeFilter, setIssueTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [blockReportModalOpen, setBlockReportModalOpen] = useState(false);
  const [exportMode, setExportMode] = useState('');

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
    const q = search.trim().toLowerCase();
    return beneficiaries.filter((b) => {
      const text = `${b.name || ''} ${b.id || ''} ${b.fatherName || ''} ${b.headName || ''} ${b.gp || ''} ${b.village || ''} ${b.block || ''}`.toLowerCase();
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
    if (activeTabKey === 'block-wise') {
      return blockWiseRows;
    }
    return buildTableRows(filteredBeneficiaries, activeTabKey);
  }, [filteredBeneficiaries, activeTabKey, blockWiseRows]);

  const totalPages = Math.max(1, Math.ceil(reportRows.length / pageSize));
  const paginatedRows = activeTabKey === 'block-wise'
    ? blockWiseRows
    : reportRows.slice((page - 1) * pageSize, page * pageSize);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (search) count++;
    if (janpadFilter) count++;
    if (gpFilter) count++;
    if (gramFilter) count++;
    if (statusFilter) count++;
    if (issueTypeFilter) count++;
    if (dateFrom) count++;
    if (dateTo) count++;
    return count;
  }, [search, janpadFilter, gpFilter, gramFilter, statusFilter, issueTypeFilter, dateFrom, dateTo]);

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

  const exportCsv = (dataRows, fileName) => {
    if (!dataRows || dataRows.length === 0) return;
    const headers = Object.keys(dataRows[0] || {});
    const csv = [headers, ...dataRows.map((row) => headers.map((header) => escapeCsv(row[header])))]
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
    if (activeTabKey === 'block-wise') {
      setBlockReportModalOpen(true);
      return;
    }
    setExportMode(mode);
    setPreviewOpen(true);
  };

  const handleExcelExport = () => {
    if (activeTabKey === 'block-wise') {
      handleDownloadBlockWiseExcel();
      return;
    }

    const exportData = reportRows.map((r, idx) => ({
      'क्र. (S.No.)': idx + 1,
      'हितग्राही ID (ID)': r.id,
      'हितग्राही का नाम (Beneficiary Name)': r.name,
      'मुखिया का नाम (Head of Family)': r.headName || '—',
      'पिता/पति का नाम (Father/Husband)': r.fatherName || '—',
      'विकासखंड (Block)': r.janpad,
      'ग्राम पंचायत (Gram Panchayat)': r.gp,
      'ग्राम (Village)': r.gram,
      ...(r.aadhaarStatus ? { 'आधार स्थिति (Aadhaar)': r.aadhaarStatus } : {}),
      ...(r.verifiedStatus ? { 'सत्यापन स्थिति (Verification)': r.verifiedStatus } : {}),
      'सर्वे स्थिति (Status)': r.status,
      'सर्वे दिनांक (Survey Date)': r.date
    }));

    exportCsv(exportData, `${activeTabKey}-report-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handlePdfExport = () => {
    window.print();
  };

  const headersByTab = {
    survey: ['ID', 'हितग्राही का नाम', 'मुखिया / पिता का नाम', 'विकासखंड', 'ग्राम पंचायत', 'ग्राम', 'सर्वे स्थिति', 'सर्वे दिनांक'],
    verified: ['ID', 'हितग्राही का नाम', 'मुखिया / पिता का नाम', 'विकासखंड', 'ग्राम पंचायत', 'ग्राम', 'आधार स्थिति', 'सत्यापन स्थिति'],
    pending: ['ID', 'हितग्राही का नाम', 'मुखिया / पिता का नाम', 'विकासखंड', 'ग्राम पंचायत', 'ग्राम', 'सर्वे स्थिति', 'सर्वे दिनांक'],
    date: ['ID', 'हितग्राही का नाम', 'मुखिया / पिता का नाम', 'विकासखंड', 'ग्राम पंचायत', 'ग्राम', 'सर्वे दिनांक', 'सर्वे स्थिति']
  };

  const renderCellValue = (row, header) => {
    if (header === 'ID') {
      return <span className="report-id-code">{row.id}</span>;
    }

    if (header === 'हितग्राही का नाम') {
      return (
        <div className="report-ben-name">
          <strong>{row.name}</strong>
        </div>
      );
    }

    if (header === 'मुखिया / पिता का नाम') {
      return (
        <div className="report-family-cell">
          <div className="family-line head-line">
            <span className="family-pill head-pill">मुखिया</span>
            <strong className={row.headName ? 'family-val head-highlight' : 'family-val text-muted'}>
              {row.headName || '—'}
            </strong>
          </div>
          <div className="family-line father-line">
            <span className="family-pill father-pill">पिता/पति</span>
            <span className="family-val father-val">{row.fatherName || '—'}</span>
          </div>
        </div>
      );
    }

    if (header === 'विकासखंड') return row.janpad || '—';
    if (header === 'ग्राम पंचायत') return row.gp || '—';
    if (header === 'ग्राम') return row.gram || '—';

    if (header === 'सर्वे स्थिति') {
      if (row.status === 'Completed') {
        return (
          <span className="report-badge success">
            <span className="badge-dot success"></span> पूर्ण (Completed)
          </span>
        );
      }
      if (row.status === 'Issue Found') {
        return (
          <span className="report-badge danger">
            <span className="badge-dot danger"></span> समस्या दर्ज
          </span>
        );
      }
      return (
        <span className="report-badge pending">
          <span className="badge-dot pending"></span> लंबित (Pending)
        </span>
      );
    }

    if (header === 'सर्वे दिनांक') {
      return <span className="report-date-cell">{formatDate(row.date)}</span>;
    }

    if (header === 'आधार स्थिति') {
      if (row.aadhaarStatus === 'Verified') {
        return (
          <span className="report-badge success">
            <span className="badge-dot success"></span> सत्यापित (Verified)
          </span>
        );
      }
      return (
        <span className="report-badge danger">
          <span className="badge-dot danger"></span> समस्या / शेष
        </span>
      );
    }

    if (header === 'सत्यापन स्थिति') {
      if (row.verifiedStatus === 'Verified Beneficiary') {
        return (
          <span className="report-badge success">
            <ShieldCheck size={13} /> दोनों उपलब्ध
          </span>
        );
      }
      return (
        <span className="report-badge pending">
          अनुपलब्ध / अपूर्ण
        </span>
      );
    }

    return row[header] ?? '—';
  };

  const tableHeaders = headersByTab[activeTabKey] || headersByTab.survey;
  const totalMembersCount = filteredBeneficiaries.length;
  const completedCount = filteredBeneficiaries.filter((b) => b.status === 'Completed').length;
  const pendingCount = filteredBeneficiaries.filter((b) => b.status === 'Pending').length;
  const aadhaarIssueCount = filteredBeneficiaries.filter(hasAadhaarIssue).length;
  const rationIssueCount = filteredBeneficiaries.filter(hasRationIssue).length;
  const verifiedBeneficiaryCount = filteredBeneficiaries.filter(hasBothAadhaarAndRation).length;

  const summaryCards = [
    {
      key: 'total-members',
      label: 'कुल सदस्य (Total)',
      value: totalMembersCount,
      tone: 'slate',
      icon: Users,
      helper: 'समस्त पंजीकृत हितग्राही',
      isActive: !statusFilter && !issueTypeFilter,
      onClick: () => {
        setStatusFilter('');
        setIssueTypeFilter('');
        setPage(1);
      }
    },
    {
      key: 'completed-survey',
      label: 'सर्वेक्षण पूर्ण',
      value: completedCount,
      tone: 'emerald',
      icon: CheckCircle2,
      helper: 'सर्वेक्षण कार्य संपन्न',
      isActive: statusFilter === 'Completed',
      onClick: () => {
        setStatusFilter((prev) => (prev === 'Completed' ? '' : 'Completed'));
        setPage(1);
      }
    },
    {
      key: 'pending-survey',
      label: 'लंबित सर्वेक्षण',
      value: pendingCount,
      tone: 'amber',
      icon: Clock,
      helper: 'सर्वेक्षण शेष रिकॉर्ड',
      isActive: statusFilter === 'Pending',
      onClick: () => {
        setStatusFilter((prev) => (prev === 'Pending' ? '' : 'Pending'));
        setPage(1);
      }
    },
    {
      key: 'aadhaar-issue',
      label: 'Aadhaar Issue',
      value: aadhaarIssueCount,
      tone: 'rose',
      icon: ShieldAlert,
      helper: 'आधार सुधार / अनुपलब्ध',
      isActive: issueTypeFilter === 'Aadhaar Issue',
      onClick: () => {
        setIssueTypeFilter((prev) => (prev === 'Aadhaar Issue' ? '' : 'Aadhaar Issue'));
        setPage(1);
      }
    },
    {
      key: 'verified-beneficiary',
      label: 'Verified Beneficiary',
      value: verifiedBeneficiaryCount,
      tone: 'blue',
      icon: ShieldCheck,
      helper: 'आधार + राशन कार्ड दोनों',
      isActive: issueTypeFilter === 'Verified Beneficiary',
      onClick: () => {
        setIssueTypeFilter((prev) => (prev === 'Verified Beneficiary' ? '' : 'Verified Beneficiary'));
        setPage(1);
      }
    }
  ];

  return (
    <div className="report-shell">
      {/* Executive Header Banner */}
      <section className="report-header-banner">
        <div className="report-header-left">
          <div className="report-header-icon">
            <BarChart3 size={28} />
          </div>
          <div>
            <h1 className="report-header-title">आयुष्मान भारत सर्वेक्षण - रिपोर्ट्स एवं सांख्यिकी</h1>
            <p className="report-header-desc">
              जिलेवार एवं विकासखंड-वार समग्र डेटा विश्लेषण, हितग्राही सत्यापन एवं एक्सेल रिपोर्ट
            </p>
          </div>
        </div>
        <div className="report-header-meta">
          <span className="report-meta-badge district">
            <MapPinned size={14} />
            {currentUser.district || appConfig.currentUser.district || 'दंतेवाड़ा'} जिला
          </span>
          <span className="report-meta-badge records">
            <Users size={14} />
            {beneficiaries.length.toLocaleString('en-IN')} कुल रिकॉर्ड
          </span>
        </div>
      </section>

      {/* Modern Interactive KPI Summary Grid */}
      <div className="report-kpi-grid">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.key}
              type="button"
              className={`report-kpi-card ${card.tone} ${card.isActive ? 'active-filter' : ''}`}
              onClick={card.onClick}
              title={`Click to filter by ${card.label}`}
            >
              <div className="report-kpi-top">
                <span className="report-kpi-label">{card.label}</span>
                <span className="report-kpi-icon-wrap">
                  <Icon size={18} />
                </span>
              </div>
              <div className="report-kpi-value">
                {loading ? <SkeletonText width="58px" className="skeleton-value" /> : card.value.toLocaleString('en-IN')}
              </div>
              <div className="report-kpi-footer">
                <span className="report-kpi-helper">
                  {loading ? <SkeletonText width="90px" /> : card.helper}
                </span>
                {card.isActive && <span className="kpi-filter-tag">फ़िल्टर सक्रिय</span>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Tab Bar & Action Controls */}
      <div className="report-control-bar card">
        <div className="report-nav-segment">
          {REPORT_TABS.map((tab) => {
            const isSelected = activeTabKey === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`report-nav-tab ${isSelected ? 'selected' : ''} ${tab.isSpecial ? 'special-tab' : ''}`}
                onClick={() => {
                  setActiveTabKey(tab.id);
                  setPage(1);
                }}
              >
                {tab.isSpecial && <Sparkles size={14} className="tab-sparkle" />}
                <span className="nav-tab-label">{tab.label}</span>
                <span className="nav-tab-sublabel">{tab.subLabel}</span>
              </button>
            );
          })}
        </div>

        <div className="report-action-cluster">
          {/* Block-wise Modal Launcher */}
          <button
            type="button"
            className="action-pill-btn highlight"
            onClick={() => setBlockReportModalOpen(true)}
            title="ब्लॉक-वार विस्तृत एक्सेल एवं प्रीव्यू"
          >
            <Sparkles size={15} />
            <span>ब्लॉक रिपोर्ट (Preview & Excel)</span>
          </button>

          {/* Export Current Table to Excel */}
          <button
            type="button"
            className="action-pill-btn secondary"
            onClick={handleExcelExport}
            title="वर्तमान डेटा को एक्सेल में डाउनलोड करें"
          >
            <FileSpreadsheet size={15} />
            <span>एक्सेल डाउनलोड</span>
          </button>

          {/* Print / PDF Export */}
          <button
            type="button"
            className="action-pill-btn secondary"
            onClick={handlePdfExport}
            title="प्रिंट या पीडीएफ सुरक्षित करें"
          >
            <Printer size={15} />
            <span>प्रिंट / PDF</span>
          </button>

          {/* Reset Filters */}
          {activeFiltersCount > 0 && (
            <button
              type="button"
              className="action-pill-btn reset"
              onClick={resetFilters}
              title="सभी फ़िल्टर साफ़ करें"
            >
              <RotateCcw size={14} />
              <span>रीसेट ({activeFiltersCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Search & Filter Drawer (shown for beneficiary tabs) */}
      {activeTabKey !== 'block-wise' && (
        <div className="report-filter-panel card">
          <div className="report-search-and-chips">
            <div className="report-search-input-wrap">
              <Search size={18} className="search-leading-icon" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="हितग्राही, मुखिया, पिता का नाम, ID, ग्राम या ब्लॉक से खोजें..."
              />
              {search && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Quick Status Chips */}
            <div className="report-quick-chips">
              <span className="chips-title">त्वरित फ़िल्टर:</span>
              <button
                type="button"
                className={`quick-chip ${!statusFilter && !issueTypeFilter ? 'active' : ''}`}
                onClick={() => {
                  setStatusFilter('');
                  setIssueTypeFilter('');
                  setPage(1);
                }}
              >
                सभी ({beneficiaries.length})
              </button>
              <button
                type="button"
                className={`quick-chip ${statusFilter === 'Pending' ? 'active' : ''}`}
                onClick={() => {
                  setStatusFilter((p) => (p === 'Pending' ? '' : 'Pending'));
                  setPage(1);
                }}
              >
                लंबित ({pendingCount})
              </button>
              <button
                type="button"
                className={`quick-chip ${statusFilter === 'Completed' ? 'active' : ''}`}
                onClick={() => {
                  setStatusFilter((p) => (p === 'Completed' ? '' : 'Completed'));
                  setPage(1);
                }}
              >
                पूर्ण ({completedCount})
              </button>
              <button
                type="button"
                className={`quick-chip ${issueTypeFilter === 'Aadhaar Issue' ? 'active' : ''}`}
                onClick={() => {
                  setIssueTypeFilter((p) => (p === 'Aadhaar Issue' ? '' : 'Aadhaar Issue'));
                  setPage(1);
                }}
              >
                आधार समस्या ({aadhaarIssueCount})
              </button>
              <button
                type="button"
                className={`quick-chip ${issueTypeFilter === 'Ration Card Issue' ? 'active' : ''}`}
                onClick={() => {
                  setIssueTypeFilter((p) => (p === 'Ration Card Issue' ? '' : 'Ration Card Issue'));
                  setPage(1);
                }}
              >
                राशन समस्या ({rationIssueCount})
              </button>
              <button
                type="button"
                className={`quick-chip ${issueTypeFilter === 'Verified Beneficiary' ? 'active' : ''}`}
                onClick={() => {
                  setIssueTypeFilter((p) => (p === 'Verified Beneficiary' ? '' : 'Verified Beneficiary'));
                  setPage(1);
                }}
              >
                सत्यापित ({verifiedBeneficiaryCount})
              </button>
            </div>
          </div>

          {/* Detailed Dropdown Filters */}
          <div className="report-filter-dropdown-grid">
            <div className="filter-field">
              <label>विकासखंड (Block)</label>
              <select
                value={janpadFilter}
                onChange={(e) => {
                  setJanpadFilter(e.target.value);
                  setGpFilter('');
                  setGramFilter('');
                  setPage(1);
                }}
              >
                <option value="">सभी ब्लॉक (All)</option>
                {distinctJanpads.map((janpad) => (
                  <option key={janpad} value={janpad}>
                    {janpad}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-field">
              <label>ग्राम पंचायत (Gram Panchayat)</label>
              <select
                value={gpFilter}
                onChange={(e) => {
                  setGpFilter(e.target.value);
                  setGramFilter('');
                  setPage(1);
                }}
              >
                <option value="">सभी ग्राम पंचायत (All)</option>
                {distinctGps.map((gp) => (
                  <option key={gp} value={gp}>
                    {gp}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-field">
              <label>ग्राम (Village)</label>
              <select
                value={gramFilter}
                onChange={(e) => {
                  setGramFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">सभी ग्राम (All)</option>
                {distinctGrams.map((gram) => (
                  <option key={gram} value={gram}>
                    {gram}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-field">
              <label>सर्वे स्थिति (Status)</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">सभी स्थितियां (All)</option>
                {STATUS_OPTIONS.filter(Boolean).map((status) => (
                  <option key={status} value={status}>
                    {status === 'Completed' ? 'Completed (पूर्ण)' : 'Pending (लंबित)'}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-field">
              <label>समस्या प्रकार (Issue Type)</label>
              <select
                value={issueTypeFilter}
                onChange={(e) => {
                  setIssueTypeFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">सभी (All Issues)</option>
                {issueTypeOptions.map((issueType) => (
                  <option key={issueType} value={issueType}>
                    {issueType}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-field">
              <label>दिनांक से (From)</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div className="filter-field">
              <label>दिनांक तक (To)</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Data Table Section */}
      <div className="report-table-panel card">
        <div className="report-table-meta-row">
          <div className="table-heading-group">
            <h3 className="table-heading-title">
              {REPORT_TABS.find((t) => t.id === activeTabKey)?.label || 'सर्वे रिपोर्ट'}
            </h3>
            <span className="table-heading-count">
              {loading ? (
                <SkeletonText width="100px" />
              ) : activeTabKey === 'block-wise' ? (
                `${blockWiseRows.length} विकासखंड • कुल ${blockWiseTotals.total.toLocaleString('en-IN')} हितग्राही`
              ) : (
                `कुल ${reportRows.length.toLocaleString('en-IN')} रिकॉर्ड्स प्रदर्शित`
              )}
            </span>
          </div>

          {activeTabKey === 'block-wise' ? (
            <button
              type="button"
              className="action-pill-btn highlight"
              onClick={handleDownloadBlockWiseExcel}
            >
              <Download size={15} /> Final Download Excel
            </button>
          ) : (
            <div className="table-header-page-size">
              <span>प्रति पृष्ठ:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                <option value={8}>8</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          )}
        </div>

        {activeTabKey === 'block-wise' ? (
          /* Detailed Government Standard Block-Wise Report Table */
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
                    <td className="cell-num">{row.total.toLocaleString('en-IN')}</td>
                    <td className="cell-num">{row.pending.toLocaleString('en-IN')}</td>
                    <td className="cell-num">{row.surveyDone.toLocaleString('en-IN')}</td>
                    <td className="cell-num">{row.aadhaarIssue.toLocaleString('en-IN')}</td>
                    <td className="cell-num">{row.rationIssue.toLocaleString('en-IN')}</td>
                    <td className="cell-num">{row.bothAvailable.toLocaleString('en-IN')}</td>
                    <td className="cell-num cell-highlight">{row.bothNoAyushman.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
                <tr className="block-report-total-row">
                  <td className="cell-block-title font-black">TOTAL</td>
                  <td className="cell-num">{blockWiseTotals.total.toLocaleString('en-IN')}</td>
                  <td className="cell-num">{blockWiseTotals.pending.toLocaleString('en-IN')}</td>
                  <td className="cell-num">{blockWiseTotals.surveyDone.toLocaleString('en-IN')}</td>
                  <td className="cell-num">{blockWiseTotals.aadhaarIssue.toLocaleString('en-IN')}</td>
                  <td className="cell-num">{blockWiseTotals.rationIssue.toLocaleString('en-IN')}</td>
                  <td className="cell-num">{blockWiseTotals.bothAvailable.toLocaleString('en-IN')}</td>
                  <td className="cell-num cell-highlight">{blockWiseTotals.bothNoAyushman.toLocaleString('en-IN')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          /* Standard Paginated Table with Mukhiya/Father Columns */
          <>
            <div className="table-container">
              <table className="custom-table modern-report-table">
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
                          <td key={`report-skeleton-${row}-${header}`}>
                            <SkeletonText width={index === 1 ? '140px' : index === 2 ? '160px' : '90px'} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={tableHeaders.length} className="empty-state-table">
                        <div className="empty-state-box">
                          <Filter size={32} className="empty-icon" />
                          <p>चयनित फ़िल्टर के अनुसार कोई रिकॉर्ड उपलब्ध नहीं है।</p>
                          <button type="button" className="action-pill-btn reset" onClick={resetFilters}>
                            <RotateCcw size={14} /> फ़िल्टर हटाएं
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row, index) => (
                      <tr key={`${activeTabKey}-${row.id || index}`}>
                        {tableHeaders.map((header) => (
                          <td key={`${activeTabKey}-${header}-${index}`}>
                            {renderCellValue(row, header)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Modern Pagination Controls */}
            {reportRows.length > 0 && (
              <div className="modern-pagination-bar">
                <div className="pagination-info">
                  प्रदर्शित <strong>{(page - 1) * pageSize + 1} - {Math.min(page * pageSize, reportRows.length)}</strong> (कुल <strong>{reportRows.length.toLocaleString('en-IN')}</strong>)
                </div>

                <div className="pagination-nav-group">
                  <button
                    type="button"
                    className="pagination-btn"
                    disabled={page === 1}
                    onClick={() => setPage(1)}
                    title="प्रथम पृष्ठ"
                  >
                    <ChevronsLeft size={16} />
                  </button>

                  <button
                    type="button"
                    className="pagination-btn"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    title="पिछला पृष्ठ"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <div className="page-indicator-pill">
                    पृष्ठ <strong>{page}</strong> / <span>{totalPages}</span>
                  </div>

                  <button
                    type="button"
                    className="pagination-btn"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    title="अगला पृष्ठ"
                  >
                    <ChevronRight size={16} />
                  </button>

                  <button
                    type="button"
                    className="pagination-btn"
                    disabled={page >= totalPages}
                    onClick={() => setPage(totalPages)}
                    title="अंतिम पृष्ठ"
                  >
                    <ChevronsRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Standard Generic Preview Modal */}
      {previewOpen && (
        <div className="report-preview-overlay" onClick={() => setPreviewOpen(false)}>
          <div className="report-preview-card" onClick={(e) => e.stopPropagation()}>
            <div className="report-preview-header">
              <div>
                <h3>{REPORT_TABS.find((t) => t.id === activeTabKey)?.label || 'Report'}</h3>
                <span>{exportMode ? `${exportMode === 'excel' ? 'Excel' : 'PDF'} preview` : 'Printable preview'}</span>
              </div>
              <button
                type="button"
                className="report-close-button"
                onClick={() => {
                  setPreviewOpen(false);
                  setExportMode('');
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="table-container preview-table-wrap">
              <table className="custom-table modern-report-table">
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
                      <td colSpan={tableHeaders.length} className="empty-state-table">
                        No preview data available.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row, index) => (
                      <tr key={`preview-row-${index}`}>
                        {tableHeaders.map((header) => (
                          <td key={`preview-cell-${header}-${index}`}>
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
              <button
                type="button"
                className="action-pill-btn secondary"
                onClick={() => {
                  setPreviewOpen(false);
                  setExportMode('');
                }}
              >
                बंद करें
              </button>
              <button
                type="button"
                className="action-pill-btn highlight"
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
                {exportMode === 'pdf' ? (
                  <>
                    <Printer size={16} /> Download PDF
                  </>
                ) : (
                  <>
                    <Download size={16} /> Download Excel
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIXEL-PERFECT BLOCK WISE REPORT MODAL MATCHING GOVT FORMAT */}
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
                      <td className="cell-num">{row.total.toLocaleString('en-IN')}</td>
                      <td className="cell-num">{row.pending.toLocaleString('en-IN')}</td>
                      <td className="cell-num">{row.surveyDone.toLocaleString('en-IN')}</td>
                      <td className="cell-num">{row.aadhaarIssue.toLocaleString('en-IN')}</td>
                      <td className="cell-num">{row.rationIssue.toLocaleString('en-IN')}</td>
                      <td className="cell-num">{row.bothAvailable.toLocaleString('en-IN')}</td>
                      <td className="cell-num cell-highlight">{row.bothNoAyushman.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                  <tr className="block-report-total-row">
                    <td className="cell-block-title font-black">TOTAL</td>
                    <td className="cell-num">{blockWiseTotals.total.toLocaleString('en-IN')}</td>
                    <td className="cell-num">{blockWiseTotals.pending.toLocaleString('en-IN')}</td>
                    <td className="cell-num">{blockWiseTotals.surveyDone.toLocaleString('en-IN')}</td>
                    <td className="cell-num">{blockWiseTotals.aadhaarIssue.toLocaleString('en-IN')}</td>
                    <td className="cell-num">{blockWiseTotals.rationIssue.toLocaleString('en-IN')}</td>
                    <td className="cell-num">{blockWiseTotals.bothAvailable.toLocaleString('en-IN')}</td>
                    <td className="cell-num cell-highlight">{blockWiseTotals.bothNoAyushman.toLocaleString('en-IN')}</td>
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
