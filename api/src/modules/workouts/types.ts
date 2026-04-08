export type WorkoutExerciseMuscleGroup = {
  id: string
  name: string
  slug: string
}

export type WorkoutExercise = {
  id: string
  name: string
  slug: string
  muscleGroups: WorkoutExerciseMuscleGroup[]
}

export type WorkoutItem = {
  id: string
  exerciseId: string
  sets: number
  reps: number
  loadKg: number
  restSeconds: number
  position: number
  createdAt: string
  updatedAt: string
  exercise: WorkoutExercise
}

export type WorkoutSummary = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export type WorkoutDetail = WorkoutSummary & {
  items: WorkoutItem[]
}

export type CreateWorkoutInput = {
  name: string
}

export type UpdateWorkoutInput = {
  name?: string
}

export type CreateWorkoutItemInput = {
  exerciseId: string
  sets: number
  reps: number
  loadKg: number
  restSeconds: number
}

export type UpdateWorkoutItemInput = {
  sets?: number
  reps?: number
  loadKg?: number
  restSeconds?: number
}

export type ReorderWorkoutItemsInput = {
  itemIdsInOrder: string[]
}
