import { useState, useRef, useEffect } from 'react';
import './DateRangePicker.css';

const pad = (n) => String(n).padStart(2, '0');
// Local date -> 'YYYY-MM-DD' (toISOString use nahi karna, wahi timezone bug deta hai)
export const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toDMY = (s) => (s ? s.split('-').reverse().join('/') : '');
const parseDMY = (t) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t.trim());
  if (!m) return null;
  const [, d, mo, y] = m;
  const dt = new Date(+y, +mo - 1, +d);
  return dt.getMonth() === +mo - 1 ? `${y}-${mo}-${d}` : null;
};
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function DateRangePicker({ from, to, onChange }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('days'); // 'days' | 'months' | 'years'
  const start = from ? new Date(from + 'T00:00:00') : new Date();
  const [cur, setCur] = useState({ y: start.getFullYear(), m: start.getMonth() });
  const [yearBase, setYearBase] = useState(2012 + 16 * Math.floor((start.getFullYear() - 2012) / 16));
  const [picking, setPicking] = useState(false); // true = start choose ho gayi, end baaki
  const [fromTxt, setFromTxt] = useState('');
  const [toTxt, setToTxt] = useState('');
  const ref = useRef(null);

  useEffect(() => { setFromTxt(toDMY(from)); setToTxt(toDMY(to)); }, [from, to]);
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const shiftMonth = (n) => {
    const d = new Date(cur.y, cur.m + n, 1);
    setCur({ y: d.getFullYear(), m: d.getMonth() });
  };

  const pickDay = (ymd) => {
    if (!picking) { onChange({ from: ymd, to: ymd }); setPicking(true); }
    else {
      const [a, b] = ymd < from ? [ymd, from] : [from, ymd];
      onChange({ from: a, to: b });
      setPicking(false);
      setOpen(false);
    }
  };

  const commitText = (which, txt) => {
    const v = parseDMY(txt);
    if (!v) return;
    onChange(which === 'from' ? { from: v, to: to && to >= v ? to : v } : { from: from && from <= v ? from : v, to: v });
  };

  // 6 weeks ka grid, Sunday se shuru
  const cells = Array.from({ length: 42 }, (_, i) => new Date(cur.y, cur.m, 1 - new Date(cur.y, cur.m, 1).getDay() + i));
  const rows = Array.from({ length: 6 }, (_, r) => cells.slice(r * 7, r * 7 + 7));

  return (
    <div className="drp" ref={ref}>
      <button type="button" className="drp-chip" onClick={() => {
        if (!open) {
            const s = from ? new Date(from + 'T00:00:00') : new Date();
            setCur({ y: s.getFullYear(), m: s.getMonth() });
            setView('days');
            setPicking(false);
        }
        setOpen((o) => !o);
        }}>
        📅 {toDMY(from)} <span>To</span> {toDMY(to)}
      </button>

      {open && (
        <div className="drp-pop">
          <div className="drp-inputs">
            <label>From
              <input value={fromTxt} placeholder="From Date" onChange={(e) => setFromTxt(e.target.value)} onBlur={() => commitText('from', fromTxt)} />
            </label>
            <label>To
              <input value={toTxt} placeholder="To Date" onChange={(e) => setToTxt(e.target.value)} onBlur={() => commitText('to', toTxt)} />
            </label>
          </div>

          {view === 'days' && (
            <>
              <div className="drp-head">
                <button type="button" onClick={() => shiftMonth(-1)}>◀</button>
                <button type="button" className="drp-title" onClick={() => setView('years')}>{MONTHS_FULL[cur.m]} {cur.y}</button>
                <button type="button" onClick={() => shiftMonth(1)}>▶</button>
              </div>
              <div className="drp-wk">{['Su','Mo','Tu','We','Th','Fr','Sa'].map((d) => <span key={d}>{d}</span>)}</div>
              {rows.map((row, i) => (
                <div className="drp-row" key={i}>
                  {row.map((d) => {
                    const ymd = toYMD(d);
                    const inRange = from && to && ymd >= from && ymd <= to;
                    const edge = ymd === from || ymd === to;
                    return (
                      <button type="button" key={ymd}
                        className={`drp-day${d.getMonth() !== cur.m ? ' out' : ''}${inRange ? ' in' : ''}${edge ? ' edge' : ''}`}
                        onClick={() => pickDay(ymd)}>{d.getDate()}</button>
                    );
                  })}
                </div>
              ))}
            </>
          )}

          {view === 'years' && (
            <>
              <div className="drp-head">
                <button type="button" onClick={() => setYearBase((y) => y - 16)}>◀</button>
                <span className="drp-title">{yearBase} - {yearBase + 15}</span>
                <button type="button" onClick={() => setYearBase((y) => y + 16)}>▶</button>
              </div>
              <div className="drp-grid">
                {Array.from({ length: 16 }, (_, i) => yearBase + i).map((y) => (
                  <button type="button" key={y} className={y === cur.y ? 'sel' : ''}
                    onClick={() => { setCur((c) => ({ ...c, y })); setView('months'); }}>{y}</button>
                ))}
              </div>
            </>
          )}

          {view === 'months' && (
            <>
              <div className="drp-head">
                <button type="button" onClick={() => setCur((c) => ({ ...c, y: c.y - 1 }))}>◀</button>
                <button type="button" className="drp-title" onClick={() => setView('years')}>{cur.y}</button>
                <button type="button" onClick={() => setCur((c) => ({ ...c, y: c.y + 1 }))}>▶</button>
              </div>
              <div className="drp-grid">
                {MONTHS.map((m, i) => (
                  <button type="button" key={m} className={i === cur.m ? 'sel' : ''}
                    onClick={() => { setCur((c) => ({ ...c, m: i })); setView('days'); }}>{m}</button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}