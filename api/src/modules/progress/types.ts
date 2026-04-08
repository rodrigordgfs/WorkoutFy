export type ProgressProfileSnapshot = {
  displayName: string | null
  heightCm: number | null
  weightKg: number | null
}

export type ProgressSummary = {
  totalCompletedSessions: number
  completedSessionsThisWeek: number
  totalCompletedSets: number
  latestCompletedAt: string | null
}

export type ExerciseProgressSummary = {
  exerciseId: string
  exerciseName: string
  exerciseSlug: string
  completedSetCount: number
  completedSessionCount: number
  bestActualLoadKg: number | null
  latestActualLoadKg: number | null
  latestCompletedAt: string | null
}

export type ProgressOverview = {
  summary: ProgressSummary
  profileSnapshot: ProgressProfileSnapshot
  exerciseProgressSummaries: ExerciseProgressSummary[]
}
