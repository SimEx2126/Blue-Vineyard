-- Production migration for the SNSW Events (Blue-Vineyard) app.
--
-- Brings the production database up to what the current `main` branch expects.
-- Run this ONCE against production BEFORE deploying the new code, so the app
-- never queries a column that doesn't exist yet.
--
-- Every statement is idempotent (IF NOT EXISTS), so a re-run is a safe no-op.
-- Equivalent to running `drizzle-kit push` against production.

BEGIN;

-- Standalone forms: a "form" is a light event with no dates/payment.
ALTER TABLE events ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'event';

-- Highlight / prioritise: featured events sort first and show a badge.
ALTER TABLE events ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;

-- Event-day check-in: arrival timestamp per registrant.
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS checked_in_at timestamptz;

-- Post-event reviews: when the review-invite email was sent (avoids re-sending).
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS review_invite_sent_at timestamptz;

-- Post-event reviews: one star rating + optional comment per registration.
CREATE TABLE IF NOT EXISTS reviews (
    id              serial PRIMARY KEY,
    org_id          integer NOT NULL REFERENCES orgs(id),
    event_id        integer NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    registration_id integer NOT NULL UNIQUE REFERENCES registrations(id) ON DELETE CASCADE,
    rating          integer NOT NULL,
    comment         text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

COMMIT;
