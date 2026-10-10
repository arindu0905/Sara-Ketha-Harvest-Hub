/** Shared form validators (each returns an error message, or null when the value is valid). */

export const validateNIC = (value: string): string | null => {
  if (!value) return 'NIC number is required';
  if (!/^(\d{9}[VvXx]|\d{12})$/.test(value.trim()))
    return 'Old NIC: 9 digits + V or X (e.g. 781234567V) · New NIC: 12 digits (e.g. 198012345678)';
  return null;
};

export const validateSLPhone = (value: string): string | null => {
  if (!value) return 'Phone number is required';
  if (!/^0\d{9}$/.test(value.trim())) return 'Phone must be 10 digits starting with 0 (e.g. 0771234567)';
  return null;
};

export const validateLicense = (value: string): string | null => {
  if (!value) return 'Licence number is required';
  if (!/^[A-Z]{1,2}\d{4,8}$/i.test(value.trim())) return 'Licence number looks like B1234567 (1–2 letters followed by 4–8 digits)';
  return null;
};
