export type WorkoutSessionStatus = 'in_progress' | 'completed'

export type WorkoutSetLogStatus = 'pending' | 'completed'

export type StartWorkoutSessionInput = {
  workoutId: string
}

export type UpdateWorkoutSetLogInput = {
  actualReps: number
  actualLoadKg: number
}

export type WorkoutExecutionSourceItem = {
  id: string
  position: number
  sets: number
  reps: number
  loadKg: number
  restSeconds: number
  exercise: {
    id: string
    name: string
    slug: string
  }
}

export type WorkoutExecutionSourceWorkout = {
  id: string
  name: string
  items: WorkoutExecutionSourceItem[]
}

export type WorkoutSetLogSnapshotCreateInput = {
  setNumber: number
  status: WorkoutSetLogStatus
  plannedReps: number
  plannedLoadKg: number
}

export type WorkoutSessionItemSnapshotCreateInput = {
  workoutItemId: string
  exerciseId: string
  exerciseName: string
  exerciseSlug: string
  plannedSets: number
  plannedReps: number
  plannedLoadKg: number
  plannedRestSeconds: number
  position: number
  setLogs: {
    create: WorkoutSetLogSnapshotCreateInput[]
  }
}

export type WorkoutSessionCreateInput = {
  userId: string
  workoutId: string
  workoutNameSnapshot?: string | null
  activeSessionUserId: string
  status: WorkoutSessionStatus
  startedAt?: Date
  items: {
    create: WorkoutSessionItemSnapshotCreateInput[]
  }
}

export type WorkoutSessionSetLog = {
  id: string
  setNumber: number
  status: WorkoutSetLogStatus
  plannedReps: number
  plannedLoadKg: number
  actualReps: number | null
  actualLoadKg: number | null
  completedAt: string | null
}

export type WorkoutSessionItem = {
  id: string
  workoutItemId: string
  exerciseId: string
  exerciseName: string
  exerciseSlug: string
  plannedSets: number
  plannedReps: number
  plannedLoadKg: number
  plannedRestSeconds: number
  position: number
  setLogs: WorkoutSessionSetLog[]
}

export type WorkoutSessionHistoryEntry = {
  id: string
  workoutId: string
  workoutName: string | null
  startedAt: string
  completedAt: string
  completedSetCount: number
  exerciseCount: number
}

export type WorkoutSessionHistoryDetail = {
  id: string
  workoutId: string
  workoutName: string | null
  startedAt: string
  completedAt: string
  items: WorkoutSessionItem[]
}

export type WorkoutSessionDetail = {
  id: string
  workoutId: string
  status: WorkoutSessionStatus
  startedAt: string
  completedAt: string | null
  workout: {
    id: string
    name: string | null
  }
  items: WorkoutSessionItem[]
}
