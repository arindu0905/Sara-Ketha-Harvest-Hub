import { Router } from 'express';
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  createVariety,
  updateVariety,
  deleteVariety,
  getCrops,
  createCrop,
  getCropById,
  updateCrop,
  deleteCrop,
} from '../controllers/cropController';
import { authenticate, requireRole, validate } from '../middleware/auth';
import { cropSchema, cropUpdateSchema } from '../schemas/validationSchemas';

const router = Router();
router.use(authenticate);

router.get('/categories', getCategories);
router.get('/categories/:id', getCategoryById);
router.post('/categories', requireRole('administrator'), createCategory);
router.put('/categories/:id', requireRole('administrator'), updateCategory);
router.delete('/categories/:id', requireRole('administrator'), deleteCategory);

router.post('/categories/:categoryId/varieties', requireRole('administrator'), createVariety);
router.put('/varieties/:id', requireRole('administrator'), updateVariety);
router.delete('/varieties/:id', requireRole('administrator'), deleteVariety);

router.get('/', getCrops);
router.post('/', requireRole('farmer', 'collection_centre_officer', 'administrator'), validate(cropSchema), createCrop);
router.get('/:id', getCropById);
router.put('/:id', requireRole('farmer', 'collection_centre_officer', 'administrator'), validate(cropUpdateSchema), updateCrop);
router.delete('/:id', requireRole('farmer', 'collection_centre_officer', 'administrator'), deleteCrop);

export default router;
