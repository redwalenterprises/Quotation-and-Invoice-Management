import { useState, useEffect } from 'react';
import { Store } from '../utils/storage';

function formatCurrency(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

export default function QuotationList({ onCreateNew, onConvert, onEdit, readOnly = false, canConvert = true }) {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);

  // NAYA: Excel-like filters ki state
  const [filters, setFilters] = useState({});
  const [activeFilterPopup, setActiveFilterPopup] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  // Popup ko bahar click karne par band karne ka logic
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
    const data = await Store.getQuotations();
    setQuotations(data);
    setLoading(false);
  }

  const total = quotations.reduce((sum, q) => sum + Number(q.total || 0), 0);
  const converted = quotations
    .filter(q => q.status === 'Converted')
    .reduce((sum, q) => sum + Number(q.total || 0), 0);
  const open = total - converted;

  async function handleConvert(id, e) {
    e.stopPropagation();
    if (readOnly || !canConvert) return;
    try {
      await Store.convertToInvoice(id);
      await loadData();
      onConvert?.(id);
    } catch (err) {
      alert('Could not convert to invoice: ' + (err?.message || 'Unknown error'));
    }
  }

  async function handleDelete(id, e) {
    e.stopPropagation();
    if (readOnly) return;
    if (!window.confirm('Delete this estimate? This cannot be undone.')) return;
    await Store.deleteQuotation(id);
    await loadData();
  }

  function handleEdit(id, e) {
    e?.stopPropagation();
    onEdit?.(id);
  }

  // NAYA: Data filter karne ka logic (Excel jaisa)
  const filteredQuotations = quotations.filter(q => {
    return Object.entries(filters).every(([key, value]) => {
      if (!value) return true; // Agar us column ka koi filter nahi hai, toh pass hone do
      
      // Amount/Balance ko theek se filter karne ke liye
      let qValue = q[key];
      if (key === 'balance') {
        qValue = q.status === 'Converted' ? 0 : q.total;
      }
      return String(qValue).toLowerCase() === String(value).toLowerCase();
    });
  });

  const clearFilter = (key, e) => {
    e.stopPropagation();
    setFilters(prev => ({ ...prev, [key]: '' }));
    setActiveFilterPopup(null);
  };

  // NAYA: Table Header ko chhota aur clean rakhne ke liye ek Custom Header Function banaya hai
  const renderFilterHeader = (label, key, isRightAligned = false) => {
    // Us column ke sabhi unique (ek jaise) values nikalna dropdown ke liye
    let uniqueValues = [];
    if (key === 'balance') {
      uniqueValues = [...new Set(quotations.map(q => q.status === 'Converted' ? 0 : q.total))].filter(v => v !== undefined);
    } else {
      uniqueValues = [...new Set(quotations.map(q => q[key]))].filter(Boolean);
    }
    
    const isActive = !!filters[key];
    const isPopupOpen = activeFilterPopup === key;

    return (
      <th className="th-filter-container" style={{ position: 'relative', backgroundColor: '#f9fafb', borderBottom: '1px solid #eaedf1', borderRight: '1px solid #eaedf1', padding: '12px 16px', color: '#6b7280', fontWeight: '600', fontSize: '13px', textAlign: isRightAligned ? 'right' : 'left' }}>
        <div style={{ display: 'flex', justifyContent: isRightAligned ? 'flex-end' : 'space-between', alignItems: 'center', gap: '8px' }}>
          {label}
          <svg 
            onClick={(e) => { e.stopPropagation(); setActiveFilterPopup(isPopupOpen ? null : key); }}
            style={{ cursor: 'pointer', fill: isActive ? '#2563eb' : 'none' }} 
            width="14" height="14" viewBox="0 0 24 24" 
            stroke={isActive ? '#2563eb' : '#a0a0a0'} 
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
          </svg>
        </div>

        {/* Floating Excel-like Filter Box */}
        {isPopupOpen && (
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: '100%', right: '0', marginTop: '4px', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', padding: '12px', zIndex: 100, minWidth: '180px', textAlign: 'left' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>Filter {label}</div>
            
            <select 
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db', marginBottom: '10px', fontSize: '13px', outline: 'none', backgroundColor: '#f9fafb' }}
              value={filters[key] || ''}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, [key]: e.target.value }));
                setActiveFilterPopup(null);
              }}
            >
              <option value="">-- All (Clear) --</option>
              {uniqueValues.map((val, idx) => (
                <option key={idx} value={val}>
                  {key === 'total' || key === 'balance' ? formatCurrency(val) : val}
                </option>
              ))}
            </select>
            
            <button 
              onClick={(e) => clearFilter(key, e)}
              style={{ width: '100%', padding: '6px', backgroundColor: '#fee2e2', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', color: '#dc2626', fontWeight: '600' }}
            >
              Clear Filter
            </button>
          </div>
        )}
      </th>
    );
  };

  if (loading) {
    return (
      <div className="page">
        <div className="empty-state">Loading estimates...</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Estimate/Quotation <span className="header-dropdown-icon">⌄</span></h2>
          <button className="btn btn-primary" onClick={onCreateNew}>+ Add Estimate</button>
      </div>

      <div className="filter-bar">
        <span className="filter-label" style={{ marginRight: '10px', fontWeight: '500' }}>Filter by :</span>
        <select className="pill-select" defaultValue="This Month">
          <option>This Month</option>
          <option>Last Month</option>
          <option>This Year</option>
        </select>
        
        <div className="date-range-group" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <span className="calendar-icon">📅</span>
          <input type="date" className="pill-input plain" defaultValue="2026-07-01" />
          <span className="filter-sep" style={{ textTransform: 'capitalize' }}>To</span>
          <input type="date" className="pill-input plain" defaultValue="2026-07-31" />
        </div>

        <select className="pill-select" defaultValue="All Firms">
          <option>All Firms</option>
        </select>
      </div>

      <div className="stat-card">
        <div className="stat-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p className="stat-label">Total Quotations</p>
            <p className="stat-value">{formatCurrency(total)}</p>
          </div>
          <div className="stat-growth" style={{ textAlign: 'right' }}>
            <span className="growth-badge" style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>0% ↗</span>
            <div className="growth-text" style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>vs last month</div>
          </div>
        </div>
        <p className="stat-sub">
          Converted: {formatCurrency(converted)} &nbsp;|&nbsp; Open: {formatCurrency(open)}
        </p>
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px' }}>
          <h3>Transactions</h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: 'pointer' }}>
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>

        {quotations.length === 0 ? (
          <div className="empty-state">No estimates yet. Create your first estimate.</div>
        ) : (
          <div className="table-scroll">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', color: '#333' }}>
              <thead>
                <tr>
                  {renderFilterHeader('Date', 'date')}
                  {renderFilterHeader('Reference no', 'refNo')}
                  {renderFilterHeader('Party Name', 'partyName')}
                  {renderFilterHeader('Amount', 'total', true)}
                  {renderFilterHeader('Balance', 'balance', true)}
                  {renderFilterHeader('Status', 'status')}
                  <th style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #eaedf1', padding: '12px 16px', color: '#6b7280', fontWeight: '600', fontSize: '13px', textAlign: 'left' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredQuotations.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
                      No matching records found for this filter.
                    </td>
                  </tr>
                ) : (
                  filteredQuotations.map(q => (
                    <tr key={q.id} onClick={() => handleEdit(q.id)} style={{ cursor: 'pointer' }}>
                      <td style={{ borderBottom: '1px solid #eaedf1', borderRight: '1px solid #eaedf1', padding: '16px' }}>{q.date}</td>
                      <td style={{ borderBottom: '1px solid #eaedf1', borderRight: '1px solid #eaedf1', padding: '16px' }}>{q.refNo}</td>
                      <td style={{ borderBottom: '1px solid #eaedf1', borderRight: '1px solid #eaedf1', padding: '16px' }}>{q.partyName}</td>
                      <td style={{ borderBottom: '1px solid #eaedf1', borderRight: '1px solid #eaedf1', padding: '16px', textAlign: 'right' }}>{formatCurrency(q.total)}</td>
                      <td style={{ borderBottom: '1px solid #eaedf1', borderRight: '1px solid #eaedf1', padding: '16px', textAlign: 'right' }}>{formatCurrency(q.status === 'Converted' ? 0 : q.total)}</td>
                      <td style={{ borderBottom: '1px solid #eaedf1', borderRight: '1px solid #eaedf1', padding: '16px' }}>
                        <span style={{ color: '#2F80ED', textDecoration: 'none' }} className={`status-badge ${q.status === 'Converted' ? 'status-converted' : 'status-open'}`}>
                          {q.status}
                        </span>
                      </td>
                      <td style={{ borderBottom: '1px solid #eaedf1', padding: '16px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {readOnly ? (
                              <button className="link-btn" onClick={(e) => handleEdit(q.id, e)}>View</button>
                            ) : (
                              <>
                                {canConvert && (q.status === 'Open' ? (
                                  <button className="link-btn" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#a0a0a0', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }} onClick={(e) => handleConvert(q.id, e)}>
                                    Convert <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                  </button>
                                ) : (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#c0c0c0', fontSize: '13px' }}>
                                    Convert <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                  </span>
                                ))}
                                <button className="link-btn" onClick={(e) => handleEdit(q.id, e)}>Edit</button>
                                <button className="link-btn" style={{ color: 'var(--danger, #EB5757)' }} onClick={(e) => handleDelete(q.id, e)}>Delete</button>
                              </>
                            )}
                          </div>
                          <svg style={{ cursor: 'pointer', color: '#a0a0a0' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="1"></circle>
                            <circle cx="12" cy="5" r="1"></circle>
                            <circle cx="12" cy="19" r="1"></circle>
                          </svg>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}