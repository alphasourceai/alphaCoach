// src/pages/InterviewAccessPage.jsx
// One-page intake → OTP → Start Interview (embedded tall)
// Uses VITE_BACKEND_URL for API calls

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import InterviewAccessForm from '../components/InterviewAccessForm';
import '../styles/agentTheme.css';

function joinUrl(base, path) {
  if (!base) return path;
  if (base.endsWith('/') && path.startsWith('/')) return base.slice(0, -1) + path;
  if (!base.endsWith('/') && !path.startsWith('/')) return base + '/' + path;
  return base + path;
}

const BK = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL)
  ? String(import.meta.env.VITE_BACKEND_URL).replace(/\/+$/, '')
  : '';

function OtpInline({ email, candidateId, roleId, onVerified, onError }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [isVerified, setIsVerified] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!/^\d{6}$/.test(code)) {
      setErr('Enter the 6-digit code.');
      return;
    }
    setBusy(true);
    try {
      const body = { email: String(email).trim().toLowerCase(), code: code.trim() };
      if (candidateId) body.candidate_id = candidateId;
      if (roleId) body.role_id = roleId;

      const resp = await fetch(joinUrl(BK, '/api/candidate/verify-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok) {
        const m = data?.error || 'Verification failed.';
        setErr(m);
        onError?.(m);
        return;
      }
      setIsVerified(true);
      onVerified?.({
        candidate_id: data?.candidate_id || candidateId,
        role_id: data?.role_id || roleId,
        email: data?.email || email,
      });
    } catch {
      setErr('Network error verifying code.');
      onError?.('Network error verifying code.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="alpha-step2">
      {/* Show heading ONLY after Step 1 is submitted (parent controls rendering of OtpInline) */}
      <h3 className="text-base font-semibold mb-3">Step 2 — Verify & Start</h3>

      <div className="mb-3">
        <label className="alpha-label">6-digit code</label>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          className="alpha-input w-full tracking-widest"
          placeholder="••••••"
          required
          disabled={isVerified}
        />
      </div>

      {err && <p className="text-red-300 text-sm mb-2">{err}</p>}

      {/* Replace button with inline confirmation when verified */}
      {isVerified ? (
        <span className="verified-inline">Verified! You can start your interview.</span>
      ) : (
        <button type="submit" disabled={busy} className="btn-lg">
          {busy ? 'Verifying…' : 'Verify'}
        </button>
      )}
    </form>
  );
}

export default function InterviewAccessPage() {
  const pingEmbedSize = () => {
    if (typeof window !== 'undefined' && window.__EMBED__ && typeof window.__EMBED__.updateSize === 'function') {
      window.__EMBED__.updateSize();
    }
  };
  const location = useLocation();
  const navigate = useNavigate();
useEffect(() => {
  try {
    document.body.classList.add('alpha-has-header');
    document.documentElement.style.overflowY = 'auto';
    document.body.style.overflowY = 'auto';
    document.body.style.height = 'auto';
  } catch {}
  return () => {
    try {
      document.body.classList.remove('alpha-has-header');
      document.documentElement.style.overflowY = '';
      document.body.style.overflowY = '';
      document.body.style.height = '';
    } catch {}
  };
}, []);
  // Normalize param names for token
  const params = useParams();
  const paramToken = params?.role_token || params?.token || params?.role || params?.id || '';
  const [roleToken, setRoleToken] = useState(paramToken || '');

  useEffect(() => {
    // Lightweight diagnostics for camera/mic embed issues.
    // Only run the active probe when ?camdebug=1 is present to avoid changing UX.
    try {
      const embedded = window.top !== window;
      const url = new URL(window.location.href);
      const camDebug = url.searchParams.get('camdebug') === '1';
      console.debug('[interview-debug] embedded:', embedded, 'origin:', window.location.origin, 'referrer:', document.referrer, 'camdebug:', camDebug);

      // Always log basic capability info
      const hasMD = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      console.debug('[interview-debug] mediaDevices.getUserMedia available:', hasMD);

      if (navigator.permissions && navigator.permissions.query) {
        ['camera', 'microphone'].forEach((name) => {
          navigator.permissions.query({ name })
            .then((status) => console.debug('[interview-debug] permission', name, status.state))
            .catch((err) => console.warn('[interview-debug] permission query failed for', name, err?.name || err));
        });
      } else {
        console.warn('[interview-debug] Permissions API not available');
      }

      // Active probe (prompts user) only when explicitly requested
      if (camDebug && hasMD) {
        (async () => {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            console.debug('[interview-debug] getUserMedia success. tracks:', stream.getTracks().map(t => t.kind));
            // Immediately stop tracks so Tavus can request again later
            stream.getTracks().forEach(t => t.stop());
          } catch (e) {
            console.error('[interview-debug] getUserMedia error:', e && (e.name || e.message), e);
          }
        })();
      }
    } catch (e) {
      console.warn('[interview-debug] probe init failed:', e?.message || e);
    }
  }, []);

  // Keep local roleToken in sync if the route param appears later (after redirects)
  useEffect(() => {
    if (paramToken && paramToken !== roleToken) {
      setRoleToken(paramToken);
      try { window.__ROLE_TOKEN = paramToken; } catch {}
    }
  }, [paramToken]);

  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      const q = u.searchParams.get('role');
      if (q && !paramToken) {
        setRoleToken(q);
        try { window.__ROLE_TOKEN = q; } catch {}
        navigate(`/interview-access/${encodeURIComponent(q)}`, { replace: true });
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, paramToken, navigate]);

  useEffect(() => {
    const onMsg = (e) => {
      const d = e?.data;
      if (d && d.type === 'ROLE_TOKEN' && typeof d.token === 'string' && d.token) {
        try { window.__ROLE_TOKEN = d.token; } catch {}
        if (!paramToken) {
          navigate(`/interview-access/${encodeURIComponent(d.token)}`, { replace: true });
        }
        setRoleToken(d.token);
        // Acknowledge receipt so Wix can stop retrying, if implemented
        try { if (window !== window.parent) window.parent.postMessage({ type: 'ROLE_TOKEN_CONFIRMED', token: d.token }, '*'); } catch {}
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [paramToken, navigate]);
  const roomRef = useRef(null);

  const [submitted, setSubmitted] = useState(null); // { candidate_id, role_id, email, resume_url }
  const [verified, setVerified] = useState(false);

  const [roomUrl, setRoomUrl] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [prejoin, setPrejoin] = useState(false);
  const [showPreInterviewNotice, setShowPreInterviewNotice] = useState(true);
  const [hasAcknowledgedQuiet, setHasAcknowledgedQuiet] = useState(false);

  // Notify Wix parent to resize when layout changes (mount, state changes)
  useEffect(() => {
    const t = setTimeout(pingEmbedSize, 60);
    return () => clearTimeout(t);
  }, []);

  const canStart = Boolean(verified && submitted?.candidate_id);

  const handleConfirmPreInterview = () => {
    setShowPreInterviewNotice(false);
    toast.success("You're all set. You can begin your interview.", { duration: 1200 });
    setTimeout(pingEmbedSize, 80);
  };

  // Recalculate height whenever layout-affecting state changes
  useEffect(() => {
    const t = setTimeout(pingEmbedSize, 80);
    return () => clearTimeout(t);
  }, [submitted, verified, roomUrl, starting, prejoin, error, showPreInterviewNotice]);

  // Ensure Tavus/Daily iframe has the required "allow" permissions
  useEffect(() => {
    const REQUIRED = 'camera; microphone; autoplay; display-capture; fullscreen; clipboard-read; clipboard-write; storage-access';
    const matchesDaily = (src = '') => /(^https?:\/\/)?([a-z0-9-]+\.)?(tavus\.daily\.co|c\.daily\.co)(\/|\?|$)/i.test(String(src || ''));

    const patch = (el) => {
      if (!el || el.tagName !== 'IFRAME') return;
      const src = el.getAttribute('src') || '';
      if (!matchesDaily(src)) return;
      try {
        const allow = (el.getAttribute('allow') || '').toLowerCase();
        // Only update if missing or insufficient
        const needs = !allow.includes('camera') || !allow.includes('microphone') || !allow.includes('display-capture') || !allow.includes('autoplay') || !allow.includes('fullscreen');
        if (needs) {
          el.setAttribute('allow', REQUIRED);
        }
        // Helpful extras that sometimes get stripped
        if (!el.hasAttribute('allowfullscreen')) el.setAttribute('allowfullscreen', '');
        if (!el.getAttribute('referrerpolicy')) el.setAttribute('referrerpolicy', 'no-referrer');
      } catch {}
    };

    const scan = () => {
      try {
        const root = document.getElementById('tavus-slot') || document.body;
        const frames = root.querySelectorAll('iframe');
        frames.forEach(patch);
      } catch {}
    };

    // Initial pass and periodic nudge (in case Tavus re-renders)
    scan();
    const tick = setInterval(scan, 800);

    // Observe DOM mutations under the Tavus slot
    const target = document.getElementById('tavus-slot') || document.body;
    const mo = new MutationObserver(() => scan());
    try { mo.observe(target, { subtree: true, childList: true, attributes: true, attributeFilter: ['src', 'allow'] }); } catch {}

    return () => { clearInterval(tick); try { mo.disconnect(); } catch {} };
  }, []);

  const startInterview = useCallback(async () => {
    if (!canStart) return;
    setStarting(true);
    setError('');
    try {
      const resp = await fetch(joinUrl(BK, '/create-tavus-interview'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_id: submitted.candidate_id,
          role_id: submitted.role_id,
          email: submitted.email,
          roleToken: roleToken,
          role_token: roleToken
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data?.error || 'Could not start interview.');
        return;
      }
      const url =
        data?.conversation_url ||
        data?.video_url ||
        data?.redirect_url ||
        data?.url ||
        '';
      if (url) {
        setRoomUrl(url);          // triggers “hide everything” below
        setPrejoin(true);
        setTimeout(() => {
          try { roomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {}
        }, 50);
        setTimeout(pingEmbedSize, 120);
      } else {
        setError('Interview room is initializing—try again in a moment.');
      }
    } catch {
      setError('Network error starting interview.');
    } finally {
      setStarting(false);
    }
  }, [canStart, submitted, roleToken]);

  const header = useMemo(
    () => (
      <header className="alpha-header" role="banner" aria-label="AlphaSource site header">
        <div className="inner">
          <div className="brand" aria-label="AlphaSource Home">
            <img src="/alpha-logo.png" alt="AlphaSource" />
          </div>
        </div>
      </header>
    ),
    []
  );

  const noRoom = !roomUrl;

  const interviewContent = (
    <div className="space-y-6">
      {header}

      {/* Full-bleed, opaque hallway hero */}
      <div className="alpha-hero fullbleed">
        <div className={`tavus-stage${prejoin ? ' prejoin' : ''}`} ref={roomRef}>
          <div
            id="tavus-slot"
            className={`tavus-slot${noRoom ? ' no-room' : ''}`}
            aria-label="Interview video area"
          >
            {roomUrl ? (
              <iframe
                title="Interview"
                src={roomUrl}
                loading="lazy"
                allow="camera; microphone; autoplay; clipboard-read; clipboard-write; display-capture; fullscreen; storage-access"
                referrerPolicy="no-referrer"
                allowFullScreen
              />
            ) : (
              <div className="placeholder">
                <div className="center-msg">
                  {!roleToken
                    ? "You’re almost there—this page needs a role link. Open the invite link you were sent, or contact your recruiter to resend it."
                    : "Your interview room will appear here after verification."}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Forms + actions are shown until the room URL actually exists */}
      {!roomUrl && (
      <div className="alpha-form">
        <div className="alpha-form-grid-3">
          {/* Step 1 spans columns 1–2 */}
          <div className="alpha-span-2">
            <InterviewAccessForm
              roleToken={roleToken}
              onSubmitted={(payload) => {
                setSubmitted(payload);
                setVerified(false);
                setRoomUrl('');
                setTimeout(pingEmbedSize, 80);
              }}
            />
          </div>

          {/* Step 2 only renders once Step 1 is submitted */}
          {submitted ? (
            <OtpInline
              email={submitted.email}
              candidateId={submitted.candidate_id}
              roleId={submitted.role_id}
              onVerified={(info) => {
                setVerified(true);
                setSubmitted((s) => ({ ...(s || {}), ...info }));
                setTimeout(pingEmbedSize, 80);
              }}
              onError={() => { setVerified(false); setTimeout(pingEmbedSize, 80); }}
            />
          ) : (
            <div className="alpha-step2">
              {/* Hidden until submitted; left here for layout stability if needed */}
            </div>
          )}
        </div>

        {/* Start Interview appears ONLY after verified; centered below the grid */}
        {verified && (
          <div className="start-block">
            <button
              type="button"
              disabled={!canStart || starting}
              onClick={startInterview}
              className="btn-xl btn-outline-lilac btn-wide"
            >
              {starting ? 'Starting…' : 'Start Interview'}
            </button>
          </div>
        )}
        {error && <p className="text-red-300 text-sm mt-2 center">{error}</p>}
      </div>
      )}

      {/* Page-scoped CSS for the Tavus slot */}
      <style>{`
        html, body {
          height: auto !important;
          min-height: 100%;
          overflow-y: auto !important;
        }
        .alpha-theme.alpha-page {
          min-height: 100%;
        }
        body.alpha-has-header {
          overflow-y: auto !important;
        }
        .tavus-stage { width: 100%; }
        .tavus-slot {
          position: relative;
          width: 100%;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(0,0,0,0.85);
          overflow: hidden;
          margin: 0 auto;
          max-width: 1200px;
        }
        @media (min-width: 768px) {
          .tavus-stage .tavus-slot { height: 520px; }
          .tavus-stage.prejoin .tavus-slot { height: 650px; }
        }
        @media (max-width: 767px) {
          .tavus-slot { aspect-ratio: 16 / 9; }
        }
        .tavus-slot.no-room { height: 690px !important; }

        .tavus-slot > iframe,
        .tavus-slot video,
        .tavus-slot [data-daily-video],
        .tavus-slot .daily-video {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
          border: 0 !important;
          display: block;
          object-fit: contain;
          background: #000;
        }
        .tavus-slot .placeholder {
          position: absolute; inset: 0;
          display:flex; align-items:center; justify-content:center;
          color: rgba(255,255,255,0.85); padding:24px; text-align:center;
        }
        .tavus-slot .center-msg { max-width: 520px; }
      `}</style>
    </div>
  );

  return (
    <div className="alpha-theme alpha-page interview-access-page">
      {showPreInterviewNotice && (
        <div className="pre-interview-overlay">
          <div className="alpha-card pre-interview-card">
            <h2>Before you start your interview</h2>
            <p>
              To make sure your interview goes smoothly, please move to a quiet, distraction-free area. Our AI Agent
              will pick up background conversations and noises, which can interfere with your answers and result in a less effective interview.
            </p>
            <label className="pre-interview-checkbox">
              <input
                type="checkbox"
                checked={hasAcknowledgedQuiet}
                onChange={(e) => setHasAcknowledgedQuiet(e.target.checked)}
              />
              <span>I understand and I am in a quiet place.</span>
            </label>
            <button
              className="alpha-button"
              disabled={!hasAcknowledgedQuiet}
              onClick={handleConfirmPreInterview}
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      {!showPreInterviewNotice && interviewContent}
    </div>
  );
}
