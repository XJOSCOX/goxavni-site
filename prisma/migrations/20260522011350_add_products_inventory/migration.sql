-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('app', 'subscription', 'resale', 'inventory', 'service');

-- CreateEnum
CREATE TYPE "ProductPlatform" AS ENUM ('android', 'ios', 'web', 'physical', 'mixed', 'service');

-- CreateEnum
CREATE TYPE "CustomerSubscriptionStatus" AS ENUM ('active', 'paused', 'canceled', 'expired');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('purchase', 'sale', 'adjustment', 'return');

-- CreateTable
CREATE TABLE "products" (
    "id" BIGSERIAL NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "type" "ProductType" NOT NULL,
    "platform" "ProductPlatform",
    "description" TEXT,
    "price_cents" INTEGER NOT NULL,
    "cost_cents" INTEGER NOT NULL DEFAULT 0,
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "reorder_level" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_subscriptions" (
    "id" BIGSERIAL NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "product_id" BIGINT NOT NULL,
    "status" "CustomerSubscriptionStatus" NOT NULL DEFAULT 'active',
    "started_on" DATE NOT NULL,
    "next_billing_on" DATE,
    "billing_every" INTEGER NOT NULL DEFAULT 1,
    "billing_unit" "RecurrenceUnit" NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "notes" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" BIGSERIAL NOT NULL,
    "product_id" BIGINT NOT NULL,
    "movement_on" DATE NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cost_cents" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_type_active_idx" ON "products"("type", "active");

-- CreateIndex
CREATE INDEX "customer_subscriptions_customer_id_status_idx" ON "customer_subscriptions"("customer_id", "status");

-- CreateIndex
CREATE INDEX "customer_subscriptions_product_id_status_idx" ON "customer_subscriptions"("product_id", "status");

-- CreateIndex
CREATE INDEX "inventory_movements_product_id_movement_on_idx" ON "inventory_movements"("product_id", "movement_on");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_subscriptions" ADD CONSTRAINT "customer_subscriptions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_subscriptions" ADD CONSTRAINT "customer_subscriptions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_subscriptions" ADD CONSTRAINT "customer_subscriptions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
