import { useState, useEffect } from 'react';
import QuotationList from './components/QuotationList';
import QuotationForm from './components/QuotationForm';
import InvoiceList from './components/InvoiceList';
import InvoicePrint from './components/InvoicePrint';
import PartyList from './components/PartyList';
import ItemList from './components/Itemlist';
import BusinessSettings from './components/BusinessSettings';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import { Store } from './utils/storage';
import { supabase } from './utils/supabaseClient';
import './App.css';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊' },
  { key: 'parties', label: 'Parties', icon: '👥' },
  { key: 'items', label: 'Items', icon: '📦' },
  { key: 'quotation', label: 'Quotation', icon: '📝' },
  { key: 'invoice', label: 'Invoices', icon: '🧾' },
  { key: 'settings', label: 'Settings', icon: '⚙️' },
];

// Only the 4 most-used sections get a bottom tab on mobile
const BOTTOM_TAB_ITEMS = NAV_ITEMS.filter(item =>
  ['dashboard', 'parties', 'quotation', 'invoice'].includes(item.key)
);

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = checking, null = logged out, object = logged in
  const [activeNav, setActiveNav] = useState('quotation');
  const [view, setView] = useState('list');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Check if already logged in (persisted session)
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    // Listen for login/logout changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  function goToNav(key) {
    setActiveNav(key);
    setView('list');
    setSidebarOpen(false); // auto-close drawer after navigating
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setSidebarOpen(false);
  }

  // Handle invoice viewing for print view asynchronously
  async function handleViewInvoice(id) {
    try {
      setLoadingInvoice(true);
      setView('print');
      const invoices = await Store.getInvoices();
      const invoice = invoices.find(i => i.id === id);
      setSelectedInvoice(invoice || null);
    } catch (err) {
      console.error('Failed to load invoice for printing:', err);
    } finally {
      setLoadingInvoice(false);
    }
  }

  const activeLabel = NAV_ITEMS.find(item => item.key === activeNav)?.label || 'BizManager';

  function renderContent() {
    if (activeNav === 'quotation') {
      if (view === 'form') {
        return (
          <QuotationForm
            mode="quotation"
            onCancel={() => setView('list')}
            onSaved={() => setView('list')}
          />
        );
      }
      return (
        <QuotationList
          onCreateNew={() => setView('form')}
          onConvert={() => goToNav('invoice')}
        />
      );
    }

    if (activeNav === 'invoice') {
      if (view === 'form') {
        return (
          <QuotationForm
            mode="invoice"
            onCancel={() => setView('list')}
            onSaved={() => setView('list')}
          />
        );
      }
      if (view === 'print') {
        if (loadingInvoice) {
          return (
            <div className="page">
              <div className="empty-state">Loading invoice details...</div>
            </div>
          );
        }
        return <InvoicePrint invoice={selectedInvoice} onBack={() => setView('list')} />;
      }
      return (
        <InvoiceList
          onCreateNew={() => setView('form')}
          onView={(id) => handleViewInvoice(id)}
        />
      );
    }

    if (activeNav === 'dashboard') {
      return <Dashboard />;
    }

    if (activeNav === 'parties') {
      return <PartyList />;
    }

    if (activeNav === 'items') {
      return <ItemList />;
    }

    if (activeNav === 'settings') {
      return <BusinessSettings />;
    }

    return <div className="page"><p className="text-muted">Coming soon.</p></div>;
  }

  // Still checking session on first load
  if (session === undefined) {
    return null;
  }

  // Not logged in — show login screen only
  if (!session) {
    return <Login onLogin={setSession} />;
  }

  return (
    <div className="app">
      {/* Mobile-only top bar */}
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

      {/* Backdrop shown behind drawer on mobile */}
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
          {NAV_ITEMS.map(item => (
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

      {/* Mobile-only bottom tab bar */}
      <nav className="bottom-tab-bar">
        {BOTTOM_TAB_ITEMS.map(item => (
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