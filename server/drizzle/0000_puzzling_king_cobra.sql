CREATE TYPE "public"."entitlement" AS ENUM('free', 'pro', 'lifetime');--> statement-breakpoint
CREATE TYPE "public"."find_status" AS ENUM('in_stock', 'sold');--> statement-breakpoint
CREATE TABLE "finds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"scan_id" uuid,
	"name" text NOT NULL,
	"local_photo_key" text,
	"status" "find_status" DEFAULT 'in_stock' NOT NULL,
	"bought_price_pence" integer NOT NULL,
	"bought_at" timestamp with time zone DEFAULT now() NOT NULL,
	"estimated_value_pence" integer,
	"sold_price_pence" integer,
	"fees_pence" integer DEFAULT 0 NOT NULL,
	"postage_pence" integer DEFAULT 0 NOT NULL,
	"sold_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"family_id" uuid NOT NULL,
	"replaced_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"image_hash" text NOT NULL,
	"item_name" text,
	"brand" text,
	"category" text,
	"search_query" text NOT NULL,
	"confidence" real DEFAULT 0 NOT NULL,
	"price_low_pence" integer,
	"price_median_pence" integer,
	"price_high_pence" integer,
	"listing_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage" (
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"scan_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "usage_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"apple_sub" text,
	"entitlement" "entitlement" DEFAULT 'free' NOT NULL,
	"entitlement_expires_at" timestamp with time zone,
	"revenuecat_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "finds" ADD CONSTRAINT "finds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finds" ADD CONSTRAINT "finds_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage" ADD CONSTRAINT "usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "finds_user_status_idx" ON "finds" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_tokens_hash_idx" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "scans_user_created_idx" ON "scans" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_apple_sub_idx" ON "users" USING btree ("apple_sub");