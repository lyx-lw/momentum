ALTER TABLE public.rsip_nodes
  ADD COLUMN IF NOT EXISTS requires_daily_execution BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.rsip_policy_library
  ADD COLUMN IF NOT EXISTS requires_daily_execution BOOLEAN NOT NULL DEFAULT TRUE;

CREATE OR REPLACE FUNCTION public.create_rsip_nodes_with_meta(
  p_intent_key text,
  p_nodes jsonb,
  p_meta jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_requested_node_ids uuid[];
  v_recorded_request_ids uuid[];
  v_intent_node_ids uuid[];
  v_nodes_result jsonb;
  v_meta_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '28000';
  END IF;

  IF p_nodes IS NULL OR jsonb_typeof(p_nodes) <> 'array' THEN
    RAISE EXCEPTION 'p_nodes must be a JSON array'
      USING ERRCODE = '22023';
  END IF;
  IF p_intent_key IS NULL OR btrim(p_intent_key) = '' THEN
    RAISE EXCEPTION 'p_intent_key must not be empty'
      USING ERRCODE = '22023';
  END IF;
  IF p_meta IS NULL OR jsonb_typeof(p_meta) <> 'object' THEN
    RAISE EXCEPTION 'p_meta must be a JSON object'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_nodes) AS item
    GROUP BY (item ->> 'id')::uuid
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'p_nodes contains duplicate node ids'
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(
    array_agg(node_id ORDER BY node_id),
    ARRAY[]::uuid[]
  )
  INTO v_requested_node_ids
  FROM (
    SELECT DISTINCT (item ->> 'id')::uuid AS node_id
    FROM jsonb_array_elements(p_nodes) AS item
  ) AS requested;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_user_id::text || ':create_nodes_with_meta:' || p_intent_key,
      0
    )
  );

  SELECT intent.request_node_ids, intent.affected_node_ids
  INTO v_recorded_request_ids, v_intent_node_ids
  FROM public.rsip_atomic_intents AS intent
  WHERE intent.user_id = v_user_id
    AND intent.intent_kind = 'create_nodes_with_meta'
    AND intent.intent_key = p_intent_key;

  IF FOUND THEN
    IF v_recorded_request_ids <> v_requested_node_ids THEN
      RAISE EXCEPTION 'RSIP creation intent key was reused for another request'
        USING ERRCODE = '22023';
    END IF;

    SELECT COALESCE(
      jsonb_agg(to_jsonb(node) ORDER BY node.sort_order, node.id),
      '[]'::jsonb
    )
    INTO v_nodes_result
    FROM public.rsip_nodes AS node
    WHERE node.user_id = v_user_id
      AND node.id = ANY(v_intent_node_ids);

    SELECT COALESCE(to_jsonb(meta), '{}'::jsonb)
    INTO v_meta_result
    FROM public.rsip_meta AS meta
    WHERE meta.user_id = v_user_id;

    RETURN jsonb_build_object(
      'nodes', v_nodes_result,
      'meta', COALESCE(v_meta_result, '{}'::jsonb)
    );
  END IF;

  -- Keep referenced rows stable until this transaction has inserted and
  -- verified the batch. Missing parents/groups are rejected by their FKs.
  PERFORM parent.id
  FROM public.rsip_nodes AS parent
  JOIN jsonb_array_elements(p_nodes) AS item
    ON parent.id = NULLIF(item ->> 'parent_id', '')::uuid
  ORDER BY parent.id
  FOR KEY SHARE OF parent;

  PERFORM node_group.id
  FROM public.rsip_groups AS node_group
  JOIN jsonb_array_elements(p_nodes) AS item
    ON node_group.id = NULLIF(item ->> 'group_id', '')::uuid
  ORDER BY node_group.id
  FOR KEY SHARE OF node_group;

  -- SECURITY DEFINER must not permit an id collision to overwrite another user.
  IF EXISTS (
    SELECT 1
    FROM public.rsip_nodes AS existing
    JOIN jsonb_array_elements(p_nodes) AS item
      ON existing.id = (item ->> 'id')::uuid
    WHERE existing.user_id <> v_user_id
  ) THEN
    RAISE EXCEPTION 'RSIP node id belongs to another user'
      USING ERRCODE = '42501';
  END IF;

  -- A supplied parent may be pre-existing or part of this batch, but it may
  -- never point into another user's tree.
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_nodes) AS item
    JOIN public.rsip_nodes AS parent
      ON parent.id = NULLIF(item ->> 'parent_id', '')::uuid
    WHERE parent.user_id <> v_user_id
  ) THEN
    RAISE EXCEPTION 'RSIP parent node belongs to another user'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_nodes) AS item
    JOIN public.rsip_groups AS node_group
      ON node_group.id = NULLIF(item ->> 'group_id', '')::uuid
    WHERE node_group.user_id <> v_user_id
  ) THEN
    RAISE EXCEPTION 'RSIP group belongs to another user'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.rsip_nodes AS existing (
    id,
    user_id,
    parent_id,
    title,
    rule,
    sort_order,
    use_timer,
    timer_minutes,
    created_at,
    emoji,
    type,
    group_id,
    reinforcement_level,
    max_reinforcement_level,
    cumulative_execution_days,
    is_passive,
    requires_daily_execution,
    split_from_goal,
    stability_phase,
    phase_started_at,
    last_executed_at,
    last_violated_at,
    consecutive_executions,
    consecutive_violations,
    total_executions,
    total_violations
  )
  SELECT
    (item ->> 'id')::uuid,
    v_user_id,
    NULLIF(item ->> 'parent_id', '')::uuid,
    item ->> 'title',
    item ->> 'rule',
    COALESCE((item ->> 'sort_order')::integer, 0),
    COALESCE((item ->> 'use_timer')::boolean, false),
    NULLIF(item ->> 'timer_minutes', '')::integer,
    COALESCE((item ->> 'created_at')::timestamptz, now()),
    NULLIF(item ->> 'emoji', ''),
    NULLIF(item ->> 'type', ''),
    NULLIF(item ->> 'group_id', '')::uuid,
    COALESCE((item ->> 'reinforcement_level')::integer, 0),
    COALESCE((item ->> 'max_reinforcement_level')::integer, 0),
    COALESCE((item ->> 'cumulative_execution_days')::integer, 0),
    COALESCE((item ->> 'is_passive')::boolean, false),
    COALESCE((item ->> 'requires_daily_execution')::boolean, true),
    NULLIF(item ->> 'split_from_goal', ''),
    COALESCE(NULLIF(item ->> 'stability_phase', ''), 'E0'),
    NULLIF(item ->> 'phase_started_at', '')::timestamptz,
    NULLIF(item ->> 'last_executed_at', '')::timestamptz,
    NULLIF(item ->> 'last_violated_at', '')::timestamptz,
    COALESCE((item ->> 'consecutive_executions')::integer, 0),
    COALESCE((item ->> 'consecutive_violations')::integer, 0),
    COALESCE((item ->> 'total_executions')::integer, 0),
    COALESCE((item ->> 'total_violations')::integer, 0)
  FROM jsonb_array_elements(p_nodes) AS item
  ON CONFLICT (id) DO NOTHING;

  -- ON CONFLICT may have waited for a concurrent transaction. Re-read on a
  -- fresh statement snapshot and fail the whole transaction unless every id
  -- now resolves to this user with tenant-safe persisted references.
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_nodes) AS item
    LEFT JOIN public.rsip_nodes AS persisted
      ON persisted.id = (item ->> 'id')::uuid
    LEFT JOIN public.rsip_nodes AS persisted_parent
      ON persisted_parent.id = persisted.parent_id
    LEFT JOIN public.rsip_groups AS persisted_group
      ON persisted_group.id = persisted.group_id
    WHERE persisted.id IS NULL
      OR persisted.user_id <> v_user_id
      OR (
        persisted.parent_id IS NOT NULL
        AND persisted_parent.user_id IS DISTINCT FROM v_user_id
      )
      OR (
        persisted.group_id IS NOT NULL
        AND persisted_group.user_id IS DISTINCT FROM v_user_id
      )
  ) THEN
    RAISE EXCEPTION 'RSIP node batch failed tenant ownership verification'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.rsip_meta AS existing (
    user_id,
    last_added_at,
    allow_multiple_per_day,
    last_tree_opened_at,
    daily_tree_open_required,
    tree_open_streak,
    current_run_number,
    current_run_started_at
  )
  VALUES (
    v_user_id,
    NULLIF(p_meta ->> 'last_added_at', '')::timestamptz,
    COALESCE((p_meta ->> 'allow_multiple_per_day')::boolean, false),
    NULLIF(p_meta ->> 'last_tree_opened_at', '')::timestamptz,
    COALESCE((p_meta ->> 'daily_tree_open_required')::boolean, false),
    COALESCE((p_meta ->> 'tree_open_streak')::integer, 0),
    NULLIF(p_meta ->> 'current_run_number', '')::integer,
    NULLIF(p_meta ->> 'current_run_started_at', '')::timestamptz
  )
  ON CONFLICT (user_id) DO UPDATE SET
    last_added_at = CASE
      WHEN existing.last_added_at IS NULL THEN EXCLUDED.last_added_at
      WHEN EXCLUDED.last_added_at IS NULL THEN existing.last_added_at
      ELSE GREATEST(existing.last_added_at, EXCLUDED.last_added_at)
    END,
    current_run_number = COALESCE(
      existing.current_run_number,
      EXCLUDED.current_run_number
    ),
    current_run_started_at = COALESCE(
      existing.current_run_started_at,
      EXCLUDED.current_run_started_at
    );

  v_intent_node_ids := v_requested_node_ids;
  INSERT INTO public.rsip_atomic_intents (
    user_id,
    intent_kind,
    intent_key,
    request_node_ids,
    affected_node_ids
  )
  VALUES (
    v_user_id,
    'create_nodes_with_meta',
    p_intent_key,
    v_requested_node_ids,
    v_intent_node_ids
  );

  SELECT COALESCE(
    jsonb_agg(to_jsonb(node) ORDER BY node.sort_order, node.id),
    '[]'::jsonb
  )
  INTO v_nodes_result
  FROM public.rsip_nodes AS node
  WHERE node.user_id = v_user_id
    AND node.id = ANY(v_intent_node_ids);

  SELECT COALESCE(to_jsonb(meta), '{}'::jsonb)
  INTO v_meta_result
  FROM public.rsip_meta AS meta
  WHERE meta.user_id = v_user_id;

  RETURN jsonb_build_object(
    'nodes', v_nodes_result,
    'meta', COALESCE(v_meta_result, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_rsip_nodes_with_meta(text, jsonb, jsonb)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_rsip_nodes_with_meta(text, jsonb, jsonb)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.archive_rsip_nodes_and_remove(
  p_intent_key text,
  p_node_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_requested_node_ids uuid[];
  v_recorded_request_ids uuid[];
  v_intent_node_ids uuid[];
  v_live_node_ids uuid[];
  v_frontier_ids uuid[];
  v_child_ids uuid[];
  v_archived_at timestamptz := now();
  v_library_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '28000';
  END IF;

  IF p_intent_key IS NULL OR btrim(p_intent_key) = '' THEN
    RAISE EXCEPTION 'p_intent_key must not be empty'
      USING ERRCODE = '22023';
  END IF;

  IF p_node_ids IS NULL OR cardinality(p_node_ids) = 0 THEN
    RETURN jsonb_build_object(
      'removed_node_ids', '[]'::jsonb,
      'library_entries', '[]'::jsonb
    );
  END IF;

  SELECT array_agg(node_id ORDER BY node_id)
  INTO v_requested_node_ids
  FROM (
    SELECT DISTINCT unnest(p_node_ids) AS node_id
  ) AS requested;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_user_id::text || ':archive_nodes:' || p_intent_key,
      0
    )
  );

  SELECT intent.request_node_ids, intent.affected_node_ids
  INTO v_recorded_request_ids, v_intent_node_ids
  FROM public.rsip_atomic_intents AS intent
  WHERE intent.user_id = v_user_id
    AND intent.intent_kind = 'archive_nodes'
    AND intent.intent_key = p_intent_key;

  IF FOUND THEN
    IF v_recorded_request_ids <> v_requested_node_ids THEN
      RAISE EXCEPTION 'RSIP archive intent key was reused for another request'
        USING ERRCODE = '22023';
    END IF;

    SELECT COALESCE(
      jsonb_agg(to_jsonb(entry) ORDER BY entry.updated_at DESC, entry.id),
      '[]'::jsonb
    )
    INTO v_library_result
    FROM public.rsip_policy_library AS entry
    WHERE entry.user_id = v_user_id
      AND entry.id = ANY(v_intent_node_ids);

    RETURN jsonb_build_object(
      'removed_node_ids', to_jsonb(v_intent_node_ids),
      'library_entries', v_library_result
    );
  END IF;

  -- Lock roots first. FK checks take a conflicting KEY SHARE lock, so after
  -- this succeeds no concurrent transaction can attach a new direct child.
  SELECT COALESCE(
    array_agg(locked_node.id ORDER BY locked_node.id),
    ARRAY[]::uuid[]
  )
  INTO v_live_node_ids
  FROM (
    SELECT node.id, node.user_id
    FROM public.rsip_nodes AS node
    WHERE node.id = ANY(p_node_ids)
    ORDER BY node.id
    FOR UPDATE
  ) AS locked_node;

  IF cardinality(v_live_node_ids) = 0 THEN
    v_intent_node_ids := v_requested_node_ids;
    INSERT INTO public.rsip_atomic_intents (
      user_id,
      intent_kind,
      intent_key,
      request_node_ids,
      affected_node_ids
    )
    VALUES (
      v_user_id,
      'archive_nodes',
      p_intent_key,
      v_requested_node_ids,
      v_intent_node_ids
    );

    SELECT COALESCE(
      jsonb_agg(to_jsonb(entry) ORDER BY entry.updated_at DESC, entry.id),
      '[]'::jsonb
    )
    INTO v_library_result
    FROM public.rsip_policy_library AS entry
    WHERE entry.user_id = v_user_id
      AND entry.id = ANY(v_intent_node_ids);

    RETURN jsonb_build_object(
      'removed_node_ids', to_jsonb(v_intent_node_ids),
      'library_entries', v_library_result
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.rsip_nodes AS root_node
    WHERE root_node.id = ANY(v_live_node_ids)
      AND root_node.user_id <> v_user_id
  ) THEN
    RAISE EXCEPTION 'RSIP node belongs to another user'
      USING ERRCODE = '42501';
  END IF;

  -- Walk one locked frontier at a time. Every parent in a frontier is already
  -- FOR UPDATE locked before its children are read, closing the cascade race
  -- at every depth instead of only for the requested roots.
  v_frontier_ids := v_live_node_ids;
  LOOP
    SELECT COALESCE(
      array_agg(locked_child.id ORDER BY locked_child.id),
      ARRAY[]::uuid[]
    )
    INTO v_child_ids
    FROM (
      SELECT child.id
      FROM public.rsip_nodes AS child
      WHERE child.parent_id = ANY(v_frontier_ids)
        AND NOT child.id = ANY(v_live_node_ids)
      ORDER BY child.id
      FOR UPDATE
    ) AS locked_child;

    EXIT WHEN cardinality(v_child_ids) = 0;

    v_live_node_ids := v_live_node_ids || v_child_ids;
    v_frontier_ids := v_child_ids;
  END LOOP;

  -- Legacy rows may predate the composite tenant FK above. Never let a root
  -- delete cascade into another user's row; abort the transaction instead.
  IF EXISTS (
    SELECT 1
    FROM public.rsip_nodes AS descendant
    WHERE descendant.id = ANY(v_live_node_ids)
      AND descendant.user_id <> v_user_id
  ) THEN
    RAISE EXCEPTION 'RSIP tree contains a node owned by another user'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.rsip_policy_library AS existing (
    id,
    user_id,
    title,
    rule,
    type,
    emoji,
    cumulative_execution_days,
    internalization_progress,
    last_active_at,
    times_used,
    use_timer,
    timer_minutes,
    is_passive,
    requires_daily_execution,
    updated_at
  )
  SELECT
    node.id,
    v_user_id,
    node.title,
    node.rule,
    node.type,
    node.emoji,
    GREATEST(
      COALESCE(node.cumulative_execution_days, 0),
      COALESCE(node.total_executions, 0),
      0
    ),
    LEAST(
      100::numeric,
      GREATEST(
        COALESCE(node.cumulative_execution_days, 0),
        COALESCE(node.total_executions, 0),
        0
      ) * 100.0 / 60.0
    ),
    v_archived_at,
    1,
    node.use_timer,
    node.timer_minutes,
    node.is_passive,
    node.requires_daily_execution,
    v_archived_at
  FROM public.rsip_nodes AS node
  WHERE node.user_id = v_user_id
    AND node.id = ANY(v_live_node_ids)
  ON CONFLICT (user_id, id) DO UPDATE SET
    title = EXCLUDED.title,
    rule = EXCLUDED.rule,
    type = COALESCE(EXCLUDED.type, existing.type),
    emoji = COALESCE(EXCLUDED.emoji, existing.emoji),
    cumulative_execution_days = GREATEST(
      existing.cumulative_execution_days,
      EXCLUDED.cumulative_execution_days
    ),
    internalization_progress = GREATEST(
      existing.internalization_progress,
      EXCLUDED.internalization_progress
    ),
    last_active_at = GREATEST(
      existing.last_active_at,
      EXCLUDED.last_active_at
    ),
    times_used = existing.times_used,
    use_timer = EXCLUDED.use_timer,
    timer_minutes = COALESCE(
      EXCLUDED.timer_minutes,
      existing.timer_minutes
    ),
    is_passive = EXCLUDED.is_passive,
    requires_daily_execution = EXCLUDED.requires_daily_execution,
    updated_at = now();

  DELETE FROM public.rsip_nodes
  WHERE user_id = v_user_id
    AND id = ANY(v_live_node_ids);

  SELECT array_agg(node_id ORDER BY node_id)
  INTO v_intent_node_ids
  FROM (
    SELECT DISTINCT unnest(v_requested_node_ids || v_live_node_ids) AS node_id
  ) AS affected;

  INSERT INTO public.rsip_atomic_intents (
    user_id,
    intent_kind,
    intent_key,
    request_node_ids,
    affected_node_ids
  )
  VALUES (
    v_user_id,
    'archive_nodes',
    p_intent_key,
    v_requested_node_ids,
    v_intent_node_ids
  );

  SELECT COALESCE(
    jsonb_agg(to_jsonb(entry) ORDER BY entry.updated_at DESC, entry.id),
    '[]'::jsonb
  )
  INTO v_library_result
  FROM public.rsip_policy_library AS entry
  WHERE entry.user_id = v_user_id
    AND entry.id = ANY(v_intent_node_ids);

  RETURN jsonb_build_object(
    'removed_node_ids', to_jsonb(v_intent_node_ids),
    'library_entries', v_library_result
  );
END;
$$;

REVOKE ALL ON FUNCTION public.archive_rsip_nodes_and_remove(text, uuid[])
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_rsip_nodes_and_remove(text, uuid[])
  TO authenticated;
