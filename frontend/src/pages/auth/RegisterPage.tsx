import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const registerSchema = z.object({
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
  confirmPassword: z.string(),
  role: z.enum(['farmer', 'buyer', 'collection_centre_officer', 'quality_inspector', 'inventory_manager', 'finance_officer', 'transport_coordinator']),
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
      toast.success('Account created! Please sign in.');
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
    <div className="min-h-screen bg-gradient-to-br from-primary-950 via-primary-900 to-surface-900 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="w-12 h-12 bg-primary-500 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">🌾</span>
            </div>
            <span className="text-xl font-bold text-white font-display">HarvestHub</span>
          </Link>
        </div>

        <div className="glass rounded-3xl shadow-modal p-8">
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
              <input type="text" placeholder="Kamal Perera" className={`form-input ${errors.full_name ? 'form-input-error' : ''}`} {...register('full_name')} />
              {errors.full_name && <p className="form-error"><AlertCircle size={12} />{errors.full_name.message}</p>}
            </div>

            <div>
              <label className="form-label">Email Address</label>
              <input type="email" placeholder="kamal@example.com" className={`form-input ${errors.email ? 'form-input-error' : ''}`} {...register('email')} />
              {errors.email && <p className="form-error"><AlertCircle size={12} />{errors.email.message}</p>}
            </div>

            <div>
              <label className="form-label">I am a...</label>
              <select className="form-select" {...register('role')}>
                <option value="farmer">Farmer</option>
                <option value="buyer">Buyer</option>
                <option value="collection_centre_officer">Collection Centre Officer</option>
                <option value="quality_inspector">Quality Inspector</option>
                <option value="inventory_manager">Inventory Manager</option>
                <option value="finance_officer">Finance Officer</option>
                <option value="transport_coordinator">Transport Coordinator</option>
              </select>
            </div>

            <div>
              <label className="form-label">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} placeholder="Min 8 chars, 1 uppercase, 1 number" className={`form-input pr-10 ${errors.password ? 'form-input-error' : ''}`} {...register('password')} />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p className="form-error"><AlertCircle size={12} />{errors.password.message}</p>}
            </div>

            <div>
              <label className="form-label">Confirm Password</label>
              <input type="password" placeholder="Repeat password" className={`form-input ${errors.confirmPassword ? 'form-input-error' : ''}`} {...register('confirmPassword')} />
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
        </div>
      </div>
    </div>
  );
};
