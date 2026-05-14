-- AstranoV AI memory + feedback + pending changes

CREATE TABLE IF NOT EXISTS ai_memory (
  id          bigserial PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL,                  -- system | user | assistant
  content     text NOT NULL,
  context     jsonb DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_memory_user_idx ON ai_memory(user_id, created_at DESC);

ALTER TABLE ai_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own ai memory" ON ai_memory;
CREATE POLICY "Users see own ai memory"
  ON ai_memory FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users insert own ai memory" ON ai_memory;
CREATE POLICY "Users insert own ai memory"
  ON ai_memory FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role ai_memory all" ON ai_memory;
CREATE POLICY "Service role ai_memory all"
  ON ai_memory FOR ALL
  USING (auth.role() = 'service_role');


CREATE TABLE IF NOT EXISTS ai_feedback (
  id          bigserial PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind        text NOT NULL,                  -- suggestion | bug | praise | request
  text        text NOT NULL,
  context     jsonb DEFAULT '{}',
  status      text NOT NULL DEFAULT 'open',   -- open | reviewing | applied | rejected
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_feedback_status_idx ON ai_feedback(status, created_at DESC);

ALTER TABLE ai_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone insert feedback" ON ai_feedback;
CREATE POLICY "Anyone insert feedback"
  ON ai_feedback FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users see own feedback" ON ai_feedback;
CREATE POLICY "Users see own feedback"
  ON ai_feedback FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role feedback all" ON ai_feedback;
CREATE POLICY "Service role feedback all"
  ON ai_feedback FOR ALL
  USING (auth.role() = 'service_role');


CREATE TABLE IF NOT EXISTS ai_proposals (
  id           bigserial PRIMARY KEY,
  prompt       text NOT NULL,
  summary      text,
  diff_preview text,
  status       text NOT NULL DEFAULT 'pending', -- pending | approved | rejected | applied
  approved_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  commit_sha   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  decided_at   timestamptz
);

CREATE INDEX IF NOT EXISTS ai_proposals_status_idx ON ai_proposals(status, created_at DESC);

ALTER TABLE ai_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners see proposals" ON ai_proposals;
CREATE POLICY "Owners see proposals"
  ON ai_proposals FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_owner = true));

DROP POLICY IF EXISTS "Owners update proposals" ON ai_proposals;
CREATE POLICY "Owners update proposals"
  ON ai_proposals FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_owner = true));

DROP POLICY IF EXISTS "Service role proposals all" ON ai_proposals;
CREATE POLICY "Service role proposals all"
  ON ai_proposals FOR ALL
  USING (auth.role() = 'service_role');
