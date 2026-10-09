import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest } from '../middleware/auth';
import { rpcToAppError } from '../utils/rpcError';

const mapRejectionReason = (reasonStr: string): string => {
  if (!reasonStr) return 'other';
  const s = reasonStr.toLowerCase();
  if (s.includes('pest') || s.includes('disease')) return 'pest_damage';
  if (s.includes('over-ripe') || s.includes('overripe') || s.includes('decompos')) return 'overripe';
  if (s.includes('moisture') || s.includes('wet')) return 'excessive_moisture';
  if (s.includes('appearance') || s.includes('discolor')) return 'poor_appearance';
  if (s.includes('under-size') || s.includes('undersize') || s.includes('underripe') || s.includes('immature')) return 'incorrect_size';
  if (s.includes('physical') || s.includes('bruis') || s.includes('crush') || s.includes('damage')) return 'damaged';
  if (s.includes('fungal') || s.includes('mold') || s.includes('mould')) return 'fungal_infection';
  if (s.includes('pesticide') || s.includes('residue') || s.includes('contam')) return 'pesticide_residue';
  const validEnums = ['damaged', 'overripe', 'underripe', 'pest_damage', 'contamination', 'incorrect_size', 'excessive_moisture', 'poor_appearance', 'fungal_infection', 'pesticide_residue', 'other'];
  if (validEnums.includes(s)) return s;
  return 'other';
};

/**
 * POST /api/inspections
 * Finalise a quality inspection in ONE database transaction (finalize_inspection):
 * validates weights/quantities, records rejections, creates the inventory batch + batch code,
 * issues the collection receipt and notifies the farmer. (E2-US4/5/7/8/9)
 */
export const createInspection = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { collection_id, grade, inspection_notes, rejection_reasons = [] } = req.body;
    const accepted = Number(req.body.accepted_qty_kg);
    const rejected = Number(req.body.rejected_qty_kg ?? 0);

    if (!collection_id) throw new AppError('collection_id is required', 400);
    if (!['grade_a', 'grade_b', 'grade_c', 'rejected'].includes(grade)) throw new AppError('Invalid quality grade', 400);
    if (!Number.isFinite(accepted) || !Number.isFinite(rejected)) throw new AppError('Accepted and rejected quantities must be numbers', 400);

    const rejections = (Array.isArray(rejection_reasons) ? rejection_reasons : []).map(
      (r: { reason: string; quantity_kg?: number; notes?: string }) => ({
        reason: mapRejectionReason(r.reason),
        quantity_kg: Number(r.quantity_kg) || 0,
        notes: r.notes || null,
      })
    );
    // If the inspector rejected produce but gave a single reason without a quantity, attribute the whole rejected qty to it.
    if (rejections.length === 1 && rejections[0].quantity_kg === 0 && rejected > 0) rejections[0].quantity_kg = rejected;

    const { data, error } = await supabaseAdmin.rpc('finalize_inspection', {
      p_collection_id: collection_id,
      p_inspector: req.user?.id,
      p_grade: grade,
      p_accepted: accepted,
      p_rejected: rejected,
      p_notes: inspection_notes || null,
      p_rejections: rejections,
    });
    if (error) throw rpcToAppError(error);

    const result = data as { inspection_id: string; batch_no?: string; receipt_no: string };
    const { data: inspection } = await supabaseAdmin.from('quality_inspections').select('*').eq('id', result.inspection_id).single();

    sendSuccess(res, {
      data: { ...inspection, batch_no: result.batch_no ?? null, receipt_no: result.receipt_no },
      statusCode: 201,
      message: result.batch_no
        ? `Inspection recorded. Batch ${result.batch_no} created, receipt ${result.receipt_no} issued.`
        : `Inspection recorded. Receipt ${result.receipt_no} issued.`,
    });
  } catch (e) { next(e); }
};

/**
 * GET /api/inspections/:id
 */
