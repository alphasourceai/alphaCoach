// src/components/InterviewAccessForm.jsx
// Submits candidate info + resume -> returns candidate/role/email to parent (no navigation)

import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import CustomFilePicker from './CustomFilePicker';

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
const isValidPhone = (value) => /^(\d{10}|\(\d{3}\)\s?\d{3}-\d{4}|\d{3}-\d{3}-\d{4})$/.test(String(value || '').trim());

function joinUrl(base, path) {
  if (!base) return path;
  if (base.endsWith('/') && path.startsWith('/')) return base.slice(0, -1) + path;
  if (!base.endsWith('/') && !path.startsWith('/')) return base + '/' + path;
  return base + path;
}

const BK = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL)
  ? String(import.meta.env.VITE_BACKEND_URL).replace(/\/+$/, '')
  : '';

export default function InterviewAccessForm({ roleToken, onSubmitted }) {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    resume: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');

  const fileInputRef = useRef(null);

  const onChange = (e) => {
    const { name, value, files } = e.target;
    setForm((prev) => ({ ...prev, [name]: files ? files[0] : value }));
  };

  const onResumeSelected = (file) => {
    setForm((prev) => ({ ...prev, resume: file || null }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isValidEmail(form.email)) {
      setEmailError('Please enter a valid email address.');
      toast.error('Please enter a valid email address.', { duration: 1500 });
      return;
    }
    setEmailError('');

    if (!isValidPhone(form.phone)) {
      setPhoneError('Enter a valid phone number: XXXXXXXXXX, (XXX) XXX-XXXX, or XXX-XXX-XXXX.');
      toast.error('Enter a valid phone number.', { duration: 1500 });
      return;
    }
    setPhoneError('');

    if (!roleToken) {
      setError('Missing role link. Please use the correct interview URL.');
      return;
    }
    if (!form.resume) {
      setError('Please attach your resume.');
      return;
    }

    setSubmitting(true);

    try {
      const body = new FormData();
      body.append('first_name', form.first_name.trim());
      body.append('last_name', form.last_name.trim());
      body.append('email', form.email.trim());
      body.append('phone', String(form.phone || '').replace(/\D/g, ''));
      body.append('resume', form.resume);
      body.append('role_token', roleToken);

      const resp = await fetch(joinUrl(BK, '/api/candidate/submit'), { method: 'POST', body });
      const data = await resp.json();

      if (!resp.ok) {
        setError(data?.error || 'Something went wrong.');
        return;
      }

      setSubmitted(true); // replaces only the submit button with confirmation
      onSubmitted?.({
        candidate_id: data?.candidate_id || null,
        role_id: data?.role_id || null,
        email: data?.email || form.email,
        resume_url: data?.resume_url || null,
      });
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isLocked = submitted;

  return (
    // INTERNAL 3-column grid (1fr | 1fr | 272px). This whole form sits across cols 1–3
    <form onSubmit={onSubmit} className="alpha-form-grid interview-access-grid gap-y-4">
      {/* First / Last (row 1) */}
      <div>
        <label className="alpha-label">First name <span className="required-asterisk">*</span></label>
        <input
          type="text"
          name="first_name"
          value={form.first_name}
          onChange={onChange}
          required
          className="alpha-input w-full"
          disabled={isLocked}
        />
        <div className="required-note">Required</div>
      </div>
      <div>
        <label className="alpha-label">Last name <span className="required-asterisk">*</span></label>
        <input
          type="text"
          name="last_name"
          value={form.last_name}
          onChange={onChange}
          required
          className="alpha-input w-full"
          disabled={isLocked}
        />
        <div className="required-note">Required</div>
      </div>

      {/* Email / Phone (row 2) */}
      <div>
        <label className="alpha-label">Email <span className="required-asterisk">*</span></label>
        <input
          type="email"
          name="email"
          value={form.email}
          onChange={onChange}
          onBlur={() => setEmailError(isValidEmail(form.email) ? '' : (form.email ? 'Please enter a valid email address.' : ''))}
          required
          placeholder="e.g. name@example.com"
          className={`alpha-input w-full ${emailError ? 'input-error' : ''}`}
          disabled={isLocked}
        />
        {emailError && <div className="input-error-text">{emailError}</div>}
        <div className="required-note">Required</div>
      </div>
      <div>
        <label className="alpha-label">Phone <span className="required-asterisk">*</span></label>
        <input
          type="tel"
          name="phone"
          value={form.phone}
          onChange={onChange}
          placeholder="e.g. (555) 123-4567 or 555-123-4567"
          required
          inputMode="tel"
          autoComplete="tel"
          className="alpha-input w-full"
          disabled={isLocked}
          onBlur={() => setPhoneError(form.phone ? (isValidPhone(form.phone) ? '' : 'Enter a valid phone number: XXXXXXXXXX, (XXX) XXX-XXXX, or XXX-XXX-XXXX.') : '')}
        />
        {phoneError && <div className="input-error-text">{phoneError}</div>}
        <div className="required-note">Required</div>
      </div>

      {/* Upload Resume (left column, row 3) */}
      <div>
        {isLocked ? (
          <div className="text-green-300 text-sm">Candidate created. OTP emailed.</div>
        ) : (
          <>
            <div className="client-dash-file-wrapper interview-resume-wrapper">
              <CustomFilePicker
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onFileSelected={onResumeSelected}
                label="Drag resume here or click to browse"
                className="client-dash-dropzone client-dash-input client-dash-file-input"
                inputRef={fileInputRef}
              />
            </div>
            {form.resume && <div className="mt-1 text-xs opacity-80">{form.resume.name}</div>}
          </>
        )}
        <div className="required-note">Required</div>
      </div>

      {/* Submit (right column, row 3) */}
      <div className="interview-submit-wrapper">
        {isLocked ? (
          <div className="text-green-300 text-sm self-center">Form submitted.</div>
        ) : (
          <button
            type="submit"
            disabled={submitting || !form.resume}
            className="btn-lg"
          >
            {submitting ? 'Submitting…' : 'Submit & Get OTP'}
          </button>
        )}
      </div>

      {/* Error across both columns, if any */}
      {error && <div className="alpha-col-span-2 text-red-300 text-sm">{error}</div>}
    </form>
  );
}
