import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

const ROLE_DASHBOARDS: Record<string, string> = {
  farmer: '/farmer/dashboard',
  collection_centre_officer: '/officer/dashboard',
  quality_inspector: '/inspector/dashboard',
  inventory_manager: '/inventory/dashboard',
  buyer: '/buyer/dashboard',
  finance_officer: '/finance/dashboard',
  transport_coordinator: '/transport/dashboard',
  administrator: '/admin/dashboard',
};

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname;

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setError('');
    try {
      await login(data.email, data.password);
      toast.success('Welcome back!');
      // Navigate to where they were going, or role dashboard
      if (from) {
        navigate(from, { replace: true });
      } else {
        // We don't know role yet from this context; re-read
        const stored = localStorage.getItem('hh_user');
        if (stored) {
          const user = JSON.parse(stored);
          navigate(ROLE_DASHBOARDS[user.role] || '/farmer/dashboard', { replace: true });
        }
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-950 via-primary-900 to-surface-900 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3 group">
            <div className="w-12 h-12 bg-primary-500 rounded-2xl flex items-center justify-center shadow-lg group-hover:bg-primary-400 transition-colors">
              <span className="text-2xl">🌾</span>
            </div>
            <div className="text-left">
              <p className="text-xl font-bold text-white font-display">HarvestHub</p>
              <p className="text-xs text-primary-400">Collection Centre Management</p>
            </div>
          </Link>
        </div>

        {/* Form Card */}
        <div className="glass rounded-3xl shadow-modal p-8">
          <h1 className="text-2xl font-bold text-surface-900 font-display mb-1">Welcome back</h1>
          <p className="text-surface-500 text-sm mb-6">Sign in to your HarvestHub account</p>

          {error && (
            <div className="alert-error mb-4">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="email" className="form-label">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className={`form-input ${errors.email ? 'form-input-error' : ''}`}
                {...register('email')}
              />
              {errors.email && (
                <p className="form-error"><AlertCircle size={12} />{errors.email.message}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="form-label mb-0">Password</label>
                <Link to="/forgot-password" className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={`form-input pr-10 ${errors.password ? 'form-input-error' : ''}`}
                  {...register('password')}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <p className="form-error"><AlertCircle size={12} />{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full btn-lg mt-2"
            >
              {isLoading ? (
                <><Loader2 size={20} className="animate-spin" /> Signing in...</>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <p className="text-center text-sm text-surface-500 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary-600 font-semibold hover:text-primary-700">
              Create one
            </Link>
          </p>
        </div>

        {/* Demo credentials */}
        <div className="mt-4 glass rounded-2xl p-4 text-xs text-surface-600">
          <p className="font-semibold text-surface-700 mb-2">🔑 Demo Accounts (after seed data):</p>
          <div className="space-y-1 font-mono">
            <p>Admin: admin@harvesthub.lk / Admin@123456</p>
            <p>Farmer: farmer@harvesthub.lk / Farmer@123456</p>
            <p>Buyer: buyer@harvesthub.lk / Buyer@123456</p>
          </div>
        </div>
      </div>
    </div>
  );
};
