import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { supabaseAdmin, createAuthClient } from '../config/supabase';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';
import { logger } from '../config/logger';

/**
 * Extract a readable message from a Supabase error.
 * Supabase sometimes returns error objects whose .message is '{}' or an empty string.
 */
function extractSupabaseError(error: any): string {
  if (!error) return 'Unknown error';

  // Try .message first
  const msg = error.message ?? '';

  // If message is an empty object string or empty, try other fields
  if (!msg || msg === '{}' || msg === 'null') {
    if (error.error_description) return error.error_description;
    if (error.code) return `Supabase error code: ${error.code}`;
    if (error.status) {
      if (error.status === 422) return 'Invalid email or password format.';
      if (error.status === 500) return 'Database not ready. Please ensure migrations have been run in Supabase.';
    }
    return 'Registration failed. Please ensure the database is set up correctly.';
  }

  // Map known Supabase messages to friendly ones
  if (msg.includes('Database error saving new user') || msg.includes('saving new user')) {
    return 'Database setup incomplete. Please run the SQL migration scripts in your Supabase project first.';
  }
  if (msg.includes('User already registered') || msg.includes('already registered')) {
    return 'An account with this email already exists.';
  }
  if (msg.includes('Invalid email')) {
    return 'Please enter a valid email address.';
  }
  if (msg.includes('Password should be')) {
    return 'Password does not meet the requirements.';
  }

  return msg;
}

