import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    full_name: z.string().min(2, 'Full name must be at least 2 characters').max(100),
    // Public self-registration is limited to farmers and buyers (E1-US1, E3-US5).
    // Staff accounts (officer, inspector, inventory, finance, transport, manager, admin) are created by an administrator.
    role: z.enum(['farmer', 'buyer']).optional().default('farmer'),
    phone: z.string().regex(/^0\d{9}$/, 'Phone must be exactly 10 digits and start with 0 (e.g. 0771234567)').optional().or(z.literal('')),
  }),
});

export const USER_ROLES = [
  'farmer', 'collection_centre_officer', 'quality_inspector', 'inventory_manager', 'buyer',
  'finance_officer', 'transport_coordinator', 'manager', 'administrator',
] as const;

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    new_password: z.string().min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain uppercase')
      .regex(/[a-z]/, 'Must contain lowercase')
      .regex(/[0-9]/, 'Must contain number'),
  }),
});

// Sri Lankan validation helpers
const sriLankaPhone = z
  .string()
  .regex(/^0\d{9}$/, 'Phone must be exactly 10 digits and start with 0 (e.g. 0771234567)');

const sriLankaNIC = z
  .string()
  .regex(
    /^(\d{9}[VvXx]|\d{12})$/,
    'NIC must be old format (9 digits + V or X, e.g. 781234567V) or new format (12 digits, e.g. 198012345678)'
  );

const bankAccount = z.string().regex(/^[0-9]{6,20}$/, 'Account number must be 6 to 20 digits');

export const farmerSchema = z.object({
  body: z.object({
    nic_number: sriLankaNIC,
    full_name: z.string().min(2).max(100),
    email: z.string().email().optional().or(z.literal('')),
    phone: sriLankaPhone,
    address: z.string().min(5),
    district: z.string().min(2),
    divisional_secretariat: z.string().optional(),
    farm_name: z.string().optional(),
    farm_location: z.string().optional(),
    farm_size_acres: z.number().positive().optional(),
    bank_name: z.string().optional(),
    bank_branch: z.string().optional(),
    account_holder_name: z.string().optional(),
    account_number: bankAccount.optional().or(z.literal('')),
    emergency_contact_name: z.string().optional(),
    emergency_contact_phone: sriLankaPhone.optional().or(z.literal('')),
    assigned_centre_id: z.string().uuid().optional(),
    notes: z.string().optional(),
  }),
});

/**
 * Used for PUT/PATCH farmer profile updates — all fields optional with strict Sri Lankan formats.
 */
const dropEmptyStrings = (v: unknown) =>
  v && typeof v === 'object' ? Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== '')) : v;

export const farmerUpdateSchema = z.object({
  body: z.preprocess(dropEmptyStrings, z.object({
    nic_number: sriLankaNIC.optional().nullable(),
    full_name: z.string().min(1).max(100).optional().nullable(),
    email: z.string().email().optional().or(z.literal('')).nullable(),
    phone: sriLankaPhone.optional().nullable(),
    address: z.string().min(1).optional().nullable(),
    district: z.string().min(1).optional().nullable(),
    divisional_secretariat: z.string().optional().nullable(),
    farm_name: z.string().optional().nullable(),
    farm_location: z.string().optional().nullable(),
    farm_size_acres: z.union([z.number().positive(), z.string().transform(v => parseFloat(v) || null)]).optional().nullable(),
    bank_name: z.string().optional().nullable(),
    bank_branch: z.string().optional().nullable(),
    account_holder_name: z.string().optional().nullable(),
    account_number: bankAccount.optional().or(z.literal('')).nullable(),
    account_number_masked: z.string().optional().nullable(),
    emergency_contact_name: z.string().optional().nullable(),
    emergency_contact_phone: sriLankaPhone.optional().or(z.literal('')).nullable(),
    assigned_centre_id: z.string().uuid().optional().nullable(),
    notes: z.string().optional().nullable(),
  })),
});

/** Today's date in Sri Lanka (YYYY-MM-DD), so the rule does not shift with the server's time zone. */
export const todayInSriLanka = (): string => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' });

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Crop calendar rules: dates must be real YYYY-MM-DD dates, the planting date cannot be in the past
 * (checked on create only – an existing crop may legitimately have been planted earlier) and the expected
 * harvest cannot be before planting or in the past.
 */
const cropDateRules = (b: { planting_date?: string | null; expected_harvest_date?: string | null }, ctx: z.RefinementCtx, isCreate: boolean) => {
  const today = todayInSriLanka();
  for (const key of ['planting_date', 'expected_harvest_date'] as const) {
    const v = b[key];
    if (v === undefined || v === null || v === '') continue;
    if (!ISO_DATE.test(v) || Number.isNaN(Date.parse(v))) {
      ctx.addIssue({ code: 'custom', path: [key], message: 'Date must be a valid date (YYYY-MM-DD)' });
    }
  }
  if (isCreate && b.planting_date && ISO_DATE.test(b.planting_date) && b.planting_date < today) {
    ctx.addIssue({ code: 'custom', path: ['planting_date'], message: 'Planting date cannot be in the past' });
  }
  if (b.expected_harvest_date && ISO_DATE.test(b.expected_harvest_date)) {
    if (b.expected_harvest_date < today) {
      ctx.addIssue({ code: 'custom', path: ['expected_harvest_date'], message: 'Expected harvest date cannot be in the past' });
    }
    if (b.planting_date && ISO_DATE.test(b.planting_date) && b.expected_harvest_date < b.planting_date) {
      ctx.addIssue({ code: 'custom', path: ['expected_harvest_date'], message: 'Expected harvest date cannot be before the planting date' });
    }
  }
};

