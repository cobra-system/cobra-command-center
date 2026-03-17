-- ============================================================
-- COBRA Operations — Full Database Backup
-- Generated: 2026-03-12
-- ============================================================

-- ============================================================
-- PROFILES
-- ============================================================
INSERT INTO profiles (id, name, role, pin, created_at, updated_at) VALUES
  ('5eda5d68-188b-47ab-919e-29b7882a343b', 'נועם', 'MANAGER', NULL, '2026-03-08 17:05:24.976829+00', '2026-03-08 20:58:40.602576+00'),
  ('50138e6e-506b-4b3e-9f15-5acac6804159', 'גיאורגי גריגוריאנץ', 'WAREHOUSE_MANAGER', '1231', '2026-03-08 17:05:25.372271+00', '2026-03-08 23:37:35.209659+00'),
  ('6a9af853-0090-4289-af71-ffc869c7e156', 'זיו בוזגלו', 'LOGISTICS', '$2a$06$3IYxDta3UydkeZXCztu45OnXGgSSzrOQ5Y5mKFlmk8a.YaVLEbhoq', '2026-03-08 17:05:25.694754+00', '2026-03-08 23:38:21.370928+00')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, role=EXCLUDED.role, pin=EXCLUDED.pin;

-- ============================================================
-- USER_ROLES
-- ============================================================
INSERT INTO user_roles (id, user_id, role) VALUES
  ('08abe315-b265-428e-b10e-a91ed19ed042', '5eda5d68-188b-47ab-919e-29b7882a343b', 'MANAGER'),
  ('2d6aaffa-0a35-467d-8ecd-e84a9a356f3d', '50138e6e-506b-4b3e-9f15-5acac6804159', 'WAREHOUSE_MANAGER'),
  ('d42351b8-61f5-4dfa-a7c7-d23d11acf40d', '6a9af853-0090-4289-af71-ffc869c7e156', 'LOGISTICS')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ROLE_DEFINITIONS
