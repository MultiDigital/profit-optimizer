-- Revenue Optimizer Database Schema
-- Run this in your Supabase SQL Editor

-- Billing rate settings per user
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  senior_rate NUMERIC DEFAULT 296,
  middle_up_rate NUMERIC DEFAULT 192,
  middle_rate NUMERIC DEFAULT 160,
  junior_rate NUMERIC DEFAULT 128,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Team members
CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  seniority TEXT NOT NULL CHECK (seniority IN ('senior', 'middleup', 'middle', 'junior')),
  days_per_month NUMERIC DEFAULT 20,
  utilization NUMERIC DEFAULT 80,
  salary NUMERIC DEFAULT 50000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Services
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  senior_days NUMERIC DEFAULT 0,
  middle_up_days NUMERIC DEFAULT 0,
  middle_days NUMERIC DEFAULT 0,
  junior_days NUMERIC DEFAULT 0,
  price NUMERIC NOT NULL,
  max_year NUMERIC, -- NULL = unlimited
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running)
DROP POLICY IF EXISTS "Users can CRUD own settings" ON settings;
DROP POLICY IF EXISTS "Users can CRUD own members" ON members;
DROP POLICY IF EXISTS "Users can CRUD own services" ON services;

-- Policies: users can only access their own data
CREATE POLICY "Users can CRUD own settings" ON settings
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD own members" ON members
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD own services" ON services
  FOR ALL USING (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_members_user_id ON members(user_id);
CREATE INDEX IF NOT EXISTS idx_services_user_id ON services(user_id);
CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id);
