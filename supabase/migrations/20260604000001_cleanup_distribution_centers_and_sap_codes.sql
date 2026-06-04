-- Merge duplicate distribution_centers rows, set SAP warehouse codes,
-- recompute division_products.monthly_avg from consumption history.

-- Survivor IDs (keep):
--   מרכז הפצה תל אביב : 8ce83d27-d762-487e-8f7a-c1e62bbc2566
--   דלק מוטורס         : 8efd8988-533f-46b3-9bf7-8c6973c82c06
--   לובינסקי           : ba65b0d3-324f-4ecd-b0cc-eade6491f57b
--   פריזבי קרסו        : 71182d80-571c-439d-baf6-ccf1f4374d45
--   יחידת היבואנים     : 85c54009-4202-4d79-a56f-077677ec853e (no dup)
--
-- Loser IDs (soft-delete after repointing):
--   מרכז הפצה תל אביב : ac235b17-fd89-4b58-a6c0-14e730e97e35
--   דלק מוטורס         : dd5285c8-56ab-444e-ae1e-0efa2f6119af
--   לובינסקי           : 0985fd0b-6ef7-4af5-9742-cb641c872fe9
--   פריזבי קרסו        : 8e575550-ac53-4008-887b-8b3f70c9337f

-- ── Repoint center_contacts ───────────────────────────────────
UPDATE center_contacts SET center_id = '8ce83d27-d762-487e-8f7a-c1e62bbc2566'
WHERE center_id = 'ac235b17-fd89-4b58-a6c0-14e730e97e35';

UPDATE center_contacts SET center_id = '8efd8988-533f-46b3-9bf7-8c6973c82c06'
WHERE center_id = 'dd5285c8-56ab-444e-ae1e-0efa2f6119af';

UPDATE center_contacts SET center_id = 'ba65b0d3-324f-4ecd-b0cc-eade6491f57b'
WHERE center_id = '0985fd0b-6ef7-4af5-9742-cb641c872fe9';

UPDATE center_contacts SET center_id = '71182d80-571c-439d-baf6-ccf1f4374d45'
WHERE center_id = '8e575550-ac53-4008-887b-8b3f70c9337f';

-- ── Repoint inventory_transfers ───────────────────────────────
UPDATE inventory_transfers SET from_center_id = '8ce83d27-d762-487e-8f7a-c1e62bbc2566'
WHERE from_center_id = 'ac235b17-fd89-4b58-a6c0-14e730e97e35';
UPDATE inventory_transfers SET to_center_id = '8ce83d27-d762-487e-8f7a-c1e62bbc2566'
WHERE to_center_id = 'ac235b17-fd89-4b58-a6c0-14e730e97e35';

UPDATE inventory_transfers SET from_center_id = '8efd8988-533f-46b3-9bf7-8c6973c82c06'
WHERE from_center_id = 'dd5285c8-56ab-444e-ae1e-0efa2f6119af';
UPDATE inventory_transfers SET to_center_id = '8efd8988-533f-46b3-9bf7-8c6973c82c06'
WHERE to_center_id = 'dd5285c8-56ab-444e-ae1e-0efa2f6119af';

UPDATE inventory_transfers SET from_center_id = 'ba65b0d3-324f-4ecd-b0cc-eade6491f57b'
WHERE from_center_id = '0985fd0b-6ef7-4af5-9742-cb641c872fe9';
UPDATE inventory_transfers SET to_center_id = 'ba65b0d3-324f-4ecd-b0cc-eade6491f57b'
WHERE to_center_id = '0985fd0b-6ef7-4af5-9742-cb641c872fe9';

UPDATE inventory_transfers SET from_center_id = '71182d80-571c-439d-baf6-ccf1f4374d45'
WHERE from_center_id = '8e575550-ac53-4008-887b-8b3f70c9337f';
UPDATE inventory_transfers SET to_center_id = '71182d80-571c-439d-baf6-ccf1f4374d45'
WHERE to_center_id = '8e575550-ac53-4008-887b-8b3f70c9337f';

