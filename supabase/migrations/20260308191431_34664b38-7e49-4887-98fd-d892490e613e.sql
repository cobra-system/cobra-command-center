
-- Add missing products from website
INSERT INTO products (name, sku, category, product_type, stock_qty, incoming_qty, description, end_product_url, end_product_image)
VALUES 
  ('CarPlay for Apple iOS', 'carplay-ios', 'מולטימדיה', 'מוגמר', 0, 0, 'CarPlay, בבסיסה, היא הדרך של אפל להביא את iOS אל הרכב שלכם ולשקף את האפליקציות הרלוונטיות.', 'https://cobra.co.il/products/multimedia', 'https://kgtpnkocukdpfeiqvign.supabase.co/storage/v1/object/public/product-images/2ac63038-ceed-41a4-98e3-a903e8880d48.jpg'),
  ('חבילת סמארטפון כוללת', 'smartphone-pkg', 'נוחות וקישוריות', 'מוגמר', 0, 0, 'חבילה מקיפה לחיבור הסמארטפון', 'https://cobra.co.il/products/comfort', NULL);

-- Update existing products with website URLs and images
UPDATE products SET 
  end_product_url = 'https://cobra.co.il/products/security',
  end_product_image = 'https://kgtpnkocukdpfeiqvign.supabase.co/storage/v1/object/public/product-images/654414fd-c9af-44d5-82e8-2c1bd148061c.jpg'
WHERE id = '3346637c-116a-4021-9022-36a9f0153362'; -- PROOF Z-4K

UPDATE products SET 
  end_product_url = 'https://cobra.co.il/products/security',
  end_product_image = 'https://kgtpnkocukdpfeiqvign.supabase.co/storage/v1/object/public/product-images/b3ea0b61-28ad-4a44-a78e-999f5bb61a1a.png'
WHERE id = '80796a7c-5937-41c3-a867-3badeab12db8'; -- COBRA Secret

UPDATE products SET 
  end_product_url = 'https://cobra.co.il/products/security',
  end_product_image = 'https://kgtpnkocukdpfeiqvign.supabase.co/storage/v1/object/public/product-images/1867a4e0-2975-4d0b-a57e-ed7032a71417.jpg'
WHERE id = '5075c10f-8e81-49cf-bf55-0ff18f7b67f1'; -- Cobra Connect

UPDATE products SET 
  end_product_url = 'https://cobra.co.il/products/security',
  end_product_image = 'https://kgtpnkocukdpfeiqvign.supabase.co/storage/v1/object/public/product-images/b1b131a4-5160-4202-8d34-d91bfdd64f35.jpg'
WHERE id = 'f2ef4b54-cc79-457e-9d28-1c00e7967888'; -- COBRA Biometric

UPDATE products SET 
  end_product_url = 'https://cobra.co.il/products/multimedia',
  end_product_image = 'https://kgtpnkocukdpfeiqvign.supabase.co/storage/v1/object/public/product-images/c471e069-862f-4f25-aa51-2da438180eea.jpg'
WHERE id IN ('6e543c60-5b9c-4e02-b3b8-2043341dea89', '65386b8a-b6f6-4ad6-8d15-954d98dca96f'); -- BackseatTV1 & TV2

UPDATE products SET 
  end_product_url = 'https://cobra.co.il/products/advanced-safety',
  end_product_image = 'https://kgtpnkocukdpfeiqvign.supabase.co/storage/v1/object/public/product-images/8c40304a-f9ff-4329-8f2a-ba1e04ef1894.jpg'
WHERE id = '314d0fa6-9aea-452e-8d14-99ec7383dec6'; -- הכפתור

UPDATE products SET 
  end_product_url = 'https://cobra.co.il/products/advanced-safety',
  end_product_image = 'https://kgtpnkocukdpfeiqvign.supabase.co/storage/v1/object/public/product-images/faac52d4-c8c0-4b7a-bf2f-743b4a8fc899.jpg'
WHERE id = 'dd42601d-c3b4-4390-bd3e-385d52290573'; -- Blindspot

UPDATE products SET 
  end_product_url = 'https://cobra.co.il/products/advanced-safety',
  end_product_image = 'https://kgtpnkocukdpfeiqvign.supabase.co/storage/v1/object/public/product-images/555a8f0b-4381-4220-9726-8dec9e0b9584.jpg'
WHERE id = '063cda4c-8a67-4da5-9ab1-7d51f5789d3f'; -- AWACS CM 108

UPDATE products SET 
  end_product_url = 'https://cobra.co.il/products/advanced-safety',
  end_product_image = 'https://kgtpnkocukdpfeiqvign.supabase.co/storage/v1/object/public/product-images/27ae7d3e-966d-4c0e-a252-8ef5f76193ac.jpg'
WHERE id = 'a08eae25-9e1b-40b4-bc5b-ca45f023f510'; -- Surround-Eye

UPDATE products SET 
  end_product_url = 'https://cobra.co.il/products/comfort',
  end_product_image = 'https://kgtpnkocukdpfeiqvign.supabase.co/storage/v1/object/public/product-images/a7d657df-5a1b-4b40-8ef3-c7c4b1ce79f8.jpg'
WHERE id = '8d5ef79e-0a52-4191-a942-be1bdb463013'; -- COBRA Mobile Key

UPDATE products SET 
  end_product_url = 'https://cobra.co.il/products/comfort',
  end_product_image = 'https://kgtpnkocukdpfeiqvign.supabase.co/storage/v1/object/public/product-images/00869af2-5c5f-4100-8750-912c0a997cda.jpg'
WHERE id = '9b342fb4-bbc3-4303-b293-b2064dc30b1c'; -- פותח תא מטען
