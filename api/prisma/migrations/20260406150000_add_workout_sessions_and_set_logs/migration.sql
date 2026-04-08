CREATE TYPE "WorkoutSessionStatus" AS ENUM ('in_progress', 'completed');
CREATE TYPE "WorkoutSetLogStatus" AS ENUM ('pending', 'completed');

CREATE TABLE "workout_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "workout_id" TEXT NOT NULL,
    "active_session_user_id" TEXT,
    "status" "WorkoutSessionStatus" NOT NULL DEFAULT 'in_progress',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workout_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workout_session_items" (
    "id" TEXT NOT NULL,
    "workout_session_id" TEXT NOT NULL,
    "workout_item_id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "exercise_name" TEXT NOT NULL,
    "exercise_slug" TEXT NOT NULL,
    "planned_sets" INTEGER NOT NULL,
    "planned_reps" INTEGER NOT NULL,
    "planned_load_kg" DOUBLE PRECISION NOT NULL,
    "planned_rest_seconds" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workout_session_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workout_set_logs" (
    "id" TEXT NOT NULL,
    "workout_session_item_id" TEXT NOT NULL,
    "set_number" INTEGER NOT NULL,
    "status" "WorkoutSetLogStatus" NOT NULL DEFAULT 'pending',
    "planned_reps" INTEGER NOT NULL,
    "planned_load_kg" DOUBLE PRECISION NOT NULL,
    "actual_reps" INTEGER,
    "actual_load_kg" DOUBLE PRECISION,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workout_set_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workout_sessions_active_session_user_id_key" ON "workout_sessions"("active_session_user_id");
CREATE INDEX "workout_sessions_user_id_status_started_at_idx" ON "workout_sessions"("user_id", "status", "started_at");
CREATE INDEX "workout_sessions_workout_id_started_at_idx" ON "workout_sessions"("workout_id", "started_at");

CREATE UNIQUE INDEX "workout_session_items_workout_session_id_position_key" ON "workout_session_items"("workout_session_id", "position");
CREATE INDEX "workout_session_items_workout_item_id_idx" ON "workout_session_items"("workout_item_id");
CREATE INDEX "workout_session_items_exercise_id_idx" ON "workout_session_items"("exercise_id");
CREATE INDEX "workout_session_items_workout_session_id_position_idx" ON "workout_session_items"("workout_session_id", "position");

CREATE UNIQUE INDEX "workout_set_logs_workout_session_item_id_set_number_key" ON "workout_set_logs"("workout_session_item_id", "set_number");
CREATE INDEX "workout_set_logs_status_idx" ON "workout_set_logs"("status");
CREATE INDEX "workout_set_logs_workout_session_item_id_set_number_idx" ON "workout_set_logs"("workout_session_item_id", "set_number");

ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workout_session_items" ADD CONSTRAINT "workout_session_items_workout_session_id_fkey" FOREIGN KEY ("workout_session_id") REFERENCES "workout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workout_set_logs" ADD CONSTRAINT "workout_set_logs_workout_session_item_id_fkey" FOREIGN KEY ("workout_session_item_id") REFERENCES "workout_session_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
