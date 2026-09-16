import { useState, useEffect, useMemo } from 'react';
import { Store } from '../utils/storage';
import BackupRestore from './BackupRestore';

function formatCurrency(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Lightweight dependency-free line chart (mirrors Vyapaar's "Total Sale" chart)
function SalesLineChart({ points, labelPrefix }) {
  const width = 900;
  const height = 260;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const [hoverIdx, setHoverIdx] = useState(null);

  const maxVal = Math.max(1, ...points.map(p => p.value));
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;

  const coords = points.map((p, i) => ({
    x: padding.left + i * stepX,
    y: padding.top + innerH - (p.value / maxVal) * innerH,
    ...p,
  }));

  const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  const areaD = `${pathD} L ${coords[coords.length - 1]?.x || 0} ${padding.top + innerH} L ${coords[0]?.x || 0} ${padding.top + innerH} Z`;

  const yTicks = 5;
  const activePoint = hoverIdx !== null ? coords[hoverIdx] : coords[coords.length - 1];

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', minWidth: 500 }}>
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const y = padding.top + (innerH / yTicks) * i;
          return (
            <line key={i} x1={padding.left} x2={width - padding.right} y1={y} y2={y}
              stroke="var(--border)" strokeWidth="1" />
          );
        })}
        {coords.length > 0 && (
          <>
            <path d={areaD} fill="var(--primary, #3b82f6)" opacity="0.08" />
            <path d={pathD} fill="none" stroke="var(--primary, #3b82f6)" strokeWidth="2.5" />
          </>
        )}
        {coords.map((c, i) => (
          <rect key={i}
            x={padding.left + i * stepX - stepX / 2}
            y={padding.top}
            width={stepX || innerW}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
          />
        ))}
        {activePoint && (
          <>
            <circle cx={activePoint.x} cy={activePoint.y} r="4" fill="var(--primary, #3b82f6)" />
            <line x1={activePoint.x} x2={activePoint.x} y1={padding.top} y2={padding.top + innerH}
              stroke="var(--primary, #3b82f6)" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
          </>
        )}
        {coords.filter((_, i) => i % Math.ceil(coords.length / 8 || 1) === 0).map((c, i) => (
          <text key={i} x={c.x} y={height - 6} fontSize="10" fill="var(--text-muted, #888)" textAnchor="middle">
            {c.label}
          </text>
        ))}
        {activePoint && (
          <g transform={`translate(${Math.min(Math.max(activePoint.x - 45, 0), width - 100)}, ${Math.max(activePoint.y - 34, 4)})`}>
            <rect width="95" height="26" rx="6" fill="var(--success, #16a34a)" />
            <text x="47" y="17" fontSize="11" fill="#fff" textAnchor="middle" fontWeight="600">
              {activePoint.label}: {labelPrefix}{Number(activePoint.value).toLocaleString('en-IN')}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

export default function Dashboard() {
  const [showBackup, setShowBackup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [partyDues, setPartyDues] = useState([]);

  const PERIOD_OPTIONS = [
    { key: 'today', label: 'Today' },
    { key: 'thisWeek', label: 'This Week' },
    { key: 'lastMonth', label: 'Last Month' },
    { key: 'thisMonth', label: 'This Month' },
    { key: 'thisQuarter', label: 'This Quarter' },
    { key: 'halfYear', label: 'Half Year' },
    { key: 'thisYear', label: 'This year' },
    { key: 'custom', label: 'Custom' },
  ];

  const [period, setPeriod] = useState('thisMonth');
  const [periodMenuOpen, setPeriodMenuOpen] = useState(false);
  const todayStr = new Date().toISOString().slice(0, 10);
  const [customStart, setCustomStart] = useState(todayStr);
  const [customEnd, setCustomEnd] = useState(todayStr);

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

  // Total Payable isn't tracked in BizManager (no purchase/expense module yet)
  const totalPayable = 0;

  // Resolve the selected period into a concrete [startDate, endDate] range
  const { rangeStart, rangeEnd } = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (period) {
      case 'today':
        break; // start === end === today
      case 'thisWeek': {
        const day = start.getDay(); // 0=Sun
        const diffToMonday = day === 0 ? 6 : day - 1;
        start.setDate(start.getDate() - diffToMonday);
        break;
      }
      case 'lastMonth': {
        start.setMonth(start.getMonth() - 1, 1);
        end.setMonth(end.getMonth(), 0); // last day of previous month
        break;
      }
      case 'thisMonth':
        start.setDate(1);
        break;
      case 'thisQuarter': {
        const qStartMonth = Math.floor(start.getMonth() / 3) * 3;
        start.setMonth(qStartMonth, 1);
        break;
      }
      case 'halfYear':
        start.setMonth(start.getMonth() - 6, start.getDate());
        break;
      case 'thisYear':
        start.setMonth(0, 1);
        break;
      case 'custom':
        return {
          rangeStart: customStart ? new Date(customStart) : start,
          rangeEnd: customEnd ? new Date(customEnd) : end,
        };
      default:
        break;
    }
    return { rangeStart: start, rangeEnd: end };
  }, [period, customStart, customEnd]);

  const chartPoints = useMemo(() => {
    const msPerDay = 24 * 60 * 60 * 1000;
    const dayCount = Math.max(1, Math.round((rangeEnd - rangeStart) / msPerDay) + 1);
    const groupByMonth = dayCount > 62; // aggregate by month for long ranges (quarter/half-year/year)

    const buckets = new Map(); // key -> { label, value, sortKey }

    invoices.forEach(inv => {
      if (!inv.date) return;
      const d = new Date(inv.date);
      if (Number.isNaN(d.getTime())) return;
      if (d < rangeStart || d > rangeEnd) return;

      let key, label, sortKey;
      if (groupByMonth) {
        key = `${d.getFullYear()}-${d.getMonth()}`;
        label = `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
        sortKey = d.getFullYear() * 12 + d.getMonth();
      } else {
        key = d.toISOString().slice(0, 10);
        label = `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`;
        sortKey = d.getTime();
      }

      if (!buckets.has(key)) buckets.set(key, { label, value: 0, sortKey });
      buckets.get(key).value += Number(inv.total || 0);
    });

    // Fill in empty buckets so the chart shows a continuous line
    if (groupByMonth) {
      const cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
      while (cursor <= rangeEnd) {
        const key = `${cursor.getFullYear()}-${cursor.getMonth()}`;
        if (!buckets.has(key)) {
          buckets.set(key, {
            label: `${MONTH_NAMES[cursor.getMonth()].slice(0, 3)} ${cursor.getFullYear()}`,
            value: 0,
            sortKey: cursor.getFullYear() * 12 + cursor.getMonth(),
          });
        }
        cursor.setMonth(cursor.getMonth() + 1);
      }
    } else {
      const cursor = new Date(rangeStart);
      while (cursor <= rangeEnd) {
        const key = cursor.toISOString().slice(0, 10);
        if (!buckets.has(key)) {
          buckets.set(key, {
            label: `${cursor.getDate()} ${MONTH_NAMES[cursor.getMonth()].slice(0, 3)}`,
            value: 0,
            sortKey: cursor.getTime(),
          });
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    return Array.from(buckets.values()).sort((a, b) => a.sortKey - b.sortKey);
  }, [invoices, rangeStart, rangeEnd]);

  const totalSaleThisPeriod = chartPoints.reduce((s, p) => s + p.value, 0);
  const periodLabel = PERIOD_OPTIONS.find(p => p.key === period)?.label || 'This Month';


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

      {/* Total Receivable / Total Payable — Vyapaar style */}
      <div className="dashboard-stats-row">
        <div className="stat-card">
          <p className="stat-label">Total Receivable</p>
          <p className="stat-value" style={{ color: 'var(--success)' }}>
            {formatCurrency(totalDue)}
          </p>
          {totalDue === 0 && <p className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>You don't have any receivables as of now.</p>}
        </div>
        <div className="stat-card">
          <p className="stat-label">Total Payable</p>
          <p className="stat-value">{formatCurrency(totalPayable)}</p>
          <p className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>You don't have any payables as of now.</p>
        </div>
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
          <p className="stat-label">Open quotations</p>
          <p className="stat-value">{openQuotations}</p>
        </div>
      </div>

      {/* Total Sale chart with month/year filter — Vyapaar style */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={{ marginBottom: 4 }}>Total Sale</h3>
            <p className="stat-value" style={{ fontSize: 20 }}>{formatCurrency(totalSaleThisPeriod)}</p>
          </div>
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setPeriodMenuOpen(o => !o)}
              style={{ minWidth: 140, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
            >
              {periodLabel} <span>▾</span>
            </button>
            {periodMenuOpen && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                  onClick={() => setPeriodMenuOpen(false)}
                />
                <div
                  className="card"
                  style={{
                    position: 'absolute', right: 0, top: '110%', zIndex: 20,
                    padding: 6, minWidth: 160, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  }}
                >
                  {PERIOD_OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => { setPeriod(opt.key); setPeriodMenuOpen(false); }}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none',
                        background: period === opt.key ? 'var(--bg-hover, #eef4ff)' : 'transparent',
                        borderRadius: 6, cursor: 'pointer', fontSize: 14,
                        fontWeight: period === opt.key ? 600 : 400,
                        color: period === opt.key ? 'var(--primary, #3b82f6)' : 'inherit',
                      }}
                    >
                      {opt.label} {period === opt.key && <span>✓</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {period === 'custom' && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 13, color: 'var(--text-muted, #666)' }}>From</label>
            <input
              type="date"
              className="input"
              value={customStart}
              max={customEnd}
              onChange={e => setCustomStart(e.target.value)}
              style={{ width: 160 }}
            />
            <label style={{ fontSize: 13, color: 'var(--text-muted, #666)' }}>To</label>
            <input
              type="date"
              className="input"
              value={customEnd}
              min={customStart}
              onChange={e => setCustomEnd(e.target.value)}
              style={{ width: 160 }}
            />
          </div>
        )}
        <SalesLineChart points={chartPoints} labelPrefix="₹" />
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
