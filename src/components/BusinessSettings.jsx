import { useState, useEffect } from 'react';
import { Store } from '../utils/storage';

export default function BusinessSettings() {
  const [settings, setSettings] = useState({ name: '', phone: '', logo: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Fetch initial business settings from Supabase
  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        const data = await Store.getBusinessSettings();
        if (data) {
          setSettings({
            name: data.name || '',
            phone: data.phone || '',
            logo: data.logo || '',
          });
        }
      } catch (error) {
        console.error('Error fetching business settings:', error);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setSettings(s => ({ ...s, logo: reader.result }));
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    try {
      setSaving(true);
      await Store.saveBusinessSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Error saving business settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="empty-state">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Business Settings</h2>
      </div>

      <div className="card" style={{ maxWidth: 480 }}>
        <div className="form-group">
          <label>Business name</label>
          <input
            type="text"
            value={settings.name}
            onChange={e => setSettings({ ...settings, name: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label>Phone number</label>
          <input
            type="text"
            value={settings.phone}
            onChange={e => setSettings({ ...settings, phone: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label>Logo</label>
          {settings.logo && (
            <img src={settings.logo} alt="Logo preview" className="logo-preview" style={{ maxHeight: '80px', display: 'block', marginBottom: '10px' }} />
          )}
          <input type="file" accept="image/*" onChange={handleLogoUpload} />
        </div>

        <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save settings'}
          </button>
          {saved && <span className="save-confirm">✓ Saved</span>}
        </div>
      </div>
    </div>
  );
}