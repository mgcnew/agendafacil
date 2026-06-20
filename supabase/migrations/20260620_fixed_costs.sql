CREATE TABLE fixed_costs (
  id         uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id   uuid          NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name       text          NOT NULL,
  amount     numeric(10,2) NOT NULL DEFAULT 0,
  due_day    smallint      CHECK (due_day BETWEEN 1 AND 28),
  type       text          NOT NULL CHECK (type IN ('expense', 'revenue')),
  is_active  boolean       NOT NULL DEFAULT true,
  created_at timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE fixed_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salon member can manage fixed_costs"
  ON fixed_costs
  USING (
    salon_id IN (
      SELECT salon_id FROM salon_members
      WHERE profile_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    salon_id IN (
      SELECT salon_id FROM salon_members
      WHERE profile_id = auth.uid() AND is_active = true
    )
  );
