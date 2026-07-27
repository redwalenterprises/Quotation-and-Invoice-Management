import { useState, useEffect } from 'react';
import { Store } from '../utils/storage';

const GST_TYPES = ['Unregistered/Consumer', 'Registered Business - Regular', 'Registered Business - Composition'];
const STATES = ['Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Uttar Pradesh', 'Gujarat'];
const TABS = ['GST & Address', 'Credit & Balance', 'Additional Fields'];

function emptyParty() {
  return {
    name: '', gstin: '', phone: '',
    gstType: 'Unregistered/Consumer', state: '', email: '',
    billingAddress: '', shippingAddress: '', enableShipping: false,
    openingBalance: '', creditLimit: '',
  };
}

function formatCurrency(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

export default function PartyList() {
  const [parties, setParties] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [balances, setBalances] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyParty());
  const [activeTab, setActiveTab] = useState('GST & Address');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load parties, invoices and balances from Supabase
  async function loadData(selectId = null) {
    try {
      setLoading(true);
      const [allParties, allInvoices] = await Promise.all([
        Store.getParties(),
        Store.getInvoices()
      ]);

      const safeParties = allParties || [];
      setParties(safeParties);
      setInvoices(allInvoices || []);

      // Calculate balances for each party asynchronously
      const balanceMap = {};
      await Promise.all(
        safeParties.map(async (p) => {
          balanceMap[p.id] = await Store.getPartyBalance(p.name);
        })
      );
      setBalances(balanceMap);

      if (selectId) {
        setSelectedId(selectId);
      } else if (safeParties.length > 0 && !selectedId) {
        setSelectedId(safeParties[0].id);
      }
    } catch (error) {
      console.error("Error fetching party data:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function openAdd() {
    setForm(emptyParty());
    setEditing(null);
    setActiveTab('GST & Address');
    setShowModal(true);
  }

  function openEdit(party) {
    setForm({ ...emptyParty(), ...party });
    setEditing(party.id);
    setActiveTab('GST & Address');
    setShowModal(true);
  }

  async function handleSave(andNew) {
    if (!form.name.trim()) return;
    try {
      setSaving(true);
      const saved = await Store.saveParty({ ...form, id: editing });
      
      await loadData(saved?.id || selectedId);

      if (andNew) {
        setForm(emptyParty());
        setEditing(null);
      } else {
        setShowModal(false);
      }
    } catch (error) {
      alert("Party save karne me error aaya: " + error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (window.confirm("Kya aap sach me is party ko delete karna chahte hain?")) {
      try {
        setLoading(true);
        await Store.deleteParty(id);
        if (selectedId === id) setSelectedId(null);
        await loadData();
      } catch (error) {
        alert("Delete karne me error aaya: " + error.message);
        setLoading(false);
      }
    }
  }

  const filteredParties = parties.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );
  
  const selectedParty = parties.find(p => p.id === selectedId);
  
  const transactions = selectedParty
    ? invoices.filter(i => i.partyName === selectedParty.name)
    : [];

  return (
    <div className="party-page">
      <div className="party-page-header">
        <h2>Parties</h2>
        <button className="btn btn-primary" onClick={openAdd}>+ Add party</button>
      </div>

      {loading ? (
        <div className="empty-state" style={{ padding: 40 }}>Loading parties...</div>
      ) : (
        <div className="party-split">
          <div className="party-sidebar">
            <input
              type="text"
              className="party-search"
              placeholder="Search party name"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div className="party-sidebar-header">
              <span>Party name</span>
              <span>Balance</span>
            </div>
            {filteredParties.length === 0 ? (
              <div className="empty-state" style={{ padding: 24 }}>No parties found.</div>
            ) : (
              filteredParties.map(p => (
                <div
                  key={p.id}
                  className={`party-sidebar-row ${selectedId === p.id ? 'active' : ''}`}
                  onClick={() => setSelectedId(p.id)}
                >
                  <span>{p.name}</span>
                  <span>{formatCurrency(balances[p.id] || 0)}</span>
                </div>
              ))
            )}
          </div>

          <div className="party-detail">
            {!selectedParty ? (
              <div className="empty-state">No party selected. Add a party to get started.</div>
            ) : (
              <>
                <div className="party-detail-header">
                  <div>
                    <h3>
                      {selectedParty.name}
                      <button className="icon-btn" onClick={() => openEdit(selectedParty)} title="Edit">✎</button>
                      <button className="icon-btn" onClick={() => handleDelete(selectedParty.id)} title="Delete" style={{ color: 'red', marginLeft: '8px' }}>🗑</button>
                    </h3>
                    {selectedParty.phone && (
                      <>
                        <p className="party-detail-label">Phone number</p>
                        <p>{selectedParty.phone}</p>
                      </>
                    )}
                  </div>
                </div>

                <div className="card">
                  <div className="section-header"><h3>Transactions</h3></div>
                  {transactions.length === 0 ? (
                    <div className="empty-state">No transactions yet for this party.</div>
                  ) : (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Type</th>
                            <th>Number</th>
                            <th>Date</th>
                            <th style={{ textAlign: 'right' }}>Total</th>
                            <th style={{ textAlign: 'right' }}>Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transactions.map(t => (
                            <tr key={t.id}>
                              <td>Sale</td>
                              <td>{t.invoiceNo}</td>
                              <td>{t.date}</td>
                              <td style={{ textAlign: 'right' }}>{formatCurrency(t.total)}</td>
                              <td style={{ textAlign: 'right' }}>
                                {formatCurrency(Number(t.total || 0) - Number(t.paidAmount || 0))}
                              </td>
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
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing ? 'Edit Party' : 'Add Party'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)} disabled={saving}>✕</button>
            </div>

            <div className="modal-top-row">
              <div className="form-group floating-group">
                <label>Party Name <span className="required">*</span></label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  autoFocus
                  disabled={saving}
                />
              </div>
              <input
                type="text"
                placeholder="GSTIN"
                className="modal-inline-input"
                value={form.gstin}
                onChange={e => setForm({ ...form, gstin: e.target.value })}
                disabled={saving}
              />
              <input
                type="text"
                placeholder="Phone Number"
                className="modal-inline-input"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                disabled={saving}
              />
            </div>

            <div className="modal-tabs">
              {TABS.map(tab => (
                <button
                  key={tab}
                  className={`modal-tab ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                  {tab === 'Credit & Balance' && <span className="new-badge">New</span>}
                </button>
              ))}
            </div>

            {activeTab === 'GST & Address' && (
              <div className="modal-tab-content modal-gst-address">
                <div className="modal-col">
                  <select
                    value={form.gstType}
                    onChange={e => setForm({ ...form, gstType: e.target.value })}
                    disabled={saving}
                  >
                    {GST_TYPES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <select
                    value={form.state}
                    onChange={e => setForm({ ...form, state: e.target.value })}
                    disabled={saving}
                  >
                    <option value="">State</option>
                    {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <input
                    type="email"
                    placeholder="Email ID"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    disabled={saving}
                  />
                </div>

                <div className="modal-col">
                  <p className="modal-col-label">Billing Address</p>
                  <textarea
                    rows={4}
                    placeholder="Billing Address"
                    value={form.billingAddress}
                    onChange={e => setForm({ ...form, billingAddress: e.target.value })}
                    disabled={saving}
                  />
                </div>

                <div className="modal-col">
                  <p className="modal-col-label">Shipping Address</p>
                  {form.enableShipping ? (
                    <textarea
                      rows={4}
                      placeholder="Shipping Address"
                      value={form.shippingAddress}
                      onChange={e => setForm({ ...form, shippingAddress: e.target.value })}
                      disabled={saving}
                    />
                  ) : (
                    <button
                      className="link-btn"
                      onClick={() => setForm({ ...form, enableShipping: true })}
                      disabled={saving}
                    >
                      + Enable Shipping Address
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'Credit & Balance' && (
              <div className="modal-tab-content">
                <div className="form-group">
                  <label>Opening balance</label>
                  <input
                    type="number"
                    value={form.openingBalance}
                    onChange={e => setForm({ ...form, openingBalance: e.target.value })}
                    disabled={saving}
                  />
                </div>
                <div className="form-group">
                  <label>Credit limit</label>
                  <input
                    type="number"
                    value={form.creditLimit}
                    onChange={e => setForm({ ...form, creditLimit: e.target.value })}
                    disabled={saving}
                  />
                </div>
              </div>
            )}

            {activeTab === 'Additional Fields' && (
              <div className="modal-tab-content">
                <p className="text-muted" style={{ fontSize: 13 }}>No additional fields yet.</p>
              </div>
            )}

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
              <button className="btn btn-secondary" onClick={() => handleSave(true)} disabled={saving}>
                {saving ? 'Saving...' : 'Save & New'}
              </button>
              <button className="btn btn-primary" onClick={() => handleSave(false)} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}