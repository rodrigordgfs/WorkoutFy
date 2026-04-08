import 'dotenv/config'

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { pathToFileURL } from 'node:url'

const seedMuscleGroups = [
  { slug: 'chest', name: 'Chest' },
  { slug: 'back', name: 'Back' },
  { slug: 'shoulders', name: 'Shoulders' },
  { slug: 'biceps', name: 'Biceps' },
  { slug: 'triceps', name: 'Triceps' },
  { slug: 'quadriceps', name: 'Quadriceps' },
  { slug: 'hamstrings', name: 'Hamstrings' },
  { slug: 'glutes', name: 'Glutes' },
  { slug: 'calves', name: 'Calves' },
  { slug: 'abs', name: 'Abs' },
]

const seedExercises = [
  { slug: 'bench-press', name: 'Bench Press', muscleGroupSlugs: ['chest', 'triceps', 'shoulders'] },
  { slug: 'incline-dumbbell-press', name: 'Incline Dumbbell Press', muscleGroupSlugs: ['chest', 'shoulders', 'triceps'] },
  { slug: 'push-up', name: 'Push-Up', muscleGroupSlugs: ['chest', 'triceps', 'abs'] },
  { slug: 'barbell-row', name: 'Barbell Row', muscleGroupSlugs: ['back', 'biceps'] },
  { slug: 'lat-pulldown', name: 'Lat Pulldown', muscleGroupSlugs: ['back', 'biceps'] },
  { slug: 'pull-up', name: 'Pull-Up', muscleGroupSlugs: ['back', 'biceps', 'abs'] },
  { slug: 'shoulder-press', name: 'Shoulder Press', muscleGroupSlugs: ['shoulders', 'triceps'] },
  { slug: 'lateral-raise', name: 'Lateral Raise', muscleGroupSlugs: ['shoulders'] },
  { slug: 'bicep-curl', name: 'Bicep Curl', muscleGroupSlugs: ['biceps'] },
  { slug: 'tricep-pushdown', name: 'Tricep Pushdown', muscleGroupSlugs: ['triceps'] },
  { slug: 'back-squat', name: 'Back Squat', muscleGroupSlugs: ['quadriceps', 'glutes', 'hamstrings'] },
  { slug: 'leg-press', name: 'Leg Press', muscleGroupSlugs: ['quadriceps', 'glutes'] },
  { slug: 'romanian-deadlift', name: 'Romanian Deadlift', muscleGroupSlugs: ['hamstrings', 'glutes', 'back'] },
  { slug: 'walking-lunge', name: 'Walking Lunge', muscleGroupSlugs: ['quadriceps', 'glutes', 'hamstrings'] },
  { slug: 'standing-calf-raise', name: 'Standing Calf Raise', muscleGroupSlugs: ['calves'] },
  { slug: 'plank', name: 'Plank', muscleGroupSlugs: ['abs'] },
]

export async function seedExerciseCatalog(prisma) {
  const muscleGroupsBySlug = new Map()
  const exerciseIdsBySlug = new Map()
  const expectedAssociationKeys = new Set()
  const seededMuscleGroupSlugs = seedMuscleGroups.map(({ slug }) => slug)
  const seededExerciseSlugs = seedExercises.map(({ slug }) => slug)

  for (const muscleGroup of seedMuscleGroups) {
    const persisted = await prisma.muscleGroup.upsert({
      where: { slug: muscleGroup.slug },
      update: {
        name: muscleGroup.name,
        isSeeded: true,
      },
      create: {
        slug: muscleGroup.slug,
        name: muscleGroup.name,
        isSeeded: true,
      },
      select: {
        id: true,
        slug: true,
      },
    })

    muscleGroupsBySlug.set(persisted.slug, persisted)
  }

  for (const exercise of seedExercises) {
    const persisted = await prisma.exercise.upsert({
      where: { slug: exercise.slug },
      update: {
        name: exercise.name,
        isSeeded: true,
      },
      create: {
        slug: exercise.slug,
        name: exercise.name,
        isSeeded: true,
      },
      select: {
        id: true,
      },
    })

    exerciseIdsBySlug.set(exercise.slug, persisted.id)

    for (const muscleGroupSlug of exercise.muscleGroupSlugs) {
      const muscleGroup = muscleGroupsBySlug.get(muscleGroupSlug)

      if (!muscleGroup) {
        throw new Error(`Missing muscle group seed data for slug: ${muscleGroupSlug}`)
      }

      expectedAssociationKeys.add(`${persisted.id}:${muscleGroup.id}`)

      await prisma.exerciseMuscleGroup.upsert({
        where: {
          exerciseId_muscleGroupId: {
            exerciseId: persisted.id,
            muscleGroupId: muscleGroup.id,
          },
        },
        update: {},
        create: {
          exerciseId: persisted.id,
          muscleGroupId: muscleGroup.id,
        },
      })
    }
  }

  const currentAssociations = await prisma.exerciseMuscleGroup.findMany({
    where: {
      exerciseId: {
        in: Array.from(exerciseIdsBySlug.values()),
      },
    },
    select: {
      exerciseId: true,
      muscleGroupId: true,
    },
  })

  for (const association of currentAssociations) {
    const key = `${association.exerciseId}:${association.muscleGroupId}`

    if (expectedAssociationKeys.has(key)) {
      continue
    }

    await prisma.exerciseMuscleGroup.delete({
      where: {
        exerciseId_muscleGroupId: {
          exerciseId: association.exerciseId,
          muscleGroupId: association.muscleGroupId,
        },
      },
    })
  }

  await prisma.exercise.deleteMany({
    where: {
      isSeeded: true,
      slug: {
        notIn: seededExerciseSlugs,
      },
    },
  })

  await prisma.muscleGroup.deleteMany({
    where: {
      isSeeded: true,
      slug: {
        notIn: seededMuscleGroupSlugs,
      },
    },
  })
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to run the seed command.')
  }

  const adapter = new PrismaPg(process.env.DATABASE_URL)
  const prisma = new PrismaClient({ adapter })

  try {
    await seedExerciseCatalog(prisma)
    console.log('WorkoutFy exercise catalog seed completed successfully.')
  } finally {
    await prisma.$disconnect()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
