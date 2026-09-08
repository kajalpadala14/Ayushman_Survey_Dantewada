import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileSpreadsheet,
  Filter,
  MapPinned,
  Printer,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  X
} from 'lucide-react';
import { appConfig } from '../config';
import { formatSurveyDateTime, formatSurveyTime } from '../utils/dateTime';

const REPORT_TABS = [
  { id: 'survey', label: 'सर्वे रिपोर्ट (Survey)' },
  { id: 'block-wise', label: 'ब्लॉक-वार रिपोर्ट (Block-wise)' },
  { id: 'verified', label: 'सत्यापित हितग्राही (Verified)' },
  { id: 'pending', label: 'लंबित सर्वेक्षण (Pending)' },
  { id: 'date', label: 'दिनांक-वार रिपोर्ट (Date-wise)' }
];

const STATUS_OPTIONS = [
  { value: '', label: 'सभी स्थिति (All Status)' },
  { value: 'Completed', label: 'Completed (पूर्ण)' },
  { value: 'Pending', label: 'Pending (लंबित)' },
  { value: 'Issue Found', label: 'Issue Found (समस्या दर्ज)' }
];

const ISSUE_TYPE_OPTIONS = [
  { value: '', label: 'समस्या का प्रकार (All Issues)' },
  { value: 'Aadhaar Issue', label: 'आधार समस्या (Aadhaar Issue)' },
  { value: 'Ration Card Issue', label: 'राशन समस्या (Ration Issue)' },
  { value: 'Both No Ayushman', label: 'दस्तावेज हैं पर आयुष्मान नहीं' },
  { value: 'Other Issue', label: 'अन्य समस्या' }
];

const SkeletonText = ({ width = '100%', className = '' }) => (
  <span className={`skeleton-line ${className}`} style={{ width }} aria-hidden="true" />
);

const reportSkeletonRows = Array.from({ length: 8 }, (_, index) => index);

export const getBeneficiaryDate = (b) => {
  if (!b) return null;
  const raw = b.surveyDate || b.date || b.updatedAt || b.createdAt || b.timestamp;
  if (!raw || raw === '-') return null;
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw;
  const str = String(raw).trim();
  if (!str) return null;
  const parsed = new Date(str.includes(' ') ? str.replace(' ', 'T') : str);
  if (!isNaN(parsed.getTime())) return parsed;
  const parts = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (parts) {
    const d = new Date(Number(parts[3]), Number(parts[2]) - 1, Number(parts[1]));
    if (!isNaN(d.getTime())) return d;
  }
  return null;
};

