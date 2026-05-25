-- Run this in Supabase -> SQL Editor -> New Query.

CREATE TABLE IF NOT EXISTS public.scans (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS id                          bigserial,
  ADD COLUMN IF NOT EXISTS created_at                  timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS scan_id                     text    DEFAULT '',
  ADD COLUMN IF NOT EXISTS platform                    text    DEFAULT 'twitter',
  ADD COLUMN IF NOT EXISTS username                    text    DEFAULT '',
  ADD COLUMN IF NOT EXISTS followers_count             int8    DEFAULT 0,
  ADD COLUMN IF NOT EXISTS following_count             int8    DEFAULT 0,
  ADD COLUMN IF NOT EXISTS follower_following_ratio    float8  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS account_age_days            int4    DEFAULT 0,
  ADD COLUMN IF NOT EXISTS statuses_count              int4    DEFAULT 0,
  ADD COLUMN IF NOT EXISTS posts_per_day               float8  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS content_density             float8  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tweets_per_day              float8  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_proxy            float8  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS followers_log               float8  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS following_log               float8  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ratio_log                   float8  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS activity_score              float8  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS growth_signal               float8  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_profile_image           int2    DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verified                    int2    DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bio_length                  int4    DEFAULT 0,
  ADD COLUMN IF NOT EXISTS username_randomness_score   float8  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS username_length             int4    DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prediction                  int4    DEFAULT 0,
  ADD COLUMN IF NOT EXISTS label                       text    DEFAULT '',
  ADD COLUMN IF NOT EXISTS fake_probability            float8  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confidence                  float8  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confidence_band             text    DEFAULT '',
  ADD COLUMN IF NOT EXISTS risk_code                   text    DEFAULT '',
  ADD COLUMN IF NOT EXISTS risk_level                  text    DEFAULT '',
  ADD COLUMN IF NOT EXISTS threat_label                text    DEFAULT '',
  ADD COLUMN IF NOT EXISTS explanation                 jsonb   DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS raw_metrics                 jsonb   DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS scans_created_at_idx
  ON public.scans (created_at DESC);

CREATE INDEX IF NOT EXISTS scans_scan_id_idx
  ON public.scans (scan_id);

ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read scans" ON public.scans;
CREATE POLICY "Allow public read scans"
  ON public.scans
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Allow public insert scans" ON public.scans;
CREATE POLICY "Allow public insert scans"
  ON public.scans
  FOR INSERT
  TO anon
  WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'scans'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scans;
  END IF;
END $$;
