-- Invite tokens table (magic-link invites sent by admin)
CREATE TABLE IF NOT EXISTS invite_token (
  token       VARCHAR(64) PRIMARY KEY,
  email       VARCHAR(255) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used        BOOLEAN NOT NULL DEFAULT FALSE
);

-- OTP table for forgot-password flow
CREATE TABLE IF NOT EXISTS otp_token (
  id          SERIAL PRIMARY KEY,
  email       VARCHAR(255) NOT NULL,
  otp         VARCHAR(6) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used        BOOLEAN NOT NULL DEFAULT FALSE
);
