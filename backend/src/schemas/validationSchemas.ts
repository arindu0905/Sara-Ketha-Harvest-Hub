import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    full_name: z.string().min(2, 'Full name must be at least 2 characters').max(100),
    role: z.enum([
      'farmer', 'collection_centre_officer', 'quality_inspector',
      'inventory_manager', 'buyer', 'finance_officer',
      'transport_coordinator', 'administrator'
    ]).optional().default('farmer'),
    phone: z.string().optional(),
  }),
});

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

export const farmerSchema = z.object({
  body: z.object({
    nic_number: z.string().min(9).max(12, 'Invalid NIC format'),
    full_name: z.string().min(2).max(100),
    email: z.string().email().optional(),
    phone: z.string().min(10, 'Invalid phone number'),
    address: z.string().min(5),
    district: z.string().min(2),
    divisional_secretariat: z.string().optional(),
    farm_name: z.string().optional(),
    farm_location: z.string().optional(),
    farm_size_acres: z.number().positive().optional(),
    bank_name: z.string().optional(),
    bank_branch: z.string().optional(),
    account_holder_name: z.string().optional(),
    account_number: z.string().optional(),
    emergency_contact_name: z.string().optional(),
    emergency_contact_phone: z.string().optional(),
    assigned_centre_id: z.string().uuid().optional(),
    notes: z.string().optional(),
  }),
});

export const cropSchema = z.object({
  body: z.object({
    farmer_id: z.string().uuid(),
    category_id: z.string().uuid(),
    variety_id: z.string().uuid().optional(),
    cultivated_area_acres: z.number().positive().optional(),
    planting_date: z.string().optional(),
    expected_harvest_date: z.string().optional(),
    expected_quantity_kg: z.number().positive().optional(),
    farming_method: z.enum(['organic', 'conventional', 'hydroponic', 'mixed']).default('conventional'),
    certification_status: z.string().optional(),
    notes: z.string().optional(),
  }),
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