const formatDate = (value) => {
  if (!value || value === '-') return '-';
  const d = getBeneficiaryDate({ surveyDate: value });
  if (!d) return String(value);
  return d.toLocaleDateString('en-GB', {
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

const buildTableRows = (beneficiariesList, activeTabKey) => {
  if (activeTabKey === 'verified') {
    return beneficiariesList.map((b) => {
      const hasAadhaar = hasValidAadhaar(b);
      const isVerified = hasBothAadhaarAndRation(b) || b.overallResult === 'VERIFIED';

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
        date: b.surveyDate ? formatDate(b.surveyDate) : '-'
      };
    });
  }

  if (activeTabKey === 'pending') {
    return beneficiariesList.map((b) => ({
      id: b.id,
      name: b.name,
      headName: b.headName || '',
      fatherName: b.fatherName || '',
      janpad: b.block || 'Unknown',
      gp: b.gp || 'Unknown',
      gram: b.village || 'Unknown',
      status: b.status || 'Pending',
      date: '-'
    }));
  }

  if (activeTabKey === 'date') {
    const sorted = [...beneficiariesList].sort((a, b) => {
      const da = getBeneficiaryDate(a);
      const db = getBeneficiaryDate(b);
      if (da && db) return db.getTime() - da.getTime();
      if (da) return -1;
      if (db) return 1;
      return 0;
    });

    return sorted.map((b) => {
      const d = getBeneficiaryDate(b);
      let dateDisplay = '-';
      if (b.surveyDate) {
        dateDisplay = formatSurveyDateTime(b.surveyDate) || formatDate(b.surveyDate);
      } else if (d) {
        dateDisplay = formatDate(d);
      }
      return {
        id: b.id,
        name: b.name,
        headName: b.headName || '',
        fatherName: b.fatherName || '',
        janpad: b.block || 'Unknown',
        gp: b.gp || 'Unknown',
        gram: b.village || 'Unknown',
        date: dateDisplay,
        status: b.status || 'Pending'
      };
    });
  }

  return beneficiariesList.map((b) => ({
    id: b.id,
    name: b.name,
    headName: b.headName || '',
    fatherName: b.fatherName || '',
    janpad: b.block || 'Unknown',
    gp: b.gp || 'Unknown',
    gram: b.village || 'Unknown',
    status: b.status || 'Pending',
    date: b.surveyDate ? formatDate(b.surveyDate) : '-'
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
  const [blockReportModalOpen, setBlockReportModalOpen] = useState(false);

  const distinctJanpads = useMemo(() => [...new Set(beneficiaries.map((b) => b.block).filter(Boolean))], [beneficiaries]);
  const distinctGps = useMemo(() => [...new Set(beneficiaries.filter((b) => !janpadFilter || b.block === janpadFilter).map((b) => b.gp).filter(Boolean))], [beneficiaries, janpadFilter]);
  const distinctGrams = useMemo(() => [...new Set(beneficiaries.filter((b) => (!janpadFilter || b.block === janpadFilter) && (!gpFilter || b.gp === gpFilter)).map((b) => b.village).filter(Boolean))], [beneficiaries, janpadFilter, gpFilter]);

  const issueMatchesSelectedType = (beneficiary, selectedIssueType) => {
    if (!selectedIssueType) return true;
    if (selectedIssueType === 'Aadhaar Issue') return hasAadhaarIssue(beneficiary);
    if (selectedIssueType === 'Ration Card Issue') return hasRationIssue(beneficiary);
    if (selectedIssueType === 'Both No Ayushman') return hasBothDocsNoAyushman(beneficiary);
    if (selectedIssueType === 'Other Issue') return hasOtherIssue(beneficiary);

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

  const handleTabChange = (tabId) => {
    setActiveTabKey(tabId);
    setPage(1);
    if (tabId === 'verified') {
      setStatusFilter('');
      setIssueTypeFilter('');
    } else if (tabId === 'pending') {
      setStatusFilter('');
      setIssueTypeFilter('');
    } else if (tabId === 'survey') {
      setStatusFilter('');
      setIssueTypeFilter('');
    } else if (tabId === 'date') {
      setStatusFilter('');
      setIssueTypeFilter('');
    }
  };

  const filteredBeneficiaries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return beneficiaries.filter((b) => {
      const text = `${b.name || ''} ${b.id || ''} ${b.fatherName || ''} ${b.headName || ''} ${b.gp || ''} ${b.village || ''} ${b.block || ''}`.toLowerCase();
      const matchesSearch = !q || text.includes(q);
      const matchesJanpad = !janpadFilter || b.block === janpadFilter;
      const matchesGp = !gpFilter || b.gp === gpFilter;
      const matchesGram = !gramFilter || b.village === gramFilter;

      // Tab-specific filter logic
      let matchesStatus = true;
      if (activeTabKey === 'pending') {
        matchesStatus = b.status === 'Pending';
      } else if (activeTabKey === 'verified') {
        matchesStatus = hasBothAadhaarAndRation(b) || b.overallResult === 'VERIFIED' || (b.status === 'Completed' && hasValidAadhaar(b));
      } else if (statusFilter) {
        matchesStatus = b.status === statusFilter;
      }

      const matchesIssueType = issueMatchesSelectedType(b, issueTypeFilter);

      // Date range filtering
      let matchesFrom = true;
      let matchesTo = true;
      const itemDate = getBeneficiaryDate(b);

      if (dateFrom) {
        if (!itemDate) {
          matchesFrom = false;
        } else {
          const fromD = new Date(`${dateFrom}T00:00:00`);
          matchesFrom = itemDate >= fromD;
        }
      }

      if (dateTo) {
        if (!itemDate) {
          matchesTo = false;
        } else {
          const toD = new Date(`${dateTo}T23:59:59`);
          matchesTo = itemDate <= toD;
        }
      }

      return matchesSearch && matchesJanpad && matchesGp && matchesGram && matchesStatus && matchesIssueType && matchesFrom && matchesTo;
    });
  }, [beneficiaries, search, janpadFilter, gpFilter, gramFilter, statusFilter, issueTypeFilter, dateFrom, dateTo, activeTabKey]);

  // Aggregate Block-Wise Statistics
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
    verified: ['ID', 'हितग्राही का नाम', 'मुखिया / पिता का नाम', 'विकासखंड', 'ग्राम पंचायत', 'ग्राम', 'आधार स्थिति', 'सत्यापन स्थिति', 'सर्वे दिनांक'],
    pending: ['ID', 'हितग्राही का नाम', 'मुखिया / पिता का नाम', 'विकासखंड', 'ग्राम पंचायत', 'ग्राम', 'सर्वे स्थिति'],
    date: ['ID', 'हितग्राही का नाम', 'मुखिया / पिता का नाम', 'विकासखंड', 'ग्राम पंचायत', 'ग्राम', 'सर्वे दिनांक व समय', 'सर्वे स्थिति']
  };

  const renderCellValue = (row, header) => {
    if (header === 'ID') {
      return <span className="report-id-code">{row.id}</span>;
    }

    if (header === 'हितग्राही का नाम') {
      return <strong>{row.name}</strong>;
    }

    if (header === 'मुखिया / पिता का नाम') {
      return (
        <div className="simple-family-cell">
          <div className="family-head-row">
            <span className="family-label">मुखिया:</span> <strong>{row.headName || '—'}</strong>
          </div>
          <div className="family-sub-row">
            <span className="family-label">पिता/पति:</span> <span>{row.fatherName || '—'}</span>
          </div>
        </div>
      );
    }

    if (header === 'विकासखंड') return row.janpad || '—';
    if (header === 'ग्राम पंचायत') return row.gp || '—';
    if (header === 'ग्राम') return row.gram || '—';

    if (header === 'सर्वे स्थिति') {
      if (row.status === 'Completed') {
        return <span className="report-status-badge success">Completed</span>;
      }
      if (row.status === 'Issue Found') {
        return <span className="report-status-badge danger">Issue Found</span>;
      }
      return <span className="report-status-badge pending">Pending</span>;
    }

    if (header === 'सर्वे दिनांक' || header === 'सर्वे दिनांक व समय') {
      return row.date || '—';
    }

    if (header === 'आधार स्थिति') {
      if (row.aadhaarStatus === 'Verified') {
        return <span className="report-status-badge success">Verified</span>;
      }
      return <span className="report-status-badge danger">Issue / Pending</span>;
    }

    if (header === 'सत्यापन स्थिति') {
      if (row.verifiedStatus === 'Verified Beneficiary') {
        return <span className="report-status-badge success">Verified Beneficiary</span>;
      }
      return <span className="report-status-badge pending">Not Verified</span>;
    }

    return row[header] ?? '—';
  };

  const tableHeaders = headersByTab[activeTabKey] || headersByTab.survey;
  const totalBeneficiariesCount = beneficiaries.length;
  const completedCount = beneficiaries.filter((b) => b.status === 'Completed').length;
  const pendingCount = beneficiaries.filter((b) => b.status === 'Pending').length;
  const aadhaarIssueCount = beneficiaries.filter(hasAadhaarIssue).length;
  const verifiedBeneficiaryCount = beneficiaries.filter(
    (b) => hasBothAadhaarAndRation(b) || b.overallResult === 'VERIFIED' || (b.status === 'Completed' && hasValidAadhaar(b))
  ).length;

  const summaryCards = [
    {
      key: 'total-members',
      label: 'कुल सदस्य (Total)',
      value: totalBeneficiariesCount,
      tone: 'blue',
      icon: Users,
      isActive: activeTabKey === 'survey' && !statusFilter && !issueTypeFilter && !search && !janpadFilter,
      onClick: () => {
        handleTabChange('survey');
        resetFilters();
      }
    },
    {
      key: 'completed-survey',
      label: 'सर्वेक्षण पूर्ण (Done)',
      value: completedCount,
      tone: 'green',
      icon: CheckCircle2,
      isActive: (activeTabKey === 'survey' || activeTabKey === 'date') && statusFilter === 'Completed',
      onClick: () => {
        if (activeTabKey !== 'survey' && activeTabKey !== 'date') {
          setActiveTabKey('survey');
        }
        setStatusFilter((prev) => (prev === 'Completed' ? '' : 'Completed'));
        setIssueTypeFilter('');
        setPage(1);
      }
    },
    {
      key: 'pending-survey',
      label: 'लंबित सर्वेक्षण (Pending)',
      value: pendingCount,
      tone: 'yellow',
      icon: Clock,
      isActive: activeTabKey === 'pending' || statusFilter === 'Pending',
      onClick: () => {
        if (activeTabKey === 'pending') {
          handleTabChange('survey');
        } else {
          handleTabChange('pending');
        }
      }
    },
    {
      key: 'aadhaar-issue',
      label: 'आधार समस्या (Aadhaar)',
      value: aadhaarIssueCount,
      tone: 'red',
      icon: ShieldAlert,
      isActive: issueTypeFilter === 'Aadhaar Issue',
      onClick: () => {
        if (activeTabKey !== 'survey') {
          setActiveTabKey('survey');
        }
        setIssueTypeFilter((prev) => (prev === 'Aadhaar Issue' ? '' : 'Aadhaar Issue'));
        setStatusFilter('');
        setPage(1);
      }
    },
    {
      key: 'verified-beneficiary',
      label: 'सत्यापित (Verified)',
      value: verifiedBeneficiaryCount,
      tone: 'blue',
      icon: ShieldCheck,
      isActive: activeTabKey === 'verified',
      onClick: () => {
        if (activeTabKey === 'verified') {
          handleTabChange('survey');
        } else {
          handleTabChange('verified');
        }
      }
    }
  ];

  return (
    <div className="report-shell">
      {/* 1. Clean Simple Header */}
      <div className="report-simple-header">
        <div className="report-header-info">
          <h2>📊 रिपोर्ट्स एवं सांख्यिकी (Reports)</h2>
          <p>
            {currentUser.district || appConfig.currentUser.district || 'दंतेवाड़ा'} जिला • कुल {beneficiaries.length.toLocaleString('en-IN')} हितग्राही रिकॉर्ड
          </p>
        </div>
        <div className="report-header-actions">
          <button
            type="button"
            className="report-simple-btn primary"
            onClick={() => setBlockReportModalOpen(true)}
          >
            <Sparkles size={15} /> ब्लॉक-वार रिपोर्ट
          </button>
          <button
            type="button"
            className="report-simple-btn"
            onClick={handleExcelExport}
          >
            <FileSpreadsheet size={15} /> एक्सेल डाउनलोड
          </button>
          <button
            type="button"
            className="report-simple-btn"
            onClick={handlePdfExport}
          >
            <Printer size={15} /> प्रिंट
          </button>
        </div>
      </div>

      {/* 2. Simple KPI Stats Cards */}
      <div className="report-simple-kpis">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.key}
              type="button"
              className={`simple-kpi-card ${card.isActive ? 'active' : ''}`}
              onClick={card.onClick}
            >
              <div className="simple-kpi-text">
                <span className="simple-kpi-label">{card.label}</span>
                <span className="simple-kpi-value">
                  {loading ? '...' : card.value.toLocaleString('en-IN')}
                </span>
              </div>
              <span className={`simple-kpi-icon ${card.tone}`}>
                <Icon size={22} />
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. Clean Report Body with Tabs & Filter */}
      <div className="report-simple-body card">
        {/* Tabs Row */}
        <div className="report-tabs-bar">
          <div className="report-tabs-list">
            {REPORT_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`report-tab-item ${activeTabKey === tab.id ? 'active' : ''}`}
                onClick={() => handleTabChange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Compact Clean Filter Bar */}
        {activeTabKey !== 'block-wise' && (
          <div className="report-simple-filters">
            {/* Search Input Row */}
            <div className="filter-search-input">
              <Search size={15} />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="नाम, मुखिया, पिता, ID, ग्राम से खोजें..."
              />
              {search && (
                <button type="button" className="clear-search-btn" onClick={() => setSearch('')}>
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Date-wise specific date range bar */}
            {activeTabKey === 'date' && (
              <div className="filter-date-toolbar">
                <div className="date-input-pair">
                  <div className="date-field">
                    <label>
                      <CalendarRange size={13} /> प्रारंभिक दिनांक:
                    </label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => {
                        setDateFrom(e.target.value);
                        setPage(1);
                      }}
                    />
                  </div>
                  <div className="date-field">
                    <label>
                      <CalendarRange size={13} /> अंतिम दिनांक:
                    </label>
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

                <div className="date-preset-buttons">
                  <button
                    type="button"
                    className={`date-preset-chip ${!dateFrom && !dateTo ? 'active' : ''}`}
                    onClick={() => {
                      setDateFrom('');
                      setDateTo('');
                      setPage(1);
                    }}
                  >
                    सभी दिनांक
                  </button>
                  <button
                    type="button"
                    className={`date-preset-chip ${dateFrom === new Date().toISOString().slice(0, 10) && dateTo === new Date().toISOString().slice(0, 10) ? 'active' : ''}`}
                    onClick={() => {
                      const today = new Date().toISOString().slice(0, 10);
                      setDateFrom(today);
                      setDateTo(today);
                      setPage(1);
                    }}
                  >
                    आज (Today)
                  </button>
                  <button
                    type="button"
                    className="date-preset-chip"
                    onClick={() => {
                      const today = new Date().toISOString().slice(0, 10);
                      const d = new Date();
                      d.setDate(d.getDate() - 7);
                      const past = d.toISOString().slice(0, 10);
                      setDateFrom(past);
                      setDateTo(today);
                      setPage(1);
                    }}
                  >
                    पिछले 7 दिन
                  </button>
                  <button
                    type="button"
                    className="date-preset-chip"
                    onClick={() => {
                      const now = new Date();
                      const today = now.toISOString().slice(0, 10);
                      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
                      setDateFrom(monthStart);
                      setDateTo(today);
                      setPage(1);
                    }}
                  >
                    इस माह
                  </button>
                  {(dateFrom || dateTo) && (
                    <button
                      type="button"
                      className="date-preset-chip clear"
                      onClick={() => {
                        setDateFrom('');
                        setDateTo('');
                        setPage(1);
                      }}
                    >
                      <X size={12} /> दिनांक रीसेट
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Dropdown Filters Row */}
            <div className="filter-selects-row">
              <select
                value={janpadFilter}
                onChange={(e) => {
                  setJanpadFilter(e.target.value);
                  setGpFilter('');
                  setGramFilter('');
                  setPage(1);
                }}
              >
                <option value="">सभी विकासखंड (All)</option>
                {distinctJanpads.map((janpad) => (
                  <option key={janpad} value={janpad}>{janpad}</option>
                ))}
              </select>

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
                  <option key={gp} value={gp}>{gp}</option>
                ))}
              </select>

              <select
                value={gramFilter}
                onChange={(e) => {
                  setGramFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">सभी ग्राम (All)</option>
                {distinctGrams.map((gram) => (
                  <option key={gram} value={gram}>{gram}</option>
                ))}
              </select>

              {/* Status filter (available in survey and date tabs) */}
              {(activeTabKey === 'survey' || activeTabKey === 'date') && (
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              )}

              {/* Issues filter */}
              <select
                value={issueTypeFilter}
                onChange={(e) => {
                  setIssueTypeFilter(e.target.value);
                  setPage(1);
                }}
              >
                {ISSUE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>

              {activeFiltersCount > 0 && (
                <button type="button" className="filter-reset-link" onClick={resetFilters}>
                  <RotateCcw size={13} /> साफ़ करें
                </button>
              )}
            </div>
          </div>
        )}

        {/* Record count summary */}
        <div className="report-count-summary">
          <span>
            {activeTabKey === 'block-wise'
              ? `${blockWiseRows.length} विकासखंड • कुल ${blockWiseTotals.total.toLocaleString('en-IN')} हितग्राही`
              : `कुल ${reportRows.length.toLocaleString('en-IN')} रिकॉर्ड`}
          </span>

          {activeTabKey === 'block-wise' ? (
            <button
              type="button"
              className="report-simple-btn primary small"
              onClick={handleDownloadBlockWiseExcel}
            >
              <Download size={14} /> Download Excel
            </button>
          ) : (
            <div className="table-page-size-wrap">
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

        {/* Data Table */}
        {activeTabKey === 'block-wise' ? (
          /* Detailed Block-Wise Report Table */
          <div className="table-container">
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
          /* Standard Paginated Table */
          <>
            <div className="table-container">
              <table className="custom-table simple-report-table">
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
                        <div className="report-empty-state">
                          <div className="empty-state-msg">
                            <strong>कोई रिकॉर्ड उपलब्ध नहीं है</strong>
                            <span>
                              {activeFiltersCount > 0
                                ? 'वर्तमान में लागू फ़िल्टर के अनुसार कोई परिणाम नहीं मिला।'
                                : 'इस श्रेणी में अभी कोई रिकॉर्ड दर्ज नहीं है।'}
                            </span>
                          </div>
                          {activeFiltersCount > 0 && (
                            <button
                              type="button"
                              className="report-simple-btn primary small"
                              onClick={resetFilters}
                            >
                              <RotateCcw size={13} /> सभी फ़िल्टर साफ़ करें (Show All)
                            </button>
                          )}
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

            {/* Simple Pagination */}
            {reportRows.length > 0 && (
              <div className="report-simple-pagination">
                <div className="pagination-text">
                  प्रदर्शित <strong>{(page - 1) * pageSize + 1} - {Math.min(page * pageSize, reportRows.length)}</strong> / कुल <strong>{reportRows.length.toLocaleString('en-IN')}</strong>
                </div>

                <div className="pagination-buttons">
                  <button
                    type="button"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft size={16} /> पिछला
                  </button>
                  <span className="page-current">
                    पृष्ठ {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    अगला <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Block Report Modal */}
      {blockReportModalOpen && (
        <div className="block-report-modal-overlay" onClick={() => setBlockReportModalOpen(false)}>
          <div className="block-report-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="block-report-modal-header">
              <div>
                <h3 className="block-report-title">ब्लॉक-वार विस्तृत रिपोर्ट (Block Wise)</h3>
                <p className="block-report-subtitle">Excel डाउनलोड से पहले डेटा प्रीव्यू</p>
              </div>
              <button
                type="button"
                className="block-report-close-btn"
                onClick={() => setBlockReportModalOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
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
              <button
                type="button"
                className="report-simple-btn"
                onClick={() => setBlockReportModalOpen(false)}
              >
                बंद करें
              </button>
              <button
                type="button"
                className="report-simple-btn primary"
                onClick={handleDownloadBlockWiseExcel}
              >
                <Download size={16} /> Final Download Excel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
