// src/pages/PaymentTerminal.jsx
import React, { useState } from 'react';
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import toast from 'react-hot-toast';

const backendBase = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/+$/, '');
const paymentsUrl = backendBase ? `${backendBase}/api/payments/create-intent` : '/api/payments/create-intent';
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

export default function PaymentTerminal() {
  const stripe = useStripe();
  const elements = useElements();

  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [billingStreet, setBillingStreet] = useState('');
  const [billingZip, setBillingZip] = useState('');
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleClear = () => {
    setName('');
    setCompany('');
    setBillingStreet('');
    setBillingZip('');
    setEmail('');
    setAmount('');
    setDescription('');
    const cardElement = elements?.getElement(CardElement);
    if (cardElement) {
      cardElement.clear();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !company.trim() || !billingStreet.trim() || !billingZip.trim() || !email.trim()) {
      toast.error('Please complete all required fields before paying.', { duration: 2000 });
      return;
    }
    if (!isValidEmail(email)) {
      toast.error('Please enter a valid email address.', { duration: 1500 });
      return;
    }
    const amountNumber = Number(amount);
    if (!amount || Number.isNaN(amountNumber) || amountNumber <= 0) {
      toast.error('Enter a valid amount greater than 0.', { duration: 2000 });
      return;
    }
    if (!stripe || !elements) {
      toast.error('Payments are not ready yet. Please wait a moment.', { duration: 2000 });
      return;
    }

    const card = elements.getElement(CardElement);
    if (!card) {
      toast.error('Card element not ready. Please wait a moment.', { duration: 2000 });
      return;
    }

    setProcessing(true);
    try {
      const resp = await fetch(paymentsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountNumber,
          description,
          name,
          company,
          billingStreet,
          billingZip,
          email
        })
      });
      const data = await resp.json();
      if (!resp.ok || !data?.clientSecret) {
        const message = data?.detail || data?.error || 'Could not create payment intent.';
        toast.error(message, { duration: 2000 });
        return;
      }

      const result = await stripe.confirmCardPayment(data.clientSecret, {
        payment_method: { card }
      });

      if (result.error) {
        toast.error(result.error.message || 'Payment failed.', { duration: 2500 });
        return;
      }

      toast.success('Payment succeeded!', { duration: 1500 });
      setName('');
      setCompany('');
      setBillingStreet('');
      setBillingZip('');
      setEmail('');
      setAmount('');
      setDescription('');
      card.clear();
    } catch (err) {
      console.error('Payment error', err);
      toast.error('Payment failed. Please try again.', { duration: 2500 });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="alpha-theme client-auth" style={{ minHeight: '100vh' }}>
      <div className="alpha-card auth-wrap client-card payment-terminal-card">
        <h2 style={{ marginBottom: 6 }}>Payment Terminal</h2>
        <p style={{ marginBottom: 14, opacity: 0.85 }}>Enter an amount and card details to complete your payment.</p>

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
            <label className="alpha-label">Company <span className="required-asterisk">*</span></label>
            <input
              type="text"
              className="alpha-input"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              required
            />
            <div className="required-note">Required</div>
          </div>

          <div>
            <label className="alpha-label">Billing Street Address <span className="required-asterisk">*</span></label>
            <input
              type="text"
              className="alpha-input"
              value={billingStreet}
              onChange={(e) => setBillingStreet(e.target.value)}
              required
            />
            <div className="required-note">Required</div>
          </div>

          <div>
            <label className="alpha-label">Billing ZIP Code <span className="required-asterisk">*</span></label>
            <input
              type="text"
              className="alpha-input"
              value={billingZip}
              onChange={(e) => setBillingZip(e.target.value)}
              required
            />
            <div className="required-note">Required</div>
          </div>

          <div>
            <label className="alpha-label">Email <span className="required-asterisk">*</span></label>
            <input
              type="email"
              className="alpha-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <div className="required-note">Required</div>
          </div>

          <div>
            <label className="alpha-label">Amount <span className="required-asterisk">*</span></label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="alpha-input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 49.99"
              required
            />
            <div className="required-note">Required</div>
          </div>

          <div>
            <label className="alpha-label">Description (optional)</label>
            <input
              type="text"
              className="alpha-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this payment for?"
            />
          </div>

          <div>
            <label className="alpha-label">Card details</label>
            <div className="card-element-wrapper">
              <CardElement
                options={{
                  hidePostalCode: true,
                  style: {
                    base: {
                      fontSize: '16px',
                      color: '#ffffff',
                      '::placeholder': { color: '#a0aec0' }
                    }
                  }
                }}
              />
            </div>
          </div>

          <div className="payment-actions">
            <button
              type="button"
              className="btn-xl btn-outline-lilac btn-wide secondary"
              onClick={handleClear}
              disabled={processing}
            >
              Clear Form
            </button>
            <button
              type="submit"
              className="btn-xl btn-outline-lilac btn-wide"
              disabled={processing || !stripe}
            >
              {processing ? 'Processing…' : 'Pay Now'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
