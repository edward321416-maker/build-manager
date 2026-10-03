-- Bounded synthetic-development attachments; existing ticket/evidence semantics are unchanged.
GRANT CREATE ON SCHEMA core_flow TO bm_core_flow_owner;
SET LOCAL ROLE bm_core_flow_owner;
CREATE TABLE core_flow.ticket_photo (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ticket_id text NOT NULL REFERENCES core_flow.ticket(id),
 org_id uuid NOT NULL REFERENCES app.organization(id),actor_id uuid NOT NULL REFERENCES app.app_user(id),
 upload_id uuid NOT NULL,mime text NOT NULL CHECK(mime IN ('image/jpeg','image/png')),
 width integer NOT NULL CHECK(width>0),height integer NOT NULL CHECK(height>0),
 content bytea NOT NULL CHECK(octet_length(content) BETWEEN 1 AND 5242880),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(ticket_id,upload_id),
 CHECK(width::bigint*height::bigint<=20000000),
 CHECK((mime='image/png' AND substring(content FROM 1 FOR 8)=decode('89504e470d0a1a0a','hex')) OR
       (mime='image/jpeg' AND substring(content FROM 1 FOR 3)=decode('ffd8ff','hex') AND substring(content FROM octet_length(content)-1 FOR 2)=decode('ffd9','hex')))
);
ALTER TABLE core_flow.ticket_photo ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_flow.ticket_photo FORCE ROW LEVEL SECURITY;
CREATE POLICY photo_org ON core_flow.ticket_photo TO bm_core_flow_owner
 USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());

CREATE FUNCTION core_flow.check_photo_write(p_digest bytea,p_id text) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r jsonb; s jsonb;
BEGIN
 r:=core_flow.read_ticket(p_digest,p_id,false);s:=core_flow.session(p_digest);
 IF s->>'role'<>'TENANT' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FORBIDDEN'; END IF;
 IF r->>'workStatus'='COMPLETED' THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
END $$;

CREATE FUNCTION core_flow.list_photos(p_digest bytea,p_id text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;
BEGIN
 PERFORM core_flow.read_ticket(p_digest,p_id,false);
 SELECT coalesce(jsonb_agg(jsonb_build_object('photoId',id,'uploadId',upload_id,'createdAt',created_at,
 'mime',mime,'byteSize',octet_length(content),'width',width,'height',height) ORDER BY created_at,id),'[]'::jsonb)
 INTO result FROM core_flow.ticket_photo WHERE ticket_id=p_id AND org_id=app.current_org_id();
 RETURN result;
END $$;

CREATE FUNCTION core_flow.read_photo(p_digest bytea,p_id text,p_photo uuid) RETURNS TABLE(metadata jsonb,content bytea)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE p core_flow.ticket_photo;
BEGIN
 PERFORM core_flow.read_ticket(p_digest,p_id,false);
 SELECT * INTO p FROM core_flow.ticket_photo WHERE id=p_photo AND ticket_id=p_id AND org_id=app.current_org_id();
 IF p.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
 RETURN QUERY SELECT jsonb_build_object('photoId',p.id,'uploadId',p.upload_id,'createdAt',p.created_at,
 'mime',p.mime,'byteSize',octet_length(p.content),'width',p.width,'height',p.height),p.content;
END $$;

CREATE FUNCTION core_flow.save_photo(p_digest bytea,p_id text,p_upload uuid,p_mime text,p_width integer,p_height integer,p_content bytea) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t core_flow.ticket; p core_flow.ticket_photo; created boolean:=false;
BEGIN
 -- Serialize count/idempotency with the same ticket lock as handling completion.
 PERFORM core_flow.read_ticket(p_digest,p_id,true);
 PERFORM core_flow.check_photo_write(p_digest,p_id);
 IF p_upload IS NULL OR p_mime IS NULL OR p_mime NOT IN ('image/jpeg','image/png') OR p_content IS NULL
 OR octet_length(p_content) NOT BETWEEN 1 AND 5242880 OR p_width IS NULL OR p_height IS NULL
 OR p_width<=0 OR p_height<=0 OR p_width::bigint*p_height::bigint>20000000
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
 SELECT * INTO t FROM core_flow.ticket WHERE id=p_id AND org_id=app.current_org_id();
 SELECT * INTO p FROM core_flow.ticket_photo WHERE ticket_id=p_id AND upload_id=p_upload AND org_id=t.org_id;
 IF p.id IS NOT NULL THEN
  IF p.content<>p_content OR p.mime<>p_mime OR p.width<>p_width OR p.height<>p_height
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
 ELSE
  IF (SELECT count(*) FROM core_flow.ticket_photo WHERE ticket_id=p_id AND org_id=t.org_id)>=3
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  INSERT INTO core_flow.ticket_photo(ticket_id,org_id,actor_id,upload_id,mime,width,height,content)
  VALUES(p_id,t.org_id,t.tenant_id,p_upload,p_mime,p_width,p_height,p_content) RETURNING * INTO p;
  created:=true;
 END IF;
 RETURN jsonb_build_object('created',created,'photo',jsonb_build_object('photoId',p.id,'uploadId',p.upload_id,'createdAt',p.created_at,
 'mime',p.mime,'byteSize',octet_length(p.content),'width',p.width,'height',p.height));
END $$;

REVOKE ALL ON core_flow.ticket_photo FROM PUBLIC;
REVOKE ALL ON FUNCTION core_flow.check_photo_write(bytea,text),core_flow.list_photos(bytea,text),
 core_flow.read_photo(bytea,text,uuid),core_flow.save_photo(bytea,text,uuid,text,integer,integer,bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core_flow.check_photo_write(bytea,text),core_flow.list_photos(bytea,text),
 core_flow.read_photo(bytea,text,uuid),core_flow.save_photo(bytea,text,uuid,text,integer,integer,bytea) TO bm_b1_web;
RESET ROLE;
REVOKE CREATE ON SCHEMA core_flow FROM bm_core_flow_owner;
