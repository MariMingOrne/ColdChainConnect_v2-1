CREATE TABLE "order_pallets" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"truck_id" text,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_pallet_items" (
	"id" text PRIMARY KEY NOT NULL,
	"pallet_id" text NOT NULL,
	"product_id" text NOT NULL,
	"qty_units" integer NOT NULL,
	"unit_cost" varchar(20) DEFAULT '0.00',
	"batch_item_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_pallets" ADD CONSTRAINT "order_pallets_order_id_bookings_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_pallets" ADD CONSTRAINT "order_pallets_truck_id_trucks_id_fk" FOREIGN KEY ("truck_id") REFERENCES "public"."trucks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_pallet_items" ADD CONSTRAINT "order_pallet_items_pallet_id_order_pallets_id_fk" FOREIGN KEY ("pallet_id") REFERENCES "public"."order_pallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_pallet_items" ADD CONSTRAINT "order_pallet_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
