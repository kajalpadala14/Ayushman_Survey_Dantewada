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
import { exportToExcel } from '../utils/excelExport';
import {
  getBeneficiaryDate,
  formatBlockName,
  hasAadhaarIssue,
  hasRationIssue,
  hasValidAadhaar,
  hasValidRation,
  hasBothAadhaarAndRation,
  hasBothDocsNoAyushman,
  hasOtherIssue,
  buildTableRows,
  buildExcelExportRows
} from '../utils/reportsHelper.js';

const REPORT_TABS = [
  { id: 'block-wise', label: 'ब्लॉक-वार रिपोर्ट (Block-wise)' },
  { id: 'gp-wise', label: 'ग्राम पंचायत-वार रिपोर्ट (GP-wise)' },
  { id: 'village-wise', label: 'ग्राम-वार रिपोर्ट (Village-wise)' },
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

export default function ReportsDashboard({
  beneficiaries = [],
  currentUser = {},
  issueTypes = [],
  users = [],
  loading = false
}) {
  const [activeTabKey, setActiveTabKey] = useState('block-wise');
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
  const [excelPreviewModalOpen, setExcelPreviewModalOpen] = useState(false);
  const [previewPage, setPreviewPage] = useState(1);
  const previewPageSize = 15;

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
    } else if (tabId === 'block-wise') {
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

  // Aggregate GP-Wise Statistics
  const gpWiseRows = useMemo(() => {
    const gpMap = new Map();
    filteredBeneficiaries.forEach((b) => {
      const gpName = b.gp || 'Unknown';
      const blockName = formatBlockName(b.block || 'Unknown');
      const key = `${blockName}___${gpName}`;
      if (!gpMap.has(key)) {
        gpMap.set(key, {
          gp: gpName,
          block: blockName,
          total: 0,
          completed: 0,
          pending: 0
        });
      }
      const item = gpMap.get(key);
      item.total += 1;
      if (b.status === 'Completed') {
        item.completed += 1;
      } else {
        item.pending += 1;
      }
    });

    const rows = Array.from(gpMap.values());
    return rows.sort((a, b) => (b.total + b.completed) - (a.total + a.completed) || a.gp.localeCompare(b.gp));
  }, [filteredBeneficiaries]);

  const gpWiseTotals = useMemo(() => {
    return gpWiseRows.reduce(
      (acc, r) => ({
        total: acc.total + r.total,
        completed: acc.completed + r.completed,
        pending: acc.pending + r.pending
      }),
      { total: 0, completed: 0, pending: 0 }
    );
  }, [gpWiseRows]);

  // Aggregate Village-Wise Statistics
  const villageWiseRows = useMemo(() => {
    const villageMap = new Map();
    filteredBeneficiaries.forEach((b) => {
      const villageName = b.village || 'Unknown';
      const gpName = b.gp || 'Unknown';
      const blockName = formatBlockName(b.block || 'Unknown');
      const key = `${blockName}___${gpName}___${villageName}`;
      if (!villageMap.has(key)) {
        villageMap.set(key, {
          village: villageName,
          gp: gpName,
          block: blockName,
          total: 0,
          completed: 0,
          pending: 0
        });
      }
      const item = villageMap.get(key);
      item.total += 1;
      if (b.status === 'Completed') {
        item.completed += 1;
      } else {
        item.pending += 1;
      }
    });

    const rows = Array.from(villageMap.values());
    return rows.sort((a, b) => (b.total + b.completed) - (a.total + a.completed) || a.village.localeCompare(b.village));
  }, [filteredBeneficiaries]);

  const villageWiseTotals = useMemo(() => {
    return villageWiseRows.reduce(
      (acc, r) => ({
        total: acc.total + r.total,
        completed: acc.completed + r.completed,
        pending: acc.pending + r.pending
      }),
      { total: 0, completed: 0, pending: 0 }
    );
  }, [villageWiseRows]);

  const reportRows = useMemo(() => {
    if (activeTabKey === 'block-wise') {
      return blockWiseRows;
    }
    if (activeTabKey === 'gp-wise') {
      return gpWiseRows;
    }
    if (activeTabKey === 'village-wise') {
      return villageWiseRows;
    }
    return buildTableRows(filteredBeneficiaries, activeTabKey);
  }, [filteredBeneficiaries, activeTabKey, blockWiseRows, gpWiseRows, villageWiseRows]);

  const totalPages = Math.max(1, Math.ceil(
    (activeTabKey === 'gp-wise' ? gpWiseRows.length : activeTabKey === 'village-wise' ? villageWiseRows.length : reportRows.length) / pageSize
  ));
  const paginatedRows = activeTabKey === 'block-wise'
    ? blockWiseRows
    : activeTabKey === 'gp-wise'
    ? gpWiseRows.slice((page - 1) * pageSize, page * pageSize)
    : activeTabKey === 'village-wise'
    ? villageWiseRows.slice((page - 1) * pageSize, page * pageSize)
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

  const handleDownloadBlockWiseExcel = () => {
    const headers = [
      'क्र. (S.No.)',
      'विकासखंड (BLOCK)',
      'कुल हितग्राही (TOTAL)',
      'लंबित (PENDING)',
      'सर्वे पूर्ण (SURVEY DONE)',
      'आधार समस्या (AADHAAR ISSUE)',
      'राशन समस्या (RATION ISSUE)',
      'दोनों उपलब्ध (BOTH AVAILABLE)'
    ];

    const dataRows = blockWiseRows.map((r, idx) => [
      idx + 1,
      r.block,
      r.total,
      r.pending,
      r.surveyDone,
      r.aadhaarIssue,
      r.rationIssue,
      r.bothAvailable
    ]);

    dataRows.push([
      '',
      'TOTAL (कुल योग)',
      blockWiseTotals.total,
      blockWiseTotals.pending,
      blockWiseTotals.surveyDone,
      blockWiseTotals.aadhaarIssue,
      blockWiseTotals.rationIssue,
      blockWiseTotals.bothAvailable
    ]);

    exportToExcel(
      [headers, ...dataRows],
      `Block_Wise_Report_${new Date().toISOString().slice(0, 10)}.xlsx`,
      'Block_Wise_Summary'
    );
  };

  const handleDownloadGpWiseExcel = () => {
    const headers = [
      'क्र. (S.No.)',
      'ग्राम पंचायत (Gram Panchayat)',
      'विकासखंड (Block)',
      'कुल सर्वे (Total Survey)',
      'पूर्ण (Completed)',
      'लंबित (Pending)'
    ];

    const dataRows = gpWiseRows.map((r, idx) => [
      idx + 1,
      r.gp,
      r.block,
      r.total,
      r.completed,
      r.pending
    ]);

    dataRows.push([
      '',
      'TOTAL (कुल योग)',
      '—',
      gpWiseTotals.total,
      gpWiseTotals.completed,
      gpWiseTotals.pending
    ]);

    exportToExcel(
      [headers, ...dataRows],
      `Gram_Panchayat_Wise_Report_${new Date().toISOString().slice(0, 10)}.xlsx`,
      'GP_Wise_Summary'
    );
  };

  const handleDownloadVillageWiseExcel = () => {
    const headers = [
      'क्र. (S.No.)',
      'ग्राम (Village)',
      'ग्राम पंचायत (Gram Panchayat)',
      'विकासखंड (Block)',
      'कुल सर्वे (Total Survey)',
      'पूर्ण (Completed)',
      'लंबित (Pending)'
    ];

    const dataRows = villageWiseRows.map((r, idx) => [
      idx + 1,
      r.village,
      r.gp,
      r.block,
      r.total,
      r.completed,
      r.pending
    ]);

    dataRows.push([
      '',
      'TOTAL (कुल योग)',
      '—',
      '—',
      villageWiseTotals.total,
      villageWiseTotals.completed,
      villageWiseTotals.pending
    ]);

    exportToExcel(
      [headers, ...dataRows],
      `Village_Wise_Report_${new Date().toISOString().slice(0, 10)}.xlsx`,
      'Village_Wise_Summary'
    );
  };

  const getExcelExportData = () => {
    if (activeTabKey === 'block-wise') {
      const rows = blockWiseRows.map((r, idx) => ({
        'क्र. (S.No.)': idx + 1,
        'विकासखंड (Block)': r.block,
        'कुल हितग्राही (Total)': r.total,
        'लंबित (Pending)': r.pending,
        'सर्वे पूर्ण (Survey Done)': r.surveyDone,
        'आधार समस्या (Aadhaar Issue)': r.aadhaarIssue,
        'राशन समस्या (Ration Issue)': r.rationIssue,
        'दोनों उपलब्ध (Both Available)': r.bothAvailable
      }));
      rows.push({
        'क्र. (S.No.)': '',
        'विकासखंड (Block)': 'कुल योग (TOTAL)',
        'कुल हितग्राही (Total)': blockWiseTotals.total,
        'लंबित (Pending)': blockWiseTotals.pending,
        'सर्वे पूर्ण (Survey Done)': blockWiseTotals.surveyDone,
        'आधार समस्या (Aadhaar Issue)': blockWiseTotals.aadhaarIssue,
        'राशन समस्या (Ration Issue)': blockWiseTotals.rationIssue,
        'दोनों उपलब्ध (Both Available)': blockWiseTotals.bothAvailable
      });
      return rows;
    }

    if (activeTabKey === 'gp-wise') {
      const rows = gpWiseRows.map((r, idx) => ({
        'क्र. (S.No.)': idx + 1,
        'ग्राम पंचायत (Gram Panchayat)': r.gp,
        'विकासखंड (Block)': r.block,
        'कुल सर्वे (Total Survey)': r.total,
        'पूर्ण (Completed)': r.completed,
        'लंबित (Pending)': r.pending
      }));
      rows.push({
        'क्र. (S.No.)': '',
        'ग्राम पंचायत (Gram Panchayat)': 'कुल योग (TOTAL)',
        'विकासखंड (Block)': '—',
        'कुल सर्वे (Total Survey)': gpWiseTotals.total,
        'पूर्ण (Completed)': gpWiseTotals.completed,
        'लंबित (Pending)': gpWiseTotals.pending
      });
      return rows;
    }

    if (activeTabKey === 'village-wise') {
      const rows = villageWiseRows.map((r, idx) => ({
        'क्र. (S.No.)': idx + 1,
        'ग्राम (Village)': r.village,
        'ग्राम पंचायत (Gram Panchayat)': r.gp,
        'विकासखंड (Block)': r.block,
        'कुल सर्वे (Total Survey)': r.total,
        'पूर्ण (Completed)': r.completed,
        'लंबित (Pending)': r.pending
      }));
      rows.push({
        'क्र. (S.No.)': '',
        'ग्राम (Village)': 'कुल योग (TOTAL)',
        'ग्राम पंचायत (Gram Panchayat)': '—',
        'विकासखंड (Block)': '—',
        'कुल सर्वे (Total Survey)': villageWiseTotals.total,
        'पूर्ण (Completed)': villageWiseTotals.completed,
        'लंबित (Pending)': villageWiseTotals.pending
      });
      return rows;
    }

    return buildExcelExportRows(reportRows);
  };

  const getExcelFileName = () => {
    const today = new Date().toISOString().slice(0, 10);
    const tabName = {
      'block-wise': 'Block_Wise_Report',
      'gp-wise': 'Gram_Panchayat_Wise_Report',
      'village-wise': 'Village_Wise_Report',
      verified: 'Verified_Beneficiaries',
      pending: 'Pending_Survey_List',
      date: 'Date_Wise_Report'
    }[activeTabKey] || 'Ayushman_Report';
    return `${tabName}_${today}.xlsx`;
  };

  const getExcelSheetName = () => {
    const sheetNameMap = {
      'block-wise': 'ब्लॉक_वार',
      'gp-wise': 'ग्राम_पंचायत_वार',
      'village-wise': 'ग्राम_वार',
      verified: 'सत्यापित_सूची',
      pending: 'लंबित_सूची',
      date: 'दिनांक_वार'
    };
    return sheetNameMap[activeTabKey] || 'Report';
  };

  const handleExcelExport = () => {
    const data = getExcelExportData();
    if (!data || data.length === 0) {
      alert('एक्सपोर्ट के लिए कोई रिकॉर्ड उपलब्ध नहीं है। कृपया फ़िल्टर जांचें।');
      return;
    }
    setPreviewPage(1);
    setExcelPreviewModalOpen(true);
  };

  const handleConfirmExcelDownload = () => {
    const data = getExcelExportData();
    const fileName = getExcelFileName();
    const sheetName = getExcelSheetName();
    exportToExcel(data, fileName, sheetName);
    setExcelPreviewModalOpen(false);
  };

  const handlePdfExport = () => {
    window.print();
  };

  const headersByTab = {
    verified: ['ID', 'हितग्राही का नाम', 'मुखिया / पिता का नाम', 'विकासखंड', 'ग्राम पंचायत', 'ग्राम', 'आधार विवरण', 'राशन कार्ड', 'सत्यापन स्थिति', 'सर्वे दिनांक'],
    pending: ['ID', 'हितग्राही का नाम', 'मुखिया / पिता का नाम', 'विकासखंड', 'ग्राम पंचायत', 'ग्राम', 'सर्वे स्थिति'],
    date: ['ID', 'हितग्राही का नाम', 'मुखिया / पिता का नाम', 'विकासखंड', 'ग्राम पंचायत', 'ग्राम', 'आधार विवरण', 'राशन कार्ड', 'सर्वे दिनांक व समय', 'सर्वे स्थिति']
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

    if (header === 'आधार विवरण') {
      if (row.aadhaarNumber) {
        return (
          <span className="survey-table-badge aadhaar" title={`आधार नंबर: ${row.aadhaarNumber}`}>
            आधार: {row.aadhaarNumber}
          </span>
        );
      }
      if (row.enrollmentNumber) {
        return (
          <span className="survey-table-badge enrollment" title={`एनरोलमेंट नंबर: ${row.enrollmentNumber}`}>
            Enr: {row.enrollmentNumber}
          </span>
        );
      }
      if (row.aadhaarRemark) {
        return (
          <span className="survey-table-badge remark" title={`रिमार्क: ${row.aadhaarRemark}`}>
            {row.aadhaarRemark}
          </span>
        );
      }
      return <span className="cell-dim">—</span>;
    }

    if (header === 'राशन कार्ड') {
      if (row.rationNumber) {
        return (
          <span className="survey-table-badge ration" title={`राशन कार्ड नंबर: ${row.rationNumber}`}>
            राशन: {row.rationNumber}
          </span>
        );
      }
      if (row.hasRationCard === 'no' || row.rationNotAvailable === 'हाँ') {
        return <span className="survey-table-badge danger">कार्ड नहीं है</span>;
      }
      if (row.hasRationCard === 'yes') {
        return <span className="survey-table-badge success">उपलब्ध</span>;
      }
      return <span className="cell-dim">—</span>;
    }

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

  const tableHeaders = headersByTab[activeTabKey] || headersByTab.verified;
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
      isActive: activeTabKey === 'block-wise' && !statusFilter && !issueTypeFilter && !search && !janpadFilter,
      onClick: () => {
        handleTabChange('block-wise');
        resetFilters();
      }
    },
    {
      key: 'completed-survey',
      label: 'सर्वेक्षण पूर्ण (Done)',
      value: completedCount,
      tone: 'green',
      icon: CheckCircle2,
      isActive: activeTabKey === 'date' && statusFilter === 'Completed',
      onClick: () => {
        if (activeTabKey !== 'date') {
          setActiveTabKey('date');
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
          handleTabChange('block-wise');
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
        if (activeTabKey === 'block-wise') {
          setActiveTabKey('date');
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
          handleTabChange('block-wise');
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

              {/* Status filter (available in date tab) */}
              {activeTabKey === 'date' && (
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
              : activeTabKey === 'gp-wise'
              ? `${gpWiseRows.length} ग्राम पंचायत • कुल ${gpWiseTotals.total.toLocaleString('en-IN')} सर्वे`
              : activeTabKey === 'village-wise'
              ? `${villageWiseRows.length} ग्राम • कुल ${villageWiseTotals.total.toLocaleString('en-IN')} सर्वे`
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
          ) : activeTabKey === 'gp-wise' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
              <button
                type="button"
                className="report-simple-btn primary small"
                onClick={handleDownloadGpWiseExcel}
              >
                <Download size={14} /> Download Excel
              </button>
            </div>
          ) : activeTabKey === 'village-wise' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
              <button
                type="button"
                className="report-simple-btn primary small"
                onClick={handleDownloadVillageWiseExcel}
              >
                <Download size={14} /> Download Excel
              </button>
            </div>
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
                </tr>
              </tbody>
            </table>
          </div>
        ) : activeTabKey === 'gp-wise' ? (
          /* Detailed Gram Panchayat-Wise Report Table */
          <>
            <div className="table-container">
              <table className="custom-table block-report-table">
                <thead>
                  <tr>
                    <th>GRAM PANCHAYAT</th>
                    <th>BLOCK</th>
                    <th className="cell-num">TOTAL SURVEY</th>
                    <th className="cell-num">COMPLETED</th>
                    <th className="cell-num">PENDING</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row) => (
                    <tr key={`${row.block}-${row.gp}`}>
                      <td className="cell-block-title font-bold">{row.gp}</td>
                      <td>{row.block}</td>
                      <td className="cell-num font-bold">{row.total.toLocaleString('en-IN')}</td>
                      <td className="cell-num font-bold" style={{ color: '#16a34a' }}>{row.completed.toLocaleString('en-IN')}</td>
                      <td className="cell-num font-bold" style={{ color: '#ea580c' }}>{row.pending.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                  {gpWiseRows.length > 0 && (
                    <tr className="block-report-total-row">
                      <td className="cell-block-title font-black">TOTAL</td>
                      <td>—</td>
                      <td className="cell-num font-black">{gpWiseTotals.total.toLocaleString('en-IN')}</td>
                      <td className="cell-num font-black" style={{ color: '#16a34a' }}>{gpWiseTotals.completed.toLocaleString('en-IN')}</td>
                      <td className="cell-num font-black" style={{ color: '#ea580c' }}>{gpWiseTotals.pending.toLocaleString('en-IN')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {gpWiseRows.length > pageSize && (
              <div className="report-simple-pagination">
                <div className="pagination-text">
                  प्रदर्शित <strong>{(page - 1) * pageSize + 1} - {Math.min(page * pageSize, gpWiseRows.length)}</strong> / कुल <strong>{gpWiseRows.length.toLocaleString('en-IN')}</strong>
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
        ) : activeTabKey === 'village-wise' ? (
          /* Detailed Village-Wise Report Table */
          <>
            <div className="table-container">
              <table className="custom-table block-report-table">
                <thead>
                  <tr>
                    <th>VILLAGE (ग्राम)</th>
                    <th>GRAM PANCHAYAT</th>
                    <th>BLOCK</th>
                    <th className="cell-num">TOTAL SURVEY</th>
                    <th className="cell-num">COMPLETED</th>
                    <th className="cell-num">PENDING</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row) => (
                    <tr key={`${row.block}-${row.gp}-${row.village}`}>
                      <td className="cell-block-title font-bold">{row.village}</td>
                      <td>{row.gp}</td>
                      <td>{row.block}</td>
                      <td className="cell-num font-bold">{row.total.toLocaleString('en-IN')}</td>
                      <td className="cell-num font-bold" style={{ color: '#16a34a' }}>{row.completed.toLocaleString('en-IN')}</td>
                      <td className="cell-num font-bold" style={{ color: '#ea580c' }}>{row.pending.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                  {villageWiseRows.length > 0 && (
                    <tr className="block-report-total-row">
                      <td className="cell-block-title font-black">TOTAL</td>
                      <td>—</td>
                      <td>—</td>
                      <td className="cell-num font-black">{villageWiseTotals.total.toLocaleString('en-IN')}</td>
                      <td className="cell-num font-black" style={{ color: '#16a34a' }}>{villageWiseTotals.completed.toLocaleString('en-IN')}</td>
                      <td className="cell-num font-black" style={{ color: '#ea580c' }}>{villageWiseTotals.pending.toLocaleString('en-IN')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {villageWiseRows.length > pageSize && (
              <div className="report-simple-pagination">
                <div className="pagination-text">
                  प्रदर्शित <strong>{(page - 1) * pageSize + 1} - {Math.min(page * pageSize, villageWiseRows.length)}</strong> / कुल <strong>{villageWiseRows.length.toLocaleString('en-IN')}</strong>
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

      {/* Excel Export & Data Preview Modal */}
      {excelPreviewModalOpen && (
        <div className="excel-preview-modal-overlay" onClick={() => setExcelPreviewModalOpen(false)}>
          <div className="excel-preview-modal-card" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="excel-preview-header">
              <div className="excel-preview-header-left">
                <div className="excel-preview-icon-box">
                  <FileSpreadsheet size={24} />
                </div>
                <div>
                  <h3 className="excel-preview-title">एक्सेल एक्सपोर्ट डेटा प्रीव्यू</h3>
                  <p className="excel-preview-subtitle">
                    फ़ाइल: <strong>{getExcelFileName()}</strong> • रिपोर्ट: {REPORT_TABS.find((t) => t.id === activeTabKey)?.label || activeTabKey}
                  </p>
                </div>
              </div>
              <div className="excel-preview-header-right">
                <span className="excel-preview-count-badge">
                  कुल {getExcelExportData().length.toLocaleString('en-IN')} रिकॉर्ड्स
                </span>
                <button
                  type="button"
                  className="block-report-close-btn"
                  onClick={() => setExcelPreviewModalOpen(false)}
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Info and Filter Notice Banner */}
            <div className="excel-preview-notice-banner">
              <div className="excel-notice-text">
                <Sparkles size={16} />
                <span>
                  यह डेटा आपके द्वारा चुने गए फ़िल्टर के आधार पर <strong>Microsoft Excel (.xlsx)</strong> फ़ॉर्मेट में डाउनलोड होगा। डाउनलोड करने से पहले नीचे डेटा का विवरण जांचें:
                </span>
              </div>
              <div className="excel-preview-filter-chips">
                <span className="preview-chip highlight">रिपोर्ट: {REPORT_TABS.find((t) => t.id === activeTabKey)?.label || activeTabKey}</span>
                {janpadFilter ? <span className="preview-chip">ब्लॉक: {janpadFilter}</span> : <span className="preview-chip neutral">ब्लॉक: सभी</span>}
                {gpFilter && <span className="preview-chip">ग्राम पंचायत: {gpFilter}</span>}
                {gramFilter && <span className="preview-chip">ग्राम: {gramFilter}</span>}
                {statusFilter && <span className="preview-chip">स्थिति: {statusFilter}</span>}
                {issueTypeFilter && <span className="preview-chip">समस्या: {issueTypeFilter}</span>}
                {search && <span className="preview-chip">खोज: "{search}"</span>}
                {dateFrom && <span className="preview-chip">प्रारंभिक दिनांक: {dateFrom}</span>}
                {dateTo && <span className="preview-chip">अंतिम दिनांक: {dateTo}</span>}
              </div>
            </div>

            {/* Preview Controls Bar */}
            {(() => {
              const data = getExcelExportData();
              const totalPages = Math.max(1, Math.ceil(data.length / previewPageSize));
              const startIdx = (previewPage - 1) * previewPageSize;
              const endIdx = Math.min(startIdx + previewPageSize, data.length);

              return (
                <div className="excel-preview-controls-bar">
                  <span className="excel-preview-showing-text">
                    प्रदर्शित: <strong>{data.length > 0 ? startIdx + 1 : 0} - {endIdx}</strong> (कुल <strong>{data.length.toLocaleString('en-IN')}</strong> रिकॉर्ड्स में से)
                  </span>
                  {totalPages > 1 && (
                    <div className="excel-preview-page-buttons">
                      <button
                        type="button"
                        className="preview-nav-btn"
                        disabled={previewPage <= 1}
                        onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft size={14} /> पिछला
                      </button>
                      <span className="preview-page-num">
                        पृष्ठ {previewPage} / {totalPages}
                      </span>
                      <button
                        type="button"
                        className="preview-nav-btn"
                        disabled={previewPage >= totalPages}
                        onClick={() => setPreviewPage((p) => Math.min(totalPages, p + 1))}
                      >
                        अगला <ChevronRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Preview Table */}
            <div className="excel-preview-table-scroll">
              {(() => {
                const data = getExcelExportData();
                const headers = data.length > 0 ? Object.keys(data[0]) : [];
                const startIdx = (previewPage - 1) * previewPageSize;
                const pageRows = data.slice(startIdx, startIdx + previewPageSize);

                return (
                  <table className="excel-preview-table">
                    <thead>
                      <tr>
                        {headers.map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((row, rIdx) => (
                        <tr key={rIdx}>
                          {headers.map((h, cIdx) => (
                            <td key={cIdx} className={typeof row[h] === 'number' ? 'cell-number' : ''}>
                              {row[h] !== undefined && row[h] !== null && row[h] !== '' ? String(row[h]) : '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>

            {/* Limit Note */}
            <div className="excel-preview-limit-note">
              ℹ️ यह केवल प्रीव्यू स्क्रीन है। नीचे <strong>"एक्सेल (.xlsx) डाउनलोड करें"</strong> बटन दबाने पर सभी <strong>{getExcelExportData().length.toLocaleString('en-IN')}</strong> रिकॉर्ड्स पूरी तरह एक्सेल फ़ाइल में सुरक्षित डाउनलोड होंगे।
            </div>

            {/* Modal Footer */}
            <div className="excel-preview-modal-footer">
              <button
                type="button"
                className="report-simple-btn"
                onClick={() => setExcelPreviewModalOpen(false)}
              >
                रद्द करें
              </button>
              <button
                type="button"
                className="excel-download-btn-green"
                onClick={handleConfirmExcelDownload}
              >
                <Download size={16} /> एक्सेल (.xlsx) डाउनलोड करें
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
