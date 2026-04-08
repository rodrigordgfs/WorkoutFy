export type ListExercisesFilters = {
  search: string | null
  muscleGroupId: string | null
}

export type CreateAdminExerciseInput = {
  name: string
  slug: string | null
  muscleGroupIds: string[]
}

export type UpdateAdminExerciseInput = {
  name?: string
  slug?: string
  muscleGroupIds?: string[]
}
