import { useState, useEffect } from 'react';
import { Store } from '../utils/storage';
import { rowCalc } from '../utils/calculations';

const UNITS = ['NONE', 'PCS', 'KG', 'BOX', 'LTR', 'MTR'];
const TAX_RATES = ['NONE', 'GST 18%'];

function emptyRow() {
  return {
    item: '', itemDescription: '', qty: '', unit: 'NONE', price: '',
    discountPercent: '', discountAmount: '',
    taxRate: 'NONE',
  };
}

export default function QuotationForm({ onSaved, onCancel, mode = 'quotation' }) {
  // === Async Data States ===
  const [savedItems, setSavedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // === Original States ===
  const [partyName, setPartyName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [stateOfSupply, setStateOfSupply] = useState('');
  const [refNo, setRefNo] = useState(''); // Will be set asynchronously
  const [rows, setRows] = useState([emptyRow(), emptyRow()]);
  const [showTerms, setShowTerms] = useState(false);
  const [terms, setTerms] = useState('');
  const [showDescription, setShowDescription] = useState(false);
  const [description, setDescription] = useState('');
  const [roundOff, setRoundOff] = useState(true);

  // === Mobile "Add Item" Modal States ===
  const [showMobileAddItem, setShowMobileAddItem] = useState(false);
  const [mItemName, setMItemName] = useState('');
  const [mItemDescription, setMItemDescription] = useState(''); 
  const [mQty, setMQty] = useState('');
  const [mRate, setMRate] = useState('');
  const [mDiscountPercent, setMDiscountPercent] = useState('');
  const [mTaxRate, setMTaxRate] = useState('NONE');
  const [mUnit, setMUnit] = useState('PCS');

  // === Fetch Initial Data (Items & Auto-generate Ref No) ===
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [items, invoices, quotations] = await Promise.all([
          Store.getItems(),
          Store.getInvoices(),
          Store.getQuotations()
        ]);
        
        setSavedItems(items || []);
        
        // Set next reference/invoice number
        const nextNo = mode === 'invoice' ? (invoices.length || 0) + 1 : (quotations.length || 0) + 1;
        setRefNo(nextNo);
      } catch (error) {
        console.error('Error loading form data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [mode]);

  // === Original Logic & Calculations ===
  function updateRow(index, field, value) {
    const next = [...rows];
    next[index] = { ...next[index], [field]: value };

    if (field === 'item') {
      const match = savedItems.find(si => si.name.toLowerCase() === value.toLowerCase());
      if (match) {
        next[index] = {
          ...next[index],
          price: match.price,
          unit: match.unit,
          taxRate: TAX_RATES.includes(match.taxRate) ? match.taxRate : 'NONE',
          hsn: match.hsn,
        };
      }
    }
    setRows(next);
  }

  function addRow() { setRows([...rows, emptyRow()]); }
  function removeRow(index) { setRows(rows.filter((_, i) => i !== index)); }

  const totals = rows.reduce(
    (acc, r) => {
      const c = rowCalc(r);
      return {
        qty: acc.qty + (Number(r.qty) || 0),
        discount: acc.discount + c.discountAmount,
        tax: acc.tax + c.taxAmount,
        amount: acc.amount + c.amount,
      };
    },
    { qty: 0, discount: 0, tax: 0, amount: 0 }
  );

  const rawTotal = totals.amount;
  const displayedRoundOff = roundOff ? Math.round(rawTotal) - rawTotal : 0;
  const finalTotal = rawTotal + displayedRoundOff;

  // === Async Form Save ===
  async function handleSave() {
    if (!partyName.trim()) return;
    
    try {
      setSaving(true);
      const data = {
        partyName: partyName.trim(),
        date,
        stateOfSupply,
        items: rows.filter(r => r.item.trim()),
        terms,
        description,
        total: finalTotal,
      };

      let saved;
      if (mode === 'invoice') {
        saved = await Store.saveInvoice({ ...data, invoiceNo: refNo });
      } else {
        saved = await Store.saveQuotation({ ...data, refNo });
      }

      onSaved?.(saved);
    } catch (error) {
      console.error('Save failed:', error);
      alert('Error saving data. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // === Mobile "Add Item" Handlers ===
  function handleMobileItemChange(val) {
    setMItemName(val);
    const match = savedItems.find(si => si.name.toLowerCase() === val.toLowerCase());
    if (match) {
      setMRate(match.price || '');
      setMUnit(match.unit || 'PCS');
      setMTaxRate(TAX_RATES.includes(match.taxRate) ? match.taxRate : 'NONE');
    }
  }

  function handleMobileSaveItem(isNew = false) {
    if (!mItemName.trim()) return;
    
    const newRow = {
      item: mItemName,
      itemDescription: mItemDescription,
      qty: mQty || 1,
      unit: mUnit,
      price: mRate || 0,
      discountPercent: mDiscountPercent, 
      discountAmount: '', 
      taxRate: mTaxRate,
    };

    const emptyIndex = rows.findIndex(r => !r.item.trim());
    if (emptyIndex !== -1) {
      const next = [...rows];
      next[emptyIndex] = newRow;
      setRows(next);
    } else {
      setRows([...rows, newRow]);
    }

    // Reset Mobile Form States
    setMItemName(''); setMItemDescription(''); setMQty(''); setMRate('');
    setMDiscountPercent(''); setMTaxRate('NONE'); setMUnit('PCS');
    
    if (!isNew) setShowMobileAddItem(false);
  }

  // Loading UI fallback
  if (loading) {
    return (
      <div className="page">
        <div className="card"><div className="empty-state">Loading data...</div></div>
      </div>
    );
  }

  // ==========================================
  // VIEW 1: MOBILE ADD ITEM SCREEN
  // ==========================================
  if (showMobileAddItem) {
    return (
      <div className="mobile-add-item-screen">
        <div className="mobile-header">
          <button className="back-btn" onClick={() => setShowMobileAddItem(false)}>←</button>
          <h3>Add Items to {mode === 'invoice' ? 'Invoice' : 'Estimate'}</h3>
        </div>
        <div className="mobile-body">
          <div className="floating-input-group">
            <input 
              type="text" placeholder=" " list="saved-items-list" autoFocus
              value={mItemName} onChange={e => handleMobileItemChange(e.target.value)} 
            />
            <label>Item Name</label>
          </div>
          
          <div className="floating-input-group">
            <input 
              type="text" placeholder=" " 
              value={mItemDescription} onChange={e => setMItemDescription(e.target.value)} 
            />
            <label>Item Description (Optional)</label>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div className="floating-input-group" style={{ flex: 1 }}>
              <input 
                type="number" placeholder=" " 
                value={mQty} onChange={e => setMQty(e.target.value)} 
              />
              <label>Quantity</label>
            </div>
            
            <div className="floating-input-group" style={{ flex: 1 }}>
              <select value={mUnit} onChange={e => setMUnit(e.target.value)} style={{ width: '100%', padding: '10px', marginTop: '12px', border: '1px solid #ccc', borderRadius: '4px' }}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <label style={{ top: '-8px', fontSize: '12px', left: '10px', background: '#fff', padding: '0 4px', color: '#666' }}>Unit</label>
            </div>
          </div>

          <div className="floating-input-group">
            <input 
              type="number" placeholder=" " 
              value={mRate} onChange={e => setMRate(e.target.value)} 
            />
            <label>Rate (Price/Unit)</label>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div className="floating-input-group" style={{ flex: 1 }}>
              <input 
                type="number" placeholder=" " 
                value={mDiscountPercent} onChange={e => setMDiscountPercent(e.target.value)} 
              />
              <label>Discount %</label>
            </div>
            
            <div className="floating-input-group" style={{ flex: 1 }}>
              <select value={mTaxRate} onChange={e => setMTaxRate(e.target.value)} style={{ width: '100%', padding: '10px', marginTop: '12px', border: '1px solid #ccc', borderRadius: '4px' }}>
                {TAX_RATES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <label style={{ top: '-8px', fontSize: '12px', left: '10px', background: '#fff', padding: '0 4px', color: '#666' }}>Tax (GST)</label>
            </div>
          </div>

        </div>
        <div className="mobile-bottom-bar">
          <button className="btn-secondary-half" onClick={() => handleMobileSaveItem(true)}>Save & New</button>
          <button className="btn-primary-half red-btn" onClick={() => handleMobileSaveItem(false)}>Save</button>
        </div>
        <datalist id="saved-items-list">
          {savedItems.map(si => <option key={si.id} value={si.name} />)}
        </datalist>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: MAIN FORM
  // ==========================================
  return (
    <div className="page">
      <div className="page-header">
        <h2>{mode === 'invoice' ? 'Sale / Invoice' : 'Estimate / Quotation'}</h2>
      </div>

      <div className="card">
        <div className="form-top-row">
          <div className="form-group floating-group" style={{ maxWidth: 320, width: '100%' }}>
            <input
              type="text" placeholder=" "
              value={partyName} onChange={e => setPartyName(e.target.value)}
            />
            <label>Customer Name <span className="required">*</span></label>
          </div>
          <div className="form-top-right">
            <div className="meta-row">
              <span className="meta-label">{mode === 'invoice' ? 'Invoice no.' : 'Ref no.'}</span>
              <input type="text" className="meta-input" value={refNo} onChange={e => setRefNo(e.target.value)} />
            </div>
            <div className="meta-row">
              <span className="meta-label">Invoice date</span>
              <input type="date" className="meta-input" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="meta-row">
              <span className="meta-label">State of supply</span>
              <select className="meta-input" value={stateOfSupply} onChange={e => setStateOfSupply(e.target.value)}>
                <option value="">Select</option>
                <option>Maharashtra</option>
                <option>Delhi</option>
                <option>Karnataka</option>
                <option>Tamil Nadu</option>
                <option>Uttar Pradesh</option>
              </select>
            </div>
          </div>
        </div>

        <div className="desktop-table-wrapper">
          <table className="item-table">
            <thead>
              <tr>
                <th>#</th><th>Item</th><th>Description</th><th>Qty</th><th>Unit</th><th>Price / unit</th>
                <th>Discount %</th><th>Discount amt</th><th>Tax</th>
                <th style={{ textAlign: 'right' }}>Amount</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const calc = rowCalc(row);
                return (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>
                      <input type="text" list="saved-items-list" value={row.item} onChange={e => updateRow(i, 'item', e.target.value)} placeholder="Item name" />
                    </td>
                    <td>
                      <input type="text" value={row.itemDescription || ''} onChange={e => updateRow(i, 'itemDescription', e.target.value)} placeholder="Description" />
                    </td>
                    <td><input type="number" value={row.qty} onChange={e => updateRow(i, 'qty', e.target.value)} /></td>
                    <td>
                      <select value={row.unit} onChange={e => updateRow(i, 'unit', e.target.value)}>
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>
                    <td><input type="number" value={row.price} onChange={e => updateRow(i, 'price', e.target.value)} /></td>
                    <td><input type="number" value={row.discountPercent} onChange={e => updateRow(i, 'discountPercent', e.target.value)} /></td>
                    <td style={{ textAlign: 'right' }}>{calc.discountAmount.toFixed(2)}</td>
                    <td>
                      <select value={row.taxRate} onChange={e => updateRow(i, 'taxRate', e.target.value)}>
                        {TAX_RATES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td style={{ textAlign: 'right' }}>{calc.amount.toFixed(2)}</td>
                    <td><button className="icon-btn" onClick={() => removeRow(i)}>✕</button></td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}><button className="link-btn" onClick={addRow}>+ Add row</button></td>
                <td style={{ fontWeight: 600 }}>{totals.qty}</td>
                <td colSpan={3}></td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{totals.discount.toFixed(2)}</td>
                <td></td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{totals.amount.toFixed(2)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mobile-cards-wrapper">
          {rows.filter(r => r.item.trim()).length > 0 && (
            <div className="billed-items-banner"><span>✓ Billed Items</span></div>
          )}
          
          {rows.map((row, i) => {
            if (!row.item.trim()) return null;
            const calc = rowCalc(row);
            return (
              <div className="billed-item-card" key={i}>
                <div className="card-row-top">
                  <span className="item-tag">#{i + 1}</span>
                  <span className="item-title">{row.item}</span>
                  <span className="item-price">₹ {calc.amount.toFixed(2)}</span>
                </div>
                {row.itemDescription && (
                  <div className="card-row-desc" style={{ fontSize: '0.85rem', color: '#666', marginTop: '2px', marginBottom: '8px' }}>
                    {row.itemDescription}
                  </div>
                )}
                <div className="card-row-sub">
                  <span>{row.qty} x ₹{row.price}</span>
                  <button className="icon-btn" onClick={() => removeRow(i)}>🗑️ Remove</button>
                </div>
              </div>
            );
          })}
          
          <button className="add-item-solid-btn" onClick={() => setShowMobileAddItem(true)}>
            + Add Items
          </button>

          <div className="items-summary-grid">
            <div>Total Disc: ₹ {totals.discount.toFixed(2)}</div>
            <div>Total Tax: ₹ {totals.tax.toFixed(2)}</div>
            <div>Total Qty: {totals.qty}</div>
            <div>Subtotal: ₹ {totals.amount.toFixed(2)}</div>
          </div>
        </div>

        <div className="extras-row" style={{ marginTop: '20px' }}>
          <div className="extras-left">
            <button className="extra-btn" onClick={() => setShowTerms(!showTerms)}>📄 Add terms</button>
            <button className="extra-btn" onClick={() => setShowDescription(!showDescription)}>📝 Add desc</button>
          </div>

          <div className="total-controls">
            <label className="roundoff-toggle">
              <input type="checkbox" checked={roundOff} onChange={e => setRoundOff(e.target.checked)} />
              Round off
            </label>
            <input type="text" className="roundoff-input" value={displayedRoundOff.toFixed(2)} readOnly />
            <span className="meta-label">Total</span>
            <input type="text" className="total-input" value={finalTotal.toFixed(2)} readOnly />
          </div>
        </div>

        {showTerms && (
          <div className="form-group extras-panel">
            <label>Terms &amp; conditions</label>
            <textarea rows={3} value={terms} onChange={e => setTerms(e.target.value)} />
          </div>
        )}

        {showDescription && (
          <div className="form-group extras-panel">
            <label>Description</label>
            <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
        )}

        <div className="form-footer">
          <div className="form-actions" style={{ marginLeft: 'auto' }}>
            <button className="btn btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        <datalist id="saved-items-list">
          {savedItems.map(si => <option key={si.id} value={si.name} />)}
        </datalist>
      </div>
    </div>
  );
}