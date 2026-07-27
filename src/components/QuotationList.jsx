import { useState, useEffect } from 'react';
import { Store } from '../utils/storage';

function formatCurrency(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

export default function QuotationList({ onCreateNew, onConvert }) {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
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

  async function handleConvert(id) {
    await Store.convertToInvoice(id);
    await loadData();
    onConvert?.(id);
  }

  if (loading) {
    return (
      <div className="page">
        <div className="empty-state">Loading quotations...</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Estimate / Quotation</h2>
        <button className="btn btn-primary" onClick={onCreateNew}>+ Add estimate</button>
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
        <select className="pill-select" defaultValue="All Firms">
          <option>All Firms</option>
        </select>
      </div>

      <div className="stat-card">
        <p className="stat-label">Total quotations</p>
        <p className="stat-value">{formatCurrency(total)}</p>
        <p className="stat-sub">
          Converted: {formatCurrency(converted)} &nbsp;|&nbsp; Open: {formatCurrency(open)}
        </p>
      </div>

      <div className="card">
        <div className="section-header"><h3>Transactions</h3></div>

        {quotations.length === 0 ? (
          <div className="empty-state">No quotations yet. Create your first estimate.</div>
        ) : (
          /* ✅ Table wrapped in table-scroll */
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reference no</th>
                  <th>Party name</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ textAlign: 'right' }}>Balance</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {quotations.map(q => (
                  <tr key={q.id}>
                    <td>{q.date}</td>
                    <td>{q.refNo}</td>
                    <td>{q.partyName}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(q.total)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(q.status === 'Converted' ? 0 : q.total)}</td>
                    <td>
                      <span className={`status-badge ${q.status === 'Converted' ? 'status-converted' : 'status-open'}`}>
                        {q.status}
                      </span>
                    </td>
                    <td>
                      {q.status === 'Open' && (
                        <button className="link-btn" onClick={() => handleConvert(q.id)}>Convert</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}