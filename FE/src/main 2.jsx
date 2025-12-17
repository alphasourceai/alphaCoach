import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';
import './styles/alphaTheme.css';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.VITE_SENTRY_ENV || import.meta.env.MODE || 'production',
    release: import.meta.env.VITE_COMMIT_SHA || undefined,
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.02),
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<div style={{ padding: 16 }}>Refresh the page and try again.</div>}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#10192e', color: '#e9edf6', border: '1px solid rgba(255,255,255,0.08)' },
        }}
      />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
