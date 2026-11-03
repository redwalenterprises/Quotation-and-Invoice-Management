import { useState, useEffect } from 'react';
import QuotationList from './components/QuotationList';
import QuotationForm from './components/QuotationForm';
import InvoiceList from './components/InvoiceList';
import InvoicePrint from './components/InvoicePrint';
import BackupRestore from './components/BackupRestore';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import { Store } from './utils/storage';
import { supabase } from './utils/supabaseClient';
import './App.css';
import { isViewer } from './utils/roles';
import Reports from './components/Reports';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊' },
  { key: 'invoice', label: 'Sales', icon: '🧾' },
  { key: 'quotation', label: 'Estimate', icon: '📝' },
  { key: 'reports', label: 'Reports', icon: '📑' },
];


export default function App() {
  const [session, setSession] = useState(undefined); 
  const [activeNav, setActiveNav] = useState('quotation');
  const [view, setView] = useState('list');
  // FIX 1: Sirf ID nahi, pura fresh data save karenge ab hum yahan
  const [printInvoiceData, setPrintInvoiceData] = useState(null); 
  const [editingId, setEditingId] = useState(null); 
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  function goToNav(key) {
    setActiveNav(key);
    setView('list');
    setEditingId(null);
    setSidebarOpen(false); 
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setSidebarOpen(false);
  }

  const readOnly = isViewer(session);
  const navItems = readOnly ? NAV_ITEMS.filter(i => i.key !== 'reports') : NAV_ITEMS;
  const activeLabel = NAV_ITEMS.find(item => item.key === activeNav)?.label || 'BizManager';

  function renderContent() {
    if (activeNav === 'quotation') {
      if (view === 'form') {
        return (
          <QuotationForm
            mode="quotation"
            editingId={editingId}
            readOnly={readOnly}
            onCancel={() => { setView('list'); setEditingId(null); }}
            onSaved={() => { setView('list'); setEditingId(null); }}
          />
        );
      }
      return (
        <QuotationList
          readOnly={readOnly}
          onCreateNew={() => { setEditingId(null); setView('form'); }}
          onEdit={(id) => { setEditingId(id); setView('form'); }}
          onConvert={() => goToNav('invoice')}
        />
      );
    }

    if (activeNav === 'invoice') {
      if (view === 'form') {
        return (
          <QuotationForm
            mode="invoice"
            editingId={editingId}
            readOnly={readOnly}
            onCancel={() => { setView('list'); setEditingId(null); }}
            onSaved={() => { setView('list'); setEditingId(null); }}
          />
        );
      }
      if (view === 'print') {
        // FIX 2: Ab directly state wala fresh data InvoicePrint ko bhejenge
        return <InvoicePrint invoice={printInvoiceData} onBack={() => setView('list')} />;
      }
      return (
        <InvoiceList
          readOnly={readOnly}
          onCreateNew={() => { setEditingId(null); setView('form'); }}
          onEdit={(id) => { setEditingId(id); setView('form'); }}
          // FIX 3: onView par click karte hi fresh data mangwayenge (async/await ka use karke)
          onView={async (id) => { 
            const freshData = await Store.getInvoice(id);
            setPrintInvoiceData(freshData); 
            setView('print'); 
          }}
        />
      );
    }

    if (activeNav === 'dashboard') {
      return <Dashboard readOnly={readOnly}/>;
    }
    
    if (activeNav === 'reports' && !readOnly) {
      return <Reports />;
    }

    return <div className="page"><p className="text-muted">Coming soon.</p></div>;
  }

  if (session === undefined) {
    return null;
  }

  if (!session) {
    return <Login onLogin={setSession} />;
  }

  return (
    <div className="app">
      <header className="mobile-topbar">
        <button
          className="hamburger-btn"
          aria-label="Open menu"
          onClick={() => setSidebarOpen(true)}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
        <span className="mobile-topbar-title">{activeLabel}</span>
      </header>

      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo-row">
          <div className="sidebar-logo">BizManager</div>
          <button
            className="sidebar-close-btn"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
          >
            ✕
          </button>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.key}
              className={`nav-item ${activeNav === item.key ? 'active' : ''}`}
              onClick={() => goToNav(item.key)}
            >
              <span className="nav-item-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
          <button className="nav-item" onClick={handleLogout} style={{ marginTop: 'auto', color: 'rgba(255,255,255,0.6)' }}>
            <span className="nav-item-icon">🚪</span>
            Logout
          </button>
        </nav>
      </aside>

      <main className="main">{renderContent()}</main>

      <nav className="bottom-tab-bar">
        {navItems.map(item => (
          <button
            key={item.key}
            className={`bottom-tab-item ${activeNav === item.key ? 'active' : ''}`}
            onClick={() => goToNav(item.key)}
          >
            <span className="bottom-tab-icon">{item.icon}</span>
            <span className="bottom-tab-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}