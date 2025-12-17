ALTER TABLE employees ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS title text;

ALTER TABLE knowledge_bases ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE knowledge_bases ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE knowledge_bases ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE knowledge_bases ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;

ALTER TABLE coaching_sessions ADD COLUMN IF NOT EXISTS channel text;
ALTER TABLE coaching_sessions ADD COLUMN IF NOT EXISTS artifacts jsonb;

ALTER TABLE coaching_plans ADD COLUMN IF NOT EXISTS source_analysis_id uuid;
