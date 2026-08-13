import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../utils/AppError';
import { logger } from '../config/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    account_status: string;
  };
  supabaseToken?: string;
}

/**
 * Middleware: Verify Supabase JWT and attach user to request.
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication token required', 401);
    }

    const token = authHeader.substring(7);

    // Verify token with Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      throw new AppError('Invalid or expired authentication token', 401);
    }

    // Get profile with role and status
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role, account_status')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new AppError('User profile not found', 401);
    }

    if (profile.account_status === 'suspended') {
      throw new AppError('Account suspended. Please contact support.', 403);
    }

    if (profile.account_status === 'inactive') {
      throw new AppError('Account inactive. Please contact support.', 403);
    }

    req.user = {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      account_status: profile.account_status,
    };
    req.supabaseToken = token;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware factory: Require specific roles.
 */
export const requireRole = (...allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Authentication required', 401));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`Access denied: user ${req.user.id} (${req.user.role}) attempted ${allowedRoles.join('|')} route`);
      next(new AppError(`Access denied. Required role: ${allowedRoles.join(' or ')}`, 403));
      return;
    }

    next();
  };
};

/**
 * Middleware: Optional authentication (attach user if token present, continue either way).
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  try {
    const token = authHeader.substring(7);
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);

    if (user) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id, email, role, account_status')
        .eq('id', user.id)
        .single();

      if (profile) {
        req.user = profile;
        req.supabaseToken = token;
      }
    }
  } catch {
    // Swallow errors for optional auth
  }

  next();
};
