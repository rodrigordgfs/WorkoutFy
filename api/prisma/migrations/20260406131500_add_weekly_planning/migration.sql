CREATE TYPE "DayOfWeek" AS ENUM ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');

CREATE TABLE "weekly_planning_days" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "workout_id" TEXT NOT NULL,
    "day_of_week" "DayOfWeek" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_planning_days_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "weekly_planning_days_user_id_day_of_week_key" ON "weekly_planning_days"("user_id", "day_of_week");
CREATE INDEX "weekly_planning_days_user_id_day_of_week_idx" ON "weekly_planning_days"("user_id", "day_of_week");
CREATE INDEX "weekly_planning_days_workout_id_idx" ON "weekly_planning_days"("workout_id");

ALTER TABLE "weekly_planning_days" ADD CONSTRAINT "weekly_planning_days_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "weekly_planning_days" ADD CONSTRAINT "weekly_planning_days_workout_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "workouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
