import type { CurrentUser } from '../users/types.js'
import type { ProgressOverview, ExerciseProgressSummary } from './types.js'
import type { ProgressProfileRecord, ProgressSessionRecord } from './repository.js'

type ProgressRepository = {
  findCompletedSessionsByUserId(userId: string): Promise<ProgressSessionRecord[]>
  findProfileSnapshotByUserId(userId: string): Promise<ProgressProfileRecord>
}

type ExerciseAccumulator = {
  exerciseId: string
  exerciseName: string
  exerciseSlug: string
  completedSetCount: number
  completedSessionIds: Set<string>
  bestActualLoadKg: number | null
  latestActualLoadKg: number | null
  latestCompletedAt: Date | null
}

const DEFAULT_PROGRESS_TIME_ZONE = 'America/Sao_Paulo'

type ZonedDateParts = {
  year: number
  month: number
  day: number
  dayOfWeek: number
}

function getProgressTimeZone() {
  return process.env.APP_TIME_ZONE?.trim() || DEFAULT_PROGRESS_TIME_ZONE
}

function getZonedDateParts(referenceDate: Date, timeZone: string): ZonedDateParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(referenceDate)

  const weekday = parts.find((part) => part.type === 'weekday')?.value ?? 'Mon'
  const year = Number(parts.find((part) => part.type === 'year')?.value ?? '1970')
  const month = Number(parts.find((part) => part.type === 'month')?.value ?? '01')
  const day = Number(parts.find((part) => part.type === 'day')?.value ?? '01')

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }

  return {
    year,
    month,
    day,
    dayOfWeek: weekdayMap[weekday] ?? 1,
  }
}

function shiftZonedDate(parts: Omit<ZonedDateParts, 'dayOfWeek'>, daysToAdd: number) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  date.setUTCDate(date.getUTCDate() + daysToAdd)

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  }
}

function getTimeZoneOffsetMs(referenceDate: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(referenceDate)

  const year = Number(parts.find((part) => part.type === 'year')?.value ?? '1970')
  const month = Number(parts.find((part) => part.type === 'month')?.value ?? '01')
  const day = Number(parts.find((part) => part.type === 'day')?.value ?? '01')
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '00')
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '00')
  const second = Number(parts.find((part) => part.type === 'second')?.value ?? '00')

  const utcTimestamp = Date.UTC(year, month - 1, day, hour, minute, second)
  return utcTimestamp - referenceDate.getTime()
}

function getZonedStartOfDayUtc(
  parts: {
    year: number
    month: number
    day: number
  },
  timeZone: string,
) {
  const utcGuess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0))
  const offset = getTimeZoneOffsetMs(utcGuess, timeZone)
  return new Date(utcGuess.getTime() - offset)
}

function getWeekRange(referenceDate = new Date(), timeZone = getProgressTimeZone()) {
  const zonedParts = getZonedDateParts(referenceDate, timeZone)
  const offsetToMonday = (zonedParts.dayOfWeek + 6) % 7
  const monday = shiftZonedDate(zonedParts, -offsetToMonday)
  const nextMonday = shiftZonedDate(monday, 7)

  const start = getZonedStartOfDayUtc(monday, timeZone)
  const end = getZonedStartOfDayUtc(nextMonday, timeZone)

  return { start, end }
}

function toExerciseProgressSummaries(sessions: ProgressSessionRecord[]): ExerciseProgressSummary[] {
  const byExercise = new Map<string, ExerciseAccumulator>()

  for (const session of sessions) {
    for (const item of session.items) {
      const completedSetLogs = item.setLogs.filter(
        (setLog) => setLog.status === 'completed' && setLog.completedAt !== null,
      )

      if (completedSetLogs.length === 0) {
        continue
      }

      const accumulator =
        byExercise.get(item.exerciseId) ??
        {
          exerciseId: item.exerciseId,
          exerciseName: item.exerciseName,
          exerciseSlug: item.exerciseSlug,
          completedSetCount: 0,
          completedSessionIds: new Set<string>(),
          bestActualLoadKg: null,
          latestActualLoadKg: null,
          latestCompletedAt: null,
        }

      accumulator.completedSessionIds.add(session.id)
      accumulator.completedSetCount += completedSetLogs.length

      for (const setLog of completedSetLogs) {
        if (setLog.actualLoadKg !== null) {
          accumulator.bestActualLoadKg =
            accumulator.bestActualLoadKg === null
              ? setLog.actualLoadKg
              : Math.max(accumulator.bestActualLoadKg, setLog.actualLoadKg)
        }

        if (
          setLog.completedAt &&
          (accumulator.latestCompletedAt === null || setLog.completedAt > accumulator.latestCompletedAt)
        ) {
          accumulator.latestCompletedAt = setLog.completedAt
          accumulator.latestActualLoadKg = setLog.actualLoadKg
        }
      }

      byExercise.set(item.exerciseId, accumulator)
    }
  }

  return Array.from(byExercise.values())
    .map((accumulator) => ({
      exerciseId: accumulator.exerciseId,
      exerciseName: accumulator.exerciseName,
      exerciseSlug: accumulator.exerciseSlug,
      completedSetCount: accumulator.completedSetCount,
      completedSessionCount: accumulator.completedSessionIds.size,
      bestActualLoadKg: accumulator.bestActualLoadKg,
      latestActualLoadKg: accumulator.latestActualLoadKg,
      latestCompletedAt: accumulator.latestCompletedAt?.toISOString() ?? null,
    }))
    .sort((left, right) => {
      const leftTime = left.latestCompletedAt ? new Date(left.latestCompletedAt).getTime() : 0
      const rightTime = right.latestCompletedAt ? new Date(right.latestCompletedAt).getTime() : 0

      if (rightTime !== leftTime) {
        return rightTime - leftTime
      }

      return left.exerciseName.localeCompare(right.exerciseName)
    })
}

function toProfileSnapshot(profile: ProgressProfileRecord) {
  return {
    displayName: profile.displayName,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
  }
}

export function createProgressService(repository: ProgressRepository) {
  return {
    async getProgressOverview(currentUser: CurrentUser): Promise<ProgressOverview> {
      const [sessions, profile] = await Promise.all([
        repository.findCompletedSessionsByUserId(currentUser.id),
        repository.findProfileSnapshotByUserId(currentUser.id),
      ])

      const { start, end } = getWeekRange()
      const completedSessionsThisWeek = sessions.filter((session) => {
        if (!session.completedAt) {
          return false
        }

        return session.completedAt >= start && session.completedAt < end
      }).length

      const totalCompletedSets = sessions.reduce(
        (sum, session) =>
          sum +
          session.items.reduce(
            (itemSum, item) => itemSum + item.setLogs.filter((setLog) => setLog.status === 'completed').length,
            0,
          ),
        0,
      )

      return {
        summary: {
          totalCompletedSessions: sessions.length,
          completedSessionsThisWeek,
          totalCompletedSets,
          latestCompletedAt: sessions[0]?.completedAt?.toISOString() ?? null,
        },
        profileSnapshot: toProfileSnapshot(profile),
        exerciseProgressSummaries: toExerciseProgressSummaries(sessions),
      }
    },
  }
}
