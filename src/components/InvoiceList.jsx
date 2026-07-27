import { useState, useEffect } from 'react';
import { Store } from '../utils/storage';

function formatCurrency(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

export default function InvoiceList({ onCreateNew, onView }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const data = await Store.getInvoices();
    setInvoices(data);
    setLoading(false);
  }

  const total = invoices.reduce((sum, i) => sum + Number(i.total || 0), 0);
  const paid = invoices.reduce((sum, i) => sum + Number(i.paidAmount || 0), 0);
  const due = total - paid;

  async function handleMarkPaid(id) {
    const invoice = invoices.find(i => i.id === id);
    const remaining = Number(invoice.total || 0) - Number(invoice.paidAmount || 0);
    await Store.recordPayment(id, remaining);
    await loadData();
  }

  if (loading) {
    return (
      <div className="page">
        <div className="empty-state">Loading invoices...</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Sale / Invoices</h2>
        <button className="btn btn-primary" onClick={onCreateNew}>+ Add invoice</button>
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

      <div className="card">
        <div className="section-header"><h3>Transactions</h3></div>

        {invoices.length === 0 ? (
          <div className="empty-state">No invoices yet. Create your first invoice or convert a quotation.</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Invoice no</th>
                  <th>Party name</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ textAlign: 'right' }}>Balance</th>
                  <th>Payment status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => {
                  const balance = Number(inv.total || 0) - Number(inv.paidAmount || 0);
                  return (
                    <tr key={inv.id}>
                      <td>{inv.date}</td>
                      <td>{inv.invoiceNo}</td>
                      <td>{inv.partyName}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(inv.total)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(balance)}</td>
                      <td>
                        <span className={`status-badge ${
                          inv.paymentStatus === 'Paid' ? 'status-converted' :
                          inv.paymentStatus === 'Partial' ? 'status-partial' : 'status-open'
                        }`}>
                          {inv.paymentStatus}
                        </span>
                      </td>
                      <td>
                        <button className="link-btn" onClick={() => onView?.(inv.id)}>View / print</button>
                        {inv.paymentStatus !== 'Paid' && (
                          <button className="link-btn" style={{ marginLeft: 10 }} onClick={() => handleMarkPaid(inv.id)}>Mark paid</button>
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