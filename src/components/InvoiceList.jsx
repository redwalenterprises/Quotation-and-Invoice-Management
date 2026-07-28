import { useState, useEffect, useRef } from 'react';
import { Store } from '../utils/storage';

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

const COLUMNS = ['Date', 'Invoice no', 'Party Name', 'Transaction', 'Payment Type', 'Amount', 'Balance'];

export default function InvoiceList({ onCreateNew, onView, onEdit }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState('');
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

  async function loadData() {
    setLoading(true);
    const data = await Store.getInvoices();
    setInvoices(data);
    setLoading(false);
  }

  const filteredInvoices = invoices.filter(inv =>
    inv.partyName?.toLowerCase().includes(search.toLowerCase())
  );

  const total = invoices.reduce((sum, i) => sum + Number(i.total || 0), 0);
  const paid = invoices.reduce((sum, i) => sum + Number(i.paidAmount || 0), 0);
  const due = total - paid;

  async function handleMarkPaid(id, e) {
    e.stopPropagation();
    setOpenMenuId(null);
    const invoice = invoices.find(i => i.id === id);
    const remaining = Number(invoice.total || 0) - Number(invoice.paidAmount || 0);
    await Store.recordPayment(id, remaining);
    await loadData();
  }

  async function handleDelete(id, e) {
    e.stopPropagation();
    setOpenMenuId(null);
    if (!window.confirm('Delete this sale? This cannot be undone.')) return;
    await Store.deleteInvoice(id);
    await loadData();
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
        <button className="btn btn-primary" onClick={onCreateNew}>+ Add Sale</button>
      </div>

      <div className="filter-bar">
        <select className="pill-select" defaultValue="This Month">
          <option>This Month</option>
          <option>Last Month</option>
          <option>This Year</option>
        </select>
        <input type="date" className="pill-input" defaultValue="2026-07-01" />
        <span className="filter-sep">to</span>
        <input type="date" className="pill-input" defaultValue="2026-07-31" />
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
                  {COLUMNS.map(col => (
                    <th key={col} className={col === 'Amount' || col === 'Balance' ? 'col-right' : ''}>
                      <span className="th-with-filter">
                        {col}
                        <FilterIcon />
                      </span>
                    </th>
                  ))}
                  <th>Payment Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map(inv => {
                  const balance = Number(inv.total || 0) - Number(inv.paidAmount || 0);
                  return (
                    <tr key={inv.id} onClick={() => onEdit?.(inv.id)} style={{ cursor: 'pointer' }}>
                      <td>{inv.date}</td>
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
                              View / print
                            </button>
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