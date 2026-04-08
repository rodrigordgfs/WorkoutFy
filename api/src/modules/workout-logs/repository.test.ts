import assert from 'node:assert/strict'
import test from 'node:test'

import { buildWorkoutSessionCreateInput } from './repository.js'

test('buildWorkoutSessionCreateInput creates an in-progress session snapshot with one active session per user semantics', () => {
  const startedAt = new Date('2026-04-06T15:00:00.000Z')

  const createInput = buildWorkoutSessionCreateInput(
    'user_1',
    {
      id: 'workout_1',
      name: 'Treino A',
      items: [
        {
          id: 'workout_item_2',
          position: 1,
          sets: 2,
          reps: 10,
          loadKg: 25,
          restSeconds: 90,
          exercise: {
            id: 'exercise_2',
            name: 'Supino inclinado',
            slug: 'supino-inclinado',
          },
        },
        {
          id: 'workout_item_1',
          position: 0,
          sets: 3,
          reps: 12,
          loadKg: 15,
          restSeconds: 60,
          exercise: {
            id: 'exercise_1',
            name: 'Crucifixo com halteres',
            slug: 'crucifixo-com-halteres',
          },
        },
      ],
    },
    startedAt,
  )

  assert.deepEqual(createInput, {
    userId: 'user_1',
    workoutId: 'workout_1',
    workoutNameSnapshot: 'Treino A',
    activeSessionUserId: 'user_1',
    status: 'in_progress',
    startedAt,
    items: {
      create: [
        {
          workoutItemId: 'workout_item_1',
          exerciseId: 'exercise_1',
          exerciseName: 'Crucifixo com halteres',
          exerciseSlug: 'crucifixo-com-halteres',
          plannedSets: 3,
          plannedReps: 12,
          plannedLoadKg: 15,
          plannedRestSeconds: 60,
          position: 0,
          setLogs: {
            create: [
              { setNumber: 1, status: 'pending', plannedReps: 12, plannedLoadKg: 15 },
              { setNumber: 2, status: 'pending', plannedReps: 12, plannedLoadKg: 15 },
              { setNumber: 3, status: 'pending', plannedReps: 12, plannedLoadKg: 15 },
            ],
          },
        },
        {
          workoutItemId: 'workout_item_2',
          exerciseId: 'exercise_2',
          exerciseName: 'Supino inclinado',
          exerciseSlug: 'supino-inclinado',
          plannedSets: 2,
          plannedReps: 10,
          plannedLoadKg: 25,
          plannedRestSeconds: 90,
          position: 1,
          setLogs: {
            create: [
              { setNumber: 1, status: 'pending', plannedReps: 10, plannedLoadKg: 25 },
              { setNumber: 2, status: 'pending', plannedReps: 10, plannedLoadKg: 25 },
            ],
          },
        },
      ],
    },
  })
})

test('buildWorkoutSessionCreateInput preserves a session snapshot even if the workout later changes elsewhere', () => {
  const sourceWorkout = {
    id: 'workout_2',
    name: 'Treino B',
    items: [
      {
        id: 'workout_item_3',
        position: 0,
        sets: 4,
        reps: 8,
        loadKg: 80,
        restSeconds: 120,
        exercise: {
          id: 'exercise_3',
          name: 'Agachamento livre',
          slug: 'agachamento-livre',
        },
      },
    ],
  }

  const snapshot = buildWorkoutSessionCreateInput('user_2', sourceWorkout)

  sourceWorkout.items[0].sets = 1
  sourceWorkout.items[0].reps = 99
  sourceWorkout.items[0].loadKg = 1
  sourceWorkout.items[0].exercise.name = 'Alterado depois'

  assert.deepEqual(snapshot.items.create[0], {
    workoutItemId: 'workout_item_3',
    exerciseId: 'exercise_3',
    exerciseName: 'Agachamento livre',
    exerciseSlug: 'agachamento-livre',
    plannedSets: 4,
    plannedReps: 8,
    plannedLoadKg: 80,
    plannedRestSeconds: 120,
    position: 0,
    setLogs: {
      create: [
        { setNumber: 1, status: 'pending', plannedReps: 8, plannedLoadKg: 80 },
        { setNumber: 2, status: 'pending', plannedReps: 8, plannedLoadKg: 80 },
        { setNumber: 3, status: 'pending', plannedReps: 8, plannedLoadKg: 80 },
        { setNumber: 4, status: 'pending', plannedReps: 8, plannedLoadKg: 80 },
      ],
    },
  })
})
