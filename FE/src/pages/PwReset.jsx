import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';

export default function PwReset() {
  const [ready, setReady] = useState(false);
  const [processing, setProcessing] = useState(true);
  const [error, setError] = useState('');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const url = new URL(window.location.href);
        const hashParams = new URLSearchParams((url.hash || '').replace(/^#/, ''));
        const code = url.searchParams.get('code');
        const tokenHash = url.searchParams.get('token_hash') || hashParams.get('token_hash');
        const typeParam = url.searchParams.get('type') || hashParams.get('type');
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (code) {
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exErr) throw exErr;
        } else if (accessToken && refreshToken) {
          const { error: setErr } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (setErr) throw setErr;
        } else if (tokenHash) {
          const { error: verifyErr } = await supabase.auth.verifyOtp({ type: typeParam || 'recovery', token_hash: tokenHash });
          if (verifyErr) throw verifyErr;
        }

        const { data } = await supabase.auth.getSession();
        if (!active) return;
        if (data?.session) {
          setReady(true);
          setError('');
        } else {
          setError('Reset link is invalid or expired.');
        }
      } catch (e) {
        if (!active) return;
        setError('Reset link is invalid or expired.');
      } finally {
        if (active) setProcessing(false);
      }
    }
    init();
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!pw1 || pw1.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    if (pw1 !== pw2) {
      toast.error('Passwords do not match.');
      return;
    }
    const { error: updErr } = await supabase.auth.updateUser({ password: pw1 });
    if (updErr) {
      toast.error(updErr.message || 'Could not update password.');
      return;
    }
    toast.success('Password updated. Sign in again.');
    await supabase.auth.signOut();
    window.location.replace('/signin');
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div>
          <div className="pill" style={{ marginBottom: 10 }}>alphaCoach</div>
          <div className="auth-title">Set a new password</div>
          <div className="muted">Complete your recovery to continue.</div>
        </div>

        {processing && <div className="muted">Preparing your reset session…</div>}
        {error && <div className="error-text">{error}</div>}

        {ready && !processing && !error && (
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <label htmlFor="pw1">New password</label>
              <input id="pw1" className="input" type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} required />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <label htmlFor="pw2">Confirm password</label>
              <input id="pw2" className="input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
            </div>
            <div className="button-row">
              <button type="submit" className="primary-btn">Update password</button>
              <button type="button" className="ghost-btn" onClick={() => window.location.replace('/signin')}>Back to sign in</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
