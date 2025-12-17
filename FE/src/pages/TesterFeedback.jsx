// src/pages/TesterFeedback.jsx
import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

const backendBase = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/+$/, '');
const optionsUrl = backendBase ? `${backendBase}/api/feedback/options` : '/api/feedback/options';
const submitUrl = backendBase ? `${backendBase}/api/feedback/submit` : '/api/feedback/submit';
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

export default function TesterFeedback() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [browser, setBrowser] = useState('');
  const [deviceType, setDeviceType] = useState('');
  const [issues, setIssues] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedIssueIds, setSelectedIssueIds] = useState([]);
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState([]);
  const [otherIssue, setOtherIssue] = useState('');
  const [otherSuggestion, setOtherSuggestion] = useState('');
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);
  const [emailError, setEmailError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(optionsUrl);
        const data = await resp.json();
        setIssues(Array.isArray(data?.issues) ? data.issues : []);
        setSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : []);
      } catch (e) {
        console.warn('[feedback] options fetch failed:', e?.message || e);
      }
    })();
  }, []);

  const toggleIssue = (id) => {
    setSelectedIssueIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };
  const toggleSuggestion = (id) => {
    setSelectedSuggestionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setEmailError('');
    setBrowser('');
    setDeviceType('');
    setSelectedIssueIds([]);
    setSelectedSuggestionIds([]);
    setOtherIssue('');
    setOtherSuggestion('');
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !browser.trim() || !deviceType.trim()) {
      toast.error('Please complete all required fields before submitting.', { duration: 2000 });
      return;
    }
    if (!isValidEmail(email)) {
      setEmailError('Please enter a valid email address.');
      toast.error('Please enter a valid email address.', { duration: 1500 });
      return;
    }
    setEmailError('');
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('name', name.trim());
      fd.append('email', email.trim());
      fd.append('browser', browser.trim());
      fd.append('deviceType', deviceType.trim());
      fd.append('selectedIssueIds', JSON.stringify(selectedIssueIds));
      fd.append('selectedSuggestionIds', JSON.stringify(selectedSuggestionIds));
      fd.append('newIssueText', otherIssue || '');
      fd.append('newSuggestionText', otherSuggestion || '');
      files.forEach((f) => fd.append('screenshots', f));

      const resp = await fetch(submitUrl, {
        method: 'POST',
        body: fd
      });
      if (!resp.ok) {
        toast.error('Something went wrong submitting your feedback. Please try again.', { duration: 2500 });
        return;
      }
      toast.success('Thanks for your feedback!', { duration: 1500 });
      resetForm();
    } catch (err) {
      console.error('[feedback] submit error:', err);
      toast.error('Something went wrong submitting your feedback. Please try again.', { duration: 2500 });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="alpha-theme client-auth" style={{ minHeight: '100vh' }}>
      <div className="alpha-card auth-wrap client-card payment-terminal-card">
        <h2 style={{ marginBottom: 6 }}>Tester Feedback</h2>
        <p style={{ marginBottom: 14, opacity: 0.85 }}>Share your experience so we can improve.</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="alpha-label">Name <span className="required-asterisk">*</span></label>
            <input
              type="text"
              className="alpha-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <div className="required-note">Required</div>
          </div>

          <div>
            <label className="alpha-label">Email <span className="required-asterisk">*</span></label>
            <input
              type="email"
              className={`alpha-input ${emailError ? 'input-error' : ''}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setEmailError(isValidEmail(email) ? '' : (email ? 'Please enter a valid email address.' : ''))}
              required
            />
            {emailError && <div className="input-error-text">{emailError}</div>}
            <div className="required-note">Required</div>
          </div>

          <div>
            <label className="alpha-label">Browser Being Used <span className="required-asterisk">*</span></label>
            <input
              type="text"
              className="alpha-input"
              value={browser}
              onChange={(e) => setBrowser(e.target.value)}
              placeholder="e.g., Chrome 131 on macOS"
              required
            />
            <div className="required-note">Required</div>
          </div>

          <div>
            <label className="alpha-label">Device Type <span className="required-asterisk">*</span></label>
            <select
              className="alpha-input alpha-select"
              value={deviceType}
              onChange={(e) => setDeviceType(e.target.value)}
              required
            >
              <option value="">Select device type…</option>
              <option value="Desktop">Desktop</option>
              <option value="Mobile">Mobile</option>
            </select>
            <div className="required-note">Required</div>
          </div>

          <div>
            <h4 style={{ marginBottom: 6 }}>Issues you experienced (optional)</h4>
            <div className="feedback-checklist">
              {issues.map((issue) => (
                <label key={issue.id} className="feedback-check-item">
                  <input
                    type="checkbox"
                    checked={selectedIssueIds.includes(issue.id)}
                    onChange={() => toggleIssue(issue.id)}
                  />
                  <div>
                    <div className="feedback-check-title">{issue.title}</div>
                    {issue.description ? <div className="feedback-check-desc">{issue.description}</div> : null}
                  </div>
                </label>
              ))}
              {issues.length === 0 && <div className="muted" style={{ fontSize: '0.85rem' }}>No known issues listed.</div>}
            </div>
            <label className="alpha-label" style={{ marginTop: 8 }}>Other Issue (optional)</label>
            <textarea
              className="alpha-input"
              rows={3}
              value={otherIssue}
              onChange={(e) => setOtherIssue(e.target.value)}
              placeholder="Describe any other issue you faced"
            />
          </div>

          <div>
            <h4 style={{ marginBottom: 6 }}>Suggestions you agree with (optional)</h4>
            <div className="feedback-checklist">
              {suggestions.map((s) => (
                <label key={s.id} className="feedback-check-item">
                  <input
                    type="checkbox"
                    checked={selectedSuggestionIds.includes(s.id)}
                    onChange={() => toggleSuggestion(s.id)}
                  />
                  <div>
                    <div className="feedback-check-title">{s.title}</div>
                    {s.description ? <div className="feedback-check-desc">{s.description}</div> : null}
                  </div>
                </label>
              ))}
              {suggestions.length === 0 && <div className="muted" style={{ fontSize: '0.85rem' }}>No suggestions listed.</div>}
            </div>
            <label className="alpha-label" style={{ marginTop: 8 }}>Other Suggestion (optional)</label>
            <textarea
              className="alpha-input"
              rows={3}
              value={otherSuggestion}
              onChange={(e) => setOtherSuggestion(e.target.value)}
              placeholder="Share any other suggestion"
            />
          </div>

          <div>
            <label className="alpha-label">Screenshots (optional)</label>
            <input
              type="file"
              accept="image/*"
              multiple
              ref={fileInputRef}
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
              className="alpha-input"
            />
            {files.length > 0 && (
              <ul className="feedback-files">
                {files.map((f, idx) => (
                  <li key={`${f.name}-${idx}`} className="feedback-file-item">{f.name}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="payment-actions">
            <button
              type="button"
              className="btn-xl btn-outline-lilac btn-wide secondary"
              onClick={resetForm}
              disabled={submitting}
            >
              Clear Form
            </button>
            <button
              type="submit"
              className="btn-xl btn-outline-lilac btn-wide"
              disabled={submitting}
            >
              {submitting ? 'Submitting…' : 'Submit Feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
