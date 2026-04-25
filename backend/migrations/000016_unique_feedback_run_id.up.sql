CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_thread_run ON feedback (thread_id, run_id) WHERE run_id IS NOT NULL;
