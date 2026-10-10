-- RUN_8: product images (marketplace)
-- Lets the administrator attach a photo to every product (crop variety). Safe to re-run.
-- (Category images already have a column; the image files themselves are stored in the "product-images" storage bucket,
--  which the API creates automatically on the first upload.)

ALTER TABLE public.crop_varieties ADD COLUMN IF NOT EXISTS image_url TEXT;

NOTIFY pgrst, 'reload schema';
