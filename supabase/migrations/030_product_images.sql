-- RUN_8: product images stored inside the database
-- Every product (crop variety) and category can have one photo. The picture itself is saved in the table
-- product_images (as base64 text, with its type and size); the product keeps a link to it in image_url.
-- The API serves it at /api/product-images/<id>. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.product_images (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  TEXT NOT NULL CHECK (entity_type IN ('variety', 'category')),
  entity_id    UUID NOT NULL,
  file_name    TEXT NOT NULL,
  mime_type    TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
  size_bytes   INT  NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 3145728),
  image_data   TEXT NOT NULL,
  uploaded_by  UUID REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_images_entity ON public.product_images(entity_type, entity_id);

-- All access goes through the backend (service role)
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.product_images TO postgres, service_role;

ALTER TABLE public.crop_varieties ADD COLUMN IF NOT EXISTS image_url TEXT;

NOTIFY pgrst, 'reload schema';