-- ── Repoint installers ────────────────────────────────────────
UPDATE installers SET center_id = '8ce83d27-d762-487e-8f7a-c1e62bbc2566'
WHERE center_id = 'ac235b17-fd89-4b58-a6c0-14e730e97e35';
UPDATE installers SET center_id = '8efd8988-533f-46b3-9bf7-8c6973c82c06'
WHERE center_id = 'dd5285c8-56ab-444e-ae1e-0efa2f6119af';
UPDATE installers SET center_id = 'ba65b0d3-324f-4ecd-b0cc-eade6491f57b'
WHERE center_id = '0985fd0b-6ef7-4af5-9742-cb641c872fe9';
UPDATE installers SET center_id = '71182d80-571c-439d-baf6-ccf1f4374d45'
WHERE center_id = '8e575550-ac53-4008-887b-8b3f70c9337f';

-- ── Handle center_inventory collision ─────────────────────────
-- ת"א loser has 1 stale row (qty=1) for product 314d0fa6 that
-- also exists on the survivor (qty=195). Delete the stale row.
DELETE FROM center_inventory
WHERE center_id = 'ac235b17-fd89-4b58-a6c0-14e730e97e35'
  AND product_id = '314d0fa6-9aea-452e-8d14-99ec7383dec6';

-- Repoint any remaining inventory from losers to survivors
UPDATE center_inventory SET center_id = '8ce83d27-d762-487e-8f7a-c1e62bbc2566'
WHERE center_id = 'ac235b17-fd89-4b58-a6c0-14e730e97e35';
UPDATE center_inventory SET center_id = '8efd8988-533f-46b3-9bf7-8c6973c82c06'
WHERE center_id = 'dd5285c8-56ab-444e-ae1e-0efa2f6119af';
UPDATE center_inventory SET center_id = 'ba65b0d3-324f-4ecd-b0cc-eade6491f57b'
WHERE center_id = '0985fd0b-6ef7-4af5-9742-cb641c872fe9';
UPDATE center_inventory SET center_id = '71182d80-571c-439d-baf6-ccf1f4374d45'
WHERE center_id = '8e575550-ac53-4008-887b-8b3f70c9337f';

-- ── Soft-delete loser centers ─────────────────────────────────
UPDATE distribution_centers SET deleted_at = now()
WHERE id IN (
  'ac235b17-fd89-4b58-a6c0-14e730e97e35',
  'dd5285c8-56ab-444e-ae1e-0efa2f6119af',
  '0985fd0b-6ef7-4af5-9742-cb641c872fe9',
  '8e575550-ac53-4008-887b-8b3f70c9337f'
);

-- ── Dedupe contacts on survivors ──────────────────────────────
DELETE FROM center_contacts
WHERE id NOT IN (
  SELECT DISTINCT ON (center_id, name, phone) id
  FROM center_contacts
  ORDER BY center_id, name, phone, created_at ASC
);

-- ── Set SAP warehouse codes ───────────────────────────────────
UPDATE distribution_centers SET sap_code = '001'
WHERE id = '8ce83d27-d762-487e-8f7a-c1e62bbc2566';

UPDATE distribution_centers SET sap_code = '002'
WHERE id = '8efd8988-533f-46b3-9bf7-8c6973c82c06';

UPDATE distribution_centers SET sap_code = '003'
WHERE id = 'ba65b0d3-324f-4ecd-b0cc-eade6491f57b';

UPDATE distribution_centers SET sap_code = '011'
WHERE id = '71182d80-571c-439d-baf6-ccf1f4374d45';

-- ── Recompute monthly_avg for all division_products ───────────
UPDATE division_products dp
SET monthly_avg = s.avg_qty,
    monthly_avg_updated_at = now()
FROM (
  SELECT division, product_id, round(AVG(quantity)::numeric, 2) AS avg_qty
  FROM division_product_consumption
  GROUP BY division, product_id
) s
WHERE dp.division = s.division
  AND dp.product_id = s.product_id;
