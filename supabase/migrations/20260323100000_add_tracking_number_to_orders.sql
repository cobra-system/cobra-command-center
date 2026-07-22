-- Add tracking_number column to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(255);

-- Add comment documenting the column
COMMENT ON COLUMN public.orders.tracking_number IS 'Tracking number for shipment monitoring (e.g., DHL, FedEx, local courier)';
