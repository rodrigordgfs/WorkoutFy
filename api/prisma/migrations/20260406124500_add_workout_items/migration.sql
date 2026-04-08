CREATE TABLE "workout_items" (
    "id" TEXT NOT NULL,
    "workout_id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps" INTEGER NOT NULL,
    "load_kg" DOUBLE PRECISION NOT NULL,
    "rest_seconds" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workout_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workout_items_workout_id_position_key" ON "workout_items"("workout_id", "position");
CREATE INDEX "workout_items_exercise_id_idx" ON "workout_items"("exercise_id");
CREATE INDEX "workout_items_workout_id_position_idx" ON "workout_items"("workout_id", "position");

ALTER TABLE "workout_items" ADD CONSTRAINT "workout_items_workout_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "workouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
