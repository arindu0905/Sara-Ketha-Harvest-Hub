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

    // Block pending accounts — farmers must be verified before they can use the system.
    // The farmer record is the source of truth: if it is already verified (e.g. approved directly in the database),
    // activate the profile instead of locking the farmer out.
    if (profile.account_status === 'pending') {
      let verified = false;
      if (profile.role === 'farmer') {
        const { data: farmer } = await supabaseAdmin
          .from('farmers').select('verification_status').eq('profile_id', profile.id).maybeSingle();
        verified = farmer?.verification_status === 'verified';
        if (verified) {
          await supabaseAdmin.from('profiles').update({ account_status: 'active' }).eq('id', profile.id);
          profile.account_status = 'active';
        }
      }
      if (!verified) {
        throw new AppError('Your account is pending verification by a Collection Officer or Admin. You cannot access the system until your account is verified.', 403);
      }
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

    // Administrators always have global superuser access to all routes, actions, and processes
    if (req.user.role === 'administrator' || allowedRoles.includes(req.user.role)) {
      return next();
    }

    logger.warn(`Access denied: user ${req.user.id} (${req.user.role}) attempted ${allowedRoles.join('|')} route`);
    next(new AppError(`Access denied. Required role: ${allowedRoles.join(' or ')}`, 403));
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

/**
 * Middleware factory: Validate request body/query/params against a Zod schema.
 * Schema must be structured as z.object({ body: z.object({...}) }) etc.
 * Returns 400 with field-level error details on failure.
 */
export const validate = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      const fieldErrors = result.error.errors.map((err: any) => ({
        field: err.path.slice(1).join('.'), // strip 'body'/'query'/'params' prefix
        message: err.message,
      }));

      res.status(400).json({
        success: false,
        message: fieldErrors[0]?.message || 'Validation failed. Please check the required fields.',
        errors: fieldErrors,
      });
      return;
    }

    // Merge validated / coerced data back into the request
    if (result.data.body !== undefined) req.body = result.data.body;
    if (result.data.query !== undefined) req.query = result.data.query;

    next();
  };
};
