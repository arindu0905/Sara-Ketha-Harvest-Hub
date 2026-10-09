import { Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest } from '../middleware/auth';
import { assertFarmerAccess } from '../services/access';

const BUCKET = 'farmer-documents';
const DOC_TYPES = ['nic', 'land_deed', 'bank_passbook', 'farmer_certificate', 'other'];
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_BYTES = 5 * 1024 * 1024;

/** GET /api/farmers/:id/documents – list with short-lived signed download links. */
export const listFarmerDocuments = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const farmerId = req.params.id;
    await assertFarmerAccess(req, farmerId);
    const { data, error } = await supabaseAdmin
      .from('farmer_documents').select('*').eq('farmer_id', farmerId).order('uploaded_at', { ascending: false });
    if (error) throw new AppError(error.message, 500);

    const docs = await Promise.all((data || []).map(async (d: any) => {
      const { data: signed } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(d.storage_path, 600);
      return { ...d, url: signed?.signedUrl ?? null };
    }));
    sendSuccess(res, { data: docs });
  } catch (e) { next(e); }
};

/**
 * POST /api/farmers/:id/documents
 * Body: { doc_type, file_name, data: "data:<mime>;base64,...", notes? }
 */
export const uploadFarmerDocument = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const farmerId = req.params.id;
    await assertFarmerAccess(req, farmerId);
    const { doc_type = 'other', file_name, data } = req.body as Record<string, string>;

    if (!DOC_TYPES.includes(doc_type)) throw new AppError('Invalid document type', 400);
    const m = typeof data === 'string' ? data.match(/^data:([\w/+.-]+);base64,(.+)$/) : null;
    if (!m) throw new AppError('A base64 data-URI file is required', 400);
    const mime = m[1];
    if (!ALLOWED_MIME.includes(mime)) throw new AppError('Only JPG, PNG, WEBP or PDF files are allowed', 400);
    const buffer = Buffer.from(m[2], 'base64');
    if (buffer.length === 0 || buffer.length > MAX_BYTES) throw new AppError('File must be between 1 byte and 5 MB', 400);

    const { data: farmer } = await supabaseAdmin.from('farmers').select('id').eq('id', farmerId).maybeSingle();
    if (!farmer) throw new AppError('Farmer not found', 404);

    const ext = mime === 'application/pdf' ? 'pdf' : mime.split('/')[1].replace('jpeg', 'jpg');
    const safeName = String(file_name || `document.${ext}`).replace(/[^\w.\- ]/g, '_').slice(0, 120);
    const storagePath = `${farmerId}/${Date.now()}_${safeName}`;

    const { error: upErr } = await supabaseAdmin.storage.from(BUCKET).upload(storagePath, buffer, { contentType: mime, upsert: false });
    if (upErr) throw new AppError(`Upload failed: ${upErr.message}`, 500);

    const { data: record, error } = await supabaseAdmin.from('farmer_documents').insert({
      farmer_id: farmerId, document_type: doc_type, file_name: safeName, storage_path: storagePath,
      mime_type: mime, file_size: buffer.length, uploaded_by: req.user?.id ?? null,
    }).select().single();
    if (error) {
      await supabaseAdmin.storage.from(BUCKET).remove([storagePath]);
      throw new AppError(error.message, 500);
    }
    sendSuccess(res, { data: record, statusCode: 201, message: 'Document uploaded' });
  } catch (e) { next(e); }
};

/** DELETE /api/farmers/:id/documents/:docId */
export const deleteFarmerDocument = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id: farmerId, docId } = req.params;
    await assertFarmerAccess(req, farmerId);
    const { data: doc } = await supabaseAdmin
      .from('farmer_documents').select('id, storage_path').eq('id', docId).eq('farmer_id', farmerId).maybeSingle();
    if (!doc) throw new AppError('Document not found', 404);
    await supabaseAdmin.storage.from(BUCKET).remove([doc.storage_path]);
    const { error } = await supabaseAdmin.from('farmer_documents').delete().eq('id', docId);
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { message: 'Document deleted' });
  } catch (e) { next(e); }
};

/** PATCH /api/farmers/:id/documents/:docId/verify – officer marks a document as checked. */
export const verifyFarmerDocument = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id: farmerId, docId } = req.params;
    const verified = req.body?.is_verified !== false;
    const { data, error } = await supabaseAdmin
      .from('farmer_documents').update({ is_verified: verified }).eq('id', docId).eq('farmer_id', farmerId).select().maybeSingle();
    if (error) throw new AppError(error.message, 500);
    if (!data) throw new AppError('Document not found', 404);
    sendSuccess(res, { data, message: verified ? 'Document marked as verified' : 'Verification removed' });
  } catch (e) { next(e); }
};
