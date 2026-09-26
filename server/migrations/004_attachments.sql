CREATE TABLE IF NOT EXISTS project_attachments (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES project_spaces(project_id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  file_name TEXT NOT NULL,
  size BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_attachments_project_id_idx ON project_attachments(project_id);
