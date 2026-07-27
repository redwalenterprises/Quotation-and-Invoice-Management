import { useState, useEffect } from 'react';
import { Store } from '../utils/storage';
import BackupRestore from './BackupRestore';

function formatCurrency(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

export default function Dashboard() {
  const [showBackup, setShowBackup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [partyDues, setPartyDues] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [invoicesData, quotationsData, partiesData] = await Promise.all([
        Store.getInvoices(),
        Store.getQuotations(),
        Store.getParties(),
      ]);

      const safeInvoices = invoicesData || [];
      const safeQuotations = quotationsData || [];
      const safeParties = partiesData || [];

      setInvoices(safeInvoices);
      setQuotations(safeQuotations);

      // Party balances fetched asynchronously
      const dues = await Promise.all(
        safeParties.map(async p => ({
          name: p.name,
          due: await Store.getPartyBalance(p.name),
        }))
      );

      setPartyDues(
        dues
          .filter(p => p.due > 0)
          .sort((a, b) => b.due - a.due)
          .slice(0, 5)
      );
    } catch (error) {
      console.error('Error loading dashboard data from Supabase:', error);
    } finally {
      setLoading(false);
    }
  }

  // Calculations
  const totalSales = invoices.reduce((sum, i) => sum + Number(i.total || 0), 0);
  const totalReceived = invoices.reduce((sum, i) => sum + Number(i.paidAmount || 0), 0);
  const totalDue = Math.max(0, totalSales - totalReceived);

  // Case-insensitive check for Open quotations ('open' or 'OPEN')
  const openQuotations = quotations.filter(
    q => q.status && q.status.toLowerCase() === 'open'
  ).length;

  const recentInvoices = [...invoices]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 5);

  // Helper for payment status badges
  const renderStatusBadge = (inv) => {
    const status = (inv.paymentStatus || inv.status || 'UNPAID').toUpperCase();
    if (status === 'PAID') {
      return <span className="status-badge status-converted">Paid</span>;
    }
    if (status === 'PARTIAL') {
      return <span className="status-badge status-partial">Partial</span>;
    }
    return <span className="status-badge status-open">Unpaid</span>;
  };

  if (showBackup) {
    return (
      <div>
        <div className="page" style={{ paddingBottom: 0 }}>
          <button className="link-btn" onClick={() => setShowBackup(false)}>
            ← Back to Dashboard
          </button>
        </div>
        <BackupRestore />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page">
        <div className="empty-state">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Dashboard</h2>
        <button className="btn btn-secondary" onClick={() => setShowBackup(true)}>
          ⬇ Backup &amp; Restore
        </button>
      </div>

      <div className="dashboard-stats-row">
        <div className="stat-card">
          <p className="stat-label">Total sales</p>
          <p className="stat-value">{formatCurrency(totalSales)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Received</p>
          <p className="stat-value" style={{ color: 'var(--success)' }}>
            {formatCurrency(totalReceived)}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Pending dues</p>
          <p className="stat-value" style={{ color: 'var(--warning)' }}>
            {formatCurrency(totalDue)}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Open quotations</p>
          <p className="stat-value">{openQuotations}</p>
        </div>
      </div>

      <div className="dashboard-columns">
        <div className="card">
          <div className="section-header">
            <h3>Recent invoices</h3>
          </div>
          {recentInvoices.length === 0 ? (
            <div className="empty-state">No invoices yet.</div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Party</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.map((inv, idx) => (
                    <tr key={inv.id || idx}>
                      <td>{inv.date}</td>
                      <td>{inv.partyName}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(inv.total)}</td>
                      <td>{renderStatusBadge(inv)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-header">
            <h3>Top pending dues</h3>
          </div>
          {partyDues.length === 0 ? (
            <div className="empty-state">No pending dues. All caught up!</div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Party</th>
                    <th style={{ textAlign: 'right' }}>Due amount</th>
                  </tr>
                </thead>
                <tbody>
                  {partyDues.map((p, idx) => (
                    <tr key={p.name || idx}>
                      <td>{p.name}</td>
                      <td style={{ textAlign: 'right', color: 'var(--warning)', fontWeight: 600 }}>
                        {formatCurrency(p.due)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}