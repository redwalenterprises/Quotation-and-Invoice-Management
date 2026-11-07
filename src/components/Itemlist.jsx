import { useState, useEffect } from 'react';
import { Store } from '../utils/storage';

const UNITS = ['NONE', 'PCS', 'KG', 'BOX', 'LTR', 'MTR'];
const TAX_RATES = ['NONE', 'GST 5%', 'GST 12%', 'GST 18%', 'GST 28%'];

function emptyItem() {
  return {
    name: '', type: 'Product', category: '', itemCode: '',
    price: '', priceType: 'Without Tax', discountOnSale: '', discountType: 'Percentage',
    purchasePrice: '', purchasePriceType: 'Without Tax',
    unit: 'NONE', taxRate: 'NONE', hsn: '', stock: '',
  };
}

function formatCurrency(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

export default function ItemList() {
  const [items, setItems] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyItem());
  const [modalTab, setModalTab] = useState('Pricing');
  const [loading, setLoading] = useState(true);

  // Load items and invoices asynchronously
  const loadData = async () => {
    setLoading(true);
    try {
      const allItems = (await Store.getItems()) || [];
      const allInvoices = (await Store.getInvoices()) || [];
      setItems(allItems);
      setInvoices(allInvoices);
      if (allItems.length > 0 && !selectedId) {
        setSelectedId(allItems[0].id);
      }
    } catch (err) {
      console.error('Error fetching items data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  function openAdd() {
    setForm(emptyItem());
    setEditing(null);
    setShowModal(true);
  }

  function openEdit(item) {
    setForm(item);
    setEditing(item.id);
    setShowModal(true);
  }

  async function handleSave(keepOpen = false) {
    if (!form.name.trim()) return;
    
    try {
      const saved = await Store.saveItem({ ...form, id: editing });
      await loadData();
      
      if (saved && saved.id) {
        setSelectedId(saved.id);
      }

      if (keepOpen) {
        setForm(emptyItem());
        setEditing(null);
      } else {
        setShowModal(false);
      }
    } catch (err) {
      console.error('Error saving item:', err);
      alert('Failed to save item. Please try again.');
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Are you sure you want to delete this item?')) return;

    try {
      await Store.deleteItem(id);
      const updatedList = items.filter(i => i.id !== id);
      setItems(updatedList);
      setSelectedId(updatedList.length > 0 ? updatedList[0].id : null);
    } catch (err) {
      console.error('Error deleting item:', err);
      alert('Failed to delete item.');
    }
  }

  const filteredItems = items.filter(i =>
    (i.name || '').toLowerCase().includes(search.toLowerCase())
  );
  const selectedItem = items.find(i => i.id === selectedId);

  const transactions = selectedItem
    ? invoices
        .filter(inv => (inv.items || []).some(row => row.item === selectedItem.name))
        .map(inv => {
          const row = inv.items.find(r => r.item === selectedItem.name);
          return { ...inv, rowQty: row.qty, rowPrice: row.price };
        })
    : [];

  const stockQty = Number(selectedItem?.stock || 0);
  const stockValue = stockQty * Number(selectedItem?.price || 0);

  return (
    <div className="party-page">
      <div className="party-page-header">
        <h2>Items</h2>
        <button className="btn btn-primary" onClick={openAdd}>+ Add item</button>
      </div>

      <div className="party-split">
        <div className="party-sidebar">
          <input
            type="text"
            className="party-search"
            placeholder="Search item name"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="party-sidebar-header">
            <span>Item</span>
            <span>Stock</span>
          </div>

          {loading ? (
            <div className="empty-state" style={{ padding: 24 }}>Loading items...</div>
          ) : filteredItems.length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}>No items found.</div>
          ) : (
            filteredItems.map(item => (
              <div
                key={item.id}
                className={`party-sidebar-row ${selectedId === item.id ? 'active' : ''}`}
                onClick={() => setSelectedId(item.id)}
              >
                <span>{item.name}</span>
                <span style={{ color: Number(item.stock) < 0 ? 'var(--danger, #EB5757)' : 'var(--success)' }}>
                  {item.stock || 0}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="party-detail">
          {!selectedItem ? (
            <div className="empty-state">No item selected. Add an item to get started.</div>
          ) : (
            <>
              <div className="item-detail-header">
                <div>
                  <h3>
                    {selectedItem.name}
                    <button className="icon-btn" onClick={() => openEdit(selectedItem)} title="Edit">✎</button>
                  </h3>
                  <p className="party-detail-label">
                    Sale price: <strong>{formatCurrency(selectedItem.price)}</strong>
                    {selectedItem.taxRate && selectedItem.taxRate !== 'NONE' && ` (+ ${selectedItem.taxRate})`}
                  </p>
                </div>
                <div className="item-stock-info">
                  <p>Stock quantity: <strong style={{ color: stockQty < 0 ? 'var(--danger, #EB5757)' : 'inherit' }}>{stockQty}</strong></p>
                  <p>Stock value: <strong>{formatCurrency(stockValue)}</strong></p>
                </div>
              </div>

              <div className="card">
                <div className="section-header"><h3>Transactions</h3></div>
                {transactions.length === 0 ? (
                  <div className="empty-state">No sales recorded for this item yet.</div>
                ) : (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Invoice no.</th>
                          <th>Party</th>
                          <th>Date</th>
                          <th style={{ textAlign: 'right' }}>Quantity</th>
                          <th style={{ textAlign: 'right' }}>Price/unit</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map(t => (
                          <tr key={t.id}>
                            <td>Sale</td>
                            <td>{t.invoiceNo || t.invoiceNumber || t.refNo}</td>
                            <td>{t.partyName || 'Cash Client'}</td>
                            <td>{t.date}</td>
                            <td style={{ textAlign: 'right' }}>{t.rowQty}</td>
                            <td style={{ textAlign: 'right' }}>{formatCurrency(t.rowPrice)}</td>
                            <td>{t.paymentStatus || 'Paid'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box item-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <h3>{editing ? 'Edit Item' : 'Add Item'}</h3>
                <div className="type-toggle">
                  <span className={form.type === 'Product' ? 'active' : ''}>Product</span>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={form.type === 'Service'}
                      onChange={e => setForm({ ...form, type: e.target.checked ? 'Service' : 'Product' })}
                    />
                    <span className="toggle-slider" />
                  </label>
                  <span className={form.type === 'Service' ? 'active' : ''}>Service</span>
                </div>
              </div>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div className="item-modal-top-row">
              <div className="form-group floating-group" style={{ flex: 1 }}>
                <label>Item Name <span className="required">*</span></label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  autoFocus
                />
              </div>
              <input
                type="text"
                placeholder="Item HSN"
                className="modal-inline-input"
                value={form.hsn}
                onChange={e => setForm({ ...form, hsn: e.target.value })}
              />
              <select
                className="unit-select-btn"
                value={form.unit}
                onChange={e => setForm({ ...form, unit: e.target.value })}
              >
                {UNITS.map(u => <option key={u} value={u}>{u === 'NONE' ? 'Select Unit' : u}</option>)}
              </select>
            </div>

            <div className="item-modal-top-row">
              <select
                className="modal-inline-input"
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
              >
                <option value="">Category</option>
                <option>General</option>
              </select>
              <input
                type="text"
                placeholder="Item Code"
                className="modal-inline-input"
                value={form.itemCode}
                onChange={e => setForm({ ...form, itemCode: e.target.value })}
              />
            </div>

            <div className="modal-tabs">
              <button className={`modal-tab ${modalTab === 'Pricing' ? 'active' : ''}`} onClick={() => setModalTab('Pricing')}>Pricing</button>
              <button className={`modal-tab ${modalTab === 'Stock' ? 'active' : ''}`} onClick={() => setModalTab('Stock')}>Stock</button>
            </div>

            {modalTab === 'Pricing' && (
              <>
                <div className="item-section">
                  <p className="item-section-title">Sale Price</p>
                  <div className="item-section-row">
                    <div className="combo-input">
                      <input
                        type="number"
                        placeholder="Sale Price"
                        value={form.price}
                        onChange={e => setForm({ ...form, price: e.target.value })}
                      />
                      <select value={form.priceType} onChange={e => setForm({ ...form, priceType: e.target.value })}>
                        <option>Without Tax</option>
                        <option>With Tax</option>
                      </select>
                    </div>
                    <div className="combo-input">
                      <input
                        type="number"
                        placeholder="Disc. on sale price"
                        value={form.discountOnSale}
                        onChange={e => setForm({ ...form, discountOnSale: e.target.value })}
                      />
                      <select value={form.discountType} onChange={e => setForm({ ...form, discountType: e.target.value })}>
                        <option>Percentage</option>
                        <option>Amount</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="item-section-pair">
                  <div className="item-section">
                    <p className="item-section-title">Purchase Price</p>
                    <div className="combo-input">
                      <input
                        type="number"
                        placeholder="Purchase Price"
                        value={form.purchasePrice}
                        onChange={e => setForm({ ...form, purchasePrice: e.target.value })}
                      />
                      <select value={form.purchasePriceType} onChange={e => setForm({ ...form, purchasePriceType: e.target.value })}>
                        <option>Without Tax</option>
                        <option>With Tax</option>
                      </select>
                    </div>
                  </div>

                  <div className="item-section">
                    <p className="item-section-title">Taxes</p>
                    <div className="form-group floating-group" style={{ height: 44 }}>
                      <label>Tax Rate</label>
                      <select
                        style={{ border: 'none' }}
                        value={form.taxRate}
                        onChange={e => setForm({ ...form, taxRate: e.target.value })}
                      >
                        {TAX_RATES.map(t => <option key={t} value={t}>{t === 'NONE' ? 'None' : t}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </>
            )}

            {modalTab === 'Stock' && (
              <div className="item-section">
                <p className="item-section-title">Opening Stock</p>
                <div className="combo-input" style={{ maxWidth: 220 }}>
                  <input
                    type="number"
                    placeholder="Quantity"
                    value={form.stock}
                    onChange={e => setForm({ ...form, stock: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="modal-footer">
              {editing && (
                <button
                  className="btn btn-secondary"
                  style={{ marginRight: 'auto' }}
                  onClick={() => { handleDelete(editing); setShowModal(false); }}
                >
                  Delete
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-secondary" onClick={() => handleSave(true)}>Save &amp; New</button>
              <button className="btn btn-primary" onClick={() => handleSave(false)}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}