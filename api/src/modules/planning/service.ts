import { AppError } from '../../common/errors/app-error.js'

import type { CurrentUser } from '../users/types.js'
import type { PlanningWorkoutSummaryRecord, WeeklyPlanningAssignmentRecord } from './repository.js'
import {
  dayOfWeekOrder,
  type DayOfWeek,
  type TodayPlanning,
  type WeeklyPlanningDay,
  type WeeklyPlanningWeek,
  type UpdateWeeklyPlanningInput,
} from './types.js'

type PlanningRepository = {
  listByUserId(userId: string): Promise<WeeklyPlanningAssignmentRecord[]>
  listWorkoutOptionsByUserId(userId: string): Promise<PlanningWorkoutSummaryRecord[]>
  replaceByUserId(
    userId: string,
    input: UpdateWeeklyPlanningInput,
  ): Promise<WeeklyPlanningAssignmentRecord[] | 'invalid_workout'>
}

type Clock = {
  now(): Date
}

function toWorkoutSummary(record: PlanningWorkoutSummaryRecord) {
  return {
    id: record.id,
    name: record.name,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

function toWeeklyPlanningWeek(assignments: WeeklyPlanningAssignmentRecord[]): WeeklyPlanningWeek {
  const assignmentsByDay = new Map(assignments.map((assignment) => [assignment.dayOfWeek, assignment]))

  return {
    days: dayOfWeekOrder.map<WeeklyPlanningDay>((dayOfWeek) => {
      const assignment = assignmentsByDay.get(dayOfWeek)

      return {
        dayOfWeek,
        workout: assignment ? toWorkoutSummary(assignment.workout) : null,
      }
    }),
  }
}

function getDayOfWeekForServerDate(date: Date): DayOfWeek {
  const serverDayOfWeekOrder: DayOfWeek[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ]

  return serverDayOfWeekOrder[date.getDay()]
}

function formatServerDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function workoutNotFoundError(): AppError {
  return new AppError('Workout not found.', 'WORKOUT_NOT_FOUND', 404)
}

export function createPlanningService(
  repository: PlanningRepository,
  clock: Clock = {
    now: () => new Date(),
  },
) {
  return {
    async getWeeklyPlanning(currentUser: CurrentUser) {
      return toWeeklyPlanningWeek(await repository.listByUserId(currentUser.id))
    },
    async getTodayPlanning(currentUser: CurrentUser): Promise<TodayPlanning> {
      const now = clock.now()
      const dayOfWeek = getDayOfWeekForServerDate(now)

      const [assignments, manualWorkoutOptions] = await Promise.all([
        repository.listByUserId(currentUser.id),
        repository.listWorkoutOptionsByUserId(currentUser.id),
      ])

      const plannedAssignment = assignments.find((assignment) => assignment.dayOfWeek === dayOfWeek)

      return {
        date: formatServerDate(now),
        dayOfWeek,
        plannedWorkout: plannedAssignment ? toWorkoutSummary(plannedAssignment.workout) : null,
        manualWorkoutOptions: manualWorkoutOptions.map(toWorkoutSummary),
      }
    },
    async updateWeeklyPlanning(currentUser: CurrentUser, input: UpdateWeeklyPlanningInput) {
      const result = await repository.replaceByUserId(currentUser.id, input)

      if (result === 'invalid_workout') {
        throw workoutNotFoundError()
      }

      return toWeeklyPlanningWeek(result)
    },
  }
}
