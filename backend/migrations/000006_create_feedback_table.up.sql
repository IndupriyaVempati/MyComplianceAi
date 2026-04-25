CREATE TABLE IF NOT EXISTS feedback (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id    UUID NOT NULL REFERENCES thread(thread_id) ON DELETE CASCADE,
  run_id       TEXT,
  rating       SMALLINT NOT NULL CHECK (rating IN (1, -1)),
  comment      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