export const cropSchema = z.object({
  body: z.object({
    farmer_id: z.string().uuid(),
    category_id: z.string().uuid(),
    variety_id: z.string().uuid().nullish(),
    cultivated_area_acres: z.number().positive().nullish(),
    planting_date: z.string().nullish(),
    expected_harvest_date: z.string().nullish(),
    expected_quantity_kg: z.number().positive().nullish(),
    farming_method: z.enum(['organic', 'conventional', 'hydroponic', 'mixed']).default('conventional'),
    certification_status: z.string().nullish(),
    notes: z.string().nullish(),
  }).superRefine((b, ctx) => cropDateRules(b, ctx, true)),
});

/**
 * Used for PUT crop updates — farmer_id and category_id are optional.
 */
export const cropUpdateSchema = z.object({
  body: z.object({
    farmer_id: z.string().uuid().optional(),
    category_id: z.string().uuid().optional(),
    variety_id: z.string().uuid().nullish(),
    cultivated_area_acres: z.number().positive().nullish(),
    planting_date: z.string().nullish(),
    expected_harvest_date: z.string().nullish(),
    expected_quantity_kg: z.number().positive().nullish(),
    farming_method: z.enum(['organic', 'conventional', 'hydroponic', 'mixed']).optional(),
    certification_status: z.string().nullish(),
    notes: z.string().nullish(),
    is_active: z.boolean().optional(),
  }).superRefine((b, ctx) => cropDateRules(b, ctx, false)),
});

export const collectionSchema = z.object({
  body: z.object({
    appointment_id: z.string().uuid().optional(),
    farmer_id: z.string().uuid(),
    centre_id: z.string().uuid(),
    category_id: z.string().uuid(),
    variety_id: z.string().uuid().optional(),
    vehicle_number: z.string().optional(),
    driver_name: z.string().optional(),
    notes: z.string().optional(),
  }),
});

export const weighSchema = z.object({
  body: z.object({
    gross_weight_kg: z.number().positive('Gross weight must be positive'),
    container_weight_kg: z.number().min(0, 'Container weight cannot be negative').default(0),
  }),
});

export const inspectionSchema = z.object({
  body: z.object({
    collection_id: z.string().uuid(),
    grade: z.enum(['grade_a', 'grade_b', 'grade_c', 'rejected']),
    accepted_qty_kg: z.number().min(0, 'Accepted quantity cannot be negative'),
    rejected_qty_kg: z.number().min(0, 'Rejected quantity cannot be negative').default(0),
    inspection_notes: z.string().optional(),
    rejection_reasons: z.array(z.object({
      reason: z.enum([
        'damaged', 'overripe', 'underripe', 'pest_damage',
        'contamination', 'incorrect_size', 'excessive_moisture',
        'poor_appearance', 'other'
      ]),
      quantity_kg: z.number().min(0).optional(),
      notes: z.string().optional(),
    })).optional(),
  }),
});

export const priceSchema = z.object({
  body: z.object({
    category_id: z.string().uuid(),
    variety_id: z.string().uuid().optional(),
    centre_id: z.string().uuid().optional(),
    grade: z.enum(['grade_a', 'grade_b', 'grade_c', 'rejected']),
    purchase_price: z.number().positive('Purchase price must be positive'),
    selling_price: z.number().positive('Selling price must be positive'),
    unit: z.string().default('kg'),
    effective_from: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
    effective_until: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  }),
});

export const orderSchema = z.object({
  body: z.object({
    buyer_id: z.string().uuid(),
    centre_id: z.string().uuid().optional(),
    requested_date: z.string().optional(),
    delivery_address: z.string().optional(),
    notes: z.string().optional(),
    items: z.array(z.object({
      category_id: z.string().uuid(),
      variety_id: z.string().uuid().optional(),
      grade: z.enum(['grade_a', 'grade_b', 'grade_c']).optional(),
      requested_qty_kg: z.number().positive('Quantity must be positive'),
      unit_price_lkr: z.number().positive().optional(),
    })).min(1, 'At least one item is required'),
  }),
});

export const farmerPaymentCalculateSchema = z.object({
  body: z.object({
    collection_id: z.string().uuid(),
    deductions: z.array(z.object({
      description: z.string(),
      amount_lkr: z.number().min(0),
    })).optional().default([]),
  }),
});

export const complaintSchema = z.object({
  body: z.object({
    category: z.enum([
      'incorrect_weight', 'incorrect_grade', 'incorrect_payment',
      'delayed_payment', 'delivery_issue', 'product_quality_issue',
      'system_issue', 'other'
    ]),
    subject: z.string().min(5).max(200),
    description: z.string().min(20),
    evidence_url: z.string().url().optional(),
  }),
});

export const paginationSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
    search: z.string().optional(),
    status: z.string().optional(),
    district: z.string().optional(),
    centre_id: z.string().uuid().optional(),
    from_date: z.string().optional(),
    to_date: z.string().optional(),
  }),
});
