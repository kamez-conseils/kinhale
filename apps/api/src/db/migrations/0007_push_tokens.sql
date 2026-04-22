CREATE TABLE IF NOT EXISTS "push_tokens" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
  "device_id" uuid NOT NULL REFERENCES "devices"("id") ON DELETE CASCADE,
  "household_id" uuid NOT NULL,
  "token" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "push_tokens_device_token_idx"
  ON "push_tokens" ("device_id", "token");

CREATE INDEX IF NOT EXISTS "push_tokens_household_idx"
  ON "push_tokens" ("household_id");