/**
 * POST /api/auth/register
 * Register a new user with Supabase Auth & role-specific tables.
 */
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password, full_name, role = 'farmer', phone } = req.body;

    // 1. Hash & Encrypt password
    const hashedPassword = bcrypt.hashSync(password, 10);

    // 2. Create user with Supabase Auth
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role, phone, encrypted_password: hashedPassword },
    });

    if (error) {
      const message = extractSupabaseError(error);
      logger.error(`Registration error for ${email}: ${JSON.stringify(error)}`);
      if (message.includes('already exists') || message.includes('already registered')) {
        throw new AppError('An account with this email already exists', 409);
      }
      throw new AppError(message, 400);
    }

    const userId = data.user?.id;

    if (userId) {
      // Find a default collection centre if available
      let defaultCentreId = null;
      if (['collection_centre_officer', 'quality_inspector', 'inventory_manager', 'finance_officer', 'transport_coordinator'].includes(role)) {
        const { data: firstCentre } = await supabaseAdmin.from('collection_centres').select('id').limit(1).maybeSingle();
        if (firstCentre) defaultCentreId = firstCentre.id;
      }

      // 3. Save encrypted password & activate profile
      // Farmers start as 'pending' until verified by a Collection Officer or Admin
      const farmerAccountStatus = role === 'farmer' ? 'pending' : 'active';

      await supabaseAdmin
        .from('profiles')
        .upsert({
          id: userId,
          email,
          full_name: full_name || email,
          role,
          account_status: farmerAccountStatus,
          phone: phone || null,
          encrypted_password: hashedPassword,
          assigned_centre: defaultCentreId,
        });

      const codeSuffix = userId.replace(/-/g, '').substring(0, 8).toUpperCase();

      // 4. Create record in role-specific database tables
      if (role === 'farmer') {
        const { data: existingFarmer } = await supabaseAdmin
          .from('farmers')
          .select('id')
          .or(`profile_id.eq.${userId},email.eq.${email}`)
          .maybeSingle();

        if (existingFarmer) {
          await supabaseAdmin
            .from('farmers')
            .update({ profile_id: userId, verification_status: 'pending' })
            .eq('id', existingFarmer.id);
        } else {
          await supabaseAdmin.from('farmers').insert({
            profile_id: userId,
            farmer_code: `FAR-${codeSuffix}`,
            nic_number: null,
            full_name: full_name || email.split('@')[0],
            email,
            phone: phone || null,
            address: null,
            district: null,
            verification_status: 'pending',
            account_status: 'active',
          });
        }
      } else if (role === 'buyer') {
        const { data: existingBuyer } = await supabaseAdmin
          .from('buyers')
          .select('id')
          .eq('profile_id', userId)
          .maybeSingle();

        if (!existingBuyer) {
          await supabaseAdmin.from('buyers').insert({
            profile_id: userId,
            buyer_code: `BUY-${codeSuffix}`,
            company_name: full_name || email.split('@')[0],
            contact_person: full_name || null,
            email,
            phone: phone || null,
            address: null,
            district: null,
            verification_status: 'verified',
            account_status: 'active',
          });
        }
      }
    }

    logger.info(`New user registered & synced to role database: ${email} (${role})`);

    const isfarmerPending = role === 'farmer';
    sendSuccess(res, {
      message: isfarmerPending
        ? 'Farmer account created. Your account requires verification by a Collection Officer or Administrator before you can log in.'
        : 'Account created successfully.',
      data: {
        id: userId,
        email: data.user?.email,
        role,
        verification_required: isfarmerPending,
      },
      statusCode: 201,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/login
 * Sign in and return a Supabase session.
 */
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;

    const { data, error } = await createAuthClient().auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Wrong credentials are a 400 from Supabase Auth; anything else (bad API key, wrong project URL, network)
      // is a server configuration problem and must not be reported as a wrong password.
      if (error.status && error.status >= 500 || /api key|jwt|fetch failed|invalid url/i.test(error.message)) {
        logger.error(`Supabase auth is misconfigured: ${error.message}`);
        throw new AppError('Sign-in service is not configured correctly. Please contact the administrator.', 503);
      }
      throw new AppError('Invalid email or password', 401);
    }

    if (!data.user || !data.session) {
      throw new AppError('Login failed. Please try again.', 401);
    }

    // Get profile for role and status
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, role, account_status, assigned_centre')
      .eq('id', data.user.id)
      .single();

    if (profile?.account_status === 'suspended') {
      throw new AppError('Account suspended. Please contact support.', 403);
    }

    if (profile?.account_status === 'inactive') {
      throw new AppError('Account inactive. Please contact support.', 403);
    }

    // Check verification status for farmer accounts
    if (profile?.role === 'farmer') {
      let { data: farmerRecord } = await supabaseAdmin
        .from('farmers')
        .select('verification_status')
        .eq('profile_id', data.user.id)
        .maybeSingle();

      if (!farmerRecord && profile.email) {
        const { data: farmerByEmail } = await supabaseAdmin
          .from('farmers')
          .select('verification_status')
          .eq('email', profile.email)
          .maybeSingle();
        farmerRecord = farmerByEmail;
      }

      if (farmerRecord) {
        if (farmerRecord.verification_status === 'pending') {
          throw new AppError('Your farmer account is pending verification by a Collection Officer or Admin. You cannot log in until your account is verified.', 403);
        }
        if (farmerRecord.verification_status === 'rejected') {
          throw new AppError('Your farmer account verification was rejected. Please contact a Collection Centre Officer or Admin.', 403);
        }
        if (farmerRecord.verification_status !== 'verified') {
          throw new AppError('Your farmer account has not been verified yet by a Collection Officer or Admin.', 403);
        }
      } else {
        throw new AppError('Your farmer account is pending verification by a Collection Officer or Admin.', 403);
      }
    }

    logger.info(`User logged in: ${email}`);

    sendSuccess(res, {
      message: 'Login successful',
      data: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        user: {
          id: data.user.id,
          email: data.user.email,
          full_name: profile?.full_name,
          role: profile?.role,
          account_status: profile?.account_status,
          assigned_centre: profile?.assigned_centre,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/logout
 */
export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      await supabaseAdmin.auth.admin.signOut(token);
    }

    sendSuccess(res, { message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/forgot-password
 */
export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;

    const { error } = await createAuthClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL}/reset-password`,
    });

    if (error) {
      logger.warn(`Password reset attempt for unknown email: ${email}`);
    }

    // Always return success to prevent email enumeration
    sendSuccess(res, {
      message: 'If an account with this email exists, a password reset link has been sent.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 * Get current authenticated user's profile.
 */
export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      throw new AppError('Not authenticated', 401);
    }

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select(`
        id, email, full_name, phone, avatar_url, role, account_status,
        assigned_centre,
        collection_centres!assigned_centre(id, name, code)
      `)
      .eq('id', userId)
      .single();

    if (error || !profile) {
      throw new AppError('Profile not found', 404);
    }

    // Get farmer/buyer record if applicable
    let entityRecord = null;
    if (profile.role === 'farmer') {
      let { data } = await supabaseAdmin
        .from('farmers')
        .select('id, farmer_code, verification_status, account_status')
        .eq('profile_id', userId)
        .maybeSingle();

      if (!data && profile.email) {
        const { data: farmerByEmail } = await supabaseAdmin
          .from('farmers')
          .select('id, farmer_code, verification_status, account_status')
          .eq('email', profile.email)
          .maybeSingle();
        data = farmerByEmail;
      }
      entityRecord = data;
    } else if (profile.role === 'buyer') {
      const { data } = await supabaseAdmin
        .from('buyers')
        .select('id, buyer_code, company_name, verification_status')
        .eq('profile_id', userId)
        .single();
      entityRecord = data;
    }

    sendSuccess(res, {
      data: { ...profile, entity: entityRecord },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token.
 */
export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      throw new AppError('Refresh token is required', 400);
    }

    const { data, error } = await createAuthClient().auth.refreshSession({
      refresh_token,
    });

    if (error || !data.session) {
      throw new AppError('Invalid or expired refresh token', 401);
    }

    sendSuccess(res, {
      data: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    });
  } catch (error) {
    next(error);
  }
};
