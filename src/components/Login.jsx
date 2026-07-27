import { useState } from 'react';
import { supabase } from '../utils/supabaseClient';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError('Invalid email or password.');
      return;
    }

    onLogin(data.session);
  }

  return (
    <div style={styles.wrapper}>
      <form style={styles.card} onSubmit={handleSubmit}>
        <h2 style={styles.title}>BizManager Login</h2>
        <p style={styles.subtitle}>Sign in to continue</p>

        <div style={styles.formGroup}>
          <label style={styles.label}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={styles.input}
            autoFocus
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={styles.input}
          />
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <button type="submit" style={styles.button} disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}

const styles = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#F7F8FA',
    padding: 16,
  },
  card: {
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: 12,
    padding: '36px 32px',
    width: '100%',
    maxWidth: 360,
    boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 4,
    color: '#1A1A1A',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 24,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 500,
    color: '#6B7280',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    padding: '11px 12px',
    fontSize: 14,
    border: '1px solid #E5E7EB',
    borderRadius: 6,
    outline: 'none',
    minHeight: 44,
    boxSizing: 'border-box',
  },
  error: {
    color: '#EB5757',
    fontSize: 13,
    marginBottom: 12,
  },
  button: {
    width: '100%',
    padding: '12px 18px',
    fontSize: 14,
    fontWeight: 600,
    background: '#2D9CDB',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    minHeight: 44,
  },
};