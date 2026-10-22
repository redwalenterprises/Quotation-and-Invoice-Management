import { useState, useEffect, useRef } from 'react';
import { Store } from '../utils/storage';
import DateRangePicker, { toYMD } from './DateRangePicker';

function formatCurrency(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function FilterIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="4 4 20 4 14 12 14 19 10 21 10 12 4 4" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="12" width="4" height="9" />
      <rect x="10" y="7" width="4" height="14" />
      <rect x="17" y="3" width="4" height="18" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}

const COLUMNS = [
  { label: 'Date', key: 'date' },
  { label: 'Invoice no', key: 'invoiceNo' },
  { label: 'Party Name', key: 'partyName' },
  { label: 'Transaction', key: 'transaction' },
  { label: 'Payment Type', key: 'paymentType' },
  { label: 'Amount', key: 'total' },
  { label: 'Balance', key: 'balance' },
];

// Compute a From/To date range for a given quick-filter label, anchored to
// the REAL current date (not a hardcoded one) so new records always show up.
function getMonthRange(type) {
  const today = new Date();
  let from, to;
  if (type === 'Last Month') {
    from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    to = new Date(today.getFullYear(), today.getMonth(), 0);
  } else if (type === 'This Year') {
    from = new Date(today.getFullYear(), 0, 1);
    to = new Date(today.getFullYear(), 11, 31);
  } else {
    // This Month (default)
    from = new Date(today.getFullYear(), today.getMonth(), 1);
    to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  }
  return { from: toYMD(from), to: toYMD(to) };
}

