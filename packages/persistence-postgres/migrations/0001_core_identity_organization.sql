CREATE SCHEMA app;

CREATE TABLE app.app_user (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  status text NOT NULL CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DELETION_PENDING')),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);

CREATE TABLE app.organization (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  status text NOT NULL CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED')),
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT organization_display_name_shape
    CHECK (
      display_name = btrim(display_name)
      AND char_length(display_name) BETWEEN 1 AND 160
    )
);

CREATE TABLE app.organization_membership (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('ORG_ADMIN', 'PROPERTY_STAFF')),
  status text NOT NULL CHECK (status IN ('ACTIVE', 'ENDED')),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  ended_at timestamptz NULL,
  CONSTRAINT organization_membership_org_fk
    FOREIGN KEY (org_id) REFERENCES app.organization(id),
  CONSTRAINT organization_membership_user_fk
    FOREIGN KEY (user_id) REFERENCES app.app_user(id),
  CONSTRAINT organization_membership_status_time
    CHECK (
      (status = 'ACTIVE' AND ended_at IS NULL)
      OR
      (status = 'ENDED' AND ended_at IS NOT NULL AND ended_at >= created_at)
    ),
  CONSTRAINT organization_membership_org_id_id_unique UNIQUE (org_id, id)
);

CREATE UNIQUE INDEX organization_membership_one_active_user_org
  ON app.organization_membership (org_id, user_id)
  WHERE status = 'ACTIVE';
