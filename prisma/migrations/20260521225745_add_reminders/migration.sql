-- CreateEnum
CREATE TYPE "ReminderPriority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('open', 'done');

-- CreateTable
CREATE TABLE "reminders" (
    "id" BIGSERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "due_on" DATE NOT NULL,
    "due_time" TEXT,
    "priority" "ReminderPriority" NOT NULL DEFAULT 'normal',
    "status" "ReminderStatus" NOT NULL DEFAULT 'open',
    "created_by" UUID NOT NULL,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
