-- ============================================================
-- 021: Musician History & Invoice Support
-- Ref: DESIGN-SPEC-v2.md 11.11 — invoice generation, pay rates
-- ============================================================

-- Add pay rate to profiles (admin-set per musician)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pay_rate_per_mass DECIMAL(10,2);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS payment_notes TEXT;

COMMENT ON COLUMN profiles.pay_rate_per_mass IS 'Agreed-upon rate per Mass for contractor musicians. NULL = volunteer.';
COMMENT ON COLUMN profiles.payment_notes IS 'Admin notes about payment arrangement (e.g., "Paid monthly", "Special rate for weddings")';

-- Materialized view for fast history queries (booking_slots + mass_events + roles)
-- Not a real materialized view (those need REFRESH), just a handy view
CREATE OR REPLACE VIEW musician_history AS
SELECT
  bs.id AS slot_id,
  bs.profile_id,
  bs.person_name,
  bs.confirmation,
  bs.is_recurring,
  bs.role_label_override,
  bs.instrument_detail,
  bs.notes AS slot_notes,
  me.id AS mass_event_id,
  me.event_date,
  me.start_time_12h,
  me.event_type,
  me.community AS ensemble,
  me.celebrant,
  me.liturgical_name,
  me.season,
  me.has_music,
  mr.id AS role_id,
  mr.name AS role_name,
  p.full_name,
  p.pay_rate_per_mass
FROM booking_slots bs
JOIN mass_events me ON me.id = bs.mass_event_id
JOIN ministry_roles mr ON mr.id = bs.ministry_role_id
LEFT JOIN profiles p ON p.id = bs.profile_id
WHERE bs.confirmation NOT IN ('declined')
ORDER BY me.event_date DESC, me.start_time_12h;
