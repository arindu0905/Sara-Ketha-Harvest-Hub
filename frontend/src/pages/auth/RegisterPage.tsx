import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { AuthShell } from '../../components/auth/AuthShell';

const registerSchema = z.object({
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[a-z]/, 'Must contain lowercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
  confirmPassword: z.string(),
  role: z.enum(['farmer', 'buyer']),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

export const RegisterPage: React.FC = () => {
  const { register: authRegister } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'farmer' },
  });

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    setError('');
    try {
      await authRegister({ email: data.email, password: data.password, full_name: data.full_name, role: data.role });
      if (data.role === 'farmer') {
        toast.success('Registration submitted! Your farmer account requires verification by a Collection Officer before logging in.', { duration: 6000 });
      } else {
        toast.success('Account created! Please sign in.');
      }
      navigate('/login');
    } catch (err: any) {
      const rawMessage = err?.response?.data?.message;
      // Guard against stringified empty objects like '{}'
      const isEmptyObj = typeof rawMessage === 'string' && rawMessage.trim().match(/^\{.*\}$/);
      const friendlyMessage = (!rawMessage || isEmptyObj)
        ? 'Registration failed. The database may not be fully set up yet. Please try again or contact support.'
        : rawMessage;
      setError(friendlyMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell wide>
          <h1 className="text-2xl font-bold text-surface-900 font-display mb-1">Create Account</h1>
          <p className="text-surface-500 text-sm mb-6">Join HarvestHub today</p>

          {error && (
            <div className="alert-error mb-4">
              <AlertCircle size={16} /><span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="form-label">Full Name</label>
              <input type="text" className={`form-input ${errors.full_name ? 'form-input-error' : ''}`} {...register('full_name')} />
              {errors.full_name && <p className="form-error"><AlertCircle size={12} />{errors.full_name.message}</p>}
            </div>

            <div>
              <label className="form-label">Email Address</label>
              <input type="email" className={`form-input ${errors.email ? 'form-input-error' : ''}`} {...register('email')} />
              {errors.email && <p className="form-error"><AlertCircle size={12} />{errors.email.message}</p>}
            </div>

            <div>
              <label className="form-label">I am a...</label>
              <select className="form-select" {...register('role')}>
                <option value="farmer">Farmer</option>
                <option value="buyer">Buyer</option>
              </select>
            </div>

            <div>
              <label className="form-label">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} className={`form-input pr-10 ${errors.password ? 'form-input-error' : ''}`} {...register('password')} />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-xs text-surface-400 mt-1">At least 8 characters with an uppercase letter, a lowercase letter and a number</p>
              {errors.password && <p className="form-error"><AlertCircle size={12} />{errors.password.message}</p>}
            </div>

            <div>
              <label className="form-label">Confirm Password</label>
              <input type="password" className={`form-input ${errors.confirmPassword ? 'form-input-error' : ''}`} {...register('confirmPassword')} />
              {errors.confirmPassword && <p className="form-error"><AlertCircle size={12} />{errors.confirmPassword.message}</p>}
            </div>

            <button type="submit" disabled={isLoading} className="btn-primary w-full btn-lg mt-2">
              {isLoading ? <><Loader2 size={20} className="animate-spin" />Creating account...</> : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-surface-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 font-semibold hover:text-primary-700">Sign in</Link>
          </p>
    </AuthShell>
  );
};