-- ============================================================
INSERT INTO role_definitions (id, name, system_key, created_at) VALUES
  ('9dc7bed0-a016-4e6f-b58e-be568f042529', 'מנהל מחסן', 'WAREHOUSE_MANAGER', '2026-03-08 21:23:21.049924+00'),
  ('3a186202-6b55-48eb-8654-8244a68420d1', 'לוגיסטיקה', 'LOGISTICS', '2026-03-08 21:23:21.049924+00'),
  ('48811b63-b864-492d-be5e-6ddf6ed0a3c4', 'לוגיסטיקה ושינוע', 'DRIVER', '2026-03-08 21:23:21.049924+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- PRODUCTS
-- ============================================================
INSERT INTO products (id, category, division, name, description, sku, product_type, supplier, supplier_origin, shipping, purchase_price, monthly_sales, monthly_order, stock_qty, incoming_qty, notes, end_product_image, end_product_url, created_at, updated_at) VALUES
  ('3346637c-116a-4021-9022-36a9f0153362', 'מיגון ואיתור', 'AWCAS', 'PROOF Z-4K', 'מערכת צילום וניטור', 'z4k', 'מוגמר', 'iStar', 'סין', 'ימי + אווירי', 95, 630, 1600, 1600, 1600, NULL, 'https://kgtpnkocukdpfeiqvign.supabase.co/storage/v1/object/public/product-images/654414fd-c9af-44d5-82e8-2c1bd148061c.jpg', 'https://proof.co.il/', '2026-03-08 17:05:25.865322+00', '2026-03-08 22:30:12.631792+00'),
  ('f3147d85-0552-4dbc-9c93-48a503f62f26', 'מיגון ואיתור', 'AWCAS', 'S400', 'מערכת צילום וניטור', 's400', 'מוגמר', 'iStar', 'סין', 'ימי + אווירי', 83, 105, 400, 0, 400, NULL, 'https://ljpdwezgahrrffnwajho.supabase.co/storage/v1/object/public/documents/product-images/s400.jpg', NULL, '2026-03-08 17:05:25.933704+00', '2026-03-08 22:31:46.322644+00'),
  ('4e2d8c92-3c5d-4510-a90c-9d2bf5ad8352', 'מיגון ואיתור', 'כפתור', 'KAF32', 'מערכת צילום וניטור', 'ks400', 'מוגמר', 'iStar', 'סין', 'ימי + אווירי', 73, 0, 50, 77, 200, 'SAP לא מיושר מול חברת כפתור', 'https://ljpdwezgahrrffnwajho.supabase.co/storage/v1/object/public/documents/product-images/kaf32.jpg', NULL, '2026-03-08 17:05:26.010353+00', '2026-03-08 22:31:59.263141+00'),
  ('80796a7c-5937-41c3-a867-3badeab12db8', 'מיגון ואיתור', 'כפתור', 'COBRA Secret', 'מערכת ניטור וניתוק', 'cobrasecrect', 'מורכב', 'CR Team', 'ישראל, סין', 'ימי', NULL, 50, 50, 383, 0, 'אין צפי הזמנות. אין צריכה.', 'https://kgtpnkocukdpfeiqvign.supabase.co/storage/v1/object/public/product-images/b3ea0b61-28ad-4a44-a78e-999f5bb61a1a.png', 'https://cobrasecret.co.il/', '2026-03-08 17:05:26.074002+00', '2026-03-08 23:21:08.875874+00'),
  ('f2ef4b54-cc79-457e-9d28-1c00e7967888', 'מיגון ואיתור', 'AWCAS', 'COBRA Biometric', 'מערכת התנעה ביומטרית', 'biofin', 'מורכב', 'CR Team', 'ישראל, סין', 'אווירי', NULL, 20, NULL, 0, 0, 'לעדכן ספירה', 'https://kgtpnkocukdpfeiqvign.supabase.co/storage/v1/object/public/product-images/b1b131a4-5160-4202-8d34-d91bfdd64f35.jpg', 'https://id.cobra.co.il/', '2026-03-08 17:05:26.127678+00', '2026-03-08 19:19:54.392552+00'),
  ('5075c10f-8e81-49cf-bf55-0ff18f7b67f1', 'מיגון ואיתור', 'AWCAS, דלק מוטורס, כפתור', 'מערכת איתור Connect', 'מערכת ניטור', '5224', 'מוגמר', 'CR Team', 'ישראל', 'יבשה', NULL, 200, 300, 1008, 0, NULL, 'https://kgtpnkocukdpfeiqvign.supabase.co/storage/v1/object/public/product-images/1867a4e0-2975-4d0b-a57e-ed7032a71417.jpg', 'https://cobra.co.il/products/security', '2026-03-08 17:05:26.187157+00', '2026-03-08 22:37:09.080524+00'),
  ('6e543c60-5b9c-4e02-b3b8-2043341dea89', 'מולטימדיה', 'AWCAS', 'COBRA BackseatTV1', 'מערכת מולטימדיה', 'cobratv1', 'מורכב', 'ACESVision', 'סין', 'ימי', 232.9, 3, NULL, 69, 0, NULL, 'https://kgtpnkocukdpfeiqvign.supabase.co/storage/v1/object/public/product-images/c471e069-862f-4f25-aa51-2da438180eea.jpg', 'https://tv.cobra.co.il/', '2026-03-08 17:05:26.244618+00', '2026-03-08 19:19:54.392552+00'),
  ('65386b8a-b6f6-4ad6-8d15-954d98dca96f', 'מולטימדיה', 'AWCAS', 'COBRA BackseatTV2', 'מערכת מולטימדיה', 'cobratv2', 'מורכב', 'ACESVision', 'סין', 'ימי', 140, 2, NULL, 0, 0, NULL, 'https://kgtpnkocukdpfeiqvign.supabase.co/storage/v1/object/public/product-images/c471e069-862f-4f25-aa51-2da438180eea.jpg', 'https://tv.cobra.co.il/', '2026-03-08 17:05:26.310556+00', '2026-03-08 19:19:54.392552+00'),
  ('a7dac02e-b3e7-4870-9976-f13c31f71086', 'מולטימדיה', 'קראסו, דלק מוטורס, לובינסקי', 'מסכי אנדרואיד', 'מערכת מולטימדיה', 'AHM1280A', 'מוגמר', 'AcesVision', 'סין', 'ימי', 130, 42, NULL, 63, 0, NULL, 'https://ljpdwezgahrrffnwajho.supabase.co/storage/v1/object/public/documents/product-images/android-screen.jpg', NULL, '2026-03-08 17:05:26.367424+00', '2026-03-08 22:38:08.639734+00'),
  ('7e91a3e7-8a09-4c61-8098-58a4eef14b5b', 'מולטימדיה', 'קראסו, דלק מוטורס, לובינסקי', 'אוזניות בלוטוס', 'אוזניות בלוטוס', 'BT100', 'מוגמר', 'AcesVision', 'סין', 'ימי', 7.5, 65, NULL, 0, 0, 'לעדכן ספירה', 'https://www.payngo.co.il/cdn-cgi/image/format=auto,metadata=none,quality=90,width=700,height=700/media/catalog/product/a/e/aem_qc-headphonearn_pdp_gallery_black-7dd.png', NULL, '2026-03-08 17:05:26.665806+00', '2026-03-08 22:38:51.767923+00'),
  ('314d0fa6-9aea-452e-8d14-99ec7383dec6', 'בטיחות', 'כפתור, קראסו (פריזבי)', 'הכפתור', NULL, 'kaf4g_new', 'מוגמר', 'CR Team', 'ישראל', 'יבשתי', 180, NULL, 780, 194, 500, 'צריך ליישר קו עם מחלקת הכפתור בנוגע למקטים', 'https://kgtpnkocukdpfeiqvign.supabase.co/storage/v1/object/public/product-images/8c40304a-f9ff-4329-8f2a-ba1e04ef1894.jpg', 'https://kaftor.co.il/', '2026-03-08 17:05:26.718149+00', '2026-03-08 22:01:53.459828+00'),
  ('dd42601d-c3b4-4390-bd3e-385d52290573', 'בטיחות', 'AWCAS, כפתור, קראסו', 'Blindspot', NULL, 'm305', 'מוגמר', 'AutoStar', 'סין', 'ימי', 84, 105, 100, 0, 0, 'לעדכן ספירה', 'https://kgtpnkocukdpfeiqvign.supabase.co/storage/v1/object/public/product-images/faac52d4-c8c0-4b7a-bf2f-743b4a8fc899.jpg', 'https://awacs.co.il/', '2026-03-08 17:05:26.770074+00', '2026-03-08 19:19:54.392552+00'),
  ('063cda4c-8a67-4da5-9ab1-7d51f5789d3f', 'בטיחות', 'AWCAS', 'AWACS CM 108', NULL, 'r8', 'מורכב', 'A.I.Matics', 'דרום קוריאה', 'ימי', 145, 60, NULL, 6, 500, NULL, 'https://kgtpnkocukdpfeiqvign.supabase.co/storage/v1/object/public/product-images/555a8f0b-4381-4220-9726-8dec9e0b9584.jpg', 'https://awacs.co.il/product/cm-107-2/', '2026-03-08 17:05:26.824267+00', '2026-03-08 20:54:10.092629+00'),
  ('a08eae25-9e1b-40b4-bc5b-ca45f023f510', 'בטיחות', 'דלק מוטורס', 'Surround-Eye Parking Sensors', NULL, 'r294', 'מוגמר', 'Vodafone', 'איטליה', 'אווירי', 26, 260, 300, 242, 0, NULL, 'https://kgtpnkocukdpfeiqvign.supabase.co/storage/v1/object/public/product-images/27ae7d3e-966d-4c0e-a252-8ef5f76193ac.jpg', 'https://cobra.co.il/products/advanced-safety', '2026-03-08 17:05:26.886966+00', '2026-03-08 22:41:17.162498+00'),
  ('36e56262-698c-4621-910a-33fbaa099ae5', 'בטיחות', 'דלק מוטורס', 'COBRA Alert', NULL, '4821', 'מוגמר', 'Vodafone', 'איטליה', 'אווירי', 39.5, 530, 775, 63, 0, NULL, 'https://ljpdwezgahrrffnwajho.supabase.co/storage/v1/object/public/documents/product-images/cobra-alert.jpg', NULL, '2026-03-08 17:05:26.941809+00', '2026-03-08 22:39:47.967318+00'),
  ('8d5ef79e-0a52-4191-a942-be1bdb463013', 'נוחות וקישוריות', 'כפתור', 'COBRA Mobile Key', NULL, 'mkey-v05', 'מורכב', 'CR Team', 'ישראל, סין', 'ימי', NULL, 15, NULL, 226, 0, NULL, 'https://kgtpnkocukdpfeiqvign.supabase.co/storage/v1/object/public/product-images/a7d657df-5a1b-4b40-8ef3-c7c4b1ce79f8.jpg', 'https://www.m-key.co.il/', '2026-03-08 17:05:26.995381+00', '2026-03-08 19:19:54.392552+00'),
  ('9b342fb4-bbc3-4303-b293-b2064dc30b1c', 'נוחות וקישוריות', 'דלק מוטורס', 'פותח תא מטען', NULL, 'tgcx5', 'מוגמר', 'Vehicle Tech', 'סין', 'ימי + אווירי', 230, 37, 50, 190, 50, 'כרגע אין צפי הזמנות מדלק מוטורס', 'https://kgtpnkocukdpfeiqvign.supabase.co/storage/v1/object/public/product-images/00869af2-5c5f-4100-8750-912c0a997cda.jpg', 'https://cobra.co.il/products/comfort', '2026-03-08 17:05:27.047521+00', '2026-03-08 22:43:26.506189+00'),
  ('6b97068e-cf65-488a-8a60-3a149a77599c', 'נוחות וקישוריות', 'לובינסקי', 'פותח מצלמה אחורית לברלינגו', NULL, '31217', 'מוגמר', 'BOW', 'סין', 'אווירי', 86, 90, 100, 162, 0, NULL, 'https://ljpdwezgahrrffnwajho.supabase.co/storage/v1/object/public/documents/product-images/rear-camera-berlingo.jpg', NULL, '2026-03-08 17:05:27.098485+00', '2026-03-08 19:29:44.14924+00'),
  ('3c61ac22-200a-4042-8d5f-28bae43b7165', 'בית', 'Doore', 'Doore', NULL, 'doorexr-full', 'מורכב', 'CR Team', 'ישראל, סין', 'ימי + אווירי', NULL, 60, NULL, 169, 0, NULL, 'https://doore.co.il/assets/doore-facial-recognition-hero-CGC8R8h-.png', 'https://doore.co.il/', '2026-03-08 17:05:27.15291+00', '2026-03-08 23:20:41.990841+00'),
  ('49d4a694-77ce-4bf0-b05a-52cc9e65463b', 'מיגון ואיתור', NULL, 'כרית מושב לכפתור', NULL, 'UNKNOW', 'מוגמר', 'Canglory', NULL, NULL, NULL, NULL, NULL, 0, 0, NULL, NULL, NULL, '2026-03-11 13:02:37.975425+00', '2026-03-11 13:02:37.975425+00')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, sku=EXCLUDED.sku, category=EXCLUDED.category, stock_qty=EXCLUDED.stock_qty, incoming_qty=EXCLUDED.incoming_qty;

-- ============================================================
-- SUPPLIERS
-- ============================================================
INSERT INTO suppliers (id, company, contact_name, country, email, phone, website, notes, created_at) VALUES
  ('9756e3a3-dc31-4340-8051-b50252f97c49', 'iStar', 'Carolyn Tang', 'סין', 'carolyn@istarvideo.com', '+86-755-8622-1951', 'www.istarvideo.com', NULL, '2026-03-08 20:48:33.887498+00'),
  ('7181e4b2-c251-400f-8296-e74bd8ecdb9e', 'AcesVision', 'Simon', 'סין', 'sales@acesvision.com', '+86-138-2316-2813', 'http://www.acesvision.com/', NULL, '2026-03-08 20:48:33.887498+00'),
  ('ce135776-1989-4932-a017-6d977ccb15a2', 'BOW', 'Denver Zheng', 'סין', 'denverzheng@hotmail.com', NULL, NULL, NULL, '2026-03-08 20:48:33.887498+00'),
  ('3f0ba9b8-794e-41c1-8a91-ebbfb8dc69fb', 'Grow', 'Winni Wu', 'סין', 'winni@hzgrow.com', '+86-150-6854-2301', 'www.hzgrow.com', NULL, '2026-03-08 20:48:33.887498+00'),
  ('b7024120-d2d5-49c7-8f8a-fed73e13908b', 'Kaier', 'Lois Song', 'סין', 'sales8@szkaier.com', '+86-136-3279-8927', 'szkaier.com', NULL, '2026-03-08 20:48:33.887498+00'),
  ('5a417bf3-b492-4748-b6ac-cd54cb621d0c', 'Lowc Tech', 'Ada', 'סין', 'ada@lowctech.com', '+86-760-8838-5329', 'www.lowctech.com', NULL, '2026-03-08 20:48:33.887498+00'),
  ('60d6f80c-8711-4edd-88da-8a661d436d8c', 'Rootrust', 'Jenny Xiong', 'סין', 'jenny@rootrust.com', '+86-156-2285-3785', 'www.olaxwifi.com', NULL, '2026-03-08 20:48:33.887498+00'),
  ('3afd858e-f5b8-4032-8e5a-cd170e5cb28d', 'Switch-Bot', 'Ivy Huang', 'סין', 'ivy@switch-bot.com', '+86-188-1942-8575', 'switch-bot.com', NULL, '2026-03-08 20:48:33.887498+00'),
  ('a780e0a6-8192-431e-938f-b65475dfeeed', 'Vehicle Tech', 'John', 'סין', 'john@vehicle-tech.net', NULL, 'vehicle-tech.net', NULL, '2026-03-08 20:48:33.887498+00'),
  ('46b4eae6-1b52-473c-ae25-dd5acd65d05e', 'Vodafone', 'Brikena Hamataj', 'איטליה', 'brikena.hamataj@vodafone.com', NULL, 'www.vodafone.com', NULL, '2026-03-08 20:48:33.887498+00'),
  ('3817bfe9-e7f9-4bf4-bf90-3cc09ab8ddd6', 'AutoStar', 'Emma', 'סין', 'emma@auto-star.com.cn', '+86-188-5000-6181', 'www.autostarsafety.com', NULL, '2026-03-08 20:48:33.887498+00'),
  ('bfa6abce-28bb-4322-a990-f6d08df7eefa', 'A.I.Matics', 'Neil Sunwoo', 'דרום קוריאה', 'neil@aimatics.ai', '+82-10-8009-8552', 'www.aimatics.ai', NULL, '2026-03-08 20:48:33.887498+00'),
  ('3af46a84-de73-4aa6-8f04-b355e1180b5b', 'Author-Alarm', 'Natalia Vankova', 'סלובניה', 'vankova@author-alarm.com', '+7-981-200-1984', 'author-alarm.com', NULL, '2026-03-08 20:48:33.887498+00'),
  ('23d75550-9247-463b-8e78-bb48b106e47a', 'Autolion', 'Danny Liu', 'סין', 'autolion@autoliongroup.com', '+86-188-2001-8336', 'www.autoliongroup.com', NULL, '2026-03-08 20:48:33.887498+00'),
  ('09fd9c26-d4c8-4179-a323-f187835aa652', 'Canglory', 'Pink Wang', 'סין', 'pinkwang@canglory.com', '+86-137-9063-2249', 'www.canglory.com', NULL, '2026-03-08 20:48:33.887498+00'),
  ('c3d35971-b47d-44c6-9d13-8cb5dcdb1541', 'Fastline PCB', 'Jenny', 'סין', 'jenny@fastlinepcb.com', '+86-180-2877-8060', 'www.fastlinepcb.com', NULL, '2026-03-08 20:48:33.887498+00'),
  ('f97c9004-18d8-4a47-9aca-7a865416064d', 'Golden Lucky', 'Michael', 'סין', 'michael076@163.com', NULL, NULL, NULL, '2026-03-08 20:48:33.887498+00'),
  ('0ff256ab-751c-44a4-974c-1ed8121f35db', 'HYF', 'Wendy Wei', 'סין', 'sales07@herofun-bio.com', '+86-136-0257-6152', 'www.herofun-bio.com', NULL, '2026-03-08 20:48:33.887498+00'),
  ('1ff5546e-d620-42c4-b55d-281c596ed3c1', 'Kingly Motor', 'Huang Quanlong', 'סין', 'huang.quanlong@kinglymotor.com', '+86-181-4449-7670', 'www.kinglymotor.com', NULL, '2026-03-08 20:48:33.887498+00'),
  ('416c9a93-d664-47e4-bdb9-b8c5c5f34ca6', 'KUDA', 'Florian Kuhlmann', 'סין', 'florian.kuhlmann@kuda-phonebase.de', '+49-5491-96950', 'www.kuda-phonebase.de', NULL, '2026-03-08 20:48:33.887498+00'),
  ('a82669af-6cdd-4c85-b67c-dd6830dfbe9e', 'Kunshan RCD', 'Pancras Qiu', 'סין', 'sales16@ksrcd.com', '+86-199-5134-2739', 'www.rcdcable.com', NULL, '2026-03-08 20:48:33.887498+00'),
  ('84c191d3-a08a-4690-b5ad-0eb012dcb55d', 'Topfoison', 'Cari Huang', 'סין', 'cari.huang@topfoison.com', '+86-180-3814-5094', 'www.topfoison.com', NULL, '2026-03-08 20:48:33.887498+00'),
  ('5c34348e-802e-43be-b1de-dd06db521a51', 'TS Prototypes', 'Zoe Zeng', 'סין', 'sales9@tsprototypes.com', '+86-187-2028-8047', 'www.tsprototypes.com', NULL, '2026-03-08 20:48:33.887498+00'),
  ('d1b527c6-6ae6-4109-9caa-60294a1706d1', 'CFT Prototypes', 'Nancy Guo', 'סין', 'nancy@cftprototypes.com', '+86-150-1288-2195', 'https://www.cftprototypes.cn/', NULL, '2026-03-08 20:48:33.887498+00'),
  ('51a02ad7-0533-4465-ae2f-6e2124ea0f1f', 'THL Consulting', 'Adrian', 'סין', 'adrian@thl.ltd', NULL, 'thl.ltd', 'עושה הדפסות לתלת מימד, עשינו בעבר מעמדים לפלאפון. יכולים לחבר אותי לספקים ומתחרים בסין.', '2026-03-08 20:48:33.887498+00'),
  ('b10ab599-6eda-40ed-8e4c-30a2dee08774', 'ניפון', 'אופיר', 'ישראל', 'udi.nippon@gmail.com', '054-2315566', 'www.nippon.co.il', NULL, '2026-03-08 20:49:09.976301+00'),
  ('2b6af2c5-7971-445b-8f7c-ce488c9dff36', 'ספטרוטק', 'ישראל', 'ישראל', NULL, '052-2260438', NULL, NULL, '2026-03-08 20:49:09.976301+00'),
  ('5f65bc28-1532-4eef-b407-4a0530546ac9', 'ERM', 'אריאל', 'ישראל', 'ariel@erm.co.il', '054-5727969', NULL, NULL, '2026-03-08 20:49:09.976301+00'),
  ('1c1276df-564f-48a8-90be-afc8dfdc75d1', 'חיווט נאה', 'ברוך', 'ישראל', NULL, '050-4287855', NULL, NULL, '2026-03-08 20:49:09.976301+00'),
  ('cc823851-8936-40df-826d-10b37bc2fd1f', 'דרור כלי עבודה', 'רועי', 'ישראל', 'office@dror-tools.co.il', '054-5900107', NULL, NULL, '2026-03-08 20:49:09.976301+00'),
  ('d3d652d8-ac16-4e09-9df1-11e4d5b5cb04', 'MTS', 'גילי', 'ישראל', NULL, '050-2931497', NULL, NULL, '2026-03-08 20:49:09.976301+00'),
  ('6e1f4a2f-fb9e-4950-99ba-75769e6034d5', 'קונטקט ליין', 'יואב', 'ישראל', 'orders@samsonix.com', '054-4237237', NULL, NULL, '2026-03-08 20:49:09.976301+00'),
  ('05d06ab3-5ffb-4362-9c9b-897876b666f0', 'פוינטר', 'ערן', 'ישראל', NULL, '053-7699579', NULL, NULL, '2026-03-08 20:49:09.976301+00'),
  ('b07720a3-52e3-457e-8f03-19cfab0db799', 'טאקט', 'אסף', 'ישראל', NULL, '054-7333309', NULL, NULL, '2026-03-08 20:49:09.976301+00'),
  ('8f917486-b914-4625-bf8c-11d4b270676b', 'אדי מערכות', 'יניב', 'ישראל', 'yaniv@adi-system.co.il', '03-9629296', 'www.adi-system.co.il', NULL, '2026-03-08 20:49:09.976301+00'),
  ('a89b1011-800b-4203-a433-b3d1f8bc2e04', 'בייסיק טכנולוגיה', 'דיויד', 'ישראל', NULL, '052-8887818', NULL, NULL, '2026-03-08 20:49:09.976301+00'),
  ('ada4bb41-ee2a-46ab-8b78-691a9cc371ca', 'גלאור חלקי חשמל', 'קובי', 'ישראל', 'koby@sherltd.co.il', '054-2691000', NULL, NULL, '2026-03-08 20:49:09.976301+00'),
  ('a25cee71-9d77-401c-96fd-f6c12f0f50c5', 'אלקרטו 7', 'משה', 'ישראל', NULL, '050-8968453', NULL, NULL, '2026-03-08 20:49:09.976301+00'),
  ('7345d872-67fe-4104-990b-5ce677773f2d', 'בנדא מגנטים', 'נירית', 'ישראל', 'israel.c@benda.co.il', '073-2660607', NULL, NULL, '2026-03-08 20:49:09.976301+00'),
  ('4ae674a3-d0d1-46ea-84f2-14fee2ddd5ae', 'נסא אלקטרוניקה', '', 'ישראל', NULL, '050-5281191', NULL, NULL, '2026-03-08 20:49:09.976301+00'),
  ('cc3e74a1-f739-41cf-80d2-326c8a9ed236', 'נטו אספקה', 'ניוה', 'ישראל', 'netosupply@gmail.com', '03-9374150', NULL, NULL, '2026-03-08 20:49:09.976301+00'),
  ('78a4365f-3471-4932-8344-5c3fc98b92f9', 'מוטורולה ישראל', 'טלי', 'ישראל', NULL, '052-7726731', NULL, NULL, '2026-03-08 20:49:09.976301+00'),
  ('051d8007-8090-4d67-90a6-219cfc186502', 'רדיו מילאנו', 'אלונה', 'ישראל', 'alona@radio-milano.co.il', '052-2575555', NULL, NULL, '2026-03-08 20:49:09.976301+00'),
  ('6a4bb159-f4c7-4302-8a93-d10632df9fef', 'אדום אש', 'אודי', 'ישראל', 'molchoudi@gmail.com', '054-6213133', NULL, NULL, '2026-03-08 20:49:09.976301+00'),
  ('79d95af6-8d6e-4c0b-b92e-1332afdd765e', 'מאי-סט', 'דנה', 'ישראל', NULL, '050-2350710', NULL, NULL, '2026-03-08 20:49:09.976301+00'),
  ('ef16af52-d6ba-4438-a046-7ffb930d8d05', 'מרפדיית בית ניקול', 'חיים', 'ישראל', 'zoar807@gmail.com', '050-3049485', NULL, NULL, '2026-03-08 20:49:09.976301+00'),
  ('59a42c78-50c2-483c-8567-6b8f5aeded6d', 'מיר בית', '', 'ישראל', NULL, '03-5621069', NULL, NULL, '2026-03-08 20:49:09.976301+00'),
  ('9216b482-b8aa-4060-b392-a94426aabab0', 'מידע פלסט', 'תומר', 'ישראל', 'tomer.mal1992@gmail.com', '052-7042042', NULL, NULL, '2026-03-08 20:49:09.976301+00'),
  ('c82ca767-baf4-4c8a-8911-60d84b30caa3', 'איתוראן', 'מירי אדוטלר', 'ישראל', 'Miri_A@ituran.com', NULL, NULL, NULL, '2026-03-08 20:49:09.976301+00'),
  ('fee211fb-a67b-4b57-b182-627bda106b14', 'סייף קאר', 'אופיר', 'ישראל', 'ofir_g@safecar.co.il', '050-4446993', NULL, NULL, '2026-03-08 20:49:09.976301+00'),
  ('6f68e964-d024-42b9-a773-2c240d71d23a', 'רדיו אמיר', 'רדואן', 'ישראל', NULL, '054-6209998', NULL, NULL, '2026-03-08 20:49:09.976301+00'),
  ('bfe7987c-554c-43fd-861e-bfcb50e7c74e', 'אקו ספט', 'אנדריי', 'ישראל', NULL, '053-3417868', NULL, NULL, '2026-03-08 20:49:09.976301+00'),
  ('110faa11-6f25-4a38-a1cf-19b33982aff0', 'גי.סי.טקליין', 'שמעון', 'ישראל', NULL, '050-4898001', NULL, NULL, '2026-03-08 20:49:09.976301+00'),
  ('d1bdf45d-98a7-4e6f-818d-5136ccf82bae', 'רוזדור', 'דרור', 'ישראל', NULL, '054-7635233', NULL, NULL, '2026-03-08 20:49:09.976301+00'),
  ('700d7149-6156-4aac-8aa5-61e243c56396', 'אלרם', 'יוני', 'ישראל', NULL, '052-5904013', NULL, NULL, '2026-03-08 20:49:09.976301+00'),
  ('e580dbdc-654f-4195-8ca3-f904714cc5ea', 'פלקאר', 'גל', 'ישראל', NULL, '052-3376032', NULL, NULL, '2026-03-08 20:49:09.976301+00'),
  ('8bda7328-5ebe-42e4-a0a6-5595330ee59d', 'תיק תוק', '', 'ישראל', NULL, '054-6330239', NULL, NULL, '2026-03-08 20:49:09.976301+00')
ON CONFLICT (id) DO UPDATE SET company=EXCLUDED.company, contact_name=EXCLUDED.contact_name, email=EXCLUDED.email, phone=EXCLUDED.phone;

-- ============================================================
-- SUPPLIER_CONTACTS
-- ============================================================
INSERT INTO supplier_contacts (id, supplier_id, name, email, phone, role, is_primary, created_at) VALUES
  ('765f90c3-7970-4f63-9be0-acd218a93000', '9756e3a3-dc31-4340-8051-b50252f97c49', 'Carolyn Tang', 'carolyn@istarvideo.com', '+86-755-8622-1951', NULL, true, '2026-03-08 22:37:01.433012+00'),
  ('53de2218-3466-4cf0-bc21-7cb3333cfa3d', '9756e3a3-dc31-4340-8051-b50252f97c49', 'Maria Zhang', 'maria@istarvideo.com', '+86-138-2350-3805', NULL, false, '2026-03-08 22:37:01.433012+00'),
  ('728e2477-a242-4a49-998c-2aaf0e417b81', '46b4eae6-1b52-473c-ae25-dd5acd65d05e', 'Brikena Hamataj', 'brikena.hamataj@vodafone.com', NULL, NULL, true, '2026-03-08 22:37:01.433012+00'),
  ('4aeebede-84f3-40f2-88b4-2363708c6062', '46b4eae6-1b52-473c-ae25-dd5acd65d05e', 'Federica Lombardini', 'federica.lombardini@vodafone.com', NULL, NULL, false, '2026-03-08 22:37:01.433012+00'),
  ('3dc3aaf4-7b3c-4219-af58-cfa3db713196', 'a780e0a6-8192-431e-938f-b65475dfeeed', 'John', 'john@vehicle-tech.net', NULL, 'CEO', true, '2026-03-11 13:06:42.581037+00'),
  ('7716bf28-b1d8-414e-b3a4-1a8cd8db4549', '09fd9c26-d4c8-4179-a323-f187835aa652', 'David Yan', NULL, NULL, 'CEO Son', true, '2026-03-11 13:43:42.761735+00'),
  ('c80d97ba-1098-4025-b17b-41ffa24d5294', '09fd9c26-d4c8-4179-a323-f187835aa652', 'Jake Yan', NULL, NULL, 'CEO', false, '2026-03-11 13:50:05.239361+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ORDERS
-- ============================================================
INSERT INTO orders (id, priority, supplier_name, supplier_id, shipping, status, eta, etd, payment_date, total_price, notes, created_at, updated_at) VALUES
  ('93dd155e-4e02-4cb1-a214-a25ce42a4a67', 'דחוף', 'iStar', NULL, 'ימי', 'SHIPPED', '2026-04-10 00:00:00+00', NULL, NULL, NULL, NULL, '2026-03-08 17:05:29.114752+00', '2026-03-08 21:28:01.723557+00'),
  ('9b03b22b-3b8c-4a20-a2f3-a28be816b133', 'גבוה', 'iStar', NULL, 'ימי', 'SHIPPED', NULL, NULL, NULL, NULL, NULL, '2026-03-08 17:05:29.225471+00', '2026-03-08 21:28:01.723557+00'),
  ('a3681410-1467-4af1-af04-e757e7ed92e8', 'דחוף', 'Switch-Bot', '3afd858e-f5b8-4032-8e5a-cd170e5cb28d', NULL, 'ORDERED', NULL, '2026-03-19 22:00:00+00', '2026-03-11 04:35:21.107+00', NULL, '2026-03-08 17:05:29.330373+00', '2026-03-11 12:47:28.872191+00'),
  ('700c41f0-5dcb-4be0-89e9-68ba6ada18d3', 'בינוני', 'AutoStar', '3817bfe9-e7f9-4bf4-bf90-3cc09ab8ddd6', 'ימי', 'ORDERED', NULL, NULL, NULL, 16800, NULL, '2026-03-11 10:34:36.332449+00', '2026-03-11 10:34:57.542954+00'),
  ('18b7868d-4fb3-4c6b-a08d-8056252e2c94', 'בינוני', 'A.I.Matics', 'bfa6abce-28bb-4322-a990-f6d08df7eefa', 'ימי', 'PENDING', NULL, NULL, NULL, 72500, NULL, '2026-03-11 10:49:58.541318+00', '2026-03-11 10:49:58.541318+00')
ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, priority=EXCLUDED.priority;

-- ============================================================
-- ORDER_ITEMS
-- ============================================================
INSERT INTO order_items (id, order_id, name, qty, price, product_id) VALUES
  ('b477ef24-1d69-48c0-a492-a9c81b22bd95', '93dd155e-4e02-4cb1-a214-a25ce42a4a67', 'PROOF Z-4K', 1600, NULL, NULL),
  ('aba8f98c-3308-4c74-bc97-7ba4e06badca', '9b03b22b-3b8c-4a20-a2f3-a28be816b133', 'S400', 400, NULL, NULL),
  ('add14735-9e88-4f29-bcb0-15fdc293ed0f', 'a3681410-1467-4af1-af04-e757e7ed92e8', 'Doore Ultra', 350, NULL, NULL),
  ('11a5c801-2122-4778-baf9-d9c161d53a38', '700c41f0-5dcb-4be0-89e9-68ba6ada18d3', 'Blindspot', 200, 84, 'dd42601d-c3b4-4390-bd3e-385d52290573'),
  ('c5464fad-eab9-4fd6-bae0-af6cd5e2cc96', '18b7868d-4fb3-4c6b-a08d-8056252e2c94', 'AWACS CM 108', 500, 145, '063cda4c-8a67-4da5-9ab1-7d51f5789d3f')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- PRODUCT_COMPONENTS
-- ============================================================
INSERT INTO product_components (id, product_id, name, sku, supplier, origin, stock_qty, price, notes) VALUES
  ('c9c78a60-d72e-4a52-bd6e-7919f0cb69b1', '8d5ef79e-0a52-4191-a942-be1bdb463013', 'מעגל + כרטיס', NULL, 'CR Team', NULL, NULL, NULL, NULL),
  ('8e600c05-f559-4a45-8667-1c7708639e52', '8d5ef79e-0a52-4191-a942-be1bdb463013', 'רתמה (כבל)', NULL, 'אביבי רכיבים', NULL, NULL, NULL, 'יש בחדר הרכבות מלאי'),
  ('66c23599-96b7-4df9-9dad-6cbd22aab276', '8d5ef79e-0a52-4191-a942-be1bdb463013', 'עלון למשתמש', NULL, 'אדום אש', NULL, NULL, NULL, NULL),
  ('376434ae-0095-4ce8-8fc4-50bbcee9e71e', '8d5ef79e-0a52-4191-a942-be1bdb463013', 'קופסא', NULL, 'DC PACK', NULL, NULL, NULL, NULL),
  ('cb1951b4-f35c-49ce-aca0-bb6d4c961b54', '8d5ef79e-0a52-4191-a942-be1bdb463013', 'חבק', NULL, 'אדום אש', NULL, NULL, NULL, NULL),
  ('c0020fb4-0b31-4ae6-bfd8-1fbc91dc64eb', '3c61ac22-200a-4042-8d5f-28bae43b7165', 'חוט 16סמ כולל 2 קונקטורים נקבה', NULL, 'ספק בישראל', NULL, NULL, NULL, 'רכיב HUB - שחור+אדום'),
  ('4b28bbaf-c960-477f-97b4-79636a2fcf3b', '3c61ac22-200a-4042-8d5f-28bae43b7165', 'חוט 30סמ כולל 1 קונקטור נקבה', NULL, 'ספק בישראל', NULL, NULL, NULL, 'רכיב HUB - שחור+אדום'),
  ('40ab6f1a-eb71-402a-bda2-fc12d9b2dbf8', '80796a7c-5937-41c3-a867-3badeab12db8', 'עלוקה אנולוגית', NULL, 'CR Team', NULL, NULL, NULL, NULL),
  ('a61b991d-c9de-49cc-b521-ff9f71bd366b', '80796a7c-5937-41c3-a867-3badeab12db8', 'עלוקה דיגיטלית - IGLA100', NULL, 'Author-Alarm', NULL, NULL, NULL, NULL),
  ('6d9861d1-420e-4bbb-81b0-5669832755e8', '80796a7c-5937-41c3-a867-3badeab12db8', 'עלוקה דיגיטלית - IGLA200', NULL, 'Author-Alarm', NULL, NULL, NULL, NULL),
  ('d398a83b-b46d-4963-ad1b-24b573bf2979', '80796a7c-5937-41c3-a867-3badeab12db8', 'עלוקה דיגיטלית - IGLA230', NULL, 'Author-Alarm', NULL, NULL, NULL, NULL),
  ('474f7309-9aff-4b58-b905-84870e134f8b', '6e543c60-5b9c-4e02-b3b8-2043341dea89', 'מסכים + ממיר + כבלים + קופסא', NULL, 'ACESVISION', NULL, NULL, NULL, NULL),
  ('2656469f-4c57-4f5d-af81-ddad575d0898', '6e543c60-5b9c-4e02-b3b8-2043341dea89', 'דונגל', NULL, 'ROOTRUST', NULL, NULL, NULL, 'שולחים ישירות לספק'),
  ('ff8f1bb6-6ba0-4858-a306-bd223471f3e2', '65386b8a-b6f6-4ad6-8d15-954d98dca96f', 'מסכים + ממיר + כבלים + קופסא', NULL, 'ACESVISION', NULL, NULL, NULL, NULL),
  ('165a1a51-2f10-4e1d-843c-7528bed55c7b', '65386b8a-b6f6-4ad6-8d15-954d98dca96f', 'דונגל', NULL, 'ROOTRUST', NULL, NULL, NULL, 'שולחים ישירות לספק'),
  ('3bcd9843-88e3-4896-8cff-d0da7a935707', '3c61ac22-200a-4042-8d5f-28bae43b7165', 'מנעול', NULL, 'Switch-Bot', NULL, NULL, NULL, NULL),
  ('bc8e8051-bf89-4c83-8b2a-559c8fd01c60', '3c61ac22-200a-4042-8d5f-28bae43b7165', 'מצלמה + תושבת + 2 סוללות + מטען + כרטיס זיכרון', NULL, 'iStar', NULL, NULL, NULL, NULL),
  ('62d45ca3-6fda-4c5f-bc58-d8ea5ce3390e', '3c61ac22-200a-4042-8d5f-28bae43b7165', 'דונגל (נתב)', NULL, 'Rootrust', NULL, NULL, NULL, NULL),
  ('db90a3fc-ac6b-42fe-bfc8-90827384998c', '3c61ac22-200a-4042-8d5f-28bae43b7165', 'לוח PCB', NULL, 'CR Team', NULL, NULL, NULL, 'רכיב HUB - הזמנה יוצאת מארנון'),
  ('7ecaf1f0-e398-4ac2-9978-bc0776e53ba7', '3c61ac22-200a-4042-8d5f-28bae43b7165', 'סורק פנים', NULL, 'Switch-Bot', NULL, NULL, NULL, NULL),
  ('6e870a83-f449-4fcb-8ab1-b5a1de6342b6', '3c61ac22-200a-4042-8d5f-28bae43b7165', 'ממיר מתח', NULL, NULL, NULL, NULL, NULL, 'רכיב HUB - irm-10-5'),
  ('492a9511-2af6-43ea-bbc7-84afb7a5fd0b', '3c61ac22-200a-4042-8d5f-28bae43b7165', 'פלסטיק אמצעי (2 חלקים)', NULL, 'מורגל', NULL, NULL, NULL, 'רכיב HUB - לשעבר זליחה'),
  ('96d14409-0485-421b-a2ca-dca5e9ab8a5d', '3c61ac22-200a-4042-8d5f-28bae43b7165', 'צמת מתח', NULL, 'KSRD', NULL, NULL, NULL, 'רכיב HUB'),
  ('8739090f-69b2-4852-8c6e-ed77fe0c387c', '3c61ac22-200a-4042-8d5f-28bae43b7165', 'פלסטיקה', NULL, 'TS Prototypes', NULL, NULL, NULL, 'רכיב HUB'),
  ('d2cc8c5a-8b8c-4aac-a86e-cb3349a6fe41', '3c61ac22-200a-4042-8d5f-28bae43b7165', 'SB-HUB', NULL, 'Switch-Bot', NULL, NULL, NULL, 'רכיב HUB - הזמנה ביחד עם מנעולים, פירוק לפני שליחה ל-CR Team'),
  ('633f8c0e-7373-4aa7-bb2c-47df3aaf775e', '3c61ac22-200a-4042-8d5f-28bae43b7165', 'פעמון', NULL, 'iStar', NULL, NULL, NULL, 'רכיב HUB - מגיע 1 לכל מצלמה'),
  ('db388df3-643c-49e6-80bb-cbc7bd79f8f8', '3c61ac22-200a-4042-8d5f-28bae43b7165', 'כבל דו גיד מולחם על מפסק ראשי', NULL, 'Fastline PCB', NULL, NULL, NULL, 'רכיב HUB - צד שני קונקטור 3 פין'),
  ('17f0a23e-4514-4653-b673-f3b6287b7d92', '063cda4c-8a67-4da5-9ab1-7d51f5789d3f', 'DISPLAY', NULL, 'Fastline PCB', NULL, NULL, NULL, 'הזמנה ב-FASTLINE, שליחה ל-TOPFUSION, ואז לארץ'),
  ('64aa2122-476b-4df9-b549-c0317fc13898', '063cda4c-8a67-4da5-9ab1-7d51f5789d3f', 'R8', NULL, 'A.I.Matics', NULL, NULL, NULL, 'הזמנה ישירות מהספק'),
  ('0d3a7359-c143-4eac-b9a3-cfa041a8f1d1', 'f2ef4b54-cc79-457e-9d28-1c00e7967888', 'פלסטיק + דבק', NULL, 'CFT Prototypes', NULL, NULL, NULL, NULL),
  ('72760ac0-745a-4830-b72b-3f3aa86e0e9d', 'f2ef4b54-cc79-457e-9d28-1c00e7967888', 'סורק טביעות אצבע', NULL, 'Grow', NULL, NULL, NULL, NULL),
  ('b4845234-0d70-4244-a91e-c9460d43a06f', 'f2ef4b54-cc79-457e-9d28-1c00e7967888', 'עלוקה', NULL, 'CR Team', NULL, NULL, NULL, NULL),
  ('f329bcf1-771f-4a8f-b6f7-1ef782b751d7', 'f2ef4b54-cc79-457e-9d28-1c00e7967888', 'כבלים', NULL, 'אביבי רכיבים ', NULL, NULL, NULL, NULL),
  ('7f81a4cc-1bd8-43bc-a45b-7227498a6756', 'f2ef4b54-cc79-457e-9d28-1c00e7967888', 'קופסא', NULL, 'DC PACK ', NULL, NULL, NULL, NULL),
  ('24310fb2-3975-452c-839b-63816320e6e1', 'f2ef4b54-cc79-457e-9d28-1c00e7967888', 'חבק', NULL, 'אדום אש', NULL, NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- TASKS
-- ============================================================
INSERT INTO tasks (id, title, priority, status, is_daily, notes, assignee_id, assignee_name, due_date, recurring_task_id, description, created_at, updated_at) VALUES
  ('6e4c44c9-3eae-4ab1-91b1-f274c73ca0fa', 'חתימה רגילה', 'גבוה', 'TODO', false, NULL, NULL, 'נועם', NULL, NULL, NULL, '2026-03-08 21:45:27.912004+00', '2026-03-08 21:45:27.912004+00'),
  ('c0d3f14d-a2a8-473a-9c95-f07d7a0e08e2', 'העברת סרטונים של הסבר על כל מערכת', 'גבוה', 'TODO', false, NULL, NULL, 'נועם', NULL, NULL, NULL, '2026-03-08 21:45:27.912004+00', '2026-03-08 21:45:27.912004+00'),
  ('5b17e675-14e0-4977-ad26-e5e285a9127a', 'פתיחה של משתמש וסיסמא לכל מערכת של קוברה', 'דחוף', 'TODO', false, NULL, NULL, 'נועם', NULL, NULL, NULL, '2026-03-08 21:45:27.912004+00', '2026-03-08 21:45:27.912004+00'),
  ('061c1aac-166c-43e5-8fff-023810dd6731', 'פתיחה של משתמש בSAP', 'דחוף', 'TODO', false, NULL, NULL, 'נועם', NULL, NULL, NULL, '2026-03-08 21:45:27.912004+00', '2026-03-08 21:45:27.912004+00'),
  ('6a1ed073-a963-4113-8c32-c20f43314960', 'הסבר על תיק יבוא - מה צריך להיות', 'גבוה', 'TODO', false, NULL, NULL, 'נועם', NULL, NULL, NULL, '2026-03-08 21:45:27.912004+00', '2026-03-08 21:45:27.912004+00'),
  ('a97d7acc-bbe4-4237-818e-68fe771e8525', 'רשימת הסכמים מוכנים של כל הספקים הגדולים', 'גבוה', 'TODO', false, NULL, NULL, 'נועם', NULL, NULL, NULL, '2026-03-08 21:45:27.912004+00', '2026-03-08 21:45:27.912004+00'),
  ('7685dd38-bc7d-4931-9817-037c1c695be8', 'רשימת ספקים כללי של כל מה שיש', 'בינוני', 'TODO', false, NULL, NULL, 'נועם', NULL, NULL, NULL, '2026-03-08 21:45:27.912004+00', '2026-03-08 21:45:27.912004+00'),
  ('701a0bdc-da7a-40b1-b184-ab59987ec999', 'פורטל סלקום - סיסמא', 'דחוף', 'TODO', false, NULL, NULL, 'נועם', NULL, NULL, NULL, '2026-03-08 21:45:27.912004+00', '2026-03-08 21:45:27.912004+00'),
  ('a6bd6c85-4b16-400d-bdf0-97d906195825', 'פורטל פלאפון - סיסמא', 'דחוף', 'TODO', false, NULL, NULL, 'נועם', NULL, NULL, NULL, '2026-03-08 21:45:27.912004+00', '2026-03-08 21:45:27.912004+00'),
  ('af2852fb-efa5-4801-aa28-2f92042ce540', 'חתימה דיגיטלית', 'גבוה', 'TODO', false, NULL, '5eda5d68-188b-47ab-919e-29b7882a343b', 'נועם', NULL, NULL, NULL, '2026-03-08 21:45:27.912004+00', '2026-03-08 21:47:14.071117+00'),
  ('bb4796a1-aebf-4789-b7ea-9df20cd161a8', 'מחשב נייח', 'בינוני', 'TODO', false, NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-08 21:45:27.912004+00', '2026-03-08 21:47:50.076207+00'),
  ('6efccb9d-92d1-42a4-949a-b75e011247a6', 'העברה של כל הסיסמאות שיש', 'דחוף', 'TODO', false, NULL, '5eda5d68-188b-47ab-919e-29b7882a343b', 'נועם', NULL, NULL, NULL, '2026-03-08 21:45:27.912004+00', '2026-03-08 21:51:45.831756+00'),
  ('18ed0611-ca8e-496b-a5ae-99c4986a1fd6', 'ספירת מלאי — COBRA Biometric', 'דחוף', 'TODO', false, 'ספירה ואיפוס מלאי', '50138e6e-506b-4b3e-9f15-5acac6804159', 'ג''ורג''', NULL, NULL, NULL, '2026-03-08 17:05:29.587366+00', '2026-03-08 22:16:32.640378+00'),
  ('aed83838-c01c-4a57-b1e6-8e9a0a0a8223', 'ספירת מלאי — COBRA TV', 'דחוף', 'TODO', false, NULL, '50138e6e-506b-4b3e-9f15-5acac6804159', 'ג''ורג''', NULL, NULL, NULL, '2026-03-08 17:05:29.644864+00', '2026-03-08 22:16:31.585556+00'),
  ('7c06b214-a4fa-40a1-8dce-6f2dde772421', 'ספירת מלאי — הכפתור', 'דחוף', 'TODO', false, NULL, '50138e6e-506b-4b3e-9f15-5acac6804159', 'ג''ורג''', NULL, NULL, NULL, '2026-03-08 17:05:29.703172+00', '2026-03-08 22:16:30.780772+00'),
  ('e05c3f39-2cf4-492b-ba9c-a307e1250651', 'ספירת מלאי — Blindspot', 'דחוף', 'TODO', false, NULL, '50138e6e-506b-4b3e-9f15-5acac6804159', 'ג''ורג''', '2026-03-10 22:00:00+00', NULL, NULL, '2026-03-08 17:05:29.755688+00', '2026-03-11 05:01:33.833367+00'),
  ('2844b917-e4d6-4313-b56c-6d69280b43dc', 'איזון SAP מול חברת כפתור — KAF32', 'גבוה', 'DONE', false, 'מקט KAF32 לא מיושר', '6a9af853-0090-4289-af71-ffc869c7e156', 'זיו', NULL, NULL, NULL, '2026-03-08 17:05:29.814743+00', '2026-03-08 21:28:02.802306+00'),
  ('3e5f4c50-f168-407f-ab06-eb3313da9941', 'עדכון מלאי אוזניות בלוטוס BT100', 'בינוני', 'TODO', false, NULL, '50138e6e-506b-4b3e-9f15-5acac6804159', 'ג''ורג''', '2026-03-09 22:00:00+00', NULL, NULL, '2026-03-08 17:05:29.868008+00', '2026-03-10 19:36:44.077108+00'),
  ('ef43f00d-936c-47d5-94ad-83d1d30c5aed', 'בדיקת ETA הזמנת Z4K מ-iStar', 'דחוף', 'TODO', false, 'ETA: 10 אפריל 2026', '6a9af853-0090-4289-af71-ffc869c7e156', 'זיו', NULL, NULL, NULL, '2026-03-08 17:05:29.9816+00', '2026-03-08 21:28:02.802306+00'),
  ('c01485cc-c6c9-4be4-a771-1756c03f95c1', 'ארגון מחסן קדמי', 'בינוני', 'TODO', true, NULL, '50138e6e-506b-4b3e-9f15-5acac6804159', 'ג''ורג''', '2026-03-10 22:00:00+00', NULL, NULL, '2026-03-08 17:05:30.037357+00', '2026-03-11 15:15:48.70757+00'),
  ('33f94bd3-e667-4052-a8cd-49572f4dac0f', 'קבלת משלוח iStar', 'גבוה', 'TODO', true, NULL, '50138e6e-506b-4b3e-9f15-5acac6804159', 'ג''ורג''', NULL, NULL, NULL, '2026-03-08 17:05:30.090389+00', '2026-03-08 21:28:02.802306+00'),
  ('0594efc9-a2d3-42f1-bf1a-9deb94463d73', 'עדכון מלאי במערכת', 'בינוני', 'TODO', true, NULL, '50138e6e-506b-4b3e-9f15-5acac6804159', 'גיאורגי גריגוריאנץ', NULL, NULL, NULL, '2026-03-08 17:05:30.146475+00', '2026-03-08 22:16:28.246763+00'),
  ('346d6a99-0ec9-4568-90e7-341354d1e295', 'פתיחת קבוצות עם כל הספקים החשובים בWeChat', 'גבוה', 'TODO', false, NULL, NULL, 'נועם', NULL, NULL, NULL, '2026-03-08 21:45:27.912004+00', '2026-03-11 04:58:41.964479+00'),
  ('5aaa59b9-8501-4305-9855-2f0e9305d2d1', 'העברה של המדריכים למשתמש שיש לכל הדברים', 'בינוני', 'TODO', false, NULL, NULL, 'נועם', '2026-03-10 22:00:00+00', NULL, NULL, '2026-03-08 21:45:27.912004+00', '2026-03-11 04:32:59.967896+00'),
  ('b93b9cfd-ccc0-405b-badc-a31aa5423dd7', 'קיבוץ תקיית נהלים של כל הדברים האפשרים לפי מוצר', 'בינוני', 'TODO', false, NULL, NULL, 'נועם', '2026-03-10 22:00:00+00', NULL, NULL, '2026-03-08 21:45:27.912004+00', '2026-03-11 04:57:56.971988+00'),
  ('958d956e-943a-49d8-8703-87e67ffc03b3', 'ישיבת רכש PI - שני', 'גבוה', 'TODO', false, NULL, NULL, NULL, '2026-03-09 00:00:00+00', 'f9f1ce6a-3d6c-4d05-a61b-d39823cf6d04', 'ישיבת רכש PI ביום שני', '2026-03-09 00:31:44.22134+00', '2026-03-10 19:36:28.945729+00'),
  ('8f45ec79-7278-4489-b57c-0ade50262167', 'ישיבת רכש עם ארנון', 'גבוה', 'TODO', false, NULL, NULL, NULL, '2026-03-09 00:00:00+00', NULL, 'ישיבת סטטוס רכש שבועית עם ארנון', '2026-03-09 00:31:44.000764+00', '2026-03-09 00:55:42.209791+00'),
  ('039cbeaf-d638-4ae9-9c55-326b371b33c7', 'לוז נסיעות מחסן', 'בינוני', 'TODO', false, NULL, NULL, NULL, '2026-03-09 00:00:00+00', NULL, 'הכנת לוז נסיעות יומי למחסן', '2026-03-09 00:31:44.395175+00', '2026-03-09 00:55:42.209791+00'),
  ('50776194-3a80-4acb-bb2a-efdd7fbdc181', 'לוז נסיעות מחסן', 'גבוה', 'TODO', false, NULL, NULL, NULL, '2026-03-09 16:00:12.168+00', 'e149f43e-8adb-45ea-929b-33e786ea84fa', 'בניית לוז הנסיעות של המחסן ליום למחרת', '2026-03-09 16:00:12.486549+00', '2026-03-10 19:37:57.109187+00'),
  ('06982226-ea79-467b-b976-b46eda3b527d', 'לוז נסיעות מחסן', 'בינוני', 'DONE', false, NULL, NULL, NULL, '2026-03-10 22:00:00+00', 'e149f43e-8adb-45ea-929b-33e786ea84fa', 'בניית לוז הנסיעות של המחסן ליום למחרת', '2026-03-10 16:00:13.288533+00', '2026-03-11 07:33:41.495722+00'),
  ('75045bcd-4c17-4b0b-9c2d-2e60f4fe6fd1', 'ישיבת רכש PI - חמישי', 'גבוה', 'TODO', false, NULL, NULL, NULL, '2026-03-12 09:00:13.524+00', '0bf8ca5b-c81f-4127-8e9a-d7372bcf417f', 'ישיבת רכש PI ביום חמישי', '2026-03-11 09:00:13.946524+00', '2026-03-11 09:00:13.946524+00'),
  ('9cf63c55-aa43-4556-83e4-ab58707a97b8', 'לוז נסיעות מחסן', 'גבוה', 'TODO', false, NULL, NULL, NULL, '2026-03-11 16:00:13.245+00', 'e149f43e-8adb-45ea-929b-33e786ea84fa', 'בניית לוז הנסיעות של המחסן ליום למחרת', '2026-03-11 16:00:13.536836+00', '2026-03-11 16:00:13.536836+00')
ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, priority=EXCLUDED.priority, due_date=EXCLUDED.due_date;

-- ============================================================
-- RECURRING_TASKS
-- ============================================================
INSERT INTO recurring_tasks (id, title, description, frequency, priority, day_of_week, day_of_month, days_before, time_of_day, is_active, next_due, last_generated, created_at, updated_at) VALUES
  ('f9f1ce6a-3d6c-4d05-a61b-d39823cf6d04', 'ישיבת רכש PI - שני', 'ישיבת רכש PI ביום שני', 'weekly', 'גבוה', 1, NULL, 1, '09:00:00', true, '2026-03-16', '2026-03-09 00:31:44.254+00', '2026-03-09 00:17:35.919342+00', '2026-03-09 00:31:44.285898+00'),
  ('0bf8ca5b-c81f-4127-8e9a-d7372bcf417f', 'ישיבת רכש PI - חמישי', 'ישיבת רכש PI ביום חמישי', 'weekly', 'גבוה', 4, NULL, 1, '09:00:00', true, '2026-03-12', '2026-03-11 09:00:13.524+00', '2026-03-09 00:17:35.919342+00', '2026-03-11 09:00:13.671571+00'),
  ('400511a2-3c48-4fd9-a515-3bb87143b2fa', 'יישור קו תשלומים עם קרן', 'סיכום חודשי של תשלומים ותזרים מזומנים', 'monthly', 'גבוה', NULL, 1, 3, '09:00:00', true, '2026-04-01', NULL, '2026-03-09 00:17:35.919342+00', '2026-03-09 00:17:35.919342+00'),
  ('74be081e-6995-4672-86b3-404aad37d5f0', 'חידוש רישיונות יבוא', 'חידוש שנתי של רישיונות יבוא', 'yearly', 'דחוף', NULL, NULL, 60, '09:00:00', true, '2027-01-01', NULL, '2026-03-09 00:17:35.919342+00', '2026-03-09 00:17:35.919342+00'),
  ('9f45f84c-b78a-458f-af1a-7b04f2fac0c9', 'הזמנה מ-VODAFONE', 'הזמנה חצי-שנתית ממוצרי VODAFONE', 'biannual', 'גבוה', NULL, NULL, 30, '09:00:00', true, '2026-09-01', NULL, '2026-03-09 00:17:35.919342+00', '2026-03-09 01:18:02.218766+00'),
  ('2cda0db8-6992-4c4e-a9dc-a6670a4b4793', 'ישיבת רכש עם ארנון', 'מעבר על ההזמנות הפתוחות מהצד שלנו', 'weekly', 'גבוה', 1, NULL, 1, '09:00:00', true, NULL, NULL, '2026-03-09 00:48:21.513575+00', '2026-03-09 00:48:21.513575+00'),
  ('6372c6bb-858e-47e6-b0e1-9340efbe143d', 'הזמנה מ-ERM', 'הזמנת מוצרים של ERM - 3-4 חודשים מראש על פי צריכה', 'quarterly', 'גבוה', NULL, 1, 14, '09:00:00', true, NULL, NULL, '2026-03-09 00:48:21.513575+00', '2026-03-09 00:48:21.513575+00'),
  ('9838d803-6442-45b2-b755-6201806e8515', 'העברת חשבוניות ממחסן', 'פעם בשבוע המחסן מעביר את החשבוניות אלינו על מנת שנחתום ונוודא כל חשבונית', 'weekly', 'בינוני', 0, NULL, 0, '09:00:00', true, NULL, NULL, '2026-03-09 00:48:21.513575+00', '2026-03-09 01:40:42.448762+00'),
  ('e149f43e-8adb-45ea-929b-33e786ea84fa', 'לוז נסיעות מחסן', 'בניית לוז הנסיעות של המחסן ליום למחרת', 'daily', 'גבוה', NULL, NULL, 0, '16:00:00', true, NULL, '2026-03-11 16:00:13.245+00', '2026-03-09 00:48:21.513575+00', '2026-03-11 16:00:13.420914+00')
ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, frequency=EXCLUDED.frequency, is_active=EXCLUDED.is_active;

-- ============================================================
-- DISTRIBUTION_CENTERS
-- ============================================================
INSERT INTO distribution_centers (id, name, city, type, is_main, created_at, updated_at) VALUES
  ('ac235b17-fd89-4b58-a6c0-14e730e97e35', 'מרכז הפצה תל אביב', 'תל אביב', 'main', true, '2026-03-08 21:45:27.912004+00', '2026-03-08 21:45:27.912004+00'),
  ('8efd8988-533f-46b3-9bf7-8c6973c82c06', 'דלק מוטורס', NULL, 'bonded', false, '2026-03-08 21:45:27.912004+00', '2026-03-08 21:45:27.912004+00'),
  ('71182d80-571c-439d-baf6-ccf1f4374d45', 'פריזבי קרסו', NULL, 'bonded', false, '2026-03-08 21:45:27.912004+00', '2026-03-08 21:45:27.912004+00'),
  ('ba65b0d3-324f-4ecd-b0cc-eade6491f57b', 'לובינסקי', NULL, 'bonded', false, '2026-03-08 21:45:27.912004+00', '2026-03-08 21:45:27.912004+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- CENTER_CONTACTS
-- ============================================================
INSERT INTO center_contacts (id, center_id, name, phone, role, created_at) VALUES
  ('c4975314-b74a-41b5-bda0-122b58746908', '8efd8988-533f-46b3-9bf7-8c6973c82c06', 'סער', '050-408-3631', 'מנהל מחסן', '2026-03-08 21:45:27.912004+00'),
  ('363924fd-5189-4115-9eb1-d901fa3a98d6', '8efd8988-533f-46b3-9bf7-8c6973c82c06', 'דוד ארביב', '054-916-9669', 'מנהל טכני', '2026-03-08 21:45:27.912004+00'),
  ('11843382-9b1b-4cb6-a611-01c2c6507ee0', '8efd8988-533f-46b3-9bf7-8c6973c82c06', 'אריה', '054-757-5350', 'מנהל', '2026-03-08 21:45:27.912004+00'),
  ('f1c0c702-8f4c-4837-bb5c-2a64dc8c1bf9', '71182d80-571c-439d-baf6-ccf1f4374d45', 'אורטל', '054-670-6727', 'מנהל מחסן', '2026-03-08 21:45:27.912004+00'),
  ('5747a7df-eeb2-4dcb-9c9f-a4188b946c83', '71182d80-571c-439d-baf6-ccf1f4374d45', 'מור דרעי', '052-526-9980', 'מנהל טכני', '2026-03-08 21:45:27.912004+00'),
  ('f389c8f0-e40c-4743-9691-7add8d0e5e48', '71182d80-571c-439d-baf6-ccf1f4374d45', 'יקי עובד', '054-681-5230', 'מנהל', '2026-03-08 21:45:27.912004+00'),
  ('558b577c-c48f-4a16-831c-f8eb437af286', 'ba65b0d3-324f-4ecd-b0cc-eade6491f57b', 'פנל', '054-536-7088', 'מנהל מחסן', '2026-03-08 21:45:27.912004+00'),
  ('54262797-8688-4234-bad1-e2d624111168', 'ba65b0d3-324f-4ecd-b0cc-eade6491f57b', '', '', 'מנהל טכני', '2026-03-08 21:45:27.912004+00'),
  ('ec654a74-2238-4a15-ae22-aa16836be635', 'ba65b0d3-324f-4ecd-b0cc-eade6491f57b', 'אבי', '050-381-2345', 'מנהל', '2026-03-08 21:45:27.912004+00'),
  ('e3fbfa0e-bca1-4182-806e-e08748e0b45c', 'ac235b17-fd89-4b58-a6c0-14e730e97e35', 'גיאורגי גריגוריאנץ', NULL, NULL, '2026-03-08 22:19:33.683853+00'),
  ('1cb0928a-50e7-4aab-b5f3-56cfb5b37a2b', '8efd8988-533f-46b3-9bf7-8c6973c82c06', 'עמית גולדי', '054-440-0152', 'מנהל חטיבה', '2026-03-08 22:20:24.760049+00'),
  ('8fa65081-f1f8-4f60-8758-bef58b94d557', '8efd8988-533f-46b3-9bf7-8c6973c82c06', 'רן אטיר', '054-455-2109', 'מנהל טכני חטיבה', '2026-03-08 22:20:24.760049+00'),
  ('daa864cf-9991-4d0a-a0a3-d95c39bfdc3b', '71182d80-571c-439d-baf6-ccf1f4374d45', 'עמית גולדי', '054-440-0152', 'מנהל חטיבה', '2026-03-08 22:20:24.760049+00'),
  ('61c0d34a-9050-4344-85d3-fb8af52d2fcb', '71182d80-571c-439d-baf6-ccf1f4374d45', 'רן אטיר', '054-455-2109', 'מנהל טכני חטיבה', '2026-03-08 22:20:24.760049+00'),
  ('ff876e59-94ba-4dec-83c0-90333920c98a', 'ba65b0d3-324f-4ecd-b0cc-eade6491f57b', 'עמית גולדי', '054-440-0152', 'מנהל חטיבה', '2026-03-08 22:20:24.760049+00'),
  ('bf1b5d60-5e2e-4306-960f-02e2278b1633', 'ba65b0d3-324f-4ecd-b0cc-eade6491f57b', 'רן אטיר', '054-455-2109', 'מנהל טכני חטיבה', '2026-03-08 22:20:24.760049+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- WORKFLOW_TEMPLATES
-- ============================================================
INSERT INTO workflow_templates (id, name, description, category, steps, created_at) VALUES
  ('b5a990c9-579d-4d9f-8e9a-90a8856ad00b', 'הזמנת רכש מחו"ל', 'תהליך מלא להזמנת רכש בינלאומית — מקבלת PI ועד קליטה במלאי', 'procurement', '[{"action":"upload_file","description":"קבל את הצעת המחיר הראשונית מהספק","index":0,"name":"קבלת PI מספק","required":true},{"action":"send_email","description":"שלח את ה-PI למור לבדיקה ראשונית","email_to":"mor@cobra.co.il","index":1,"name":"שליחת PI למור","required":true},{"action":"approve","description":"אשר מול אבינועם ומור בישיבת ב׳ או ה׳","index":2,"name":"אישור בישיבת רכש","note":"הישיבות מתקיימות בימי שני וחמישי","required":true},{"action":"input_eta","description":"שלח אישור תשלום לספק ותעד את תאריך ההגעה הצפוי","index":3,"name":"שליחת SWIFT + תיעוד ETA","required":true},{"action":"send_email","description":"וודא שהמחסן קיבל את הסחורה ושלח חשבונית לאלינור","email_to":"alinor@cobra.co.il","index":4,"name":"קליטת סחורה + מייל לאלינור","required":true},{"action":"confirm","description":"וודא שהסחורה נקלטה במלאי ב-SAP","index":5,"name":"אישור קליטה במלאי","required":true}]', '2026-03-09 01:01:58.071825+00')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, steps=EXCLUDED.steps;

-- ============================================================
-- WORKFLOW_INSTANCES
-- ============================================================
INSERT INTO workflow_instances (id, template_id, order_id, current_step, status, created_at, updated_at) VALUES
  ('8c27ed40-343e-4561-ab53-34bd2c00012b', 'b5a990c9-579d-4d9f-8e9a-90a8856ad00b', 'a3681410-1467-4af1-af04-e757e7ed92e8', 6, 'completed', '2026-03-09 01:21:18.153633+00', '2026-03-09 01:21:18.153633+00'),
  ('21b3fe2d-05ea-483a-848a-1c4148d481a6', 'b5a990c9-579d-4d9f-8e9a-90a8856ad00b', '9b03b22b-3b8c-4a20-a2f3-a28be816b133', 2, 'active', '2026-03-11 04:32:46.349735+00', '2026-03-11 04:32:46.349735+00'),
  ('62e22da2-896d-4419-8be5-9c40ac83d8ae', 'b5a990c9-579d-4d9f-8e9a-90a8856ad00b', '700c41f0-5dcb-4be0-89e9-68ba6ada18d3', 0, 'active', '2026-03-11 10:34:49.709353+00', '2026-03-11 10:34:49.709353+00')
ON CONFLICT (id) DO UPDATE SET current_step=EXCLUDED.current_step, status=EXCLUDED.status;

-- ============================================================
-- WORKFLOW_STEP_LOGS
-- ============================================================
INSERT INTO workflow_step_logs (id, instance_id, step_index, completed_by, notes, completed_at) VALUES
  ('6accea57-b4c9-442f-b31b-aced173dc841', '8c27ed40-343e-4561-ab53-34bd2c00012b', 0, 'נועם', NULL, '2026-03-09 01:32:22.471291+00'),
  ('0f772ee0-4cc0-43da-8c20-6afe989c487e', '8c27ed40-343e-4561-ab53-34bd2c00012b', 1, 'נועם', NULL, '2026-03-09 01:32:27.391109+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- PURCHASE_DOCUMENTS
-- ============================================================
INSERT INTO purchase_documents (id, type, quantity, currency, status, file_url, notes, approval_date, approved_by, created_at, updated_at) VALUES
  ('aa265cc2-e5c0-4cff-92e4-e5614615818a', 'PI', 0, 'USD', 'נשלח לספק', 'https://ljpdwezgahrrffnwajho.supabase.co/storage/v1/object/public/documents/uploads/1773157193144_PI%20iSV260310A05rev1%20spare.pdf', 'קובץ: PI iSV260310A05rev1 spare.pdf', '2026-03-10 15:40:02.124+00', '5eda5d68-188b-47ab-919e-29b7882a343b', '2026-03-10 15:40:01.205682+00', '2026-03-10 15:40:05.571294+00'),
  ('d3c703ee-e37d-42ed-8a92-c3c7f74e5725', 'PI', 0, 'USD', 'ממתין לאישור', 'https://ljpdwezgahrrffnwajho.supabase.co/storage/v1/object/public/documents/uploads/1773157268798_PI%2020260107R01.pdf', 'קובץ: PI 20260107R01.pdf', NULL, NULL, '2026-03-10 15:41:13.72234+00', '2026-03-10 15:41:13.72234+00'),
  ('09b3bdf3-1a8f-4de2-a2fe-783d5a0c719a', 'PI', 0, 'USD', 'ממתין לאישור', 'https://ljpdwezgahrrffnwajho.supabase.co/storage/v1/object/public/documents/uploads/1773166697767_20260310-%20Proforma%20Invoice%20for%20wire.pdf', 'קובץ: 20260310- Proforma Invoice for wire.pdf', '2026-03-11 04:48:38.423+00', '5eda5d68-188b-47ab-919e-29b7882a343b', '2026-03-10 18:18:26.553429+00', '2026-03-11 05:37:31.544642+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- COMPLIANCE_ITEMS
-- ============================================================
INSERT INTO compliance_items (id, name, category, status, expiry_date, notes, created_at, updated_at) VALUES
  ('57facbfb-b609-4d23-b410-00df982eda29', 'רישיון יבוא', 'יבוא', 'active', '2026-12-31', 'חידוש שנתי — כל המוצרים המיובאים', '2026-03-09 01:41:58.204619+00', '2026-03-09 01:41:58.204619+00'),
  ('2ea694c1-a070-4801-87a4-4b74906a0ba4', 'רישיון תקשורת', 'תקשורת', 'active', '2026-09-26', 'רישיון תקשורת למוצר Biometric — פג בקרוב', '2026-03-09 01:41:58.204619+00', '2026-03-09 01:41:58.204619+00'),
  ('e7e1cc0b-1082-4562-afdf-13130ce00106', 'אישור דיגום לובינסקי — וו גרירה', 'דיגום', 'active', '2026-09-26', 'אישור דיגום לובינסקי עבור וו גרירה', '2026-03-09 01:41:58.204619+00', '2026-03-09 01:41:58.204619+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- COMPLIANCE_PRODUCT_LINKS
-- ============================================================
INSERT INTO compliance_product_links (id, compliance_item_id, product_id, created_at) VALUES
  ('a7827506-ad25-4bcd-8930-94f4ab901ddf', '57facbfb-b609-4d23-b410-00df982eda29', 'a08eae25-9e1b-40b4-bc5b-ca45f023f510', '2026-03-10 20:43:09.006509+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- LOGIN_ATTEMPTS
-- ============================================================
INSERT INTO login_attempts (id, ip_address, success, attempted_at) VALUES
  ('688706ab-fe6f-4106-a6a6-d3509126868b', '89.139.117.152', true, '2026-03-08 23:38:07.622552+00'),
  ('41a5b440-628b-4c47-b61f-b9b3d36a67ca', '89.139.117.152', false, '2026-03-09 00:07:17.220668+00'),
  ('d72d6a20-1965-47f0-b60a-b46e2caa23b4', '89.139.117.152', false, '2026-03-09 00:07:20.010839+00'),
  ('ffd2fe4b-fb9e-4bc0-8a9a-f327a3b564bd', '89.139.117.152', false, '2026-03-09 00:07:22.841455+00'),
  ('68dd51f1-d97b-4990-bedf-18490df7a837', '89.139.117.152', false, '2026-03-09 00:07:26.591885+00'),
  ('da74d74b-80c6-4371-b578-72e92e5c9ecc', '89.139.117.152', false, '2026-03-09 00:07:34.943622+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- EMPTY TABLES (no data):
-- center_inventory, inventory_transfers, product_issues,
-- supplier_payments, supplier_price_quotes, sap_sync_log,
-- learning_journal
-- ============================================================
