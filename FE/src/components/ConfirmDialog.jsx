'use client';

import React from 'react';

function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel }) {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        top: 64,
        display: 'flex',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 16,
        pointerEvents: 'none'
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 10,
          padding: 20,
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
          color: '#111827',
          pointerEvents: 'auto'
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: 18, fontWeight: 700, color: '#111827' }}>{title}</h3>
        <p style={{ marginTop: 0, marginBottom: 16, lineHeight: 1.5, color: '#1f2937' }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              background: '#e5e7eb',
              color: '#111827',
              cursor: 'pointer',
              outline: 'none'
            }}
            onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.4)'; }}
            onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: 'none',
              background: '#dc2626',
              color: '#fff',
              cursor: 'pointer',
              outline: 'none'
            }}
            onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.4)'; }}
            onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
