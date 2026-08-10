-- ========================================================
-- SUPABASE DATABASE & STORAGE MIGRATION FOR NGHE TRUYEN CHU
-- Run this in your Supabase SQL Editor
-- ========================================================

-- 1. Create table `novels`
CREATE TABLE IF NOT EXISTS novels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT,
  cover_url TEXT,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  chapter_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create table `user_progress`
CREATE TABLE IF NOT EXISTS user_progress (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  location_cfi TEXT,
  chapter_index INT DEFAULT 0,
  tts_sentence_index INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, novel_id)
);

-- 3. Enable RLS
ALTER TABLE novels ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
CREATE POLICY "Users can CRUD own novels"
  ON novels FOR ALL
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can CRUD own progress"
  ON user_progress FOR ALL
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- 5. Create Indexes
CREATE INDEX IF NOT EXISTS idx_novels_user ON novels(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_user_novel ON user_progress(user_id, novel_id);

-- 6. Storage Buckets (Execute in Supabase Storage or via SQL if storage schema enabled)
-- Create bucket 'novels' (private or public)
-- Create bucket 'covers' (public)
-- Create bucket 'tts-models' (public)
