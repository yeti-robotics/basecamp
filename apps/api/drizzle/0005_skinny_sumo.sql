CREATE TABLE "bot_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"token_ciphertext" text,
	CONSTRAINT "bot_settings_singleton_check" CHECK ("bot_settings"."id" = 1)
);
