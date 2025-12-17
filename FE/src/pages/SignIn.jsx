import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.documentElement.classList.add('auth-mode');
    return () => document.documentElement.classList.remove('auth-mode');
  }, []);

  async function handleSignIn(e) {
    e.preventDefault();
    if (!email || !password || loading) return;
    if (!isValidEmail(email)) {
      toast.error('Enter a valid email.');
      return;
    }
    setLoading(true);
    setError('');
    const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signErr) {
      setError(signErr.message || 'Could not sign in.');
      return;
    }
    const url = new URL(window.location.href);
    const next = url.searchParams.get('next');
    window.location.replace(next || '/dashboard');
  }

  async function startReset() {
    if (!email || !isValidEmail(email)) {
      toast.error('Enter a valid email to reset.');
      return;
    }
    const origin = window.location.origin;
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/pwreset` });
    if (resetErr) toast.error(resetErr.message || 'Could not start reset.');
    else toast.success('Check your email for a reset link.');
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div>
          <div className="pill" style={{ marginBottom: 10 }}>alphaCoach</div>
          <div className="auth-title">Sign in</div>
          <div className="muted">Access your coaching workspace.</div>
        </div>

        <form onSubmit={handleSignIn} style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              required
            />
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <div className="button-row">
            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? 'Signing in…' : 'Continue'}
            </button>
            <button type="button" className="ghost-btn" onClick={startReset}>
              Forgot password
            </button>
          </div>
        </form>

        {error && <div className="error-text">{error}</div>}
      </div>
    </div>
  );
}
