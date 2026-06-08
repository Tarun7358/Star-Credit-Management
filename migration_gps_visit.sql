-- Add GPS verification columns to customer_activities table
ALTER TABLE public.customer_activities ADD COLUMN IF NOT EXISTS worker_lat double precision;
ALTER TABLE public.customer_activities ADD COLUMN IF NOT EXISTS worker_lng double precision;
ALTER TABLE public.customer_activities ADD COLUMN IF NOT EXISTS gps_verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.customer_activities ADD COLUMN IF NOT EXISTS distance_from_customer numeric;

-- Comment for reference
COMMENT ON COLUMN public.customer_activities.worker_lat IS 'Worker GPS latitude at time of logging field visit';
COMMENT ON COLUMN public.customer_activities.worker_lng IS 'Worker GPS longitude at time of logging field visit';
COMMENT ON COLUMN public.customer_activities.gps_verified IS 'True if worker was within 100 meters of customer location when logging';
COMMENT ON COLUMN public.customer_activities.distance_from_customer IS 'Calculated distance in meters between worker and customer at time of logging';
