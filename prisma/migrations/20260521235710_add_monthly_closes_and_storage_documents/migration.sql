-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "storage_bucket" TEXT,
ADD COLUMN     "storage_path" TEXT,
ALTER COLUMN "url" DROP NOT NULL;

-- CreateTable
CREATE TABLE "monthly_closes" (
    "id" BIGSERIAL NOT NULL,
    "period" TEXT NOT NULL,
    "closed_on" DATE NOT NULL,
    "summary" JSONB NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_closes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "monthly_closes_period_key" ON "monthly_closes"("period");

-- AddForeignKey
ALTER TABLE "monthly_closes" ADD CONSTRAINT "monthly_closes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
