import { useRef, useState } from 'react';
import { Store } from '../utils/storage';

export default function BackupRestore() {
  const fileInputRef = useRef(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    try {
      setLoading(true);
      setMessage('Preparing backup file...');
      
      const json = await Store.exportAllData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `bizmanager-backup-${dateStamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      setMessage('✓ Backup downloaded successfully!');
    } catch (err) {
      console.error(err);
      setMessage('✕ Export failed. Could not fetch data from database.');
    } finally {
      setLoading(false);
    }
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        setLoading(true);
        setMessage('Restoring data to Supabase...');
        
        await Store.importAllData(reader.result);
        setMessage('✓ Data restored successfully. Refresh the page to see updated data.');
      } catch (err) {
        console.error(err);
        setMessage('✕ Could not restore data. Make sure it is a valid backup JSON file.');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Backup &amp; Restore</h2>
      </div>

      <div className="card" style={{ maxWidth: 560 }}>
        <p className="text-muted" style={{ marginBottom: 20, fontSize: 14 }}>
          Your data is securely saved in your Supabase cloud database. 
          You can download a local JSON backup for your offline records, or restore previous backup files directly into your cloud database anytime.
        </p>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <button 
            className="btn btn-primary" 
            onClick={handleExport}
            disabled={loading}
          >
            {loading ? 'Processing...' : '⬇ Download backup'}
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={handleImportClick}
            disabled={loading}
          >
            {loading ? 'Processing...' : '⬆ Restore from backup'}
          </button>
          <input
            type="file"
            accept="application/json"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileChange}
            disabled={loading}
          />
        </div>

        {message && <p style={{ fontSize: 13 }}>{message}</p>}
      </div>
    </div>
  );
}