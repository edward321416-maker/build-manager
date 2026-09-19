CREATE TABLE app.property (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  address_reference text NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT property_org_fk
    FOREIGN KEY (org_id) REFERENCES app.organization(id),
  CONSTRAINT property_org_id_id_unique UNIQUE (org_id, id),
  CONSTRAINT property_address_reference_shape
    CHECK (
      address_reference IS NULL
      OR (
        address_reference = btrim(address_reference)
        AND char_length(address_reference) BETWEEN 1 AND 512
      )
    )
);

CREATE TABLE app.unit (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  property_id uuid NOT NULL,
  label text NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT unit_org_id_id_unique UNIQUE (org_id, id),
  CONSTRAINT unit_property_fk
    FOREIGN KEY (org_id, property_id)
    REFERENCES app.property(org_id, id),
  CONSTRAINT unit_label_shape
    CHECK (
      label = btrim(label)
      AND char_length(label) BETWEEN 1 AND 80
      AND label !~ '[[:cntrl:]]'
    )
);

CREATE UNIQUE INDEX unit_active_label_unique
  ON app.unit (
    org_id,
    property_id,
    (lower(label) COLLATE "C")
  )
  WHERE status = 'ACTIVE';

CREATE TABLE app.occupancy (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'ENDED')),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT occupancy_org_id_id_unique UNIQUE (org_id, id),
  CONSTRAINT occupancy_unit_fk
    FOREIGN KEY (org_id, unit_id)
    REFERENCES app.unit(org_id, id),
  CONSTRAINT occupancy_time_shape
    CHECK (
      (ends_at IS NULL OR ends_at > starts_at)
      AND (status <> 'ENDED' OR ends_at IS NOT NULL)
    )
);

CREATE UNIQUE INDEX occupancy_one_active_unit
  ON app.occupancy (org_id, unit_id)
  WHERE status = 'ACTIVE';

CREATE TABLE app.occupancy_member (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  occupancy_id uuid NOT NULL,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL,
  ended_at timestamptz NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'ENDED')),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT occupancy_member_org_id_id_unique UNIQUE (org_id, id),
  CONSTRAINT occupancy_member_occupancy_fk
    FOREIGN KEY (org_id, occupancy_id)
    REFERENCES app.occupancy(org_id, id),
  CONSTRAINT occupancy_member_user_fk
    FOREIGN KEY (user_id) REFERENCES app.app_user(id),
  CONSTRAINT occupancy_member_time_shape
    CHECK (
      (ended_at IS NULL OR ended_at >= joined_at)
      AND (status <> 'ENDED' OR ended_at IS NOT NULL)
    )
);

CREATE UNIQUE INDEX occupancy_member_one_active_user
  ON app.occupancy_member (org_id, occupancy_id, user_id)
  WHERE status = 'ACTIVE';
