import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { authApi } from '../../services/api';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-950 via-primary-900 to-surface-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="w-12 h-12 bg-primary-500 rounded-2xl flex items-center justify-center">
              <span className="text-2xl">🌾</span>
            </div>
            <span className="text-xl font-bold text-white font-display">HarvestHub</span>
          </Link>
        </div>

        <div className="glass rounded-3xl shadow-modal p-8">
          {sent ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-primary-600" />
              </div>
              <h2 className="text-xl font-bold text-surface-900 mb-2">Email Sent</h2>
              <p className="text-surface-500 text-sm mb-6">
                If an account with <strong>{email}</strong> exists, a password reset link has been sent.
              </p>
              <Link to="/login" className="btn-primary w-full">Back to Login</Link>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center mb-4">
                <Mail className="w-6 h-6 text-primary-600" />
              </div>
              <h1 className="text-2xl font-bold text-surface-900 font-display mb-1">Forgot Password?</h1>
              <p className="text-surface-500 text-sm mb-6">Enter your email to receive a reset link.</p>

              {error && <div className="alert-error mb-4"><AlertCircle size={16} /><span>{error}</span></div>}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="form-label">Email Address</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="form-input" required />
                </div>
                <button type="submit" disabled={isLoading} className="btn-primary w-full btn-lg">
                  {isLoading ? <><Loader2 size={20} className="animate-spin" />Sending...</> : 'Send Reset Link'}
                </button>
              </form>

              <p className="text-center text-sm text-surface-500 mt-6">
                Remember your password? <Link to="/login" className="text-primary-600 font-semibold">Sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
