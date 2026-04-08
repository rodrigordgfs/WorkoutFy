export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

export const dayOfWeekOrder: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

export type WeeklyPlanningWorkout = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export type WeeklyPlanningDay = {
  dayOfWeek: DayOfWeek
  workout: WeeklyPlanningWorkout | null
}

export type WeeklyPlanningWeek = {
  days: WeeklyPlanningDay[]
}

export type TodayPlanning = {
  date: string
  dayOfWeek: DayOfWeek
  plannedWorkout: WeeklyPlanningWorkout | null
  manualWorkoutOptions: WeeklyPlanningWorkout[]
}

export type UpdateWeeklyPlanningDayInput = {
  dayOfWeek: DayOfWeek
  workoutId: string | null
}

export type UpdateWeeklyPlanningInput = {
  days: UpdateWeeklyPlanningDayInput[]
}
