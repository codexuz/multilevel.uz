CREATE TABLE "pack_parts" (
	"pack_id" uuid NOT NULL,
	"section_item_id" uuid NOT NULL,
	"position" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "pack_parts_pack_id_section_item_id_pk" PRIMARY KEY("pack_id","section_item_id")
);
--> statement-breakpoint
CREATE TABLE "part_unlocks" (
	"user_id" uuid NOT NULL,
	"section_item_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "part_unlocks_user_id_section_item_id_pk" PRIMARY KEY("user_id","section_item_id")
);
--> statement-breakpoint
ALTER TABLE "pack_parts" ADD CONSTRAINT "pack_parts_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_parts" ADD CONSTRAINT "pack_parts_section_item_id_section_items_id_fk" FOREIGN KEY ("section_item_id") REFERENCES "public"."section_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_unlocks" ADD CONSTRAINT "part_unlocks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_unlocks" ADD CONSTRAINT "part_unlocks_section_item_id_section_items_id_fk" FOREIGN KEY ("section_item_id") REFERENCES "public"."section_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pack_parts_item_idx" ON "pack_parts" USING btree ("section_item_id");