export const getInspectionById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('quality_inspections')
      .select(`
        *, collection_rejections(*),
        produce_collections!collection_id(
          collection_no, net_weight_kg, farmer_id,
          farmers!farmer_id(full_name, farmer_code),
          crop_categories!category_id(name),
          crop_varieties!variety_id(name)
        ),
        profiles!inspector_id(full_name)
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !data) throw new AppError('Inspection not found', 404);
    sendSuccess(res, { data });
  } catch (e) { next(e); }
};

/**
 * POST /api/inspections/:id/approve
 */
export const approveInspection = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('quality_inspections')
      .update({ approved_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data, message: 'Inspection approved' });
  } catch (e) { next(e); }
};

/**
 * GET /api/inspections — pending inspections
 */
export const getPendingInspections = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('produce_collections')
      .select(`
        id, collection_no, status, net_weight_kg, created_at,
        farmers!farmer_id(full_name, farmer_code),
        crop_categories!category_id(name),
        collection_centres!centre_id(name)
      `)
      .in('status', ['pending_inspection', 'weighed'])
      .order('created_at', { ascending: false });

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data: data || [] });
  } catch (e) { next(e); }
};

// ─── Inspection Evidence Images ───────────────────────────────────────────────

/**
 * POST /api/inspections/:id/images
 * Upload base64-encoded evidence images and save to DB.
 * Body: { images: [{ data: "data:image/jpeg;base64,...", caption?: string, image_type?: string }] }
 */
export const uploadInspectionImages = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id: inspectionId } = req.params;
    const { images } = req.body as { images: { data: string; caption?: string; image_type?: string }[] };

    if (!images || !Array.isArray(images) || images.length === 0) {
      throw new AppError('No images provided', 400);
    }

    // Verify inspection exists
    const { data: inspection } = await supabaseAdmin
      .from('quality_inspections')
      .select('id')
      .eq('id', inspectionId)
      .single();
    if (!inspection) throw new AppError('Inspection not found', 404);

    const savedImages: any[] = [];
    let firstDbError: string | null = null;

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      if (!img.data) continue;

      // Strip data URI prefix -> get base64 payload + mime
      const matches = img.data.match(/^data:(.+);base64,(.+)$/);
      if (!matches) continue;
      const mimeType = matches[1]; // e.g. image/jpeg
      const base64Data = matches[2];
      const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
      const fileName = `inspection_${inspectionId}_${Date.now()}_${i}.${ext}`;
      const storagePath = `inspection-evidence/${inspectionId}/${fileName}`;

      // Convert base64 to Buffer
      const buffer = Buffer.from(base64Data, 'base64');

      // Upload to Supabase Storage
      const { error: uploadErr } = await supabaseAdmin.storage
        .from('evidence-images')
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadErr) {
        console.warn(`Storage upload failed for image ${i}: ${uploadErr.message}`);
        // Still save with a placeholder path so record is created
      }

      // Get public URL
      const { data: urlData } = supabaseAdmin.storage
        .from('evidence-images')
        .getPublicUrl(storagePath);

      const publicUrl = urlData?.publicUrl || storagePath;

      // Save record to DB
      const { data: record, error: dbErr } = await supabaseAdmin
        .from('inspection_evidence_images')
        .insert({
          inspection_id: inspectionId,
          storage_path:  publicUrl,
          file_name:     fileName,
          caption:       img.caption   || null,
          image_type:    img.image_type || 'general',
          sort_order:    i,
          uploaded_by:   req.user?.id || null,
        })
        .select()
        .single();

      if (dbErr) {
        firstDbError = firstDbError ?? dbErr.message;
        console.warn(`DB insert failed for image ${i}: ${dbErr.message}`);
      } else if (record) {
        savedImages.push(record);
      }
    }

    if (savedImages.length === 0 && firstDbError) {
      throw new AppError(`Evidence images could not be saved (${firstDbError}). Ask the administrator to run migration 022 (inspection_evidence_images).`, 500);
    }

    sendSuccess(res, {
      data: savedImages,
      statusCode: 201,
      message: `${savedImages.length} image(s) uploaded successfully`,
    });
  } catch (e) { next(e); }
};

/**
 * GET /api/inspections/:id/images
 * Retrieve all evidence images for an inspection.
 */
export const getInspectionImages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('inspection_evidence_images')
      .select('*, profiles!uploaded_by(full_name)')
      .eq('inspection_id', req.params.id)
      .order('sort_order', { ascending: true });

    // Older databases may not have the evidence table yet – show "no images" instead of failing the page.
    if (error && /schema cache|does not exist/i.test(error.message)) { sendSuccess(res, { data: [] }); return; }
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data: data || [] });
  } catch (e) { next(e); }
};

/**
 * DELETE /api/inspections/:id/images/:imageId
 */
export const deleteInspectionImage = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { error } = await supabaseAdmin
      .from('inspection_evidence_images')
      .delete()
      .eq('id', req.params.imageId)
      .eq('inspection_id', req.params.id);

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { message: 'Image deleted' });
  } catch (e) { next(e); }
};
