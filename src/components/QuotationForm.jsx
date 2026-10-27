import { useState, useEffect } from 'react';
import { Store } from '../utils/storage';
import { rowCalc } from '../utils/calculations';

const UNITS = ['NONE', 'PCS', 'KG', 'BOX', 'LTR', 'MTR'];
const TAX_RATES = ['NONE', 'GST@18%'];

function emptyRow() {
  return {
    item: '', itemDescription: '', qty: '', unit: 'NONE', price: '',
    discountPercent: '', discountAmount: '',
    taxRate: 'NONE',
  };
}

export default function QuotationForm({ onSaved, onCancel, mode = 'quotation', editingId = null, readOnly = false }) {
  // === Async Data States ===
  const [savedItems, setSavedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // === Original States ===
  const [partyName, setPartyName] = useState('');
  const [phoneNo, setPhoneNo] = useState('');
  const [isCash, setIsCash] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [stateOfSupply, setStateOfSupply] = useState('');
  const [refNo, setRefNo] = useState('');
  const [rows, setRows] = useState([emptyRow(), emptyRow()]);
  const [showTerms, setShowTerms] = useState(true);
  const [terms, setTerms] = useState(
    `1. Advance Payment: All advance payments made for salon chairs are non-refundable. By making an advance payment, the buyer acknowledges and agrees to this condition.
2. Sale Finality: Once sold, goods will not be taken back or exchanged. The buyer confirms their purchase based on personal judgment and any information provided by the seller.
3. Warranty & Guarantee: Salon chairs are sold "as is", with no warranty or guarantee, expressed or implied. The seller is not responsible for any future performance issues, maintenance, or defects.
4. Product Inspection: The buyer agrees to inspect the salon chairs at the time of purchase or delivery. Any defects or discrepancies must be reported immediately. Failure to do so waives any claims against the seller.
5. Service Location: All servicing and repairs are done only at our factory. No home service available.
6. Governing Law: These terms and conditions are governed by the laws of Maharashtra, India. Any disputes will fall under the exclusive jurisdiction of Maharashtra courts.
7. Discount Policy: Any discount applied to the purchase will result in the exclusion of warranty and guarantee provisions.
8. Order Collection & Payment: If an order is not collected within 30 days, full payment must be made. A 1-month extension may be granted to complete the previous order, subject to adjusted pricing at current rates.
9. Hydraulic Pump Replacement: We offer a one-time hydraulic pump replacement within 2 years for ₹1800. Applicable only for manufacturing defects under normal use. Original invoice is required. Exclusions: Damage due to misuse, accidental breakage, unauthorized repairs, or external factors.
10. Service Policy: All servicing and repairs will be conducted exclusively at our factory. No on-site or home service is provided.`
  );
  const [showDescription, setShowDescription] = useState(false);
  const [description, setDescription] = useState('');
  const [roundOff, setRoundOff] = useState(true);
  const [recordReceived, setRecordReceived] = useState(false);
  const [receivedAmount, setReceivedAmount] = useState('');

  // === Mobile "Add Item" Modal States ===
  const [showMobileAddItem, setShowMobileAddItem] = useState(false);
  const [mItemName, setMItemName] = useState('');
  const [mItemDescription, setMItemDescription] = useState(''); 
  const [mQty, setMQty] = useState('');
  const [mRate, setMRate] = useState('');
  const [mDiscountPercent, setMDiscountPercent] = useState('');
  const [mDiscountAmount, setMDiscountAmount] = useState('');
  const [mTaxRate, setMTaxRate] = useState('NONE');
  const [mUnit, setMUnit] = useState('PCS');

  const isEditing = Boolean(editingId);
  const entityLabel = mode === 'invoice' ? 'Sale' : 'Estimate';

  // === Fetch Initial Data ===
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [items, quotations] = await Promise.all([
          Store.getItems(),
          Store.getQuotations()
        ]);

        setSavedItems(items || []);

        if (editingId) {
          const existing = mode === 'invoice'
            ? await Store.getInvoice(editingId)
            : await Store.getQuotation(editingId);

          if (existing) {
            setPartyName(existing.partyName || '');
            setDate(existing.date || new Date().toISOString().slice(0, 10));
            setStateOfSupply(existing.stateOfSupply || '');
            setRefNo(mode === 'invoice' ? existing.invoiceNo : existing.refNo);
            setPhoneNo(existing.partyPhone || '');
            if (mode === 'invoice') setIsCash((existing.paymentType || 'Cash') === 'Cash');
            setTerms(existing.terms || '');
            setDescription(existing.description || '');
            setShowTerms(Boolean(existing.terms));
            setShowDescription(Boolean(existing.description));
            setRows(
              existing.items && existing.items.length > 0
                ? existing.items
                : [emptyRow(), emptyRow()]
            );
            if (mode === 'invoice' && Number(existing.paidAmount) > 0) {
              setRecordReceived(true);
              setReceivedAmount(existing.paidAmount);
            }
          }
        } else {
          if (mode === 'invoice') {
            setRefNo('');
          } else {
            const maxQuo = quotations.reduce((m, q) => Math.max(m, Number(q.refNo) || 0), 0);
            setRefNo(maxQuo + 1);
          }
        }
      } catch (error) {
        console.error('Error loading form data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [mode, editingId]);

  // === Original Logic & Calculations ===
  function updateRow(index, field, value) {
    updateRowFields(index, { [field]: value });
  }

  function updateRowFields(index, updates) {
    const next = [...rows];
    next[index] = { ...next[index], ...updates };

    if (updates.item !== undefined) {
      const match = savedItems.find(si => si.name.toLowerCase() === updates.item.toLowerCase());
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
  const receivedValue = recordReceived ? (Number(receivedAmount) || 0) : 0;
  const balanceValue = finalTotal - receivedValue;

  // === Async Form Save ===
  async function handleSave() {
    if (readOnly) return;
    if (!partyName.trim()) return;
    if (mode === 'invoice') {
      const no = Number(String(refNo).trim());
      if (!String(refNo).trim() || !Number.isFinite(no) || no <= 0) {
        alert('Invoice number daalna zaroori hai (sirf number).');
        return;
      }
    }
    
    try {
      setSaving(true);
      const data = {
        partyName: partyName.trim(),
        partyPhone: phoneNo.trim(),
        date,
        stateOfSupply,
        items: rows.filter(r => r.item.trim()),
        terms,
        description,
        total: finalTotal,
      };

      if (isEditing) data.id = editingId;

      let saved;
      if (mode === 'invoice') {
        data.paymentType = isCash ? 'Cash' : 'Credit';
        data.paidAmount = receivedValue;
        data.paymentStatus = receivedValue >= finalTotal && finalTotal > 0
          ? 'Paid'
          : receivedValue > 0
            ? 'Partial'
            : 'Unpaid';
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
      discountPercent: mDiscountAmount ? '' : mDiscountPercent,
      discountAmount: mDiscountAmount || '',
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

    setMItemName(''); setMItemDescription(''); setMQty(''); setMRate('');
    setMDiscountPercent(''); setMDiscountAmount(''); setMTaxRate('NONE'); setMUnit('PCS');
    
    if (!isNew) setShowMobileAddItem(false);
  }

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
  if (showMobileAddItem && !readOnly) {
    return (
      <div className="mobile-add-item-screen">
        <div className="mobile-header">
          <button className="back-btn" onClick={() => setShowMobileAddItem(false)}>←</button>
          <h3>Add Items to {entityLabel}</h3>
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
                value={mDiscountPercent}
                onChange={e => { setMDiscountPercent(e.target.value); if (e.target.value) setMDiscountAmount(''); }}
              />
              <label>Discount %</label>
            </div>

            <div className="floating-input-group" style={{ flex: 1 }}>
              <input
                type="number" placeholder=" "
                value={mDiscountAmount}
                onChange={e => { setMDiscountAmount(e.target.value); if (e.target.value) setMDiscountPercent(''); }}
              />
              <label>Discount ₹</label>
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
      {/* DESKTOP TOP BAR */}
      <div className="billing-top-bar">
        <h2 className="billing-title">
          {readOnly ? `View ${entityLabel}` : isEditing ? `Edit ${entityLabel}` : entityLabel}
        </h2>
        <div className="payment-toggle">
          <span style={{ color: !isCash ? '#1976d2' : '#666' }}>Credit</span>
          <label className="toggle-switch">
            <input type="checkbox" checked={isCash} onChange={e => setIsCash(e.target.checked)} disabled={readOnly} />
            <span className="slider"></span>
          </label>
          <span style={{ color: isCash ? '#1976d2' : '#666' }}>Cash</span>
        </div>
      </div>

      <div className="card">
        {/* ===== FIELDSET START: readOnly hone par andar ka sab disable ===== */}
        <fieldset disabled={readOnly} className="ro-fieldset">

        {/* DESKTOP HEADER BLOCK */}
        <div className="details-box">
          <div className="party-inputs-group">
            <input
              type="text"
              className="compact-input-field"
              placeholder="Search by Name/Phone *"
              list="saved-items-party-list"
              value={partyName}
              onChange={e => setPartyName(e.target.value)}
            />
            <input
              type="text"
              className="compact-input-field"
              placeholder="Phone No."
              value={phoneNo}
              onChange={e => setPhoneNo(e.target.value)}
            />
          </div>
          

          <div className="invoice-meta-group">
            <div className="meta-inline-row">
              <label>{mode === 'invoice' ? 'Invoice Number' : 'Ref Number'}</label>
              <input
                type="text"
                inputMode={mode === 'invoice' ? 'numeric' : 'text'}
                placeholder={mode === 'invoice' ? 'Invoice no. daalo' : ''}
                value={refNo}
                onChange={e => setRefNo(e.target.value)}
              />
            </div>
            <div className="meta-inline-row">
              <label>Invoice Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="meta-inline-row">
              <label>State of supply</label>
              <select value={stateOfSupply} onChange={e => setStateOfSupply(e.target.value)}>
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

        {/* DESKTOP ZERO-GAP SPREADSHEET TABLE */}
        <div className="desktop-table-wrapper">
          <table className="spreadsheet-grid-table">
            <thead>
              <tr>
                <th style={{ width: '30px' }} className="col-center">#</th>
                <th>ITEM</th>
                <th style={{ width: '70px' }} className="col-center">QTY</th>
                <th style={{ width: '90px' }}>UNIT</th>
                <th style={{ width: '110px' }} className="col-right">PRICE/UNIT</th>
                <th style={{ width: '90px' }} className="col-right">DISC %</th>
                <th style={{ width: '100px' }} className="col-right">DISC ₹</th>
                <th style={{ width: '120px' }}>TAX</th>
                <th style={{ width: '100px' }} className="col-right">AMOUNT</th>
                <th style={{ width: '30px' }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const calc = rowCalc(row);
                return (
                  <tr key={i}>
                    <td className="col-center" style={{ color: '#888' }}>{i + 1}</td>
                    <td>
                      <input
                        type="text"
                        list="saved-items-list"
                        placeholder="Item name"
                        value={row.item}
                        onChange={e => updateRow(i, 'item', e.target.value)}
                        style={{ fontWeight: 600 }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="col-center"
                        value={row.qty}
                        onChange={e => updateRow(i, 'qty', e.target.value)}
                      />
                    </td>
                    <td>
                      <select value={row.unit} onChange={e => updateRow(i, 'unit', e.target.value)}>
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        className="col-right"
                        value={row.price}
                        onChange={e => updateRow(i, 'price', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="col-right"
                        placeholder="%"
                        value={row.discountPercent}
                        onChange={e => updateRowFields(i, { discountPercent: e.target.value, discountAmount: e.target.value ? '' : row.discountAmount })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="col-right"
                        placeholder="₹"
                        value={row.discountAmount}
                        onChange={e => updateRowFields(i, { discountAmount: e.target.value, discountPercent: e.target.value ? '' : row.discountPercent })}
                      />
                    </td>
                    <td>
                      <select value={row.taxRate} onChange={e => updateRow(i, 'taxRate', e.target.value)}>
                        {TAX_RATES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="col-right" style={{ fontWeight: 700 }}>
                      {calc.amount.toFixed(2)}
                    </td>
                    <td className="col-center">
                      {!readOnly && (
                        <button
                          onClick={() => removeRow(i)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#999' }}
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="table-footer-row">
                <td colSpan={2}>
                  {!readOnly && (
                    <button className="btn-add-row-blue" onClick={addRow}>
                      ADD ROW
                    </button>
                  )}
                </td>
                <td className="col-center">{totals.qty || ''}</td>
                <td></td>
                <td></td>
                <td className="col-right">{totals.discount > 0 ? totals.discount.toFixed(2) : '0'}</td>
                <td className="col-right">{totals.tax > 0 ? totals.tax.toFixed(2) : ''}</td>
                <td className="col-right">{finalTotal.toFixed(2)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ORIGINAL MOBILE CARDS WRAPPER */}
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
                  {!readOnly && (
                    <button className="icon-btn" onClick={() => removeRow(i)}>🗑️ Remove</button>
                  )}
                </div>
              </div>
            );
          })}
          
          {!readOnly && (
            <button className="add-item-solid-btn" onClick={() => setShowMobileAddItem(true)}>
              + Add Items
            </button>
          )}

          <div className="items-summary-grid">
            <div>Total Disc: ₹ {totals.discount.toFixed(2)}</div>
            <div>Total Tax: ₹ {totals.tax.toFixed(2)}</div>
            <div>Total Qty: {totals.qty}</div>
            <div>Subtotal: ₹ {totals.amount.toFixed(2)}</div>
          </div>
        </div>

        {/* EXTRAS & FOOTER */}
        <div className="extras-row" style={{ marginTop: '20px' }}>
          <div className="extras-left">
            {!readOnly && (
              <>
                <button className="extra-btn" onClick={() => setShowTerms(!showTerms)}>📄 Add terms</button>
                <button className="extra-btn" onClick={() => setShowDescription(!showDescription)}>📝 Add desc</button>
              </>
            )}
          </div>

          <div className="total-controls total-controls-stacked">
            <div className="total-controls-row">
              <label className="roundoff-toggle">
                <input type="checkbox" checked={roundOff} onChange={e => setRoundOff(e.target.checked)} />
                Round off
              </label>
              <input type="text" className="roundoff-input" value={displayedRoundOff.toFixed(2)} readOnly />
              <span className="meta-label">Total</span>
              <input type="text" className="total-input" value={finalTotal.toFixed(2)} readOnly />
            </div>

            {mode === 'invoice' && (
              <>
                <div className="total-controls-row">
                  <label className="roundoff-toggle">
                    <input
                      type="checkbox"
                      checked={recordReceived}
                      onChange={e => setRecordReceived(e.target.checked)}
                    />
                    Received
                  </label>
                  <input
                    type="number"
                    className="total-input"
                    value={receivedAmount}
                    onChange={e => setReceivedAmount(e.target.value)}
                    disabled={!recordReceived}
                    placeholder="0.00"
                  />
                </div>

                <div className="total-controls-row">
                  <span className="meta-label" style={{ fontWeight: 700 }}>Balance</span>
                  <input
                    type="text"
                    className="total-input"
                    value={balanceValue.toFixed(2)}
                    readOnly
                    style={{ fontWeight: 700 }}
                  />
                </div>
              </>
            )}
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

        </fieldset>
        {/* ===== FIELDSET END ===== */}

        <div className="form-footer">
          <div className="form-actions" style={{ marginLeft: 'auto' }}>
            <button className="btn btn-secondary" onClick={onCancel} disabled={saving}>
              {readOnly ? 'Back' : 'Cancel'}
            </button>
            {!readOnly && (
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            )}
          </div>
        </div>

        <datalist id="saved-items-list">
          {savedItems.map(si => <option key={si.id} value={si.name} />)}
        </datalist>
      </div>
    </div>
  );
}