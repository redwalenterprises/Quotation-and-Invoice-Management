import { useState, useEffect, useMemo } from 'react';
import { Store } from '../utils/storage';
import DateRangePicker, { toYMD } from './DateRangePicker';
import { generateSalesReportPDF } from '../utils/salesReport';

function formatCurrency(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

// Quick filter ke liye From/To range (hamesha asli current date se)
function getRange(type) {
  const t = new Date();
  let from, to;
  if (type === 'Today') {
    from = to = t;
  } else if (type === 'Yesterday') {
    from = to = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1);
  } else if (type === 'Last Month') {
    from = new Date(t.getFullYear(), t.getMonth() - 1, 1);
    to = new Date(t.getFullYear(), t.getMonth(), 0);
  } else if (type === 'This Year') {
    from = new Date(t.getFullYear(), 0, 1);
    to = new Date(t.getFullYear(), 11, 31);
  } else {
    from = new Date(t.getFullYear(), t.getMonth(), 1);
    to = new Date(t.getFullYear(), t.getMonth() + 1, 0);
  }
  return { from: toYMD(from), to: toYMD(to) };
}

export default function Reports() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rangeType, setRangeType] = useState('This Month');
  const initial = getRange('This Month');
  const [fromDate, setFromDate] = useState(initial.from);
  const [toDate, setToDate] = useState(initial.to);
  const [busy, setBusy] = useState(''); // kaunsa kaam chal raha hai, jaise 'd-view'

  useEffect(() => {
    (async () => {
      setInvoices(await Store.getInvoices());
      setLoading(false);
    })();
  }, []);

  function handleRangeTypeChange(value) {
    setRangeType(value);
    if (value === 'Custom') return;
    const r = getRange(value);
    setFromDate(r.from);
    setToDate(r.to);
  }

  const filtered = useMemo(
    () => invoices.filter(i => (!fromDate || i.date >= fromDate) && (!toDate || i.date <= toDate)),
    [invoices, fromDate, toDate]
  );

  // din ke hisaab se group (preview table ke liye)
  const dayRows = useMemo(() => {
    const map = {};
    filtered.forEach(i => {
      const d = i.date || 'Unknown';
      const r = (map[d] = map[d] || { date: d, bills: 0, total: 0, paid: 0 });
      r.bills += 1;
      r.total += Number(i.total || 0);
      r.paid += Number(i.paidAmount || 0);
    });
    return Object.values(map).sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [filtered]);

  const total = filtered.reduce((s, i) => s + Number(i.total || 0), 0);
  const paid = filtered.reduce((s, i) => s + Number(i.paidAmount || 0), 0);
  const due = total - paid;

  function buildReport(detailed) {
    return generateSalesReportPDF({ invoices: filtered, fromDate, toDate, detailed });
  }

  // View: PDF naye tab me khulta hai (download button nahi)
  async function handleView(detailed) {
    if (filtered.length === 0) {
      alert('Is range me koi sale nahi hai.');
      return;
    }
    // popup block se bachne ke liye tab pehle hi khol lo, PDF baad me daalenge
    const win = window.open('', '_blank');
    try {
      setBusy(`${detailed ? 'd' : 's'}-view`);
      const { blob } = await buildReport(detailed);
      const url = URL.createObjectURL(blob);
      if (win) {
        win.location.href = url;
      } else {
        alert('Popup block ho gaya. Browser me is site ke liye popups allow karo.');
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      console.error('Report PDF failed:', e);
      win?.close();
      alert('Report banane me error aaya. Dobara try karo.');
    } finally {
      setBusy('');
    }
  }

  // Share: phone/device ka share sheet (WhatsApp etc.), same jaisa invoice me hai
  async function handleShare(detailed) {
    if (filtered.length === 0) {
      alert('Is range me koi sale nahi hai.');
      return;
    }
    try {
      setBusy(`${detailed ? 'd' : 's'}-share`);
      const { blob, fileName } = await buildReport(detailed);
      const file = new File([blob], fileName, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Sales Report',
          text: `Sales Report ${fromDate.split('-').reverse().join('/')} to ${toDate.split('-').reverse().join('/')}`,
        });
      } else {
        alert('Is device/browser me Share support nahi hai. "View" se report kholo.');
      }
    } catch (e) {
      if (e?.name !== 'AbortError') {
        console.error('Report share failed:', e);
        alert('Share nahi ho paya. Dobara try karo.');
      }
    } finally {
      setBusy('');
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="empty-state">Loading reports...</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Reports</h2>
      </div>

      <div className="filter-bar">
        <select className="pill-select" value={rangeType} onChange={e => handleRangeTypeChange(e.target.value)}>
          <option>Today</option>
          <option>Yesterday</option>
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
            setRangeType('Custom');
          }}
        />
      </div>

      <div className="stat-card">
        <p className="stat-label">Total sales</p>
        <p className="stat-value">{formatCurrency(total)}</p>
        <p className="stat-sub">
          Bills: <b>{filtered.length}</b> &nbsp;|&nbsp; Received: {formatCurrency(paid)} &nbsp;|&nbsp; Due: {formatCurrency(due)}
        </p>
      </div>

      <div className="card" style={{ padding: '4px 16px', marginBottom: 20 }}>
        {[
          { label: 'Day-wise Summary', detailed: false },
          { label: 'Detailed with Items', detailed: true },
        ].map((rep, idx) => (
          <div
            key={rep.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
              padding: '12px 0',
              borderTop: idx ? '1px solid #eee' : 'none',
            }}
          >
            <span style={{ fontWeight: 600 }}>{rep.label} (PDF)</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" disabled={!!busy} onClick={() => handleView(rep.detailed)}>
                {busy === `${rep.detailed ? 'd' : 's'}-view` ? 'Preparing...' : '👁 View'}
              </button>
              <button className="btn btn-primary" disabled={!!busy} onClick={() => handleShare(rep.detailed)}>
                {busy === `${rep.detailed ? 'd' : 's'}-share` ? 'Preparing...' : '📤 Share'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="card table-card-plain">
        <div className="table-toolbar">
          <h3>Day-wise Sales</h3>
        </div>
        {dayRows.length === 0 ? (
          <div className="empty-state">Is range me koi sale nahi hai.</div>
        ) : (
          <div className="table-scroll">
            <table className="vyapar-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="col-right">Bills</th>
                  <th className="col-right">Total Sales</th>
                  <th className="col-right">Received</th>
                  <th className="col-right">Due</th>
                </tr>
              </thead>
              <tbody>
                {dayRows.map(r => (
                  <tr key={r.date}>
                    <td>{r.date.split('-').reverse().join('/')}</td>
                    <td className="col-right">{r.bills}</td>
                    <td className="col-right">{formatCurrency(r.total)}</td>
                    <td className="col-right">{formatCurrency(r.paid)}</td>
                    <td className="col-right">{formatCurrency(r.total - r.paid)}</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 700 }}>
                  <td>Grand Total</td>
                  <td className="col-right">{filtered.length}</td>
                  <td className="col-right">{formatCurrency(total)}</td>
                  <td className="col-right">{formatCurrency(paid)}</td>
                  <td className="col-right">{formatCurrency(due)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}