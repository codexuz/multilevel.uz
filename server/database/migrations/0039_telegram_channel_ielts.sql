DROP INDEX IF EXISTS "reward_transactions_once_uq";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "reward_transactions_once_uq" ON "reward_transactions" USING btree ("user_id","reason") WHERE reason in ('WELCOME', 'TELEGRAM_CHANNEL', 'TELEGRAM_CHANNEL_IELTS');