export default function InvoiceList({ onCreateNew, onView, onEdit, readOnly = false }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({});
  const [activeFilterPopup, setActiveFilterPopup] = useState(null);
  const [dateRangeType, setDateRangeType] = useState('This Month');
  const defaultRange = getMonthRange('This Month');
  const [fromDate, setFromDate] = useState(defaultRange.from);
  const [toDate, setToDate] = useState(defaultRange.to);
  const menuRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.th-filter-container')) {
        setActiveFilterPopup(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  async function loadData() {
    setLoading(true);
    const data = await Store.getInvoices();
    setInvoices(data);
    setLoading(false);
  }

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.partyName?.toLowerCase().includes(search.toLowerCase());
    const matchesFilters = Object.entries(filters).every(([key, value]) => {
      if (!value) return true;
      let invValue = inv[key];
      if (key === 'balance') {
        invValue = Number(inv.total || 0) - Number(inv.paidAmount || 0);
      }
      if (key === 'transaction') {
        invValue = 'Sale';
      }
      return String(invValue).toLowerCase() === String(value).toLowerCase();
    });
    const matchesDateRange = (!fromDate || inv.date >= fromDate) && (!toDate || inv.date <= toDate);
    return matchesSearch && matchesFilters && matchesDateRange;
  });

  const total = filteredInvoices.reduce((sum, i) => sum + Number(i.total || 0), 0);
  const paid = filteredInvoices.reduce((sum, i) => sum + Number(i.paidAmount || 0), 0);
  const due = total - paid;

  async function handleMarkPaid(id, e) {
    e.stopPropagation();
    setOpenMenuId(null);
    if (readOnly) return;
    const invoice = invoices.find(i => i.id === id);
    const remaining = Number(invoice.total || 0) - Number(invoice.paidAmount || 0);
    await Store.recordPayment(id, remaining);
    await loadData();
  }

  async function handleDelete(id, e) {
    e.stopPropagation();
    setOpenMenuId(null);
    if (readOnly) return;
    if (!window.confirm('Delete this sale? This cannot be undone.')) return;
    await Store.deleteInvoice(id);
    await loadData();
  }

  function handleDateRangeTypeChange(value) {
    setDateRangeType(value);
    if (value === 'Custom') return;
    const { from, to } = getMonthRange(value);
    setFromDate(from);
    setToDate(to);
  }

  function renderFilterHeader(label, key, isRightAligned = false) {
    let uniqueValues = [];
    if (key === 'balance') {
      uniqueValues = [...new Set(invoices.map(inv => Number(inv.total || 0) - Number(inv.paidAmount || 0)))];
    } else if (key === 'transaction') {
      uniqueValues = ['Sale'];
    } else {
      uniqueValues = [...new Set(invoices.map(inv => inv[key]))].filter(Boolean);
    }

    const isActive = !!filters[key];
    const isPopupOpen = activeFilterPopup === key;

    return (
      <th key={key} className={`th-filter-container ${isRightAligned ? 'col-right' : ''}`} style={{ position: 'relative' }}>
        <span className="th-with-filter">
          {label}
          <svg
            onClick={(e) => { e.stopPropagation(); setActiveFilterPopup(isPopupOpen ? null : key); }}
            width="12" height="12" viewBox="0 0 24 24"
            fill={isActive ? '#2563eb' : 'none'}
            stroke={isActive ? '#2563eb' : 'currentColor'}
            strokeWidth="2" style={{ cursor: 'pointer' }}
          >
            <polygon points="4 4 20 4 14 12 14 19 10 21 10 12 4 4" />
          </svg>
        </span>

        {isPopupOpen && (
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', padding: '12px', zIndex: 100, minWidth: '180px', textAlign: 'left' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>Filter {label}</div>
            <select
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db', marginBottom: '10px', fontSize: '13px' }}
              value={filters[key] || ''}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, [key]: e.target.value }));
                setActiveFilterPopup(null);
              }}
            >
              <option value="">-- All (Clear) --</option>
              {uniqueValues.map((val, idx) => (
                <option key={idx} value={val}>
                  {(key === 'total' || key === 'balance') ? formatCurrency(val) : val}
                </option>
              ))}
            </select>
            <button
              onClick={(e) => { e.stopPropagation(); setFilters(prev => ({ ...prev, [key]: '' })); setActiveFilterPopup(null); }}
              style={{ width: '100%', padding: '6px', backgroundColor: '#fee2e2', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', color: '#dc2626', fontWeight: '600' }}
            >
              Clear Filter
            </button>
          </div>
        )}
      </th>
    );
  }

  function toggleMenu(id, e) {
    e.stopPropagation();
    setOpenMenuId(openMenuId === id ? null : id);
  }

  if (loading) {
    return (
      <div className="page">
        <div className="empty-state">Loading sales...</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Sales</h2>
        {!readOnly && (
          <button className="btn btn-primary" onClick={onCreateNew}>+ Add Sale</button>
        )}
      </div>

      <div className="filter-bar">
        <select
          className="pill-select"
          value={dateRangeType}
          onChange={(e) => handleDateRangeTypeChange(e.target.value)}
        >
          <option>This Month</option>
          <option>Last Month</option>
          <option>This Year</option>
          <option>Custom</option>
        </select>
        <DateRangePicker
          from={fromDate}
          to={toDate}
          onChange={({ from, to }) => {
            setFromDate(from);
            setToDate(to);
            setDateRangeType('Custom');
          }}
        />
      </div>

      <div className="stat-card">
        <p className="stat-label">Total sales</p>
        <p className="stat-value">{formatCurrency(total)}</p>
        <p className="stat-sub">
          Received: {formatCurrency(paid)} &nbsp;|&nbsp; Due: {formatCurrency(due)}
        </p>
      </div>

      <div className="card table-card-plain">
        <div className="table-toolbar">
          <h3>Transactions</h3>
          <div className="table-toolbar-icons">
            <button className="table-icon-btn" onClick={() => setShowSearch(!showSearch)} title="Search"><SearchIcon /></button>
            <button className="table-icon-btn" title="Chart view" disabled><ChartIcon /></button>
            <button className="table-icon-btn xls-icon" title="Export to Excel" disabled>XLS</button>
            <button className="table-icon-btn" title="Print" onClick={() => window.print()}><PrintIcon /></button>
          </div>
        </div>

        {showSearch && (
          <input
            type="text"
            className="table-search-input"
            placeholder="Search party name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        )}

        {filteredInvoices.length === 0 ? (
          <div className="empty-state">No sales yet. Create your first sale or convert a quotation.</div>
        ) : (
          <div className="table-scroll">
            <table className="vyapar-table">
              <thead>
                <tr>
                  {COLUMNS.map(col =>
                    renderFilterHeader(col.label, col.key, col.key === 'total' || col.key === 'balance')
                  )}
                  <th>Payment Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map(inv => {
                  const balance = Number(inv.total || 0) - Number(inv.paidAmount || 0);
                  return (
                    <tr key={inv.id} onClick={() => (readOnly ? onView?.(inv.id) : onEdit?.(inv.id))} style={{ cursor: 'pointer' }}>
                      <td>{inv.date?.split('-').reverse().join('/')}</td>
                      <td>{inv.invoiceNo}</td>
                      <td>{inv.partyName}</td>
                      <td>Sale</td>
                      <td>{inv.paymentType || 'Cash'}</td>
                      <td className="col-right">{formatCurrency(inv.total)}</td>
                      <td className="col-right">{formatCurrency(balance)}</td>
                      <td>
                        <span className={`status-badge ${
                          inv.paymentStatus === 'Paid' ? 'status-converted' :
                          inv.paymentStatus === 'Partial' ? 'status-partial' : 'status-open'
                        }`}>
                          {inv.paymentStatus}
                        </span>
                      </td>
                      <td style={{ position: 'relative', textAlign: 'center' }}>
                        <button
                          className="icon-btn dots-btn"
                          onClick={(e) => toggleMenu(inv.id, e)}
                        >
                          ⋮
                        </button>

                        {openMenuId === inv.id && (
                          <div className="row-menu" ref={menuRef} onClick={e => e.stopPropagation()}>
                            <button className="row-menu-item" onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); onView?.(inv.id); }}>
                              {readOnly ? 'View / share' : 'View / print'}
                            </button>
                            {!readOnly && (
                              <>
                                <button className="row-menu-item" onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); onEdit?.(inv.id); }}>
                                  Edit
                                </button>
                                {inv.paymentStatus !== 'Paid' && (
                                  <button className="row-menu-item" onClick={(e) => handleMarkPaid(inv.id, e)}>
                                    Mark paid
                                  </button>
                                )}
                                <button className="row-menu-item row-menu-danger" onClick={(e) => handleDelete(inv.id, e)}>
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}