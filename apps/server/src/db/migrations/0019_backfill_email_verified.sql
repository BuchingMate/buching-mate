-- Backfill email_verified=true for users who signed up before the
-- requireEmailVerification gate was turned on (commit 1e0aba0). Without this,
-- pre-existing password users would be locked out of sign-in and unable to
-- send invites until they manually re-verified. Better-auth auto-mails a new
-- verification on blocked sign-in, but the surprise is avoidable.
UPDATE "auth"."user" SET "email_verified" = true WHERE "email_verified" = false;