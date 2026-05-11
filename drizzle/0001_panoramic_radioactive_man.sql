ALTER TABLE "farmers" ADD COLUMN "auth_user_id" uuid;--> statement-breakpoint
ALTER TABLE "farmers" ADD CONSTRAINT "farmers_auth_user_id_unique" UNIQUE("auth_user_id");--> statement-breakpoint
ALTER TABLE "farmers" ADD CONSTRAINT "farmers_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES auth.users(id) ON DELETE SET NULL;