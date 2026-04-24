CREATE TABLE "user_quiet_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"enabled" boolean NOT NULL,
	"start_local_time" text NOT NULL,
	"end_local_time" text NOT NULL,
	"timezone" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_quiet_hours" ADD CONSTRAINT "user_quiet_hours_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_quiet_hours_account_idx" ON "user_quiet_hours" USING btree ("account_id");