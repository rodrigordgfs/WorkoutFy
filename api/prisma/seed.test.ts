import test from 'node:test'
import assert from 'node:assert/strict'

import { seedExerciseCatalog } from './seed.js'

test('seedExerciseCatalog is idempotent for muscle groups, exercises and their associations', async () => {
  type SeedState = {
    muscleGroups: Map<string, { id: string; slug: string; name: string; isSeeded: boolean }>
    exercises: Map<string, { id: string; slug: string; name: string; isSeeded: boolean }>
    exerciseMuscleGroups: Set<string>
  }

  const state: SeedState = {
    muscleGroups: new Map(),
    exercises: new Map(),
    exerciseMuscleGroups: new Set(),
  }

  let idCounter = 0

  const nextId = (prefix: string) => `${prefix}_${++idCounter}`

  const prisma = {
    muscleGroup: {
      async upsert({
        where,
        update,
        create,
      }: {
        where: { slug: string }
        update: { name: string; isSeeded: boolean }
        create: { slug: string; name: string; isSeeded: boolean }
        select: { id: true; slug: true }
      }) {
        const existing = state.muscleGroups.get(where.slug)

        if (existing) {
          const updated = { ...existing, name: update.name, isSeeded: update.isSeeded }
          state.muscleGroups.set(where.slug, updated)
          return { id: updated.id, slug: updated.slug }
        }

        const createdRecord = {
          id: nextId('mg'),
          slug: create.slug,
          name: create.name,
          isSeeded: create.isSeeded,
        }
        state.muscleGroups.set(create.slug, createdRecord)
        return { id: createdRecord.id, slug: createdRecord.slug }
      },
      async deleteMany({
        where,
      }: {
        where: {
          isSeeded: boolean
          slug: {
            notIn: string[]
          }
        }
      }) {
        for (const [slug, muscleGroup] of state.muscleGroups.entries()) {
          if (muscleGroup.isSeeded === where.isSeeded && where.slug.notIn.includes(slug)) {
            continue
          }

          if (muscleGroup.isSeeded === where.isSeeded) {
            state.muscleGroups.delete(slug)

            for (const key of Array.from(state.exerciseMuscleGroups)) {
              if (key.endsWith(`:${muscleGroup.id}`)) {
                state.exerciseMuscleGroups.delete(key)
              }
            }
          }
        }

        return {}
      },
    },
    exercise: {
      async upsert({
        where,
        update,
        create,
      }: {
        where: { slug: string }
        update: { name: string; isSeeded: boolean }
        create: { slug: string; name: string; isSeeded: boolean }
        select: { id: true }
      }) {
        const existing = state.exercises.get(where.slug)

        if (existing) {
          const updated = { ...existing, name: update.name, isSeeded: update.isSeeded }
          state.exercises.set(where.slug, updated)
          return { id: updated.id }
        }

        const createdRecord = {
          id: nextId('ex'),
          slug: create.slug,
          name: create.name,
          isSeeded: create.isSeeded,
        }
        state.exercises.set(create.slug, createdRecord)
        return { id: createdRecord.id }
      },
      async deleteMany({
        where,
      }: {
        where: {
          isSeeded: boolean
          slug: {
            notIn: string[]
          }
        }
      }) {
        for (const [slug, exercise] of state.exercises.entries()) {
          if (exercise.isSeeded === where.isSeeded && where.slug.notIn.includes(slug)) {
            continue
          }

          if (exercise.isSeeded === where.isSeeded) {
            state.exercises.delete(slug)

            for (const key of Array.from(state.exerciseMuscleGroups)) {
              if (key.startsWith(`${exercise.id}:`)) {
                state.exerciseMuscleGroups.delete(key)
              }
            }
          }
        }

        return {}
      },
    },
    exerciseMuscleGroup: {
      async findMany({
        where,
      }: {
        where: {
          exerciseId: {
            in: string[]
          }
        }
        select: {
          exerciseId: true
          muscleGroupId: true
        }
      }) {
        const selectedExerciseIds = new Set(where.exerciseId.in)

        return Array.from(state.exerciseMuscleGroups)
          .map((key) => {
            const [exerciseId, muscleGroupId] = key.split(':')
            return { exerciseId, muscleGroupId }
          })
          .filter(({ exerciseId }) => selectedExerciseIds.has(exerciseId))
      },
      async upsert({
        where,
      }: {
        where: {
          exerciseId_muscleGroupId: {
            exerciseId: string
            muscleGroupId: string
          }
        }
        update: Record<string, never>
        create: {
          exerciseId: string
          muscleGroupId: string
        }
      }) {
        const key = `${where.exerciseId_muscleGroupId.exerciseId}:${where.exerciseId_muscleGroupId.muscleGroupId}`
        state.exerciseMuscleGroups.add(key)
        return {}
      },
      async delete({
        where,
      }: {
        where: {
          exerciseId_muscleGroupId: {
            exerciseId: string
            muscleGroupId: string
          }
        }
      }) {
        const key = `${where.exerciseId_muscleGroupId.exerciseId}:${where.exerciseId_muscleGroupId.muscleGroupId}`
        state.exerciseMuscleGroups.delete(key)
        return {}
      },
    },
  }

  await seedExerciseCatalog(prisma as never)

  const firstCounts = {
    muscleGroups: state.muscleGroups.size,
    exercises: state.exercises.size,
    exerciseMuscleGroups: state.exerciseMuscleGroups.size,
  }

  await seedExerciseCatalog(prisma as never)

  assert.deepEqual(
    {
      muscleGroups: state.muscleGroups.size,
      exercises: state.exercises.size,
      exerciseMuscleGroups: state.exerciseMuscleGroups.size,
    },
    firstCounts,
  )
  assert.ok(firstCounts.muscleGroups >= 5)
  assert.ok(firstCounts.exercises >= 10)
  assert.ok(firstCounts.exerciseMuscleGroups > firstCounts.exercises)

  const pullUp = state.exercises.get('pull-up')
  const chest = state.muscleGroups.get('chest')

  assert.ok(pullUp)
  assert.ok(chest)

  state.exerciseMuscleGroups.add(`${pullUp.id}:${chest.id}`)

  await seedExerciseCatalog(prisma as never)

  assert.equal(state.exerciseMuscleGroups.has(`${pullUp.id}:${chest.id}`), false)

  state.exercises.set('legacy-seeded-exercise', {
    id: 'ex_legacy_seeded',
    slug: 'legacy-seeded-exercise',
    name: 'Legacy Seeded Exercise',
    isSeeded: true,
  })
  state.exercises.set('manual-admin-exercise', {
    id: 'ex_manual_admin',
    slug: 'manual-admin-exercise',
    name: 'Manual Admin Exercise',
    isSeeded: false,
  })
  state.muscleGroups.set('legacy-seeded-group', {
    id: 'mg_legacy_seeded',
    slug: 'legacy-seeded-group',
    name: 'Legacy Seeded Group',
    isSeeded: true,
  })
  state.muscleGroups.set('manual-admin-group', {
    id: 'mg_manual_admin',
    slug: 'manual-admin-group',
    name: 'Manual Admin Group',
    isSeeded: false,
  })
  state.exerciseMuscleGroups.add('ex_legacy_seeded:mg_legacy_seeded')
  state.exerciseMuscleGroups.add('ex_manual_admin:mg_manual_admin')

  await seedExerciseCatalog(prisma as never)

  assert.equal(state.exercises.has('legacy-seeded-exercise'), false)
  assert.equal(state.muscleGroups.has('legacy-seeded-group'), false)
  assert.equal(state.exerciseMuscleGroups.has('ex_legacy_seeded:mg_legacy_seeded'), false)
  assert.equal(state.exercises.has('manual-admin-exercise'), true)
  assert.equal(state.muscleGroups.has('manual-admin-group'), true)
  assert.equal(state.exerciseMuscleGroups.has('ex_manual_admin:mg_manual_admin'), true)
})
