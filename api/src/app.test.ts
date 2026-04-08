import test from 'node:test'
import assert from 'node:assert/strict'
import { Prisma } from '@prisma/client'
import { buildApp } from './app.js'
import { AppError } from './common/errors/app-error.js'

function setTestEnv(): void {
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/workoutfy_test'
  process.env.APP_TIME_ZONE = 'America/Sao_Paulo'
  process.env.CLERK_SECRET_KEY = 'sk_test_story_1_2'
  process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_Y2xlcmsuZXhhbXBsZS5jb20k'
}

test('buildApp responds to health checks', async () => {
  setTestEnv()

  const app = buildApp()

  const response = await app.inject({
    method: 'GET',
    url: '/health',
  })

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), { status: 'ok' })

  await app.close()
})

test('buildApp exposes a usable Prisma client instance', async () => {
  setTestEnv()

  const app = buildApp()
  await app.ready()

  assert.ok(app.prisma)
  assert.equal(typeof app.prisma.$connect, 'function')
  assert.equal(typeof app.prisma.$disconnect, 'function')

  await app.close()
})

test('buildApp exposes a normalized 404 error response', async () => {
  setTestEnv()

  const app = buildApp()

  const response = await app.inject({
    method: 'GET',
    url: '/missing-route',
  })

  assert.equal(response.statusCode, 404)
  assert.deepEqual(response.json(), {
    message: 'Route GET:/missing-route not found',
    code: 'NOT_FOUND',
    statusCode: 404,
  })

  await app.close()
})

test('buildApp normalizes application errors with the project format', async () => {
  setTestEnv()

  const app = buildApp()

  app.get('/test-error', async () => {
    throw new AppError('Synthetic application error.', 'SYNTHETIC_ERROR', 418, {
      source: 'app-test',
    })
  })

  const response = await app.inject({
    method: 'GET',
    url: '/test-error',
  })

  assert.equal(response.statusCode, 418)
  assert.deepEqual(response.json(), {
    message: 'Synthetic application error.',
    code: 'SYNTHETIC_ERROR',
    statusCode: 418,
    details: {
      source: 'app-test',
    },
  })

  await app.close()
})

test('buildApp exposes swagger metadata for the public healthcheck', async () => {
  setTestEnv()

  const app = buildApp()
  await app.ready()

  const document = app.swagger() as {
    openapi?: string
    paths?: Record<string, { get?: { summary?: string }; patch?: { summary?: string }; post?: { summary?: string } }>
  }

  assert.equal(document.openapi, '3.0.3')
  assert.ok(document.paths?.['/health'])
  assert.ok(document.paths?.['/health']?.get)
  assert.equal(document.paths?.['/health']?.get?.summary, 'Healthcheck')
  assert.ok(document.paths?.['/api/auth/context'])
  assert.ok(document.paths?.['/api/auth/sign-up']?.post)
  assert.ok(document.paths?.['/api/auth/sign-in']?.post)
  assert.ok(document.paths?.['/api/auth/sign-out']?.post)
  assert.ok(document.paths?.['/api/auth/session']?.get)
  assert.ok(document.paths?.['/api/auth/admin/status'])
  assert.ok(document.paths?.['/api/auth/admin/access'])
  assert.ok(document.paths?.['/api/admin/muscle-groups'])
  assert.ok(document.paths?.['/api/admin/muscle-groups/{muscleGroupId}'])
  assert.ok(document.paths?.['/api/admin/exercises'])
  assert.ok(document.paths?.['/api/admin/exercises/{exerciseId}'])
  assert.ok(document.paths?.['/api/users/me'])
  assert.ok(document.paths?.['/api/users/me']?.patch)
  assert.ok(document.paths?.['/api/muscle-groups'])
  assert.ok(document.paths?.['/api/exercises'])
  assert.ok(document.paths?.['/api/workouts'])
  assert.ok(document.paths?.['/api/workouts/{workoutId}'])
  assert.ok(document.paths?.['/api/workouts/{workoutId}/items'])
  assert.ok(document.paths?.['/api/workouts/{workoutId}/items/reorder'])
  assert.ok(document.paths?.['/api/workouts/{workoutId}/items/{workoutItemId}'])
  assert.ok(document.paths?.['/api/planning/today'])
  assert.ok(document.paths?.['/api/planning/week'])
  assert.ok(document.paths?.['/api/progress/overview'])
  assert.ok(document.paths?.['/api/workout-sessions'])
  assert.ok(document.paths?.['/api/workout-sessions/history'])
  assert.ok(document.paths?.['/api/workout-sessions/history/{workoutSessionId}'])
  assert.ok(document.paths?.['/api/workout-sessions/active'])
  assert.ok(document.paths?.['/api/workout-sessions/active/set-logs/{workoutSetLogId}']?.patch)
  assert.ok(document.paths?.['/api/workout-sessions/active/complete']?.post)

  await app.close()
})

test('buildApp enforces the /api boundary structurally for protected routes without manual auth calls', async () => {
  setTestEnv()

  const app = buildApp()

  const deniedResponse = await app.inject({
    method: 'GET',
    url: '/api/auth/context',
  })

  assert.equal(deniedResponse.statusCode, 401)
  assert.deepEqual(deniedResponse.json(), {
    message: 'Authentication is required.',
    code: 'UNAUTHORIZED',
    statusCode: 401,
  })

  const allowedResponse = await app.inject({
    method: 'GET',
    url: '/api/auth/context',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_boundary',
      'x-test-clerk-email': 'boundary@example.com',
      'x-test-clerk-first-name': 'Boundary',
      'x-test-clerk-last-name': 'Guard',
      'x-test-clerk-image-url': 'https://example.com/boundary.png',
    },
  })

  assert.equal(allowedResponse.statusCode, 200)
  assert.deepEqual(allowedResponse.json(), {
    clerkUserId: 'clerk_user_boundary',
    email: 'boundary@example.com',
    firstName: 'Boundary',
    lastName: 'Guard',
    imageUrl: 'https://example.com/boundary.png',
  })

  await app.close()
})

test('buildApp resolves administrative status without requiring admin access', async () => {
  setTestEnv()

  const app = buildApp()

  const nonAdminResponse = await app.inject({
    method: 'GET',
    url: '/api/auth/admin/status',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_member',
    },
  })

  assert.equal(nonAdminResponse.statusCode, 200)
  assert.deepEqual(nonAdminResponse.json(), {
    isAdmin: false,
    authorizationSource: 'privateMetadata',
  })

  const adminResponse = await app.inject({
    method: 'GET',
    url: '/api/auth/admin/status',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_admin_status',
      'x-test-clerk-role': 'admin',
    },
  })

  assert.equal(adminResponse.statusCode, 200)
  assert.deepEqual(adminResponse.json(), {
    isAdmin: true,
    authorizationSource: 'privateMetadata',
  })

  await app.close()
})

test('buildApp signs up through API-mediated auth, sets an HTTP-only session cookie, and resolves the session bootstrap', async () => {
  setTestEnv()

  type FakeAuthPersistedUser = {
    id: string
    clerkUserId: string
    email: string | null
    firstName: string | null
    lastName: string | null
    imageUrl: string | null
    profile: {
      displayName: string | null
      dateOfBirth: null
      heightCm: number | null
      weightKg: number | null
    }
  }

  const fakePrismaState: { user: FakeAuthPersistedUser } = {
    user: {
      id: 'user_internal_auth_1',
      clerkUserId: 'clerk_user_test_1',
      email: 'new-user@example.com',
      firstName: null,
      lastName: null,
      imageUrl: null,
      profile: {
        displayName: null,
        dateOfBirth: null,
        heightCm: null,
        weightKg: null,
      },
    },
  }

  const fakePrisma = {
    user: {
      async upsert(args: {
        where: { clerkUserId: string }
        update: {
          email: string | null
          firstName: string | null
          lastName: string | null
          imageUrl: string | null
        }
        create: {
          clerkUserId: string
          email: string | null
          firstName: string | null
          lastName: string | null
          imageUrl: string | null
          profile: { create: Record<string, never> }
        }
        include: { profile: true }
      }) {
        fakePrismaState.user = {
          ...fakePrismaState.user,
          clerkUserId: args.where.clerkUserId,
          email: args.update.email,
          firstName: args.update.firstName,
          lastName: args.update.lastName,
          imageUrl: args.update.imageUrl,
        }

        return fakePrismaState.user
      },
    },
    userProfile: {
      async upsert() {
        return fakePrismaState.user.profile
      },
    },
  }

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: fakePrisma,
  })

  const signUpResponse = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up',
    payload: {
      email: 'new-user@example.com',
      password: 'password123',
    },
  })

  assert.equal(signUpResponse.statusCode, 201)
  assert.equal(signUpResponse.json().authenticated, true)
  assert.equal(signUpResponse.json().user.email, 'new-user@example.com')

  assert.equal(typeof signUpResponse.headers['set-cookie'], 'string')
  const setCookieHeader = String(signUpResponse.headers['set-cookie'])
  assert.match(setCookieHeader, /__session=/)
  assert.match(setCookieHeader, /HttpOnly/)

  const sessionResponse = await app.inject({
    method: 'GET',
    url: '/api/auth/session',
    headers: {
      cookie: setCookieHeader,
    },
  })

  assert.equal(sessionResponse.statusCode, 200)
  assert.deepEqual(sessionResponse.json(), {
    authenticated: true,
    user: {
      id: 'user_internal_auth_1',
      clerkUserId: 'clerk_user_test_1',
      email: 'new-user@example.com',
      firstName: null,
      lastName: null,
      imageUrl: null,
      isAdmin: false,
      profile: {
        displayName: null,
        dateOfBirth: null,
        heightCm: null,
        weightKg: null,
      },
    },
  })

  const authContextResponse = await app.inject({
    method: 'GET',
    url: '/api/auth/context',
    headers: {
      cookie: setCookieHeader,
    },
  })

  assert.equal(authContextResponse.statusCode, 200)
  assert.deepEqual(authContextResponse.json(), {
    clerkUserId: 'clerk_user_test_1',
    email: 'new-user@example.com',
    firstName: null,
    lastName: null,
    imageUrl: null,
  })

  await app.close()
})

test('buildApp signs in through API-mediated auth and rejects invalid credentials', async () => {
  setTestEnv()

  type FakeAuthPersistedUser = {
    id: string
    clerkUserId: string
    email: string | null
    firstName: string | null
    lastName: string | null
    imageUrl: string | null
    profile: {
      displayName: string | null
      dateOfBirth: null
      heightCm: number | null
      weightKg: number | null
    }
  }

  const fakePrismaState: { user: FakeAuthPersistedUser } = {
    user: {
      id: 'user_internal_auth_2',
      clerkUserId: 'clerk_user_test_1',
      email: 'signin-user@example.com',
      firstName: null,
      lastName: null,
      imageUrl: null,
      profile: {
        displayName: null,
        dateOfBirth: null,
        heightCm: null,
        weightKg: null,
      },
    },
  }

  const fakePrisma = {
    user: {
      async upsert(args: {
        where: { clerkUserId: string }
        update: {
          email: string | null
          firstName: string | null
          lastName: string | null
          imageUrl: string | null
        }
        create: {
          clerkUserId: string
          email: string | null
          firstName: string | null
          lastName: string | null
          imageUrl: string | null
          profile: { create: Record<string, never> }
        }
        include: { profile: true }
      }) {
        fakePrismaState.user = {
          ...fakePrismaState.user,
          clerkUserId: args.where.clerkUserId,
          email: args.update.email,
          firstName: args.update.firstName,
          lastName: args.update.lastName,
          imageUrl: args.update.imageUrl,
        }

        return fakePrismaState.user
      },
    },
    userProfile: {
      async upsert() {
        return fakePrismaState.user.profile
      },
    },
  }

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: fakePrisma,
  })

  const signUpResponse = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up',
    payload: {
      email: 'signin-user@example.com',
      password: 'password123',
    },
  })

  assert.equal(signUpResponse.statusCode, 201)

  const signInResponse = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-in',
    payload: {
      email: 'signin-user@example.com',
      password: 'password123',
    },
  })

  assert.equal(signInResponse.statusCode, 200)
  assert.equal(signInResponse.json().authenticated, true)
  assert.equal(signInResponse.json().user.email, 'signin-user@example.com')
  assert.match(String(signInResponse.headers['set-cookie']), /__session=/)

  const invalidCredentialsResponse = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-in',
    payload: {
      email: 'signin-user@example.com',
      password: 'wrongpass123',
    },
  })

  assert.equal(invalidCredentialsResponse.statusCode, 401)
  assert.deepEqual(invalidCredentialsResponse.json(), {
    message: 'Invalid email or password.',
    code: 'AUTH_INVALID_CREDENTIALS',
    statusCode: 401,
  })

  await app.close()
})

test('buildApp returns unauthenticated session bootstrap and clears session cookie on sign-out', async () => {
  setTestEnv()

  type FakeAuthPersistedUser = {
    id: string
    clerkUserId: string
    email: string | null
    firstName: string | null
    lastName: string | null
    imageUrl: string | null
    profile: {
      displayName: string | null
      dateOfBirth: null
      heightCm: number | null
      weightKg: number | null
    }
  }

  const fakePrismaState: { user: FakeAuthPersistedUser } = {
    user: {
      id: 'user_internal_auth_3',
      clerkUserId: 'clerk_user_test_1',
      email: 'logout-user@example.com',
      firstName: null,
      lastName: null,
      imageUrl: null,
      profile: {
        displayName: null,
        dateOfBirth: null,
        heightCm: null,
        weightKg: null,
      },
    },
  }

  const fakePrisma = {
    user: {
      async upsert(args: {
        where: { clerkUserId: string }
        update: {
          email: string | null
          firstName: string | null
          lastName: string | null
          imageUrl: string | null
        }
        create: {
          clerkUserId: string
          email: string | null
          firstName: string | null
          lastName: string | null
          imageUrl: string | null
          profile: { create: Record<string, never> }
        }
        include: { profile: true }
      }) {
        fakePrismaState.user = {
          ...fakePrismaState.user,
          clerkUserId: args.where.clerkUserId,
          email: args.update.email,
          firstName: args.update.firstName,
          lastName: args.update.lastName,
          imageUrl: args.update.imageUrl,
        }

        return fakePrismaState.user
      },
    },
    userProfile: {
      async upsert() {
        return fakePrismaState.user.profile
      },
    },
  }

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: fakePrisma,
  })

  const unauthenticatedSessionResponse = await app.inject({
    method: 'GET',
    url: '/api/auth/session',
  })

  assert.equal(unauthenticatedSessionResponse.statusCode, 200)
  assert.deepEqual(unauthenticatedSessionResponse.json(), {
    authenticated: false,
    user: null,
  })

  const signUpResponse = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up',
    payload: {
      email: 'logout-user@example.com',
      password: 'password123',
    },
  })

  const sessionCookie = String(signUpResponse.headers['set-cookie'])

  const signOutResponse = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-out',
    headers: {
      cookie: sessionCookie,
    },
  })

  assert.equal(signOutResponse.statusCode, 204)
  assert.match(String(signOutResponse.headers['set-cookie']), /Max-Age=0/)

  const clearedSessionResponse = await app.inject({
    method: 'GET',
    url: '/api/auth/session',
  })

  assert.equal(clearedSessionResponse.statusCode, 200)
  assert.deepEqual(clearedSessionResponse.json(), {
    authenticated: false,
    user: null,
  })

  await app.close()
})

test('buildApp allows the administrative proof route only for users resolved as admin', async () => {
  setTestEnv()

  const app = buildApp()

  const deniedResponse = await app.inject({
    method: 'GET',
    url: '/api/auth/admin/access',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_non_admin',
    },
  })

  assert.equal(deniedResponse.statusCode, 403)
  assert.deepEqual(deniedResponse.json(), {
    message: 'Administrator access is required.',
    code: 'FORBIDDEN',
    statusCode: 403,
  })

  const allowedResponse = await app.inject({
    method: 'GET',
    url: '/api/auth/admin/access',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_admin',
      'x-test-clerk-role': 'admin',
    },
  })

  assert.equal(allowedResponse.statusCode, 200)
  assert.deepEqual(allowedResponse.json(), {
    authorized: true,
    authorizationSource: 'privateMetadata',
  })

  await app.close()
})

test('buildApp creates and returns the current authenticated user through /api/users/me', async () => {
  setTestEnv()

  type FakePersistedUser = {
    id: string
    clerkUserId: string
    email: string | null
    firstName: string | null
    lastName: string | null
    imageUrl: string | null
    profile: {
      id: string
      userId: string
      displayName: string | null
      dateOfBirth: Date | null
      heightCm: number | null
      weightKg: number | null
    }
  }

  const fakePrismaState = {
    user: null as null | FakePersistedUser,
    upsertCalls: 0,
  }

  const fakePrisma = {
    user: {
      async upsert({
        where,
        create,
        update,
      }: {
        where: { clerkUserId: string }
        create: {
          clerkUserId: string
          email: string | null
          firstName: string | null
          lastName: string | null
          imageUrl: string | null
          profile: { create: Record<string, never> }
        }
        update: {
          email: string | null
          firstName: string | null
          lastName: string | null
          imageUrl: string | null
        }
      }) {
        assert.equal(where.clerkUserId, 'clerk_user_1')
        fakePrismaState.upsertCalls += 1

        if (!fakePrismaState.user) {
          fakePrismaState.user = {
            id: 'user_internal_1',
            clerkUserId: create.clerkUserId,
            email: create.email,
            firstName: create.firstName,
            lastName: create.lastName,
            imageUrl: create.imageUrl,
            profile: {
              id: 'profile_internal_1',
              userId: 'user_internal_1',
              displayName: null,
              dateOfBirth: null,
              heightCm: null,
              weightKg: null,
            },
          }

          return fakePrismaState.user
        }

        fakePrismaState.user = {
          ...fakePrismaState.user,
          email: update.email,
          firstName: update.firstName,
          lastName: update.lastName,
          imageUrl: update.imageUrl,
          profile: {
            ...fakePrismaState.user.profile,
          },
        }

        return fakePrismaState.user
      },
    },
  }

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: fakePrisma,
  })

  const response = await app.inject({
    method: 'GET',
    url: '/api/users/me',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_1',
      'x-test-clerk-email': 'user1@example.com',
      'x-test-clerk-first-name': 'Rodrigo',
      'x-test-clerk-last-name': 'Silva',
      'x-test-clerk-image-url': 'https://example.com/avatar-1.png',
    },
  })

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), {
    id: 'user_internal_1',
    clerkUserId: 'clerk_user_1',
    email: 'user1@example.com',
    firstName: 'Rodrigo',
    lastName: 'Silva',
    imageUrl: 'https://example.com/avatar-1.png',
    profile: {
      displayName: null,
      dateOfBirth: null,
      heightCm: null,
      weightKg: null,
    },
  })
  assert.equal(fakePrismaState.upsertCalls, 1)

  await app.close()
})

test('buildApp reuses the current user without duplicating records or overwriting editable profile fields', async () => {
  setTestEnv()

  type FakePersistedUser = {
    id: string
    clerkUserId: string
    email: string | null
    firstName: string | null
    lastName: string | null
    imageUrl: string | null
    profile: {
      id: string
      userId: string
      displayName: string | null
      dateOfBirth: Date | null
      heightCm: number | null
      weightKg: number | null
    }
  }

  const fakePrismaState = {
    user: {
      id: 'user_internal_2',
      clerkUserId: 'clerk_user_2',
      email: 'old-email@example.com',
      firstName: 'Old',
      lastName: 'Name',
      imageUrl: 'https://example.com/avatar-old.png',
      profile: {
        id: 'profile_internal_2',
        userId: 'user_internal_2',
        displayName: 'Coach Rodrigo',
        dateOfBirth: new Date('1994-02-10T00:00:00.000Z'),
        heightCm: 178,
        weightKg: 85,
      },
    } as FakePersistedUser,
    upsertCalls: 0,
  }

  const fakePrisma = {
    user: {
      async upsert({
        where,
        create,
        update,
      }: {
        where: { clerkUserId: string }
        create: {
          clerkUserId: string
          email: string | null
          firstName: string | null
          lastName: string | null
          imageUrl: string | null
          profile: { create: Record<string, never> }
        }
        update: {
          email: string | null
          firstName: string | null
          lastName: string | null
          imageUrl: string | null
        }
      }) {
        assert.equal(where.clerkUserId, fakePrismaState.user.clerkUserId)
        assert.equal(create.clerkUserId, fakePrismaState.user.clerkUserId)

        fakePrismaState.upsertCalls += 1
        fakePrismaState.user = {
          ...fakePrismaState.user,
          email: update.email,
          firstName: update.firstName,
          lastName: update.lastName,
          imageUrl: update.imageUrl,
          profile: {
            ...fakePrismaState.user.profile,
          },
        }

        return fakePrismaState.user
      },
    },
  }

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: fakePrisma,
  })

  const response = await app.inject({
    method: 'GET',
    url: '/api/users/me',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_2',
      'x-test-clerk-email': 'new-email@example.com',
      'x-test-clerk-first-name': 'New',
      'x-test-clerk-last-name': 'Identity',
      'x-test-clerk-image-url': 'https://example.com/avatar-new.png',
    },
  })

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), {
    id: 'user_internal_2',
    clerkUserId: 'clerk_user_2',
    email: 'new-email@example.com',
    firstName: 'New',
    lastName: 'Identity',
    imageUrl: 'https://example.com/avatar-new.png',
    profile: {
      displayName: 'Coach Rodrigo',
      dateOfBirth: '1994-02-10',
      heightCm: 178,
      weightKg: 85,
    },
  })
  assert.equal(fakePrismaState.upsertCalls, 1)
  assert.equal(fakePrismaState.user.profile.displayName, 'Coach Rodrigo')

  await app.close()
})

test('buildApp normalizes invalid authenticated context instead of leaking an internal error', async () => {
  setTestEnv()

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      async $transaction<T>(fn: (tx: unknown) => Promise<T>) {
        return fn(this as unknown)
      },
      user: {
        async upsert() {
          throw new Error('upsert should not run when auth context is invalid')
        },
      },
    },
  })

  const response = await app.inject({
    method: 'GET',
    url: '/api/users/me',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_invalid',
      'x-test-clerk-image-url': 'not-a-valid-url',
    },
  })

  assert.equal(response.statusCode, 401)
  assert.deepEqual(response.json(), {
    message: 'Authenticated user context is invalid.',
    code: 'INVALID_AUTH_CONTEXT',
    statusCode: 401,
    details: {
      issues: [
        {
          path: 'imageUrl',
          message: 'Invalid URL',
        },
      ],
    },
  })

  await app.close()
})

test('buildApp supports the real getAuth branch when request.auth is populated by Clerk middleware', async () => {
  setTestEnv()

  const app = buildApp()

  app.addHook('onRequest', async (request) => {
    if (request.url !== '/api/users/me') {
      return
    }

    Object.assign(request, {
      auth: {
        sessionClaims: {
          email: 'real-branch@example.com',
          first_name: 'Real',
          last_name: 'Branch',
          image_url: 'https://example.com/real-branch.png',
        },
        sessionId: 'sess_123',
        sessionStatus: 'active',
        actor: null,
        tokenType: 'session_token',
        userId: 'clerk_user_real_branch',
        orgId: null,
        orgRole: null,
        orgSlug: null,
        orgPermissions: null,
        factorVerificationAge: null,
        getToken: async () => null,
        has: () => false,
        debug: () => ({}),
        isAuthenticated: true,
      },
    })
  })

  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      async $transaction<T>(fn: (tx: unknown) => Promise<T>) {
        return fn(this as unknown)
      },
      user: {
        async upsert({
          create,
          update,
        }: {
          where: { clerkUserId: string }
          create: {
            clerkUserId: string
            email: string | null
            firstName: string | null
            lastName: string | null
            imageUrl: string | null
            profile: { create: Record<string, never> }
          }
          update: {
            email: string | null
            firstName: string | null
            lastName: string | null
            imageUrl: string | null
          }
        }) {
          return {
            id: 'user_internal_real_branch',
            clerkUserId: create.clerkUserId,
            email: update.email,
            firstName: update.firstName,
            lastName: update.lastName,
            imageUrl: update.imageUrl,
            profile: {
              displayName: null,
              dateOfBirth: null,
              heightCm: null,
              weightKg: null,
            },
          }
        },
      },
    },
  })

  const originalNodeEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'development'

  const response = await app.inject({
    method: 'GET',
    url: '/api/users/me',
  })

  process.env.NODE_ENV = originalNodeEnv

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), {
    id: 'user_internal_real_branch',
    clerkUserId: 'clerk_user_real_branch',
    email: 'real-branch@example.com',
    firstName: 'Real',
    lastName: 'Branch',
    imageUrl: 'https://example.com/real-branch.png',
    profile: {
      displayName: null,
      dateOfBirth: null,
      heightCm: null,
      weightKg: null,
    },
  })

  await app.close()
})

test('buildApp rejects /api/users/me when there is no authenticated user context', async () => {
  setTestEnv()

  const app = buildApp()

  const response = await app.inject({
    method: 'GET',
    url: '/api/users/me',
  })

  assert.equal(response.statusCode, 401)
  assert.deepEqual(response.json(), {
    message: 'Authentication is required.',
    code: 'UNAUTHORIZED',
    statusCode: 401,
  })

  await app.close()
})

test('buildApp updates editable profile fields through PATCH /api/users/me without changing Clerk-synced data', async () => {
  setTestEnv()

  type FakePersistedUser = {
    id: string
    clerkUserId: string
    email: string | null
    firstName: string | null
    lastName: string | null
    imageUrl: string | null
    profile: {
      id: string
      userId: string
      displayName: string | null
      dateOfBirth: Date | null
      heightCm: number | null
      weightKg: number | null
    }
  }

  const fakePrismaState = {
    user: {
      id: 'user_internal_patch_1',
      clerkUserId: 'clerk_user_patch_1',
      email: 'clerk@example.com',
      firstName: 'Clerk',
      lastName: 'User',
      imageUrl: 'https://example.com/clerk.png',
      profile: {
        id: 'profile_internal_patch_1',
        userId: 'user_internal_patch_1',
        displayName: 'Old Display',
        dateOfBirth: new Date('1990-01-01T00:00:00.000Z'),
        heightCm: 170,
        weightKg: 80,
      },
    } as FakePersistedUser,
    userUpsertCalls: 0,
    profileUpsertCalls: 0,
  }

  const fakePrisma = {
    user: {
      async upsert({
        where,
        create,
        update,
      }: {
        where: { clerkUserId: string }
        create: {
          clerkUserId: string
          email: string | null
          firstName: string | null
          lastName: string | null
          imageUrl: string | null
          profile: { create: Record<string, never> }
        }
        update: {
          email: string | null
          firstName: string | null
          lastName: string | null
          imageUrl: string | null
        }
      }) {
        assert.equal(where.clerkUserId, fakePrismaState.user.clerkUserId)
        assert.equal(create.clerkUserId, fakePrismaState.user.clerkUserId)
        fakePrismaState.userUpsertCalls += 1
        fakePrismaState.user = {
          ...fakePrismaState.user,
          email: update.email,
          firstName: update.firstName,
          lastName: update.lastName,
          imageUrl: update.imageUrl,
          profile: {
            ...fakePrismaState.user.profile,
          },
        }

        return fakePrismaState.user
      },
    },
    userProfile: {
      async upsert({
        where,
        update,
        create,
      }: {
        where: { userId: string }
        update: {
          displayName?: string | null
          dateOfBirth?: Date | null
          heightCm?: number | null
          weightKg?: number | null
        }
        create: {
          userId: string
          displayName?: string | null
          dateOfBirth?: Date | null
          heightCm?: number | null
          weightKg?: number | null
        }
      }) {
        assert.equal(where.userId, fakePrismaState.user.id)
        assert.equal(create.userId, fakePrismaState.user.id)
        fakePrismaState.profileUpsertCalls += 1
        fakePrismaState.user = {
          ...fakePrismaState.user,
          profile: {
            ...fakePrismaState.user.profile,
            ...(update.displayName === undefined ? {} : { displayName: update.displayName }),
            ...(update.dateOfBirth === undefined ? {} : { dateOfBirth: update.dateOfBirth }),
            ...(update.heightCm === undefined ? {} : { heightCm: update.heightCm }),
            ...(update.weightKg === undefined ? {} : { weightKg: update.weightKg }),
          },
        }

        return fakePrismaState.user.profile
      },
    },
  }

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: fakePrisma,
  })

  const response = await app.inject({
    method: 'PATCH',
    url: '/api/users/me',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_patch_1',
      'x-test-clerk-email': 'clerk@example.com',
      'x-test-clerk-first-name': 'Clerk',
      'x-test-clerk-last-name': 'User',
      'x-test-clerk-image-url': 'https://example.com/clerk.png',
    },
    payload: {
      displayName: 'Rodrigo Silva',
      heightCm: 178,
    },
  })

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), {
    id: 'user_internal_patch_1',
    clerkUserId: 'clerk_user_patch_1',
    email: 'clerk@example.com',
    firstName: 'Clerk',
    lastName: 'User',
    imageUrl: 'https://example.com/clerk.png',
    profile: {
      displayName: 'Rodrigo Silva',
      dateOfBirth: '1990-01-01',
      heightCm: 178,
      weightKg: 80,
    },
  })
  assert.equal(fakePrismaState.userUpsertCalls, 1)
  assert.equal(fakePrismaState.profileUpsertCalls, 1)
  assert.equal(fakePrismaState.user.email, 'clerk@example.com')

  await app.close()
})

test('buildApp supports explicit null clearing for editable profile fields through PATCH /api/users/me', async () => {
  setTestEnv()

  const fakePrismaState = {
    user: {
      id: 'user_internal_patch_2',
      clerkUserId: 'clerk_user_patch_2',
      email: 'clerk2@example.com',
      firstName: 'Second',
      lastName: 'User',
      imageUrl: 'https://example.com/clerk-2.png',
      profile: {
        id: 'profile_internal_patch_2',
        userId: 'user_internal_patch_2',
        displayName: 'Clear Me' as string | null,
        dateOfBirth: new Date('1988-03-15T00:00:00.000Z') as Date | null,
        heightCm: 172 as number | null,
        weightKg: 76 as number | null,
      },
    },
  }

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      user: {
        async upsert() {
          return fakePrismaState.user
        },
      },
      userProfile: {
        async upsert({
          update,
        }: {
          where: { userId: string }
          update: {
            displayName?: string | null
            dateOfBirth?: Date | null
            heightCm?: number | null
            weightKg?: number | null
          }
          create: {
            userId: string
            displayName?: string | null
            dateOfBirth?: Date | null
            heightCm?: number | null
            weightKg?: number | null
          }
        }) {
          fakePrismaState.user.profile = {
            ...fakePrismaState.user.profile,
            ...(update.displayName === undefined ? {} : { displayName: update.displayName }),
            ...(update.dateOfBirth === undefined ? {} : { dateOfBirth: update.dateOfBirth }),
            ...(update.heightCm === undefined ? {} : { heightCm: update.heightCm }),
            ...(update.weightKg === undefined ? {} : { weightKg: update.weightKg }),
          }

          return fakePrismaState.user.profile
        },
      },
    },
  })

  const response = await app.inject({
    method: 'PATCH',
    url: '/api/users/me',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_patch_2',
      'x-test-clerk-email': 'clerk2@example.com',
      'x-test-clerk-first-name': 'Second',
      'x-test-clerk-last-name': 'User',
      'x-test-clerk-image-url': 'https://example.com/clerk-2.png',
    },
    payload: {
      displayName: null,
      dateOfBirth: null,
    },
  })

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), {
    id: 'user_internal_patch_2',
    clerkUserId: 'clerk_user_patch_2',
    email: 'clerk2@example.com',
    firstName: 'Second',
    lastName: 'User',
    imageUrl: 'https://example.com/clerk-2.png',
    profile: {
      displayName: null,
      dateOfBirth: null,
      heightCm: 172,
      weightKg: 76,
    },
  })

  await app.close()
})

test('buildApp rejects invalid PATCH /api/users/me payloads with the normalized validation format', async () => {
  setTestEnv()

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      user: {
        async upsert() {
          return {
            id: 'user_internal_patch_invalid',
            clerkUserId: 'clerk_user_patch_invalid',
            email: 'invalid@example.com',
            firstName: 'Invalid',
            lastName: 'Payload',
            imageUrl: 'https://example.com/invalid.png',
            profile: {
              displayName: null,
              dateOfBirth: null,
              heightCm: null,
              weightKg: null,
            },
          }
        },
      },
      userProfile: {
        async upsert() {
          throw new Error('userProfile.upsert should not run for invalid payloads')
        },
      },
    },
  })

  const response = await app.inject({
    method: 'PATCH',
    url: '/api/users/me',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_patch_invalid',
    },
    payload: {},
  })

  assert.equal(response.statusCode, 400)
  assert.deepEqual(response.json(), {
    message: 'Request validation failed.',
    code: 'VALIDATION_ERROR',
    statusCode: 400,
    details: {
      issues: [
        {
          path: '',
          message: 'At least one editable profile field must be provided.',
        },
      ],
    },
  })

  await app.close()
})

test('buildApp rejects impossible calendar dates in PATCH /api/users/me', async () => {
  setTestEnv()

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      user: {
        async upsert() {
          return {
            id: 'user_internal_patch_invalid_date',
            clerkUserId: 'clerk_user_patch_invalid_date',
            email: 'invalid-date@example.com',
            firstName: 'Invalid',
            lastName: 'Date',
            imageUrl: 'https://example.com/invalid-date.png',
            profile: {
              displayName: null,
              dateOfBirth: null,
              heightCm: null,
              weightKg: null,
            },
          }
        },
      },
      userProfile: {
        async upsert() {
          throw new Error('userProfile.upsert should not run for impossible calendar dates')
        },
      },
    },
  })

  const response = await app.inject({
    method: 'PATCH',
    url: '/api/users/me',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_patch_invalid_date',
    },
    payload: {
      dateOfBirth: '2024-02-31',
    },
  })

  assert.equal(response.statusCode, 400)
  assert.deepEqual(response.json(), {
    message: 'Request validation failed.',
    code: 'VALIDATION_ERROR',
    statusCode: 400,
    details: {
      issues: [
        {
          path: 'dateOfBirth',
          message: 'Invalid calendar date. Expected a real YYYY-MM-DD date.',
        },
      ],
    },
  })

  await app.close()
})

test('buildApp normalizes Fastify validation errors to the same details shape used by module validation', async () => {
  setTestEnv()

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      user: {
        async upsert() {
          return {
            id: 'user_internal_patch_extra_field',
            clerkUserId: 'clerk_user_patch_extra_field',
            email: 'extra@example.com',
            firstName: 'Extra',
            lastName: 'Field',
            imageUrl: 'https://example.com/extra.png',
            profile: {
              displayName: null,
              dateOfBirth: null,
              heightCm: null,
              weightKg: null,
            },
          }
        },
      },
      userProfile: {
        async upsert() {
          throw new Error('userProfile.upsert should not run for Fastify validation errors')
        },
      },
    },
  })

  const response = await app.inject({
    method: 'PATCH',
    url: '/api/users/me',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_patch_extra_field',
    },
    payload: {
      heightCm: 'not-a-number',
    },
  })

  assert.equal(response.statusCode, 400)
  assert.deepEqual(response.json(), {
    message: 'Request validation failed.',
    code: 'VALIDATION_ERROR',
    statusCode: 400,
    details: {
      issues: [
        {
          path: 'heightCm',
          message: 'must be integer,null',
        },
      ],
    },
  })

  await app.close()
})

test('buildApp lists muscle groups through GET /api/muscle-groups in camelCase', async () => {
  setTestEnv()

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      muscleGroup: {
        async findMany() {
          return [
            { id: 'mg_back', name: 'Back', slug: 'back' },
            { id: 'mg_chest', name: 'Chest', slug: 'chest' },
          ]
        },
      },
    },
  })

  const response = await app.inject({
    method: 'GET',
    url: '/api/muscle-groups',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_catalog_1',
    },
  })

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), [
    { id: 'mg_back', name: 'Back', slug: 'back' },
    { id: 'mg_chest', name: 'Chest', slug: 'chest' },
  ])

  await app.close()
})

test('buildApp rejects unauthenticated GET /api/muscle-groups', async () => {
  setTestEnv()

  const app = buildApp()

  const response = await app.inject({
    method: 'GET',
    url: '/api/muscle-groups',
  })

  assert.equal(response.statusCode, 401)
  assert.deepEqual(response.json(), {
    message: 'Authentication is required.',
    code: 'UNAUTHORIZED',
    statusCode: 401,
  })

  await app.close()
})

test('buildApp allows administrators to list muscle groups through GET /api/admin/muscle-groups', async () => {
  setTestEnv()

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      muscleGroup: {
        async findMany() {
          return [
            {
              id: 'mg_back',
              name: 'Back',
              slug: 'back',
              createdAt: new Date('2026-04-06T20:00:00.000Z'),
              updatedAt: new Date('2026-04-06T20:05:00.000Z'),
            },
          ]
        },
      },
    },
  })

  const response = await app.inject({
    method: 'GET',
    url: '/api/admin/muscle-groups',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_admin_muscle_groups_list',
      'x-test-clerk-role': 'admin',
    },
  })

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), [
    {
      id: 'mg_back',
      name: 'Back',
      slug: 'back',
      createdAt: '2026-04-06T20:00:00.000Z',
      updatedAt: '2026-04-06T20:05:00.000Z',
    },
  ])

  await app.close()
})

test('buildApp blocks non-admin users from GET /api/admin/muscle-groups', async () => {
  setTestEnv()

  const app = buildApp()

  const response = await app.inject({
    method: 'GET',
    url: '/api/admin/muscle-groups',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_non_admin_muscle_groups_list',
    },
  })

  assert.equal(response.statusCode, 403)
  assert.deepEqual(response.json(), {
    message: 'Administrator access is required.',
    code: 'FORBIDDEN',
    statusCode: 403,
  })

  await app.close()
})

test('buildApp creates muscle groups through POST /api/admin/muscle-groups with normalized slug', async () => {
  setTestEnv()

  const app = buildApp()
  await app.ready()

  const fakePrismaState = {
    createCalls: [] as Array<{ name: string; slug: string }>,
  }

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      muscleGroup: {
        async create({
          data,
        }: {
          data: { name: string; slug: string }
          select: Record<string, unknown>
        }) {
          fakePrismaState.createCalls.push(data)

          return {
            id: 'mg_shoulders',
            name: data.name,
            slug: data.slug,
            createdAt: new Date('2026-04-06T20:10:00.000Z'),
            updatedAt: new Date('2026-04-06T20:10:00.000Z'),
          }
        },
      },
      exerciseMuscleGroup: {
        async count() {
          throw new Error('exerciseMuscleGroup.count should not run during create')
        },
      },
    },
  })

  const response = await app.inject({
    method: 'POST',
    url: '/api/admin/muscle-groups',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_admin_muscle_groups_create',
      'x-test-clerk-role': 'admin',
    },
    payload: {
      name: 'Ombros',
    },
  })

  assert.equal(response.statusCode, 201)
  assert.deepEqual(response.json(), {
    id: 'mg_shoulders',
    name: 'Ombros',
    slug: 'ombros',
    createdAt: '2026-04-06T20:10:00.000Z',
    updatedAt: '2026-04-06T20:10:00.000Z',
  })
  assert.deepEqual(fakePrismaState.createCalls, [
    {
      name: 'Ombros',
      slug: 'ombros',
    },
  ])

  await app.close()
})

test('buildApp updates muscle groups through PATCH /api/admin/muscle-groups/:muscleGroupId and normalizes explicit slug', async () => {
  setTestEnv()

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      muscleGroup: {
        async findMany() {
          throw new Error('findMany should not run during update')
        },
        async findUnique({
          where,
        }: {
          where: { id: string }
          select: Record<string, unknown>
        }) {
          assert.equal(where.id, 'mg_shoulders')

          return {
            id: 'mg_shoulders',
            name: 'Ombros',
            slug: 'ombros',
            createdAt: new Date('2026-04-06T20:00:00.000Z'),
            updatedAt: new Date('2026-04-06T20:00:00.000Z'),
          }
        },
        async update({
          where,
          data,
        }: {
          where: { id: string }
          data: { name?: string; slug?: string }
          select: Record<string, unknown>
        }) {
          assert.equal(where.id, 'mg_shoulders')
          assert.deepEqual(data, {
            name: 'Deltoides',
            slug: 'deltoides-lateral',
          })

          return {
            id: 'mg_shoulders',
            name: 'Deltoides',
            slug: 'deltoides-lateral',
            createdAt: new Date('2026-04-06T20:00:00.000Z'),
            updatedAt: new Date('2026-04-06T20:12:00.000Z'),
          }
        },
      },
      exerciseMuscleGroup: {
        async count() {
          throw new Error('exerciseMuscleGroup.count should not run during update')
        },
      },
    },
  })

  const response = await app.inject({
    method: 'PATCH',
    url: '/api/admin/muscle-groups/mg_shoulders',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_admin_muscle_groups_update',
      'x-test-clerk-role': 'admin',
    },
    payload: {
      name: 'Deltoides',
      slug: ' Deltoides lateral ',
    },
  })

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), {
    id: 'mg_shoulders',
    name: 'Deltoides',
    slug: 'deltoides-lateral',
    createdAt: '2026-04-06T20:00:00.000Z',
    updatedAt: '2026-04-06T20:12:00.000Z',
  })

  await app.close()
})

test('buildApp returns a normalized conflict when creating a duplicate muscle group slug', async () => {
  setTestEnv()

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      muscleGroup: {
        async create() {
          throw new Prisma.PrismaClientKnownRequestError(
            'Unique constraint failed on the fields: (`slug`)',
            {
              code: 'P2002',
              clientVersion: '7.6.0',
              meta: {
                target: ['slug'],
              },
            },
          )
        },
      },
      exerciseMuscleGroup: {
        async count() {
          throw new Error('exerciseMuscleGroup.count should not run during create conflict')
        },
      },
    },
  })

  const response = await app.inject({
    method: 'POST',
    url: '/api/admin/muscle-groups',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_admin_muscle_groups_duplicate',
      'x-test-clerk-role': 'admin',
    },
    payload: {
      name: 'Peito',
    },
  })

  assert.equal(response.statusCode, 409)
  assert.deepEqual(response.json(), {
    message: 'A muscle group with this slug already exists.',
    code: 'MUSCLE_GROUP_SLUG_CONFLICT',
    statusCode: 409,
  })

  await app.close()
})

test('buildApp blocks DELETE /api/admin/muscle-groups/:muscleGroupId when the muscle group is associated with exercises', async () => {
  setTestEnv()

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      muscleGroup: {
        async findMany() {
          throw new Error('findMany should not run during delete conflict')
        },
        async findUnique({
          where,
        }: {
          where: { id: string }
          select: Record<string, unknown>
        }) {
          assert.equal(where.id, 'mg_chest')

          return {
            id: 'mg_chest',
            name: 'Chest',
            slug: 'chest',
            createdAt: new Date('2026-04-06T20:00:00.000Z'),
            updatedAt: new Date('2026-04-06T20:00:00.000Z'),
          }
        },
        async delete() {
          throw new Error('delete should not run for associated muscle groups')
        },
      },
      exerciseMuscleGroup: {
        async count({
          where,
        }: {
          where: { muscleGroupId: string }
        }) {
          assert.equal(where.muscleGroupId, 'mg_chest')
          return 2
        },
      },
    },
  })

  const response = await app.inject({
    method: 'DELETE',
    url: '/api/admin/muscle-groups/mg_chest',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_admin_muscle_groups_delete_conflict',
      'x-test-clerk-role': 'admin',
    },
  })

  assert.equal(response.statusCode, 409)
  assert.deepEqual(response.json(), {
    message: 'Muscle group cannot be removed while it is associated with exercises.',
    code: 'MUSCLE_GROUP_IN_USE',
    statusCode: 409,
  })

  await app.close()
})

test('buildApp deletes muscle groups through DELETE /api/admin/muscle-groups/:muscleGroupId with 204', async () => {
  setTestEnv()

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      muscleGroup: {
        async findMany() {
          throw new Error('findMany should not run during successful delete')
        },
        async findUnique({
          where,
        }: {
          where: { id: string }
          select: Record<string, unknown>
        }) {
          assert.equal(where.id, 'mg_back')

          return {
            id: 'mg_back',
            name: 'Back',
            slug: 'back',
            createdAt: new Date('2026-04-06T20:00:00.000Z'),
            updatedAt: new Date('2026-04-06T20:00:00.000Z'),
          }
        },
        async delete({
          where,
        }: {
          where: { id: string }
        }) {
          assert.equal(where.id, 'mg_back')
          return { id: 'mg_back' }
        },
      },
      exerciseMuscleGroup: {
        async count({
          where,
        }: {
          where: { muscleGroupId: string }
        }) {
          assert.equal(where.muscleGroupId, 'mg_back')
          return 0
        },
      },
    },
  })

  const response = await app.inject({
    method: 'DELETE',
    url: '/api/admin/muscle-groups/mg_back',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_admin_muscle_groups_delete_success',
      'x-test-clerk-role': 'admin',
    },
  })

  assert.equal(response.statusCode, 204)
  assert.equal(response.body, '')

  await app.close()
})

test('buildApp lists exercises with muscle groups, name search and muscle group filter', async () => {
  setTestEnv()

  const app = buildApp()
  await app.ready()

  const allExercises = [
    {
      id: 'ex_bench',
      name: 'Bench Press',
      slug: 'bench-press',
      muscleGroups: [
        { muscleGroup: { id: 'mg_chest', name: 'Chest', slug: 'chest' } },
        { muscleGroup: { id: 'mg_triceps', name: 'Triceps', slug: 'triceps' } },
      ],
    },
    {
      id: 'ex_pullup',
      name: 'Pull-Up',
      slug: 'pull-up',
      muscleGroups: [
        { muscleGroup: { id: 'mg_back', name: 'Back', slug: 'back' } },
        { muscleGroup: { id: 'mg_biceps', name: 'Biceps', slug: 'biceps' } },
      ],
    },
  ]

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      exercise: {
        async findMany({
          where,
        }: {
          where?: {
            name?: { contains: string; mode: 'insensitive' }
            muscleGroups?: {
              some: {
                muscleGroupId: string
              }
            }
          }
        }) {
          const search = where?.name?.contains?.toLowerCase() ?? null
          const muscleGroupId = where?.muscleGroups?.some.muscleGroupId ?? null

          return allExercises.filter((exercise) => {
            const matchesSearch = search ? exercise.name.toLowerCase().includes(search) : true
            const matchesMuscleGroup = muscleGroupId
              ? exercise.muscleGroups.some(({ muscleGroup }) => muscleGroup.id === muscleGroupId)
              : true

            return matchesSearch && matchesMuscleGroup
          })
        },
      },
    },
  })

  const filteredResponse = await app.inject({
    method: 'GET',
    url: '/api/exercises?search=pull&muscleGroupId=mg_back',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_catalog_2',
    },
  })

  assert.equal(filteredResponse.statusCode, 200)
  assert.deepEqual(filteredResponse.json(), [
    {
      id: 'ex_pullup',
      name: 'Pull-Up',
      slug: 'pull-up',
      muscleGroups: [
        { id: 'mg_back', name: 'Back', slug: 'back' },
        { id: 'mg_biceps', name: 'Biceps', slug: 'biceps' },
      ],
    },
  ])

  const emptyResponse = await app.inject({
    method: 'GET',
    url: '/api/exercises?search=squat',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_catalog_2',
    },
  })

  assert.equal(emptyResponse.statusCode, 200)
  assert.deepEqual(emptyResponse.json(), [])

  await app.close()
})

test('buildApp rejects invalid GET /api/exercises querystrings with the normalized validation format', async () => {
  setTestEnv()

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      exercise: {
        async findMany() {
          throw new Error('exercise.findMany should not run for invalid querystrings')
        },
      },
    },
  })

  const response = await app.inject({
    method: 'GET',
    url: '/api/exercises?search=',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_catalog_3',
    },
  })

  assert.equal(response.statusCode, 400)
  assert.deepEqual(response.json(), {
    message: 'Request validation failed.',
    code: 'VALIDATION_ERROR',
    statusCode: 400,
    details: {
      issues: [
        {
          path: 'search',
          message: 'must NOT have fewer than 1 characters',
        },
      ],
    },
  })

  await app.close()
})

test('buildApp allows administrators to list exercises through GET /api/admin/exercises', async () => {
  setTestEnv()

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      exercise: {
        async findMany() {
          return [
            {
              id: 'ex_bench',
              name: 'Bench Press',
              slug: 'bench-press',
              createdAt: new Date('2026-04-06T20:20:00.000Z'),
              updatedAt: new Date('2026-04-06T20:25:00.000Z'),
              muscleGroups: [
                { muscleGroup: { id: 'mg_chest', name: 'Chest', slug: 'chest' } },
                { muscleGroup: { id: 'mg_triceps', name: 'Triceps', slug: 'triceps' } },
              ],
            },
          ]
        },
      },
    },
  })

  const response = await app.inject({
    method: 'GET',
    url: '/api/admin/exercises',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_admin_exercises_list',
      'x-test-clerk-role': 'admin',
    },
  })

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), [
    {
      id: 'ex_bench',
      name: 'Bench Press',
      slug: 'bench-press',
      muscleGroups: [
        { id: 'mg_chest', name: 'Chest', slug: 'chest' },
        { id: 'mg_triceps', name: 'Triceps', slug: 'triceps' },
      ],
      createdAt: '2026-04-06T20:20:00.000Z',
      updatedAt: '2026-04-06T20:25:00.000Z',
    },
  ])

  await app.close()
})

test('buildApp blocks non-admin users from GET /api/admin/exercises', async () => {
  setTestEnv()

  const app = buildApp()

  const response = await app.inject({
    method: 'GET',
    url: '/api/admin/exercises',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_non_admin_exercises_list',
    },
  })

  assert.equal(response.statusCode, 403)
  assert.deepEqual(response.json(), {
    message: 'Administrator access is required.',
    code: 'FORBIDDEN',
    statusCode: 403,
  })

  await app.close()
})

test('buildApp creates exercises through POST /api/admin/exercises with normalized slug and plural muscle groups', async () => {
  setTestEnv()

  const app = buildApp()
  await app.ready()

  const fakePrismaState = {
    createdExercise: null as null | { id: string; name: string; slug: string },
    syncedMuscleGroupIds: [] as string[],
  }

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      async $transaction<T>(callback: (transactionClient: unknown) => Promise<T>) {
        return callback(this as unknown)
      },
      exercise: {
        async create({
          data,
        }: {
          data: { name: string; slug: string }
          select: Record<string, unknown>
        }) {
          fakePrismaState.createdExercise = {
            id: 'ex_incline_press',
            name: data.name,
            slug: data.slug,
          }

          return { id: 'ex_incline_press' }
        },
        async findUniqueOrThrow({
          where,
        }: {
          where: { id: string }
          select: Record<string, unknown>
        }) {
          assert.equal(where.id, 'ex_incline_press')

          return {
            id: 'ex_incline_press',
            name: fakePrismaState.createdExercise?.name ?? 'Incline Press',
            slug: fakePrismaState.createdExercise?.slug ?? 'incline-press',
            createdAt: new Date('2026-04-06T20:30:00.000Z'),
            updatedAt: new Date('2026-04-06T20:30:00.000Z'),
            muscleGroups: fakePrismaState.syncedMuscleGroupIds.map((muscleGroupId) => ({
              muscleGroup: {
                id: muscleGroupId,
                name: muscleGroupId === 'mg_chest' ? 'Chest' : 'Shoulders',
                slug: muscleGroupId === 'mg_chest' ? 'chest' : 'shoulders',
              },
            })),
          }
        },
      },
      muscleGroup: {
        async count({
          where,
        }: {
          where: { id: { in: string[] } }
        }) {
          assert.deepEqual(where.id.in, ['mg_chest', 'mg_shoulders'])
          return 2
        },
      },
      exerciseMuscleGroup: {
        async deleteMany({
          where,
        }: {
          where: { exerciseId: string }
        }) {
          assert.equal(where.exerciseId, 'ex_incline_press')
          return { count: 0 }
        },
        async createMany({
          data,
        }: {
          data: Array<{ exerciseId: string; muscleGroupId: string }>
        }) {
          fakePrismaState.syncedMuscleGroupIds = data.map((entry) => entry.muscleGroupId)
          assert.deepEqual(data, [
            { exerciseId: 'ex_incline_press', muscleGroupId: 'mg_chest' },
            { exerciseId: 'ex_incline_press', muscleGroupId: 'mg_shoulders' },
          ])
          return { count: data.length }
        },
      },
      workoutItem: {
        async count() {
          throw new Error('workoutItem.count should not run during create')
        },
      },
      workoutSessionItem: {
        async count() {
          throw new Error('workoutSessionItem.count should not run during create')
        },
      },
    },
  })

  const response = await app.inject({
    method: 'POST',
    url: '/api/admin/exercises',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_admin_exercises_create',
      'x-test-clerk-role': 'admin',
    },
    payload: {
      name: 'Incline Press',
      muscleGroupIds: ['mg_chest', 'mg_shoulders'],
    },
  })

  assert.equal(response.statusCode, 201)
  assert.deepEqual(response.json(), {
    id: 'ex_incline_press',
    name: 'Incline Press',
    slug: 'incline-press',
    muscleGroups: [
      { id: 'mg_chest', name: 'Chest', slug: 'chest' },
      { id: 'mg_shoulders', name: 'Shoulders', slug: 'shoulders' },
    ],
    createdAt: '2026-04-06T20:30:00.000Z',
    updatedAt: '2026-04-06T20:30:00.000Z',
  })

  await app.close()
})

test('buildApp rejects duplicate muscleGroupIds when creating admin exercises', async () => {
  setTestEnv()

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {},
  })

  const response = await app.inject({
    method: 'POST',
    url: '/api/admin/exercises',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_admin_exercises_validation',
      'x-test-clerk-role': 'admin',
    },
    payload: {
      name: 'Bench Press',
      muscleGroupIds: ['mg_chest', 'mg_chest'],
    },
  })

  assert.equal(response.statusCode, 400)
  assert.deepEqual(response.json(), {
    message: 'Request validation failed.',
    code: 'VALIDATION_ERROR',
    statusCode: 400,
    details: {
      issues: [
        {
          path: 'muscleGroupIds',
          message: 'Duplicate muscle groups are not allowed for the same exercise.',
        },
      ],
    },
  })

  await app.close()
})

test('buildApp returns 400 when creating admin exercises with unknown muscle groups', async () => {
  setTestEnv()

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      muscleGroup: {
        async count({
          where,
        }: {
          where: { id: { in: string[] } }
        }) {
          assert.deepEqual(where.id.in, ['mg_chest', 'mg_missing'])
          return 1
        },
      },
    },
  })

  const response = await app.inject({
    method: 'POST',
    url: '/api/admin/exercises',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_admin_exercises_missing_group',
      'x-test-clerk-role': 'admin',
    },
    payload: {
      name: 'Bench Press',
      muscleGroupIds: ['mg_chest', 'mg_missing'],
    },
  })

  assert.equal(response.statusCode, 400)
  assert.deepEqual(response.json(), {
    message: 'One or more informed muscle groups do not exist.',
    code: 'MUSCLE_GROUP_NOT_FOUND',
    statusCode: 400,
  })

  await app.close()
})

test('buildApp updates exercises through PATCH /api/admin/exercises/:exerciseId and replaces muscle group associations', async () => {
  setTestEnv()

  const app = buildApp()
  await app.ready()

  const fakePrismaState = {
    syncedMuscleGroupIds: ['mg_chest'],
  }

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      async $transaction<T>(callback: (transactionClient: unknown) => Promise<T>) {
        return callback(this as unknown)
      },
      exercise: {
        async findMany() {
          throw new Error('findMany should not run during update')
        },
        async findUnique({
          where,
        }: {
          where: { id: string }
          select: Record<string, unknown>
        }) {
          assert.equal(where.id, 'ex_bench')

          return {
            id: 'ex_bench',
            name: 'Bench Press',
            slug: 'bench-press',
            createdAt: new Date('2026-04-06T20:00:00.000Z'),
            updatedAt: new Date('2026-04-06T20:00:00.000Z'),
            muscleGroups: [
              { muscleGroup: { id: 'mg_chest', name: 'Chest', slug: 'chest' } },
            ],
          }
        },
        async update({
          where,
          data,
        }: {
          where: { id: string }
          data: { name?: string; slug?: string }
          select: Record<string, unknown>
        }) {
          assert.equal(where.id, 'ex_bench')
          assert.deepEqual(data, {
            name: 'Bench Press Machine',
            slug: 'bench-press-machine',
          })

          return { id: 'ex_bench' }
        },
        async findUniqueOrThrow({
          where,
        }: {
          where: { id: string }
          select: Record<string, unknown>
        }) {
          assert.equal(where.id, 'ex_bench')

          return {
            id: 'ex_bench',
            name: 'Bench Press Machine',
            slug: 'bench-press-machine',
            createdAt: new Date('2026-04-06T20:00:00.000Z'),
            updatedAt: new Date('2026-04-06T20:40:00.000Z'),
            muscleGroups: fakePrismaState.syncedMuscleGroupIds.map((muscleGroupId) => ({
              muscleGroup: {
                id: muscleGroupId,
                name: muscleGroupId === 'mg_chest' ? 'Chest' : 'Triceps',
                slug: muscleGroupId === 'mg_chest' ? 'chest' : 'triceps',
              },
            })),
          }
        },
      },
      muscleGroup: {
        async count({
          where,
        }: {
          where: { id: { in: string[] } }
        }) {
          assert.deepEqual(where.id.in, ['mg_chest', 'mg_triceps'])
          return 2
        },
      },
      exerciseMuscleGroup: {
        async deleteMany({
          where,
        }: {
          where: { exerciseId: string }
        }) {
          assert.equal(where.exerciseId, 'ex_bench')
          fakePrismaState.syncedMuscleGroupIds = []
          return { count: 1 }
        },
        async createMany({
          data,
        }: {
          data: Array<{ exerciseId: string; muscleGroupId: string }>
        }) {
          fakePrismaState.syncedMuscleGroupIds = data.map((entry) => entry.muscleGroupId)
          assert.deepEqual(data, [
            { exerciseId: 'ex_bench', muscleGroupId: 'mg_chest' },
            { exerciseId: 'ex_bench', muscleGroupId: 'mg_triceps' },
          ])
          return { count: data.length }
        },
      },
      workoutItem: {
        async count() {
          throw new Error('workoutItem.count should not run during update')
        },
      },
      workoutSessionItem: {
        async count() {
          throw new Error('workoutSessionItem.count should not run during update')
        },
      },
    },
  })

  const response = await app.inject({
    method: 'PATCH',
    url: '/api/admin/exercises/ex_bench',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_admin_exercises_update',
      'x-test-clerk-role': 'admin',
    },
    payload: {
      name: 'Bench Press Machine',
      muscleGroupIds: ['mg_chest', 'mg_triceps'],
    },
  })

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), {
    id: 'ex_bench',
    name: 'Bench Press Machine',
    slug: 'bench-press-machine',
    muscleGroups: [
      { id: 'mg_chest', name: 'Chest', slug: 'chest' },
      { id: 'mg_triceps', name: 'Triceps', slug: 'triceps' },
    ],
    createdAt: '2026-04-06T20:00:00.000Z',
    updatedAt: '2026-04-06T20:40:00.000Z',
  })

  await app.close()
})

test('buildApp returns a normalized conflict when creating an admin exercise with duplicate slug', async () => {
  setTestEnv()

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      async $transaction() {
        throw new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed on the fields: (`slug`)',
          {
            code: 'P2002',
            clientVersion: '7.6.0',
            meta: {
              target: ['slug'],
            },
          },
        )
      },
      muscleGroup: {
        async count() {
          return 1
        },
      },
    },
  })

  const response = await app.inject({
    method: 'POST',
    url: '/api/admin/exercises',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_admin_exercises_duplicate_slug',
      'x-test-clerk-role': 'admin',
    },
    payload: {
      name: 'Bench Press',
      muscleGroupIds: ['mg_chest'],
    },
  })

  assert.equal(response.statusCode, 409)
  assert.deepEqual(response.json(), {
    message: 'An exercise with this slug already exists.',
    code: 'EXERCISE_SLUG_CONFLICT',
    statusCode: 409,
  })

  await app.close()
})

test('buildApp blocks DELETE /api/admin/exercises/:exerciseId when the exercise is in operational use', async () => {
  setTestEnv()

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      exercise: {
        async findMany() {
          throw new Error('findMany should not run during delete conflict')
        },
        async findUnique({
          where,
        }: {
          where: { id: string }
          select: Record<string, unknown>
        }) {
          assert.equal(where.id, 'ex_bench')

          return {
            id: 'ex_bench',
            name: 'Bench Press',
            slug: 'bench-press',
            createdAt: new Date('2026-04-06T20:00:00.000Z'),
            updatedAt: new Date('2026-04-06T20:00:00.000Z'),
            muscleGroups: [
              { muscleGroup: { id: 'mg_chest', name: 'Chest', slug: 'chest' } },
            ],
          }
        },
        async delete() {
          throw new Error('delete should not run while exercise is referenced')
        },
      },
      muscleGroup: {
        async count() {
          throw new Error('muscleGroup.count should not run during delete')
        },
      },
      exerciseMuscleGroup: {
        async deleteMany() {
          throw new Error('exerciseMuscleGroup.deleteMany should not run during delete')
        },
        async createMany() {
          throw new Error('exerciseMuscleGroup.createMany should not run during delete')
        },
      },
      workoutItem: {
        async count({
          where,
        }: {
          where: { exerciseId: string }
        }) {
          assert.equal(where.exerciseId, 'ex_bench')
          return 1
        },
      },
      workoutSessionItem: {
        async count({
          where,
        }: {
          where: { exerciseId: string }
        }) {
          assert.equal(where.exerciseId, 'ex_bench')
          return 0
        },
      },
    },
  })

  const response = await app.inject({
    method: 'DELETE',
    url: '/api/admin/exercises/ex_bench',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_admin_exercises_delete_conflict',
      'x-test-clerk-role': 'admin',
    },
  })

  assert.equal(response.statusCode, 409)
  assert.deepEqual(response.json(), {
    message: 'Exercise cannot be removed while it is referenced by workouts or workout history.',
    code: 'EXERCISE_IN_USE',
    statusCode: 409,
  })

  await app.close()
})

test('buildApp deletes admin exercises through DELETE /api/admin/exercises/:exerciseId with 204', async () => {
  setTestEnv()

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      exercise: {
        async findMany() {
          throw new Error('findMany should not run during successful delete')
        },
        async findUnique({
          where,
        }: {
          where: { id: string }
          select: Record<string, unknown>
        }) {
          assert.equal(where.id, 'ex_pullup')

          return {
            id: 'ex_pullup',
            name: 'Pull-Up',
            slug: 'pull-up',
            createdAt: new Date('2026-04-06T20:00:00.000Z'),
            updatedAt: new Date('2026-04-06T20:00:00.000Z'),
            muscleGroups: [
              { muscleGroup: { id: 'mg_back', name: 'Back', slug: 'back' } },
            ],
          }
        },
        async delete({
          where,
        }: {
          where: { id: string }
        }) {
          assert.equal(where.id, 'ex_pullup')
          return { id: 'ex_pullup' }
        },
      },
      muscleGroup: {
        async count() {
          throw new Error('muscleGroup.count should not run during delete')
        },
      },
      exerciseMuscleGroup: {
        async deleteMany() {
          throw new Error('exerciseMuscleGroup.deleteMany should not run during delete')
        },
        async createMany() {
          throw new Error('exerciseMuscleGroup.createMany should not run during delete')
        },
      },
      workoutItem: {
        async count({
          where,
        }: {
          where: { exerciseId: string }
        }) {
          assert.equal(where.exerciseId, 'ex_pullup')
          return 0
        },
      },
      workoutSessionItem: {
        async count({
          where,
        }: {
          where: { exerciseId: string }
        }) {
          assert.equal(where.exerciseId, 'ex_pullup')
          return 0
        },
      },
    },
  })

  const response = await app.inject({
    method: 'DELETE',
    url: '/api/admin/exercises/ex_pullup',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_admin_exercises_delete_success',
      'x-test-clerk-role': 'admin',
    },
  })

  assert.equal(response.statusCode, 204)
  assert.equal(response.body, '')

  await app.close()
})

test('buildApp creates workouts and returns the created resource in camelCase', async () => {
  setTestEnv()

  type FakePersistedUser = {
    id: string
    clerkUserId: string
    email: string | null
    firstName: string | null
    lastName: string | null
    imageUrl: string | null
    profile: {
      displayName: string | null
      dateOfBirth: Date | null
      heightCm: number | null
      weightKg: number | null
    }
  }

  const users = new Map<string, FakePersistedUser>()
  let workoutCounter = 0

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      async $transaction<T>(callback: (transactionClient: unknown) => Promise<T>) {
        return callback(this as unknown)
      },
      user: {
        async upsert({
          where,
          create,
          update,
        }: {
          where: { clerkUserId: string }
          create: {
            clerkUserId: string
            email: string | null
            firstName: string | null
            lastName: string | null
            imageUrl: string | null
            profile: { create: Record<string, never> }
          }
          update: {
            email: string | null
            firstName: string | null
            lastName: string | null
            imageUrl: string | null
          }
        }) {
          const existing = users.get(where.clerkUserId)

          if (existing) {
            const updatedUser = {
              ...existing,
              email: update.email,
              firstName: update.firstName,
              lastName: update.lastName,
              imageUrl: update.imageUrl,
            }
            users.set(where.clerkUserId, updatedUser)
            return updatedUser
          }

          const createdUser = {
            id: `user_${users.size + 1}`,
            clerkUserId: create.clerkUserId,
            email: create.email,
            firstName: create.firstName,
            lastName: create.lastName,
            imageUrl: create.imageUrl,
            profile: {
              displayName: null,
              dateOfBirth: null,
              heightCm: null,
              weightKg: null,
            },
          }
          users.set(where.clerkUserId, createdUser)
          return createdUser
        },
      },
      workout: {
        async create({
          data,
        }: {
          data: {
            userId: string
            name: string
          }
          select: {
            id: true
            name: true
            createdAt: true
            updatedAt: true
          }
        }) {
          const timestamp = new Date('2026-04-06T12:00:00.000Z')
          workoutCounter += 1

          return {
            id: `workout_${workoutCounter}`,
            name: data.name,
            createdAt: timestamp,
            updatedAt: timestamp,
          }
        },
      },
    },
  })

  const response = await app.inject({
    method: 'POST',
    url: '/api/workouts',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_workout_create',
      'x-test-clerk-email': 'workout-create@example.com',
    },
    payload: {
      name: '  Push Day  ',
    },
  })

  assert.equal(response.statusCode, 201)
  assert.deepEqual(response.json(), {
    id: 'workout_1',
    name: 'Push Day',
    createdAt: '2026-04-06T12:00:00.000Z',
    updatedAt: '2026-04-06T12:00:00.000Z',
  })

  await app.close()
})

test('buildApp lists and reads workouts scoped to the authenticated user ordered by updatedAt desc', async () => {
  setTestEnv()

  type FakePersistedUser = {
    id: string
    clerkUserId: string
    email: string | null
    firstName: string | null
    lastName: string | null
    imageUrl: string | null
    profile: {
      displayName: string | null
      dateOfBirth: Date | null
      heightCm: number | null
      weightKg: number | null
    }
  }

  const users = new Map<string, FakePersistedUser>([
    [
      'clerk_user_workout_list',
      {
        id: 'user_workout_list',
        clerkUserId: 'clerk_user_workout_list',
        email: 'list@example.com',
        firstName: null,
        lastName: null,
        imageUrl: null,
        profile: {
          displayName: null,
          dateOfBirth: null,
          heightCm: null,
          weightKg: null,
        },
      },
    ],
    [
      'clerk_user_other',
      {
        id: 'user_other',
        clerkUserId: 'clerk_user_other',
        email: 'other@example.com',
        firstName: null,
        lastName: null,
        imageUrl: null,
        profile: {
          displayName: null,
          dateOfBirth: null,
          heightCm: null,
          weightKg: null,
        },
      },
    ],
  ])

  const workouts = [
    {
      id: 'workout_newer',
      userId: 'user_workout_list',
      name: 'Upper A',
      createdAt: new Date('2026-04-01T12:00:00.000Z'),
      updatedAt: new Date('2026-04-06T12:00:00.000Z'),
    },
    {
      id: 'workout_older',
      userId: 'user_workout_list',
      name: 'Lower B',
      createdAt: new Date('2026-04-02T12:00:00.000Z'),
      updatedAt: new Date('2026-04-03T12:00:00.000Z'),
    },
    {
      id: 'workout_other_user',
      userId: 'user_other',
      name: 'Other User Workout',
      createdAt: new Date('2026-04-03T12:00:00.000Z'),
      updatedAt: new Date('2026-04-05T12:00:00.000Z'),
    },
  ]

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      user: {
        async upsert({
          where,
        }: {
          where: { clerkUserId: string }
          create: {
            clerkUserId: string
            email: string | null
            firstName: string | null
            lastName: string | null
            imageUrl: string | null
            profile: { create: Record<string, never> }
          }
          update: {
            email: string | null
            firstName: string | null
            lastName: string | null
            imageUrl: string | null
          }
        }) {
          const user = users.get(where.clerkUserId)

          if (!user) {
            throw new Error(`Missing fake user for ${where.clerkUserId}`)
          }

          return user
        },
      },
      workout: {
        async findMany({
          where,
        }: {
          where: {
            userId: string
          }
          orderBy: Array<{ updatedAt: 'asc' | 'desc' }>
          select: {
            id: true
            name: true
            createdAt: true
            updatedAt: true
          }
        }) {
          return workouts
            .filter((workout) => workout.userId === where.userId)
            .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
            .map(({ id, name, createdAt, updatedAt }) => ({ id, name, createdAt, updatedAt }))
        },
        async findFirst({
          where,
        }: {
          where: {
            id: string
            userId: string
          }
          select: Record<string, unknown>
        }) {
          const workout = workouts.find(
            (candidate) => candidate.id === where.id && candidate.userId === where.userId,
          )

          return workout
            ? {
                id: workout.id,
                name: workout.name,
                createdAt: workout.createdAt,
                updatedAt: workout.updatedAt,
                items: [],
              }
            : null
        },
      },
    },
  })

  const listResponse = await app.inject({
    method: 'GET',
    url: '/api/workouts',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_workout_list',
    },
  })

  assert.equal(listResponse.statusCode, 200)
  assert.deepEqual(listResponse.json(), [
    {
      id: 'workout_newer',
      name: 'Upper A',
      createdAt: '2026-04-01T12:00:00.000Z',
      updatedAt: '2026-04-06T12:00:00.000Z',
    },
    {
      id: 'workout_older',
      name: 'Lower B',
      createdAt: '2026-04-02T12:00:00.000Z',
      updatedAt: '2026-04-03T12:00:00.000Z',
    },
  ])

  const getResponse = await app.inject({
    method: 'GET',
    url: '/api/workouts/workout_newer',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_workout_list',
    },
  })

  assert.equal(getResponse.statusCode, 200)
  assert.deepEqual(getResponse.json(), {
    id: 'workout_newer',
    name: 'Upper A',
    createdAt: '2026-04-01T12:00:00.000Z',
    updatedAt: '2026-04-06T12:00:00.000Z',
    items: [],
  })

  await app.close()
})

test('buildApp updates and deletes workouts scoped to the authenticated user', async () => {
  setTestEnv()

  type FakePersistedUser = {
    id: string
    clerkUserId: string
    email: string | null
    firstName: string | null
    lastName: string | null
    imageUrl: string | null
    profile: {
      displayName: string | null
      dateOfBirth: Date | null
      heightCm: number | null
      weightKg: number | null
    }
  }

  const users = new Map<string, FakePersistedUser>([
    [
      'clerk_user_workout_edit',
      {
        id: 'user_workout_edit',
        clerkUserId: 'clerk_user_workout_edit',
        email: null,
        firstName: null,
        lastName: null,
        imageUrl: null,
        profile: {
          displayName: null,
          dateOfBirth: null,
          heightCm: null,
          weightKg: null,
        },
      },
    ],
  ])

  const workouts = new Map([
    [
      'workout_editable',
      {
        id: 'workout_editable',
        userId: 'user_workout_edit',
        name: 'Old Name',
        createdAt: new Date('2026-04-01T12:00:00.000Z'),
        updatedAt: new Date('2026-04-01T12:00:00.000Z'),
      },
    ],
  ])

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      user: {
        async upsert({
          where,
        }: {
          where: { clerkUserId: string }
          create: {
            clerkUserId: string
            email: string | null
            firstName: string | null
            lastName: string | null
            imageUrl: string | null
            profile: { create: Record<string, never> }
          }
          update: {
            email: string | null
            firstName: string | null
            lastName: string | null
            imageUrl: string | null
          }
        }) {
          const user = users.get(where.clerkUserId)

          if (!user) {
            throw new Error(`Missing fake user for ${where.clerkUserId}`)
          }

          return user
        },
      },
      workout: {
        async count({
          where,
        }: {
          where: {
            id: string
            userId: string
          }
        }) {
          const workout = workouts.get(where.id)

          return workout && workout.userId === where.userId ? 1 : 0
        },
        async findFirst({
          where,
        }: {
          where: {
            id: string
            userId: string
          }
          select: Record<string, unknown>
        }) {
          const workout = workouts.get(where.id)

          if (!workout || workout.userId !== where.userId) {
            return null
          }

          return {
            id: workout.id,
            name: workout.name,
            createdAt: workout.createdAt,
            updatedAt: workout.updatedAt,
            items: [],
          }
        },
        async updateMany({
          where,
          data,
        }: {
          where: {
            id: string
            userId: string
          }
          data: {
            name?: string
          }
        }) {
          const workout = workouts.get(where.id)

          if (!workout || workout.userId !== where.userId) {
            return { count: 0 }
          }

          workouts.set(where.id, {
            ...workout,
            ...(data.name === undefined ? {} : { name: data.name }),
            updatedAt: new Date('2026-04-06T13:00:00.000Z'),
          })

          return { count: 1 }
        },
        async deleteMany({
          where,
        }: {
          where: {
            id: string
            userId: string
          }
        }) {
          const workout = workouts.get(where.id)

          if (!workout || workout.userId !== where.userId) {
            return { count: 0 }
          }

          workouts.delete(where.id)
          return { count: 1 }
        },
      },
    },
  })

  const patchResponse = await app.inject({
    method: 'PATCH',
    url: '/api/workouts/workout_editable',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_workout_edit',
    },
    payload: {
      name: 'New Name',
    },
  })

  assert.equal(patchResponse.statusCode, 200)
  assert.deepEqual(patchResponse.json(), {
    id: 'workout_editable',
    name: 'New Name',
    createdAt: '2026-04-01T12:00:00.000Z',
    updatedAt: '2026-04-06T13:00:00.000Z',
  })

  const deleteResponse = await app.inject({
    method: 'DELETE',
    url: '/api/workouts/workout_editable',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_workout_edit',
    },
  })

  assert.equal(deleteResponse.statusCode, 204)
  assert.equal(deleteResponse.body, '')

  const getAfterDeleteResponse = await app.inject({
    method: 'GET',
    url: '/api/workouts/workout_editable',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_workout_edit',
    },
  })

  assert.equal(getAfterDeleteResponse.statusCode, 404)
  assert.deepEqual(getAfterDeleteResponse.json(), {
    message: 'Workout not found.',
    code: 'WORKOUT_NOT_FOUND',
    statusCode: 404,
  })

  await app.close()
})

test('buildApp does not expose workouts from another user and normalizes invalid workout payloads', async () => {
  setTestEnv()

  type FakePersistedUser = {
    id: string
    clerkUserId: string
    email: string | null
    firstName: string | null
    lastName: string | null
    imageUrl: string | null
    profile: {
      displayName: string | null
      dateOfBirth: Date | null
      heightCm: number | null
      weightKg: number | null
    }
  }

  const users = new Map<string, FakePersistedUser>([
    [
      'clerk_user_owner',
      {
        id: 'user_owner',
        clerkUserId: 'clerk_user_owner',
        email: null,
        firstName: null,
        lastName: null,
        imageUrl: null,
        profile: {
          displayName: null,
          dateOfBirth: null,
          heightCm: null,
          weightKg: null,
        },
      },
    ],
    [
      'clerk_user_intruder',
      {
        id: 'user_intruder',
        clerkUserId: 'clerk_user_intruder',
        email: null,
        firstName: null,
        lastName: null,
        imageUrl: null,
        profile: {
          displayName: null,
          dateOfBirth: null,
          heightCm: null,
          weightKg: null,
        },
      },
    ],
  ])

  const workouts = [
    {
      id: 'workout_private',
      userId: 'user_owner',
      name: 'Private Workout',
      createdAt: new Date('2026-04-01T12:00:00.000Z'),
      updatedAt: new Date('2026-04-05T12:00:00.000Z'),
    },
  ]

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      async $transaction<T>(callback: (transactionClient: unknown) => Promise<T>) {
        return callback(this as unknown)
      },
      user: {
        async upsert({
          where,
        }: {
          where: { clerkUserId: string }
          create: {
            clerkUserId: string
            email: string | null
            firstName: string | null
            lastName: string | null
            imageUrl: string | null
            profile: { create: Record<string, never> }
          }
          update: {
            email: string | null
            firstName: string | null
            lastName: string | null
            imageUrl: string | null
          }
        }) {
          const user = users.get(where.clerkUserId)

          if (!user) {
            throw new Error(`Missing fake user for ${where.clerkUserId}`)
          }

          return user
        },
      },
      workout: {
        async count({
          where,
        }: {
          where: {
            id: string
            userId: string
          }
        }) {
          const workout = workouts.find(
            (candidate) => candidate.id === where.id && candidate.userId === where.userId,
          )

          return workout && workout.userId === where.userId ? 1 : 0
        },
        async findFirst({
          where,
        }: {
          where: {
            id: string
            userId: string
          }
          select: Record<string, unknown>
        }) {
          const workout = workouts.find(
            (candidate) => candidate.id === where.id && candidate.userId === where.userId,
          )

          return workout
            ? {
                id: workout.id,
                name: workout.name,
                createdAt: workout.createdAt,
                updatedAt: workout.updatedAt,
                items: [],
              }
            : null
        },
        async create() {
          throw new Error('workout.create should not run for invalid payloads')
        },
      },
    },
  })

  const forbiddenLookupResponse = await app.inject({
    method: 'GET',
    url: '/api/workouts/workout_private',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_intruder',
    },
  })

  assert.equal(forbiddenLookupResponse.statusCode, 404)
  assert.deepEqual(forbiddenLookupResponse.json(), {
    message: 'Workout not found.',
    code: 'WORKOUT_NOT_FOUND',
    statusCode: 404,
  })

  const invalidCreateResponse = await app.inject({
    method: 'POST',
    url: '/api/workouts',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_owner',
    },
    payload: {
      name: '',
    },
  })

  assert.equal(invalidCreateResponse.statusCode, 400)
  assert.deepEqual(invalidCreateResponse.json(), {
    message: 'Request validation failed.',
    code: 'VALIDATION_ERROR',
    statusCode: 400,
    details: {
      issues: [
        {
          path: 'name',
          message: 'must NOT have fewer than 1 characters',
        },
      ],
    },
  })

  await app.close()
})

test('buildApp manages workout items with ordered detail responses and duplicate exercises', async () => {
  setTestEnv()

  type FakePersistedUser = {
    id: string
    clerkUserId: string
    email: string | null
    firstName: string | null
    lastName: string | null
    imageUrl: string | null
    profile: {
      displayName: string | null
      dateOfBirth: Date | null
      heightCm: number | null
      weightKg: number | null
    }
  }

  type FakeExercise = {
    id: string
    name: string
    slug: string
    muscleGroups: Array<{
      muscleGroup: {
        id: string
        name: string
        slug: string
      }
    }>
  }

  type FakeWorkout = {
    id: string
    userId: string
    name: string
    createdAt: Date
    updatedAt: Date
  }

  type FakeWorkoutItem = {
    id: string
    workoutId: string
    exerciseId: string
    sets: number
    reps: number
    loadKg: number
    restSeconds: number
    position: number
    createdAt: Date
    updatedAt: Date
  }

  const users = new Map<string, FakePersistedUser>([
    [
      'clerk_user_items_owner',
      {
        id: 'user_items_owner',
        clerkUserId: 'clerk_user_items_owner',
        email: null,
        firstName: null,
        lastName: null,
        imageUrl: null,
        profile: {
          displayName: null,
          dateOfBirth: null,
          heightCm: null,
          weightKg: null,
        },
      },
    ],
  ])

  const exercises = new Map<string, FakeExercise>([
    [
      'exercise_bench_press',
      {
        id: 'exercise_bench_press',
        name: 'Bench Press',
        slug: 'bench-press',
        muscleGroups: [
          {
            muscleGroup: {
              id: 'mg_chest',
              name: 'Chest',
              slug: 'chest',
            },
          },
          {
            muscleGroup: {
              id: 'mg_triceps',
              name: 'Triceps',
              slug: 'triceps',
            },
          },
        ],
      },
    ],
  ])

  const workouts = new Map<string, FakeWorkout>([
    [
      'workout_push_day',
      {
        id: 'workout_push_day',
        userId: 'user_items_owner',
        name: 'Push Day',
        createdAt: new Date('2026-04-06T10:00:00.000Z'),
        updatedAt: new Date('2026-04-06T10:00:00.000Z'),
      },
    ],
  ])

  const workoutItems = new Map<string, FakeWorkoutItem>()
  let workoutItemCounter = 0

  function toWorkoutDetail(workout: FakeWorkout) {
    return {
      id: workout.id,
      name: workout.name,
      createdAt: workout.createdAt,
      updatedAt: workout.updatedAt,
      items: Array.from(workoutItems.values())
        .filter((item) => item.workoutId === workout.id)
        .sort((left, right) => left.position - right.position)
        .map((item) => ({
          id: item.id,
          exerciseId: item.exerciseId,
          sets: item.sets,
          reps: item.reps,
          loadKg: item.loadKg,
          restSeconds: item.restSeconds,
          position: item.position,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          exercise: exercises.get(item.exerciseId)!,
        })),
    }
  }

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      user: {
        async upsert({
          where,
        }: {
          where: { clerkUserId: string }
          create: {
            clerkUserId: string
            email: string | null
            firstName: string | null
            lastName: string | null
            imageUrl: string | null
            profile: { create: Record<string, never> }
          }
          update: {
            email: string | null
            firstName: string | null
            lastName: string | null
            imageUrl: string | null
          }
        }) {
          const user = users.get(where.clerkUserId)

          if (!user) {
            throw new Error(`Missing fake user for ${where.clerkUserId}`)
          }

          return user
        },
      },
      workout: {
        async count({
          where,
        }: {
          where: {
            id: string
            userId: string
          }
        }) {
          const workout = workouts.get(where.id)

          return workout && workout.userId === where.userId ? 1 : 0
        },
        async findFirst({
          where,
        }: {
          where: {
            id: string
            userId: string
          }
          select: Record<string, unknown>
        }) {
          const workout = workouts.get(where.id)

          if (!workout || workout.userId !== where.userId) {
            return null
          }

          return toWorkoutDetail(workout)
        },
      },
      exercise: {
        async count({
          where,
        }: {
          where: { id: string }
        }) {
          return exercises.has(where.id) ? 1 : 0
        },
      },
      workoutItem: {
        async findMany({
          where,
          orderBy,
          take,
        }: {
          where: { workoutId: string }
          orderBy: Array<{ position: 'asc' | 'desc' }>
          take?: number
          select:
            | { position: true }
            | Record<string, unknown>
        }) {
          const items = Array.from(workoutItems.values())
            .filter((item) => item.workoutId === where.workoutId)
            .sort((left, right) =>
              orderBy[0]?.position === 'desc'
                ? right.position - left.position
                : left.position - right.position,
            )

          return (take ? items.slice(0, take) : items).map((item) => ({ position: item.position }))
        },
        async create({
          data,
        }: {
          data: {
            workoutId: string
            exerciseId: string
            sets: number
            reps: number
            loadKg: number
            restSeconds: number
            position: number
          }
          select: Record<string, unknown>
        }) {
          workoutItemCounter += 1
          const timestamp = new Date(`2026-04-06T10:0${workoutItemCounter}:00.000Z`)
          const createdItem: FakeWorkoutItem = {
            id: `workout_item_${workoutItemCounter}`,
            workoutId: data.workoutId,
            exerciseId: data.exerciseId,
            sets: data.sets,
            reps: data.reps,
            loadKg: data.loadKg,
            restSeconds: data.restSeconds,
            position: data.position,
            createdAt: timestamp,
            updatedAt: timestamp,
          }

          workoutItems.set(createdItem.id, createdItem)

          return {
            ...createdItem,
            exercise: exercises.get(createdItem.exerciseId)!,
          }
        },
        async findFirst({
          where,
        }: {
          where: {
            id: string
            workoutId: string
            workout: { userId: string }
          }
          select: { id: true }
        }) {
          const item = workoutItems.get(where.id)
          const workout = item ? workouts.get(item.workoutId) : null

          if (!item || !workout || item.workoutId !== where.workoutId || workout.userId !== where.workout.userId) {
            return null
          }

          return { id: item.id }
        },
        async update({
          where,
          data,
        }: {
          where: { id: string }
          data: {
            sets?: number
            reps?: number
            loadKg?: number
            restSeconds?: number
          }
          select: Record<string, unknown>
        }) {
          const item = workoutItems.get(where.id)

          if (!item) {
            throw new Error(`Missing workout item ${where.id}`)
          }

          const updatedItem: FakeWorkoutItem = {
            ...item,
            ...(data.sets === undefined ? {} : { sets: data.sets }),
            ...(data.reps === undefined ? {} : { reps: data.reps }),
            ...(data.loadKg === undefined ? {} : { loadKg: data.loadKg }),
            ...(data.restSeconds === undefined ? {} : { restSeconds: data.restSeconds }),
            updatedAt: new Date('2026-04-06T10:30:00.000Z'),
          }

          workoutItems.set(where.id, updatedItem)

          return {
            ...updatedItem,
            exercise: exercises.get(updatedItem.exerciseId)!,
          }
        },
        async deleteMany({
          where,
        }: {
          where: {
            id: string
            workoutId: string
            workout: { userId: string }
          }
        }) {
          const item = workoutItems.get(where.id)
          const workout = item ? workouts.get(item.workoutId) : null

          if (!item || !workout || item.workoutId !== where.workoutId || workout.userId !== where.workout.userId) {
            return { count: 0 }
          }

          workoutItems.delete(where.id)
          return { count: 1 }
        },
      },
    },
  })

  const createFirstItemResponse = await app.inject({
    method: 'POST',
    url: '/api/workouts/workout_push_day/items',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_items_owner',
    },
    payload: {
      exerciseId: 'exercise_bench_press',
      sets: 4,
      reps: 10,
      loadKg: 60,
      restSeconds: 90,
    },
  })

  assert.equal(createFirstItemResponse.statusCode, 201)
  assert.deepEqual(createFirstItemResponse.json(), {
    id: 'workout_item_1',
    exerciseId: 'exercise_bench_press',
    sets: 4,
    reps: 10,
    loadKg: 60,
    restSeconds: 90,
    position: 0,
    createdAt: '2026-04-06T10:01:00.000Z',
    updatedAt: '2026-04-06T10:01:00.000Z',
    exercise: {
      id: 'exercise_bench_press',
      name: 'Bench Press',
      slug: 'bench-press',
      muscleGroups: [
        { id: 'mg_chest', name: 'Chest', slug: 'chest' },
        { id: 'mg_triceps', name: 'Triceps', slug: 'triceps' },
      ],
    },
  })

  const createSecondItemResponse = await app.inject({
    method: 'POST',
    url: '/api/workouts/workout_push_day/items',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_items_owner',
    },
    payload: {
      exerciseId: 'exercise_bench_press',
      sets: 3,
      reps: 12,
      loadKg: 40,
      restSeconds: 60,
    },
  })

  assert.equal(createSecondItemResponse.statusCode, 201)
  assert.deepEqual(createSecondItemResponse.json(), {
    id: 'workout_item_2',
    exerciseId: 'exercise_bench_press',
    sets: 3,
    reps: 12,
    loadKg: 40,
    restSeconds: 60,
    position: 1,
    createdAt: '2026-04-06T10:02:00.000Z',
    updatedAt: '2026-04-06T10:02:00.000Z',
    exercise: {
      id: 'exercise_bench_press',
      name: 'Bench Press',
      slug: 'bench-press',
      muscleGroups: [
        { id: 'mg_chest', name: 'Chest', slug: 'chest' },
        { id: 'mg_triceps', name: 'Triceps', slug: 'triceps' },
      ],
    },
  })

  const patchItemResponse = await app.inject({
    method: 'PATCH',
    url: '/api/workouts/workout_push_day/items/workout_item_1',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_items_owner',
    },
    payload: {
      loadKg: 62.5,
      restSeconds: 120,
    },
  })

  assert.equal(patchItemResponse.statusCode, 200)
  assert.deepEqual(patchItemResponse.json(), {
    id: 'workout_item_1',
    exerciseId: 'exercise_bench_press',
    sets: 4,
    reps: 10,
    loadKg: 62.5,
    restSeconds: 120,
    position: 0,
    createdAt: '2026-04-06T10:01:00.000Z',
    updatedAt: '2026-04-06T10:30:00.000Z',
    exercise: {
      id: 'exercise_bench_press',
      name: 'Bench Press',
      slug: 'bench-press',
      muscleGroups: [
        { id: 'mg_chest', name: 'Chest', slug: 'chest' },
        { id: 'mg_triceps', name: 'Triceps', slug: 'triceps' },
      ],
    },
  })

  const getWorkoutResponse = await app.inject({
    method: 'GET',
    url: '/api/workouts/workout_push_day',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_items_owner',
    },
  })

  assert.equal(getWorkoutResponse.statusCode, 200)
  assert.deepEqual(getWorkoutResponse.json(), {
    id: 'workout_push_day',
    name: 'Push Day',
    createdAt: '2026-04-06T10:00:00.000Z',
    updatedAt: '2026-04-06T10:00:00.000Z',
    items: [
      {
        id: 'workout_item_1',
        exerciseId: 'exercise_bench_press',
        sets: 4,
        reps: 10,
        loadKg: 62.5,
        restSeconds: 120,
        position: 0,
        createdAt: '2026-04-06T10:01:00.000Z',
        updatedAt: '2026-04-06T10:30:00.000Z',
        exercise: {
          id: 'exercise_bench_press',
          name: 'Bench Press',
          slug: 'bench-press',
          muscleGroups: [
            { id: 'mg_chest', name: 'Chest', slug: 'chest' },
            { id: 'mg_triceps', name: 'Triceps', slug: 'triceps' },
          ],
        },
      },
      {
        id: 'workout_item_2',
        exerciseId: 'exercise_bench_press',
        sets: 3,
        reps: 12,
        loadKg: 40,
        restSeconds: 60,
        position: 1,
        createdAt: '2026-04-06T10:02:00.000Z',
        updatedAt: '2026-04-06T10:02:00.000Z',
        exercise: {
          id: 'exercise_bench_press',
          name: 'Bench Press',
          slug: 'bench-press',
          muscleGroups: [
            { id: 'mg_chest', name: 'Chest', slug: 'chest' },
            { id: 'mg_triceps', name: 'Triceps', slug: 'triceps' },
          ],
        },
      },
    ],
  })

  const deleteItemResponse = await app.inject({
    method: 'DELETE',
    url: '/api/workouts/workout_push_day/items/workout_item_2',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_items_owner',
    },
  })

  assert.equal(deleteItemResponse.statusCode, 204)
  assert.equal(deleteItemResponse.body, '')

  const getAfterDeleteResponse = await app.inject({
    method: 'GET',
    url: '/api/workouts/workout_push_day',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_items_owner',
    },
  })

  assert.equal(getAfterDeleteResponse.statusCode, 200)
  assert.equal(getAfterDeleteResponse.json().items.length, 1)
  assert.equal(getAfterDeleteResponse.json().items[0].id, 'workout_item_1')

  await app.close()
})

test('buildApp enforces workout item ownership and normalizes invalid workout item payloads', async () => {
  setTestEnv()

  type FakePersistedUser = {
    id: string
    clerkUserId: string
    email: string | null
    firstName: string | null
    lastName: string | null
    imageUrl: string | null
    profile: {
      displayName: string | null
      dateOfBirth: Date | null
      heightCm: number | null
      weightKg: number | null
    }
  }

  const users = new Map<string, FakePersistedUser>([
    [
      'clerk_user_item_owner',
      {
        id: 'user_item_owner',
        clerkUserId: 'clerk_user_item_owner',
        email: null,
        firstName: null,
        lastName: null,
        imageUrl: null,
        profile: {
          displayName: null,
          dateOfBirth: null,
          heightCm: null,
          weightKg: null,
        },
      },
    ],
    [
      'clerk_user_item_intruder',
      {
        id: 'user_item_intruder',
        clerkUserId: 'clerk_user_item_intruder',
        email: null,
        firstName: null,
        lastName: null,
        imageUrl: null,
        profile: {
          displayName: null,
          dateOfBirth: null,
          heightCm: null,
          weightKg: null,
        },
      },
    ],
  ])

  const workouts = new Map([
    [
      'workout_private_items',
      {
        id: 'workout_private_items',
        userId: 'user_item_owner',
        name: 'Private Items Workout',
        createdAt: new Date('2026-04-06T09:00:00.000Z'),
        updatedAt: new Date('2026-04-06T09:00:00.000Z'),
      },
    ],
  ])

  const workoutItems = new Map([
    [
      'workout_item_private',
      {
        id: 'workout_item_private',
        workoutId: 'workout_private_items',
        exerciseId: 'exercise_existing',
        sets: 3,
        reps: 8,
        loadKg: 80,
        restSeconds: 120,
        position: 0,
        createdAt: new Date('2026-04-06T09:05:00.000Z'),
        updatedAt: new Date('2026-04-06T09:05:00.000Z'),
      },
    ],
  ])

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      async $transaction<T>(fn: (tx: unknown) => Promise<T>) {
        return fn(this as unknown)
      },
      user: {
        async upsert({
          where,
        }: {
          where: { clerkUserId: string }
          create: {
            clerkUserId: string
            email: string | null
            firstName: string | null
            lastName: string | null
            imageUrl: string | null
            profile: { create: Record<string, never> }
          }
          update: {
            email: string | null
            firstName: string | null
            lastName: string | null
            imageUrl: string | null
          }
        }) {
          const user = users.get(where.clerkUserId)

          if (!user) {
            throw new Error(`Missing fake user for ${where.clerkUserId}`)
          }

          return user
        },
      },
      workout: {
        async count({
          where,
        }: {
          where: { id: string; userId: string }
        }) {
          const workout = workouts.get(where.id)
          return workout && workout.userId === where.userId ? 1 : 0
        },
        async findFirst({
          where,
        }: {
          where: { id: string; userId: string }
          select: Record<string, unknown>
        }) {
          const workout = workouts.get(where.id)

          if (!workout || workout.userId !== where.userId) {
            return null
          }

          return {
            ...workout,
            items: [],
          }
        },
      },
      exercise: {
        async count({
          where,
        }: {
          where: { id: string }
        }) {
          return where.id === 'exercise_existing' ? 1 : 0
        },
      },
      workoutItem: {
        async findMany() {
          return []
        },
        async create() {
          throw new Error('workoutItem.create should not run for invalid exercise or payload')
        },
        async findFirst({
          where,
        }: {
          where: {
            id: string
            workoutId: string
            workout: { userId: string }
          }
          select: { id: true }
        }) {
          const item = workoutItems.get(where.id)
          const workout = item ? workouts.get(item.workoutId) : null

          if (!item || !workout || item.workoutId !== where.workoutId || workout.userId !== where.workout.userId) {
            return null
          }

          return { id: item.id }
        },
        async update() {
          throw new Error('workoutItem.update should not run for unauthorized updates')
        },
        async deleteMany({
          where,
        }: {
          where: {
            id: string
            workoutId: string
            workout: { userId: string }
          }
        }) {
          const item = workoutItems.get(where.id)
          const workout = item ? workouts.get(item.workoutId) : null

          if (!item || !workout || item.workoutId !== where.workoutId || workout.userId !== where.workout.userId) {
            return { count: 0 }
          }

          workoutItems.delete(where.id)
          return { count: 1 }
        },
      },
    },
  })

  const foreignWorkoutResponse = await app.inject({
    method: 'POST',
    url: '/api/workouts/workout_private_items/items',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_item_intruder',
    },
    payload: {
      exerciseId: 'exercise_existing',
      sets: 4,
      reps: 8,
      loadKg: 50,
      restSeconds: 90,
    },
  })

  assert.equal(foreignWorkoutResponse.statusCode, 404)
  assert.deepEqual(foreignWorkoutResponse.json(), {
    message: 'Workout not found.',
    code: 'WORKOUT_NOT_FOUND',
    statusCode: 404,
  })

  const missingExerciseResponse = await app.inject({
    method: 'POST',
    url: '/api/workouts/workout_private_items/items',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_item_owner',
    },
    payload: {
      exerciseId: 'exercise_missing',
      sets: 4,
      reps: 8,
      loadKg: 50,
      restSeconds: 90,
    },
  })

  assert.equal(missingExerciseResponse.statusCode, 400)
  assert.deepEqual(missingExerciseResponse.json(), {
    message: 'Exercise not found.',
    code: 'EXERCISE_NOT_FOUND',
    statusCode: 400,
  })

  const invalidPayloadResponse = await app.inject({
    method: 'POST',
    url: '/api/workouts/workout_private_items/items',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_item_owner',
    },
    payload: {
      exerciseId: 'exercise_existing',
      sets: 0,
      reps: 8,
      loadKg: 50,
      restSeconds: 90,
    },
  })

  assert.equal(invalidPayloadResponse.statusCode, 400)
  assert.deepEqual(invalidPayloadResponse.json(), {
    message: 'Request validation failed.',
    code: 'VALIDATION_ERROR',
    statusCode: 400,
    details: {
      issues: [
        {
          path: 'sets',
          message: 'must be >= 1',
        },
      ],
    },
  })

  const forbiddenItemPatchResponse = await app.inject({
    method: 'PATCH',
    url: '/api/workouts/workout_private_items/items/workout_item_private',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_item_intruder',
    },
    payload: {
      reps: 10,
    },
  })

  assert.equal(forbiddenItemPatchResponse.statusCode, 404)
  assert.deepEqual(forbiddenItemPatchResponse.json(), {
    message: 'Workout item not found.',
    code: 'WORKOUT_ITEM_NOT_FOUND',
    statusCode: 404,
  })

  await app.close()
})

test('buildApp reorders workout items atomically and rejects invalid item orders', async () => {
  setTestEnv()

  type FakePersistedUser = {
    id: string
    clerkUserId: string
    email: string | null
    firstName: string | null
    lastName: string | null
    imageUrl: string | null
    profile: {
      displayName: string | null
      dateOfBirth: Date | null
      heightCm: number | null
      weightKg: number | null
    }
  }

  type FakeWorkout = {
    id: string
    userId: string
    name: string
    createdAt: Date
    updatedAt: Date
  }

  type FakeWorkoutItem = {
    id: string
    workoutId: string
    exerciseId: string
    sets: number
    reps: number
    loadKg: number
    restSeconds: number
    position: number
    createdAt: Date
    updatedAt: Date
  }

  const users = new Map<string, FakePersistedUser>([
    [
      'clerk_user_reorder_owner',
      {
        id: 'user_reorder_owner',
        clerkUserId: 'clerk_user_reorder_owner',
        email: null,
        firstName: null,
        lastName: null,
        imageUrl: null,
        profile: {
          displayName: null,
          dateOfBirth: null,
          heightCm: null,
          weightKg: null,
        },
      },
    ],
  ])

  const exercises = new Map([
    [
      'exercise_bench_press',
      {
        id: 'exercise_bench_press',
        name: 'Bench Press',
        slug: 'bench-press',
        muscleGroups: [
          {
            muscleGroup: {
              id: 'mg_chest',
              name: 'Chest',
              slug: 'chest',
            },
          },
        ],
      },
    ],
    [
      'exercise_row',
      {
        id: 'exercise_row',
        name: 'Seated Row',
        slug: 'seated-row',
        muscleGroups: [
          {
            muscleGroup: {
              id: 'mg_back',
              name: 'Back',
              slug: 'back',
            },
          },
        ],
      },
    ],
    [
      'exercise_shoulder_press',
      {
        id: 'exercise_shoulder_press',
        name: 'Shoulder Press',
        slug: 'shoulder-press',
        muscleGroups: [
          {
            muscleGroup: {
              id: 'mg_shoulders',
              name: 'Shoulders',
              slug: 'shoulders',
            },
          },
        ],
      },
    ],
  ])

  const workouts = new Map<string, FakeWorkout>([
    [
      'workout_reorder',
      {
        id: 'workout_reorder',
        userId: 'user_reorder_owner',
        name: 'Reorder Workout',
        createdAt: new Date('2026-04-06T11:00:00.000Z'),
        updatedAt: new Date('2026-04-06T11:00:00.000Z'),
      },
    ],
  ])

  const workoutItems = new Map<string, FakeWorkoutItem>([
    [
      'workout_item_1',
      {
        id: 'workout_item_1',
        workoutId: 'workout_reorder',
        exerciseId: 'exercise_bench_press',
        sets: 4,
        reps: 10,
        loadKg: 60,
        restSeconds: 90,
        position: 0,
        createdAt: new Date('2026-04-06T11:01:00.000Z'),
        updatedAt: new Date('2026-04-06T11:01:00.000Z'),
      },
    ],
    [
      'workout_item_2',
      {
        id: 'workout_item_2',
        workoutId: 'workout_reorder',
        exerciseId: 'exercise_row',
        sets: 4,
        reps: 12,
        loadKg: 55,
        restSeconds: 90,
        position: 1,
        createdAt: new Date('2026-04-06T11:02:00.000Z'),
        updatedAt: new Date('2026-04-06T11:02:00.000Z'),
      },
    ],
    [
      'workout_item_3',
      {
        id: 'workout_item_3',
        workoutId: 'workout_reorder',
        exerciseId: 'exercise_shoulder_press',
        sets: 3,
        reps: 12,
        loadKg: 25,
        restSeconds: 60,
        position: 2,
        createdAt: new Date('2026-04-06T11:03:00.000Z'),
        updatedAt: new Date('2026-04-06T11:03:00.000Z'),
      },
    ],
  ])

  function toWorkoutDetail(workout: FakeWorkout) {
    return {
      id: workout.id,
      name: workout.name,
      createdAt: workout.createdAt,
      updatedAt: workout.updatedAt,
      items: Array.from(workoutItems.values())
        .filter((item) => item.workoutId === workout.id)
        .sort((left, right) => left.position - right.position)
        .map((item) => ({
          id: item.id,
          exerciseId: item.exerciseId,
          sets: item.sets,
          reps: item.reps,
          loadKg: item.loadKg,
          restSeconds: item.restSeconds,
          position: item.position,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          exercise: exercises.get(item.exerciseId)!,
        })),
    }
  }

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      async $transaction<T>(fn: (tx: unknown) => Promise<T>) {
        return fn({
          workoutItem: this.workoutItem,
        })
      },
      user: {
        async upsert({
          where,
        }: {
          where: { clerkUserId: string }
          create: {
            clerkUserId: string
            email: string | null
            firstName: string | null
            lastName: string | null
            imageUrl: string | null
            profile: { create: Record<string, never> }
          }
          update: {
            email: string | null
            firstName: string | null
            lastName: string | null
            imageUrl: string | null
          }
        }) {
          const user = users.get(where.clerkUserId)

          if (!user) {
            throw new Error(`Missing fake user for ${where.clerkUserId}`)
          }

          return user
        },
      },
      workout: {
        async create() {
          throw new Error('workout.create should not run in reorder tests')
        },
        async findMany() {
          throw new Error('workout.findMany should not run in reorder tests')
        },
        async count({
          where,
        }: {
          where: { id: string; userId: string }
        }) {
          const workout = workouts.get(where.id)
          return workout && workout.userId === where.userId ? 1 : 0
        },
        async findFirst({
          where,
        }: {
          where: { id: string; userId: string }
          select: Record<string, unknown>
        }) {
          const workout = workouts.get(where.id)

          if (!workout || workout.userId !== where.userId) {
            return null
          }

          return toWorkoutDetail(workout)
        },
        async updateMany() {
          throw new Error('workout.updateMany should not run in reorder tests')
        },
        async deleteMany() {
          throw new Error('workout.deleteMany should not run in reorder tests')
        },
      },
      exercise: {
        async count() {
          throw new Error('exercise.count should not run in reorder tests')
        },
      },
      workoutItem: {
        async findMany({
          where,
          orderBy,
          take,
          select,
        }: {
          where: { workoutId: string }
          orderBy: Array<{ position: 'asc' | 'desc' }>
          take?: number
          select: Record<string, unknown>
        }) {
          const items = Array.from(workoutItems.values())
            .filter((item) => item.workoutId === where.workoutId)
            .sort((left, right) =>
              orderBy[0]?.position === 'desc'
                ? right.position - left.position
                : left.position - right.position,
            )

          const selectedItems = take ? items.slice(0, take) : items

          if ('id' in select) {
            return selectedItems.map((item) => ({
              id: item.id,
              position: item.position,
            }))
          }

          return selectedItems.map((item) => ({
            position: item.position,
          }))
        },
        async create() {
          throw new Error('workoutItem.create should not run in reorder tests')
        },
        async update({
          where,
          data,
          select,
        }: {
          where: { id: string }
          data: { position?: number; sets?: number; reps?: number; loadKg?: number; restSeconds?: number }
          select: Record<string, unknown>
        }) {
          const item = workoutItems.get(where.id)

          if (!item) {
            throw new Error(`Missing workout item ${where.id}`)
          }

          const updatedItem = {
            ...item,
            ...(data.position === undefined ? {} : { position: data.position }),
            ...(data.sets === undefined ? {} : { sets: data.sets }),
            ...(data.reps === undefined ? {} : { reps: data.reps }),
            ...(data.loadKg === undefined ? {} : { loadKg: data.loadKg }),
            ...(data.restSeconds === undefined ? {} : { restSeconds: data.restSeconds }),
          }

          workoutItems.set(where.id, updatedItem)

          if ('exercise' in select) {
            return {
              ...updatedItem,
              exercise: exercises.get(updatedItem.exerciseId)!,
            }
          }

          return {
            position: updatedItem.position,
          }
        },
        async findFirst() {
          throw new Error('workoutItem.findFirst should not run in reorder tests')
        },
        async deleteMany() {
          throw new Error('workoutItem.deleteMany should not run in reorder tests')
        },
      },
    },
  })

  const reorderResponse = await app.inject({
    method: 'PATCH',
    url: '/api/workouts/workout_reorder/items/reorder',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_reorder_owner',
    },
    payload: {
      itemIdsInOrder: ['workout_item_3', 'workout_item_1', 'workout_item_2'],
    },
  })

  assert.equal(reorderResponse.statusCode, 200)
  assert.deepEqual(
    reorderResponse.json().items.map((item: { id: string; position: number }) => ({
      id: item.id,
      position: item.position,
    })),
    [
      { id: 'workout_item_3', position: 0 },
      { id: 'workout_item_1', position: 1 },
      { id: 'workout_item_2', position: 2 },
    ],
  )

  const getWorkoutResponse = await app.inject({
    method: 'GET',
    url: '/api/workouts/workout_reorder',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_reorder_owner',
    },
  })

  assert.equal(getWorkoutResponse.statusCode, 200)
  assert.deepEqual(
    getWorkoutResponse.json().items.map((item: { id: string; position: number }) => ({
      id: item.id,
      position: item.position,
    })),
    [
      { id: 'workout_item_3', position: 0 },
      { id: 'workout_item_1', position: 1 },
      { id: 'workout_item_2', position: 2 },
    ],
  )

  const invalidReorderResponse = await app.inject({
    method: 'PATCH',
    url: '/api/workouts/workout_reorder/items/reorder',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_reorder_owner',
    },
    payload: {
      itemIdsInOrder: ['workout_item_1', 'workout_item_2'],
    },
  })

  assert.equal(invalidReorderResponse.statusCode, 400)
  assert.deepEqual(invalidReorderResponse.json(), {
    message: 'Workout item order is invalid.',
    code: 'INVALID_WORKOUT_ITEM_ORDER',
    statusCode: 400,
  })

  await app.close()
})

test('buildApp replaces and returns normalized weekly planning for the authenticated user', async () => {
  setTestEnv()

  type FakePersistedUser = {
    id: string
    clerkUserId: string
    email: string | null
    firstName: string | null
    lastName: string | null
    imageUrl: string | null
    profile: {
      displayName: string | null
      dateOfBirth: Date | null
      heightCm: number | null
      weightKg: number | null
    }
  }

  type FakeWorkout = {
    id: string
    userId: string
    name: string
    createdAt: Date
    updatedAt: Date
  }

  type FakePlanningDay = {
    id: string
    userId: string
    workoutId: string
    dayOfWeek: string
  }

  const users = new Map<string, FakePersistedUser>([
    [
      'clerk_user_planning_owner',
      {
        id: 'user_planning_owner',
        clerkUserId: 'clerk_user_planning_owner',
        email: null,
        firstName: null,
        lastName: null,
        imageUrl: null,
        profile: {
          displayName: null,
          dateOfBirth: null,
          heightCm: null,
          weightKg: null,
        },
      },
    ],
    [
      'clerk_user_planning_intruder',
      {
        id: 'user_planning_intruder',
        clerkUserId: 'clerk_user_planning_intruder',
        email: null,
        firstName: null,
        lastName: null,
        imageUrl: null,
        profile: {
          displayName: null,
          dateOfBirth: null,
          heightCm: null,
          weightKg: null,
        },
      },
    ],
  ])

  const workouts = new Map<string, FakeWorkout>([
    [
      'workout_upper',
      {
        id: 'workout_upper',
        userId: 'user_planning_owner',
        name: 'Upper Body',
        createdAt: new Date('2026-04-06T12:00:00.000Z'),
        updatedAt: new Date('2026-04-06T12:00:00.000Z'),
      },
    ],
    [
      'workout_legs',
      {
        id: 'workout_legs',
        userId: 'user_planning_owner',
        name: 'Leg Day',
        createdAt: new Date('2026-04-06T12:05:00.000Z'),
        updatedAt: new Date('2026-04-06T12:05:00.000Z'),
      },
    ],
    [
      'workout_foreign',
      {
        id: 'workout_foreign',
        userId: 'user_planning_intruder',
        name: 'Foreign Workout',
        createdAt: new Date('2026-04-06T12:10:00.000Z'),
        updatedAt: new Date('2026-04-06T12:10:00.000Z'),
      },
    ],
  ])

  const planningDays = new Map<string, FakePlanningDay>()
  let planningCounter = 0

  function listPlanningByUserId(userId: string) {
    return Array.from(planningDays.values())
      .filter((day) => day.userId === userId)
      .map((day) => ({
        dayOfWeek: day.dayOfWeek,
        workout: workouts.get(day.workoutId)!,
      }))
  }

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      async $transaction<T>(fn: (tx: unknown) => Promise<T>) {
        return fn({
          weeklyPlanningDay: this.weeklyPlanningDay,
        })
      },
      user: {
        async upsert({
          where,
        }: {
          where: { clerkUserId: string }
          create: {
            clerkUserId: string
            email: string | null
            firstName: string | null
            lastName: string | null
            imageUrl: string | null
            profile: { create: Record<string, never> }
          }
          update: {
            email: string | null
            firstName: string | null
            lastName: string | null
            imageUrl: string | null
          }
        }) {
          const user = users.get(where.clerkUserId)

          if (!user) {
            throw new Error(`Missing fake user for ${where.clerkUserId}`)
          }

          return user
        },
      },
      workout: {
        async findMany({
          where,
          orderBy,
        }: {
          where: { userId: string; id?: { in: string[] } }
          orderBy?: Array<{ updatedAt: 'asc' | 'desc' }>
          select: Record<string, unknown>
        }) {
          if (where.id) {
            return where.id.in
              .map((id) => workouts.get(id))
              .filter((workout): workout is FakeWorkout => workout !== undefined && workout.userId === where.userId)
              .map((workout) => ({
                id: workout.id,
              }))
          }

          return Array.from(workouts.values())
            .filter((workout) => workout.userId === where.userId)
            .sort((left, right) =>
              orderBy?.[0]?.updatedAt === 'asc'
                ? left.updatedAt.getTime() - right.updatedAt.getTime()
                : right.updatedAt.getTime() - left.updatedAt.getTime(),
            )
            .map((workout) => ({
              id: workout.id,
              name: workout.name,
              createdAt: workout.createdAt,
              updatedAt: workout.updatedAt,
            }))
        },
      },
      weeklyPlanningDay: {
        async findMany({
          where,
        }: {
          where: { userId: string }
          select: Record<string, unknown>
        }) {
          return listPlanningByUserId(where.userId)
        },
        async deleteMany({
          where,
        }: {
          where: { userId: string }
        }) {
          let deleted = 0

          for (const [id, planningDay] of planningDays.entries()) {
            if (planningDay.userId === where.userId) {
              planningDays.delete(id)
              deleted += 1
            }
          }

          return { count: deleted }
        },
        async create({
          data,
        }: {
          data: {
            userId: string
            workoutId: string
            dayOfWeek: string
          }
        }) {
          planningCounter += 1
          const id = `planning_day_${planningCounter}`

          planningDays.set(id, {
            id,
            userId: data.userId,
            workoutId: data.workoutId,
            dayOfWeek: data.dayOfWeek,
          })

          return { id }
        },
      },
    },
  })

  const getEmptyWeekResponse = await app.inject({
    method: 'GET',
    url: '/api/planning/week',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_planning_owner',
    },
  })

  assert.equal(getEmptyWeekResponse.statusCode, 200)
  assert.equal(getEmptyWeekResponse.json().days.length, 7)
  assert.ok(getEmptyWeekResponse.json().days.every((day: { workout: unknown }) => day.workout === null))

  const putWeekResponse = await app.inject({
    method: 'PUT',
    url: '/api/planning/week',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_planning_owner',
    },
    payload: {
      days: [
        { dayOfWeek: 'monday', workoutId: 'workout_upper' },
        { dayOfWeek: 'tuesday', workoutId: null },
        { dayOfWeek: 'wednesday', workoutId: 'workout_legs' },
        { dayOfWeek: 'thursday', workoutId: null },
        { dayOfWeek: 'friday', workoutId: 'workout_upper' },
        { dayOfWeek: 'saturday', workoutId: null },
        { dayOfWeek: 'sunday', workoutId: null },
      ],
    },
  })

  assert.equal(putWeekResponse.statusCode, 200)
  assert.deepEqual(
    putWeekResponse.json().days.map((day: { dayOfWeek: string; workout: { id: string } | null }) => ({
      dayOfWeek: day.dayOfWeek,
      workoutId: day.workout?.id ?? null,
    })),
    [
      { dayOfWeek: 'monday', workoutId: 'workout_upper' },
      { dayOfWeek: 'tuesday', workoutId: null },
      { dayOfWeek: 'wednesday', workoutId: 'workout_legs' },
      { dayOfWeek: 'thursday', workoutId: null },
      { dayOfWeek: 'friday', workoutId: 'workout_upper' },
      { dayOfWeek: 'saturday', workoutId: null },
      { dayOfWeek: 'sunday', workoutId: null },
    ],
  )

  const getWeekResponse = await app.inject({
    method: 'GET',
    url: '/api/planning/week',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_planning_owner',
    },
  })

  assert.equal(getWeekResponse.statusCode, 200)
  assert.deepEqual(
    getWeekResponse.json().days.map((day: { dayOfWeek: string; workout: { id: string } | null }) => ({
      dayOfWeek: day.dayOfWeek,
      workoutId: day.workout?.id ?? null,
    })),
    [
      { dayOfWeek: 'monday', workoutId: 'workout_upper' },
      { dayOfWeek: 'tuesday', workoutId: null },
      { dayOfWeek: 'wednesday', workoutId: 'workout_legs' },
      { dayOfWeek: 'thursday', workoutId: null },
      { dayOfWeek: 'friday', workoutId: 'workout_upper' },
      { dayOfWeek: 'saturday', workoutId: null },
      { dayOfWeek: 'sunday', workoutId: null },
    ],
  )

  const foreignWorkoutResponse = await app.inject({
    method: 'PUT',
    url: '/api/planning/week',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_planning_owner',
    },
    payload: {
      days: [
        { dayOfWeek: 'monday', workoutId: 'workout_foreign' },
        { dayOfWeek: 'tuesday', workoutId: null },
        { dayOfWeek: 'wednesday', workoutId: null },
        { dayOfWeek: 'thursday', workoutId: null },
        { dayOfWeek: 'friday', workoutId: null },
        { dayOfWeek: 'saturday', workoutId: null },
        { dayOfWeek: 'sunday', workoutId: null },
      ],
    },
  })

  assert.equal(foreignWorkoutResponse.statusCode, 404)
  assert.deepEqual(foreignWorkoutResponse.json(), {
    message: 'Workout not found.',
    code: 'WORKOUT_NOT_FOUND',
    statusCode: 404,
  })

  await app.close()
})

test('buildApp returns today planning with deterministic server date and manual workout options', async () => {
  setTestEnv()

  type FakePersistedUser = {
    id: string
    clerkUserId: string
    email: string | null
    firstName: string | null
    lastName: string | null
    imageUrl: string | null
    profile: {
      displayName: string | null
      dateOfBirth: Date | null
      heightCm: number | null
      weightKg: number | null
    }
  }

  type FakeWorkout = {
    id: string
    userId: string
    name: string
    createdAt: Date
    updatedAt: Date
  }

  const users = new Map<string, FakePersistedUser>([
    [
      'clerk_user_today_owner',
      {
        id: 'user_today_owner',
        clerkUserId: 'clerk_user_today_owner',
        email: null,
        firstName: null,
        lastName: null,
        imageUrl: null,
        profile: {
          displayName: null,
          dateOfBirth: null,
          heightCm: null,
          weightKg: null,
        },
      },
    ],
    [
      'clerk_user_today_intruder',
      {
        id: 'user_today_intruder',
        clerkUserId: 'clerk_user_today_intruder',
        email: null,
        firstName: null,
        lastName: null,
        imageUrl: null,
        profile: {
          displayName: null,
          dateOfBirth: null,
          heightCm: null,
          weightKg: null,
        },
      },
    ],
  ])

  const workouts = new Map<string, FakeWorkout>([
    [
      'workout_push',
      {
        id: 'workout_push',
        userId: 'user_today_owner',
        name: 'Push Day',
        createdAt: new Date('2026-04-04T09:00:00.000Z'),
        updatedAt: new Date('2026-04-05T15:00:00.000Z'),
      },
    ],
    [
      'workout_pull',
      {
        id: 'workout_pull',
        userId: 'user_today_owner',
        name: 'Pull Day',
        createdAt: new Date('2026-04-04T10:00:00.000Z'),
        updatedAt: new Date('2026-04-06T08:00:00.000Z'),
      },
    ],
    [
      'workout_intruder',
      {
        id: 'workout_intruder',
        userId: 'user_today_intruder',
        name: 'Intruder Day',
        createdAt: new Date('2026-04-04T11:00:00.000Z'),
        updatedAt: new Date('2026-04-06T09:00:00.000Z'),
      },
    ],
  ])

  const planningAssignments = [
    {
      dayOfWeek: 'monday',
      workout: workouts.get('workout_pull')!,
    },
    {
      dayOfWeek: 'friday',
      workout: workouts.get('workout_push')!,
    },
  ]

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      user: {
        async upsert({
          where,
        }: {
          where: { clerkUserId: string }
          create: {
            clerkUserId: string
            email: string | null
            firstName: string | null
            lastName: string | null
            imageUrl: string | null
            profile: { create: Record<string, never> }
          }
          update: {
            email: string | null
            firstName: string | null
            lastName: string | null
            imageUrl: string | null
          }
        }) {
          const user = users.get(where.clerkUserId)

          if (!user) {
            throw new Error(`Missing fake user for ${where.clerkUserId}`)
          }

          return user
        },
      },
      workout: {
        async findMany({
          where,
          orderBy,
          select,
        }: {
          where: { userId: string; id?: { in: string[] } }
          orderBy?: Array<{ updatedAt: 'asc' | 'desc' }>
          select: Record<string, unknown>
        }) {
          if (where.id) {
            return where.id.in
              .map((id) => workouts.get(id))
              .filter((workout): workout is FakeWorkout => workout !== undefined && workout.userId === where.userId)
              .map((workout) => ({
                id: workout.id,
              }))
          }

          return Array.from(workouts.values())
            .filter((workout) => workout.userId === where.userId)
            .sort((left, right) =>
              orderBy?.[0]?.updatedAt === 'asc'
                ? left.updatedAt.getTime() - right.updatedAt.getTime()
                : right.updatedAt.getTime() - left.updatedAt.getTime(),
            )
            .map((workout) => ({
              id: workout.id,
              name: workout.name,
              createdAt: workout.createdAt,
              updatedAt: workout.updatedAt,
            }))
        },
      },
      weeklyPlanningDay: {
        async findMany({
          where,
        }: {
          where: { userId: string }
          select: Record<string, unknown>
        }) {
          return where.userId === 'user_today_owner' ? planningAssignments : []
        },
      },
    },
  })

  const RealDate = Date
  class MockDate extends Date {
    constructor(value?: string | number | Date) {
      if (value === undefined) {
        super('2026-04-06T10:30:00')
        return
      }

      super(value)
    }

    static now() {
      return new RealDate('2026-04-06T10:30:00').valueOf()
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).Date = MockDate

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/planning/today',
      headers: {
        'x-test-clerk-user-id': 'clerk_user_today_owner',
      },
    })

    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json(), {
      date: '2026-04-06',
      dayOfWeek: 'monday',
      plannedWorkout: {
        id: 'workout_pull',
        name: 'Pull Day',
        createdAt: '2026-04-04T10:00:00.000Z',
        updatedAt: '2026-04-06T08:00:00.000Z',
      },
      manualWorkoutOptions: [
        {
          id: 'workout_pull',
          name: 'Pull Day',
          createdAt: '2026-04-04T10:00:00.000Z',
          updatedAt: '2026-04-06T08:00:00.000Z',
        },
        {
          id: 'workout_push',
          name: 'Push Day',
          createdAt: '2026-04-04T09:00:00.000Z',
          updatedAt: '2026-04-05T15:00:00.000Z',
        },
      ],
    })
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).Date = RealDate
    await app.close()
  }
})

test('buildApp starts a workout session from an owned workout and returns the persisted snapshot', async () => {
  setTestEnv()

  const users = new Map([
    [
      'clerk_user_session_owner',
      {
        id: 'user_session_owner',
        clerkUserId: 'clerk_user_session_owner',
        email: null,
        firstName: null,
        lastName: null,
        imageUrl: null,
        profile: {
          displayName: null,
          dateOfBirth: null,
          heightCm: null,
          weightKg: null,
        },
      },
    ],
  ])

  const workouts = new Map([
    [
      'workout_session_push',
      {
        id: 'workout_session_push',
        userId: 'user_session_owner',
        name: 'Push Day',
        items: [
          {
            id: 'workout_item_2',
            position: 1,
            sets: 2,
            reps: 10,
            loadKg: 28,
            restSeconds: 90,
            exercise: {
              id: 'exercise_supino',
              name: 'Supino reto',
              slug: 'supino-reto',
            },
          },
          {
            id: 'workout_item_1',
            position: 0,
            sets: 3,
            reps: 12,
            loadKg: 12.5,
            restSeconds: 60,
            exercise: {
              id: 'exercise_crucifixo',
              name: 'Crucifixo',
              slug: 'crucifixo',
            },
          },
        ],
      },
    ],
  ])

  const workoutSessions: Array<{
    id: string
    userId: string
    workoutId: string
    status: 'in_progress' | 'completed'
    startedAt: Date
    completedAt: Date | null
    items: Array<{
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
      setLogs: Array<{
        id: string
        setNumber: number
        status: 'pending' | 'completed'
        plannedReps: number
        plannedLoadKg: number
        actualReps: number | null
        actualLoadKg: number | null
        completedAt: Date | null
      }>
    }>
  }> = []

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      user: {
        async upsert({
          where,
        }: {
          where: { clerkUserId: string }
          create: Record<string, unknown>
          update: Record<string, unknown>
        }) {
          const user = users.get(where.clerkUserId)

          if (!user) {
            throw new Error(`Missing fake user for ${where.clerkUserId}`)
          }

          return user
        },
      },
      workout: {
        async findFirst({
          where,
          select,
        }: {
          where: { id: string; userId: string }
          select: Record<string, unknown>
        }) {
          const workout = workouts.get(where.id)

          if (!workout || workout.userId !== where.userId) {
            return null
          }

          if ('items' in select) {
            return workout
          }

          return {
            id: workout.id,
            name: workout.name,
          }
        },
      },
      workoutSession: {
        async create({
          data,
        }: {
          data: {
            userId: string
            workoutId: string
            status: 'in_progress'
            activeSessionUserId: string
            startedAt?: Date
            items: {
              create: Array<{
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
                  create: Array<{
                    setNumber: number
                    status: 'pending'
                    plannedReps: number
                    plannedLoadKg: number
                  }>
                }
              }>
            }
          }
          select: Record<string, unknown>
        }) {
          const startedAt = data.startedAt ?? new Date('2026-04-06T18:00:00.000Z')
          const session = {
            id: 'workout_session_1',
            userId: data.userId,
            workoutId: data.workoutId,
            status: data.status,
            startedAt,
            completedAt: null,
            items: data.items.create.map((item, itemIndex) => ({
              id: `workout_session_item_${itemIndex + 1}`,
              workoutItemId: item.workoutItemId,
              exerciseId: item.exerciseId,
              exerciseName: item.exerciseName,
              exerciseSlug: item.exerciseSlug,
              plannedSets: item.plannedSets,
              plannedReps: item.plannedReps,
              plannedLoadKg: item.plannedLoadKg,
              plannedRestSeconds: item.plannedRestSeconds,
              position: item.position,
              setLogs: item.setLogs.create.map((setLog, setIndex) => ({
                id: `workout_set_log_${itemIndex + 1}_${setIndex + 1}`,
                setNumber: setLog.setNumber,
                status: setLog.status,
                plannedReps: setLog.plannedReps,
                plannedLoadKg: setLog.plannedLoadKg,
                actualReps: null,
                actualLoadKg: null,
                completedAt: null,
              })),
            })),
          }

          workoutSessions.push(session)
          return session
        },
        async findFirst() {
          return null
        },
      },
    },
  })

  const response = await app.inject({
    method: 'POST',
    url: '/api/workout-sessions',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_session_owner',
    },
    payload: {
      workoutId: 'workout_session_push',
    },
  })

  assert.equal(response.statusCode, 201)
  assert.deepEqual(response.json(), {
    id: 'workout_session_1',
    workoutId: 'workout_session_push',
    status: 'in_progress',
    startedAt: '2026-04-06T18:00:00.000Z',
    completedAt: null,
    workout: {
      id: 'workout_session_push',
      name: 'Push Day',
    },
    items: [
      {
        id: 'workout_session_item_1',
        workoutItemId: 'workout_item_1',
        exerciseId: 'exercise_crucifixo',
        exerciseName: 'Crucifixo',
        exerciseSlug: 'crucifixo',
        plannedSets: 3,
        plannedReps: 12,
        plannedLoadKg: 12.5,
        plannedRestSeconds: 60,
        position: 0,
        setLogs: [
          {
            id: 'workout_set_log_1_1',
            setNumber: 1,
            status: 'pending',
            plannedReps: 12,
            plannedLoadKg: 12.5,
            actualReps: null,
            actualLoadKg: null,
            completedAt: null,
          },
          {
            id: 'workout_set_log_1_2',
            setNumber: 2,
            status: 'pending',
            plannedReps: 12,
            plannedLoadKg: 12.5,
            actualReps: null,
            actualLoadKg: null,
            completedAt: null,
          },
          {
            id: 'workout_set_log_1_3',
            setNumber: 3,
            status: 'pending',
            plannedReps: 12,
            plannedLoadKg: 12.5,
            actualReps: null,
            actualLoadKg: null,
            completedAt: null,
          },
        ],
      },
      {
        id: 'workout_session_item_2',
        workoutItemId: 'workout_item_2',
        exerciseId: 'exercise_supino',
        exerciseName: 'Supino reto',
        exerciseSlug: 'supino-reto',
        plannedSets: 2,
        plannedReps: 10,
        plannedLoadKg: 28,
        plannedRestSeconds: 90,
        position: 1,
        setLogs: [
          {
            id: 'workout_set_log_2_1',
            setNumber: 1,
            status: 'pending',
            plannedReps: 10,
            plannedLoadKg: 28,
            actualReps: null,
            actualLoadKg: null,
            completedAt: null,
          },
          {
            id: 'workout_set_log_2_2',
            setNumber: 2,
            status: 'pending',
            plannedReps: 10,
            plannedLoadKg: 28,
            actualReps: null,
            actualLoadKg: null,
            completedAt: null,
          },
        ],
      },
    ],
  })
  assert.equal(workoutSessions.length, 1)

  await app.close()
})

test('buildApp rejects starting a workout session for an empty workout or a workout from another user', async () => {
  setTestEnv()

  const users = new Map([
    [
      'clerk_user_session_owner_2',
      {
        id: 'user_session_owner_2',
        clerkUserId: 'clerk_user_session_owner_2',
        email: null,
        firstName: null,
        lastName: null,
        imageUrl: null,
        profile: {
          displayName: null,
          dateOfBirth: null,
          heightCm: null,
          weightKg: null,
        },
      },
    ],
  ])

  const workouts = new Map([
    [
      'workout_empty',
      {
        id: 'workout_empty',
        userId: 'user_session_owner_2',
        name: 'Empty Workout',
        items: [],
      },
    ],
  ])

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      user: {
        async upsert({
          where,
        }: {
          where: { clerkUserId: string }
          create: Record<string, unknown>
          update: Record<string, unknown>
        }) {
          return users.get(where.clerkUserId)
        },
      },
      workout: {
        async findFirst({
          where,
          select,
        }: {
          where: { id: string; userId: string }
          select: Record<string, unknown>
        }) {
          const workout = workouts.get(where.id)

          if (!workout || workout.userId !== where.userId) {
            return null
          }

          if ('items' in select) {
            return workout
          }

          return {
            id: workout.id,
            name: workout.name,
          }
        },
      },
      workoutSession: {
        async create() {
          throw new Error('create should not run for invalid workout sources')
        },
        async findFirst() {
          return null
        },
      },
    },
  })

  const emptyWorkoutResponse = await app.inject({
    method: 'POST',
    url: '/api/workout-sessions',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_session_owner_2',
    },
    payload: {
      workoutId: 'workout_empty',
    },
  })

  assert.equal(emptyWorkoutResponse.statusCode, 400)
  assert.deepEqual(emptyWorkoutResponse.json(), {
    message: 'Workout must have at least one item before starting a session.',
    code: 'EMPTY_WORKOUT',
    statusCode: 400,
  })

  const foreignWorkoutResponse = await app.inject({
    method: 'POST',
    url: '/api/workout-sessions',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_session_owner_2',
    },
    payload: {
      workoutId: 'workout_foreign',
    },
  })

  assert.equal(foreignWorkoutResponse.statusCode, 404)
  assert.deepEqual(foreignWorkoutResponse.json(), {
    message: 'Workout not found.',
    code: 'WORKOUT_NOT_FOUND',
    statusCode: 404,
  })

  await app.close()
})

test('buildApp blocks a second active workout session with a normalized conflict response', async () => {
  setTestEnv()

  const users = new Map([
    [
      'clerk_user_session_conflict',
      {
        id: 'user_session_conflict',
        clerkUserId: 'clerk_user_session_conflict',
        email: null,
        firstName: null,
        lastName: null,
        imageUrl: null,
        profile: {
          displayName: null,
          dateOfBirth: null,
          heightCm: null,
          weightKg: null,
        },
      },
    ],
  ])

  const workouts = new Map([
    [
      'workout_conflict',
      {
        id: 'workout_conflict',
        userId: 'user_session_conflict',
        name: 'Conflict Workout',
        items: [
          {
            id: 'workout_item_conflict',
            position: 0,
            sets: 1,
            reps: 10,
            loadKg: 20,
            restSeconds: 60,
            exercise: {
              id: 'exercise_conflict',
              name: 'Remada',
              slug: 'remada',
            },
          },
        ],
      },
    ],
  ])

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      user: {
        async upsert({
          where,
        }: {
          where: { clerkUserId: string }
          create: Record<string, unknown>
          update: Record<string, unknown>
        }) {
          return users.get(where.clerkUserId)
        },
      },
      workout: {
        async findFirst({
          where,
          select,
        }: {
          where: { id: string; userId: string }
          select: Record<string, unknown>
        }) {
          const workout = workouts.get(where.id)

          if (!workout || workout.userId !== where.userId) {
            return null
          }

          if ('items' in select) {
            return workout
          }

          return {
            id: workout.id,
            name: workout.name,
          }
        },
      },
      workoutSession: {
        async create() {
          throw new Prisma.PrismaClientKnownRequestError(
            'Unique constraint failed on the fields: (`active_session_user_id`)',
            {
              code: 'P2002',
              clientVersion: '7.6.0',
              meta: {
                target: ['active_session_user_id'],
              },
            },
          )
        },
        async findFirst() {
          return null
        },
      },
    },
  })

  const response = await app.inject({
    method: 'POST',
    url: '/api/workout-sessions',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_session_conflict',
    },
    payload: {
      workoutId: 'workout_conflict',
    },
  })

  assert.equal(response.statusCode, 409)
  assert.deepEqual(response.json(), {
    message: 'An active workout session already exists for the current user.',
    code: 'ACTIVE_WORKOUT_SESSION_EXISTS',
    statusCode: 409,
  })

  await app.close()
})

test('buildApp returns the active workout session for the authenticated user and normalizes absence as 404', async () => {
  setTestEnv()

  const users = new Map([
    [
      'clerk_user_session_active',
      {
        id: 'user_session_active',
        clerkUserId: 'clerk_user_session_active',
        email: null,
        firstName: null,
        lastName: null,
        imageUrl: null,
        profile: {
          displayName: null,
          dateOfBirth: null,
          heightCm: null,
          weightKg: null,
        },
      },
    ],
    [
      'clerk_user_session_empty',
      {
        id: 'user_session_empty',
        clerkUserId: 'clerk_user_session_empty',
        email: null,
        firstName: null,
        lastName: null,
        imageUrl: null,
        profile: {
          displayName: null,
          dateOfBirth: null,
          heightCm: null,
          weightKg: null,
        },
      },
    ],
  ])

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      user: {
        async upsert({
          where,
        }: {
          where: { clerkUserId: string }
          create: Record<string, unknown>
          update: Record<string, unknown>
        }) {
          const user = users.get(where.clerkUserId)

          if (!user) {
            throw new Error(`Missing fake user for ${where.clerkUserId}`)
          }

          return user
        },
      },
      workout: {
        async findFirst({
          where,
        }: {
          where: { id: string; userId: string }
          select: Record<string, unknown>
        }) {
          if (where.id !== 'workout_active' || where.userId !== 'user_session_active') {
            return null
          }

          return {
            id: 'workout_active',
            name: 'Upper Body',
          }
        },
      },
      workoutSession: {
        async create() {
          throw new Error('create should not be called by GET /active')
        },
        async findFirst({
          where,
        }: {
          where: { userId: string; status: 'in_progress' }
          select: Record<string, unknown>
        }) {
          if (where.userId !== 'user_session_active') {
            return null
          }

          return {
            id: 'session_active_1',
            workoutId: 'workout_active',
            status: 'in_progress',
            startedAt: new Date('2026-04-06T19:00:00.000Z'),
            completedAt: null,
            items: [
              {
                id: 'session_item_active_1',
                workoutItemId: 'workout_item_active_1',
                exerciseId: 'exercise_active_1',
                exerciseName: 'Desenvolvimento',
                exerciseSlug: 'desenvolvimento',
                plannedSets: 2,
                plannedReps: 10,
                plannedLoadKg: 14,
                plannedRestSeconds: 75,
                position: 0,
                setLogs: [
                  {
                    id: 'set_log_active_1',
                    setNumber: 1,
                    status: 'completed',
                    plannedReps: 10,
                    plannedLoadKg: 14,
                    actualReps: 10,
                    actualLoadKg: 14,
                    completedAt: new Date('2026-04-06T19:05:00.000Z'),
                  },
                  {
                    id: 'set_log_active_2',
                    setNumber: 2,
                    status: 'pending',
                    plannedReps: 10,
                    plannedLoadKg: 14,
                    actualReps: null,
                    actualLoadKg: null,
                    completedAt: null,
                  },
                ],
              },
            ],
          }
        },
      },
    },
  })

  const activeResponse = await app.inject({
    method: 'GET',
    url: '/api/workout-sessions/active',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_session_active',
    },
  })

  assert.equal(activeResponse.statusCode, 200)
  assert.deepEqual(activeResponse.json(), {
    id: 'session_active_1',
    workoutId: 'workout_active',
    status: 'in_progress',
    startedAt: '2026-04-06T19:00:00.000Z',
    completedAt: null,
    workout: {
      id: 'workout_active',
      name: 'Upper Body',
    },
    items: [
      {
        id: 'session_item_active_1',
        workoutItemId: 'workout_item_active_1',
        exerciseId: 'exercise_active_1',
        exerciseName: 'Desenvolvimento',
        exerciseSlug: 'desenvolvimento',
        plannedSets: 2,
        plannedReps: 10,
        plannedLoadKg: 14,
        plannedRestSeconds: 75,
        position: 0,
        setLogs: [
          {
            id: 'set_log_active_1',
            setNumber: 1,
            status: 'completed',
            plannedReps: 10,
            plannedLoadKg: 14,
            actualReps: 10,
            actualLoadKg: 14,
            completedAt: '2026-04-06T19:05:00.000Z',
          },
          {
            id: 'set_log_active_2',
            setNumber: 2,
            status: 'pending',
            plannedReps: 10,
            plannedLoadKg: 14,
            actualReps: null,
            actualLoadKg: null,
            completedAt: null,
          },
        ],
      },
    ],
  })

  const missingActiveResponse = await app.inject({
    method: 'GET',
    url: '/api/workout-sessions/active',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_session_empty',
    },
  })

  assert.equal(missingActiveResponse.statusCode, 404)
  assert.deepEqual(missingActiveResponse.json(), {
    message: 'No active workout session was found.',
    code: 'ACTIVE_WORKOUT_SESSION_NOT_FOUND',
    statusCode: 404,
  })

  await app.close()
})

test('buildApp registers and adjusts a set log in the active workout session and reflects the update on subsequent reads', async () => {
  setTestEnv()

  type MutableSetLog = {
    id: string
    setNumber: number
    status: 'pending' | 'completed'
    plannedReps: number
    plannedLoadKg: number
    actualReps: number | null
    actualLoadKg: number | null
    completedAt: Date | null
  }

  type MutableActiveSession = {
    id: string
    workoutId: string
    status: 'in_progress'
    startedAt: Date
    completedAt: Date | null
    items: Array<{
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
      setLogs: MutableSetLog[]
    }>
  }

  const users = new Map([
    [
      'clerk_user_set_log_active',
      {
        id: 'user_set_log_active',
        clerkUserId: 'clerk_user_set_log_active',
        email: null,
        firstName: null,
        lastName: null,
        imageUrl: null,
        profile: {
          displayName: null,
          dateOfBirth: null,
          heightCm: null,
          weightKg: null,
        },
      },
    ],
  ])

  const activeSession: MutableActiveSession = {
    id: 'session_set_log_active',
    workoutId: 'workout_set_log_active',
    status: 'in_progress' as const,
    startedAt: new Date('2026-04-06T19:00:00.000Z'),
    completedAt: null,
    items: [
      {
        id: 'session_item_set_log_1',
        workoutItemId: 'workout_item_set_log_1',
        exerciseId: 'exercise_set_log_1',
        exerciseName: 'Agachamento',
        exerciseSlug: 'agachamento',
        plannedSets: 2,
        plannedReps: 8,
        plannedLoadKg: 60,
        plannedRestSeconds: 120,
        position: 0,
        setLogs: [
          {
            id: 'set_log_mutable_1',
            setNumber: 1,
            status: 'pending',
            plannedReps: 8,
            plannedLoadKg: 60,
            actualReps: null,
            actualLoadKg: null,
            completedAt: null,
          },
          {
            id: 'set_log_mutable_2',
            setNumber: 2,
            status: 'pending',
            plannedReps: 8,
            plannedLoadKg: 60,
            actualReps: null,
            actualLoadKg: null,
            completedAt: null,
          },
        ],
      },
    ],
  }

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      user: {
        async upsert({
          where,
        }: {
          where: { clerkUserId: string }
          create: Record<string, unknown>
          update: Record<string, unknown>
        }) {
          const user = users.get(where.clerkUserId)

          if (!user) {
            throw new Error(`Missing fake user for ${where.clerkUserId}`)
          }

          return user
        },
      },
      workout: {
        async findFirst({
          where,
        }: {
          where: { id: string; userId: string }
          select: Record<string, unknown>
        }) {
          if (where.id !== activeSession.workoutId || where.userId !== 'user_set_log_active') {
            return null
          }

          return {
            id: activeSession.workoutId,
            name: 'Leg Day',
          }
        },
      },
      workoutSession: {
        async create() {
          throw new Error('create should not be called by set log mutations')
        },
        async findFirst({
          where,
        }: {
          where: { userId: string; status: 'in_progress' }
          select: Record<string, unknown>
        }) {
          if (where.userId !== 'user_set_log_active') {
            return null
          }

          return activeSession
        },
      },
      workoutSetLog: {
        async update({
          where,
          data,
        }: {
          where: { id: string }
          data: {
            status: 'completed'
            actualReps: number
            actualLoadKg: number
            completedAt: Date
          }
        }) {
          const targetSetLog = activeSession.items.flatMap((item) => item.setLogs).find((setLog) => setLog.id === where.id)

          if (!targetSetLog) {
            throw new Error(`Missing fake set log for ${where.id}`)
          }

          targetSetLog.status = data.status
          targetSetLog.actualReps = data.actualReps
          targetSetLog.actualLoadKg = data.actualLoadKg
          targetSetLog.completedAt = data.completedAt

          return targetSetLog
        },
      },
    },
  })

  const registerResponse = await app.inject({
    method: 'PATCH',
    url: '/api/workout-sessions/active/set-logs/set_log_mutable_1',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_set_log_active',
    },
    payload: {
      actualReps: 8,
      actualLoadKg: 62.5,
    },
  })

  assert.equal(registerResponse.statusCode, 200)
  assert.deepEqual(registerResponse.json(), {
    id: 'set_log_mutable_1',
    setNumber: 1,
    status: 'completed',
    plannedReps: 8,
    plannedLoadKg: 60,
    actualReps: 8,
    actualLoadKg: 62.5,
    completedAt: activeSession.items[0]!.setLogs[0]!.completedAt?.toISOString() ?? null,
  })

  const adjustResponse = await app.inject({
    method: 'PATCH',
    url: '/api/workout-sessions/active/set-logs/set_log_mutable_1',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_set_log_active',
    },
    payload: {
      actualReps: 7,
      actualLoadKg: 65,
    },
  })

  assert.equal(adjustResponse.statusCode, 200)
  assert.deepEqual(adjustResponse.json(), {
    id: 'set_log_mutable_1',
    setNumber: 1,
    status: 'completed',
    plannedReps: 8,
    plannedLoadKg: 60,
    actualReps: 7,
    actualLoadKg: 65,
    completedAt: activeSession.items[0]!.setLogs[0]!.completedAt?.toISOString() ?? null,
  })

  assert.equal(activeSession.items[0]?.setLogs.length, 2)

  const activeSessionResponse = await app.inject({
    method: 'GET',
    url: '/api/workout-sessions/active',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_set_log_active',
    },
  })

  assert.equal(activeSessionResponse.statusCode, 200)
  assert.deepEqual(activeSessionResponse.json(), {
    id: 'session_set_log_active',
    workoutId: 'workout_set_log_active',
    status: 'in_progress',
    startedAt: '2026-04-06T19:00:00.000Z',
    completedAt: null,
    workout: {
      id: 'workout_set_log_active',
      name: 'Leg Day',
    },
    items: [
      {
        id: 'session_item_set_log_1',
        workoutItemId: 'workout_item_set_log_1',
        exerciseId: 'exercise_set_log_1',
        exerciseName: 'Agachamento',
        exerciseSlug: 'agachamento',
        plannedSets: 2,
        plannedReps: 8,
        plannedLoadKg: 60,
        plannedRestSeconds: 120,
        position: 0,
        setLogs: [
          {
            id: 'set_log_mutable_1',
            setNumber: 1,
            status: 'completed',
            plannedReps: 8,
            plannedLoadKg: 60,
            actualReps: 7,
            actualLoadKg: 65,
            completedAt: activeSession.items[0]!.setLogs[0]!.completedAt?.toISOString() ?? null,
          },
          {
            id: 'set_log_mutable_2',
            setNumber: 2,
            status: 'pending',
            plannedReps: 8,
            plannedLoadKg: 60,
            actualReps: null,
            actualLoadKg: null,
            completedAt: null,
          },
        ],
      },
    ],
  })

  await app.close()
})

test('buildApp returns normalized 404 responses for missing active session and set log outside the active session scope', async () => {
  setTestEnv()

  const users = new Map([
    [
      'clerk_user_set_log_missing',
      {
        id: 'user_set_log_missing',
        clerkUserId: 'clerk_user_set_log_missing',
        email: null,
        firstName: null,
        lastName: null,
        imageUrl: null,
        profile: {
          displayName: null,
          dateOfBirth: null,
          heightCm: null,
          weightKg: null,
        },
      },
    ],
    [
      'clerk_user_set_log_scoped',
      {
        id: 'user_set_log_scoped',
        clerkUserId: 'clerk_user_set_log_scoped',
        email: null,
        firstName: null,
        lastName: null,
        imageUrl: null,
        profile: {
          displayName: null,
          dateOfBirth: null,
          heightCm: null,
          weightKg: null,
        },
      },
    ],
  ])

  const scopedActiveSession = {
    id: 'session_set_log_scoped',
    workoutId: 'workout_set_log_scoped',
    status: 'in_progress' as const,
    startedAt: new Date('2026-04-06T20:00:00.000Z'),
    completedAt: null,
    items: [
      {
        id: 'session_item_set_log_scoped',
        workoutItemId: 'workout_item_set_log_scoped',
        exerciseId: 'exercise_set_log_scoped',
        exerciseName: 'Puxada',
        exerciseSlug: 'puxada',
        plannedSets: 1,
        plannedReps: 12,
        plannedLoadKg: 35,
        plannedRestSeconds: 75,
        position: 0,
        setLogs: [
          {
            id: 'set_log_scoped_1',
            setNumber: 1,
            status: 'pending' as const,
            plannedReps: 12,
            plannedLoadKg: 35,
            actualReps: null,
            actualLoadKg: null,
            completedAt: null,
          },
        ],
      },
    ],
  }

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      user: {
        async upsert({
          where,
        }: {
          where: { clerkUserId: string }
          create: Record<string, unknown>
          update: Record<string, unknown>
        }) {
          const user = users.get(where.clerkUserId)

          if (!user) {
            throw new Error(`Missing fake user for ${where.clerkUserId}`)
          }

          return user
        },
      },
      workout: {
        async findFirst() {
          return {
            id: 'workout_set_log_scoped',
            name: 'Pull Day',
          }
        },
      },
      workoutSession: {
        async create() {
          throw new Error('create should not be called by set log mutations')
        },
        async findFirst({
          where,
        }: {
          where: { userId: string; status: 'in_progress' }
          select: Record<string, unknown>
        }) {
          if (where.userId === 'user_set_log_scoped') {
            return scopedActiveSession
          }

          return null
        },
      },
      workoutSetLog: {
        async update() {
          throw new Error('update should not run when set log is outside scope or session is missing')
        },
      },
    },
  })

  const missingActiveResponse = await app.inject({
    method: 'PATCH',
    url: '/api/workout-sessions/active/set-logs/set_log_missing',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_set_log_missing',
    },
    payload: {
      actualReps: 10,
      actualLoadKg: 20,
    },
  })

  assert.equal(missingActiveResponse.statusCode, 404)
  assert.deepEqual(missingActiveResponse.json(), {
    message: 'No active workout session was found.',
    code: 'ACTIVE_WORKOUT_SESSION_NOT_FOUND',
    statusCode: 404,
  })

  const outOfScopeResponse = await app.inject({
    method: 'PATCH',
    url: '/api/workout-sessions/active/set-logs/set_log_other_scope',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_set_log_scoped',
    },
    payload: {
      actualReps: 10,
      actualLoadKg: 20,
    },
  })

  assert.equal(outOfScopeResponse.statusCode, 404)
  assert.deepEqual(outOfScopeResponse.json(), {
    message: 'Workout set log not found in the active session.',
    code: 'WORKOUT_SET_LOG_NOT_FOUND',
    statusCode: 404,
  })

  await app.close()
})

test('buildApp validates set log mutation payloads with the normalized error format', async () => {
  setTestEnv()

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      user: {
        async upsert() {
          return {
            id: 'user_set_log_invalid',
            clerkUserId: 'clerk_user_set_log_invalid',
            email: null,
            firstName: null,
            lastName: null,
            imageUrl: null,
            profile: {
              displayName: null,
              dateOfBirth: null,
              heightCm: null,
              weightKg: null,
            },
          }
        },
      },
      workout: {
        async findFirst() {
          throw new Error('workout lookup should not run for invalid payload')
        },
      },
      workoutSession: {
        async create() {
          throw new Error('session creation should not run for invalid payload')
        },
        async findFirst() {
          throw new Error('session lookup should not run for invalid payload')
        },
      },
      workoutSetLog: {
        async update() {
          throw new Error('set log update should not run for invalid payload')
        },
      },
    },
  })

  const response = await app.inject({
    method: 'PATCH',
    url: '/api/workout-sessions/active/set-logs/set_log_invalid_payload',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_set_log_invalid',
    },
    payload: {
      actualReps: 0,
    },
  })

  assert.equal(response.statusCode, 400)
  assert.deepEqual(response.json(), {
    message: 'Request validation failed.',
    code: 'VALIDATION_ERROR',
    statusCode: 400,
    details: {
      issues: [
        {
          path: '',
          message: "must have required property 'actualLoadKg'",
        },
      ],
    },
  })

  await app.close()
})

test('buildApp completes the active workout session and removes it from the active session slot', async () => {
  setTestEnv()

  const users = new Map([
    [
      'clerk_user_session_complete',
      {
        id: 'user_session_complete',
        clerkUserId: 'clerk_user_session_complete',
        email: null,
        firstName: null,
        lastName: null,
        imageUrl: null,
        profile: {
          displayName: null,
          dateOfBirth: null,
          heightCm: null,
          weightKg: null,
        },
      },
    ],
  ])

  let activeSession: {
    id: string
    workoutId: string
    status: 'in_progress' | 'completed'
    startedAt: Date
    completedAt: Date | null
    items: Array<{
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
      setLogs: Array<{
        id: string
        setNumber: number
        status: 'pending' | 'completed'
        plannedReps: number
        plannedLoadKg: number
        actualReps: number | null
        actualLoadKg: number | null
        completedAt: Date | null
      }>
    }>
  } | null = {
    id: 'session_complete_1',
    workoutId: 'workout_complete_1',
    status: 'in_progress',
    startedAt: new Date('2026-04-06T20:00:00.000Z'),
    completedAt: null,
    items: [
      {
        id: 'session_complete_item_1',
        workoutItemId: 'workout_complete_item_1',
        exerciseId: 'exercise_complete_1',
        exerciseName: 'Supino reto',
        exerciseSlug: 'supino-reto',
        plannedSets: 2,
        plannedReps: 10,
        plannedLoadKg: 40,
        plannedRestSeconds: 90,
        position: 0,
        setLogs: [
          {
            id: 'set_log_complete_1',
            setNumber: 1,
            status: 'completed',
            plannedReps: 10,
            plannedLoadKg: 40,
            actualReps: 10,
            actualLoadKg: 40,
            completedAt: new Date('2026-04-06T20:05:00.000Z'),
          },
          {
            id: 'set_log_complete_2',
            setNumber: 2,
            status: 'pending',
            plannedReps: 10,
            plannedLoadKg: 40,
            actualReps: null,
            actualLoadKg: null,
            completedAt: null,
          },
        ],
      },
    ],
  }

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      async $transaction<T>(fn: (tx: unknown) => Promise<T>) {
        return fn({
          workout: {
            async findFirst({
              where,
            }: {
              where: { id: string; userId: string }
              select: Record<string, unknown>
            }) {
              if (where.id !== 'workout_complete_1' || where.userId !== 'user_session_complete') {
                return null
              }

              return {
                id: 'workout_complete_1',
                name: 'Chest Day',
              }
            },
          },
          workoutSession: {
            async findFirst({
              where,
            }: {
              where: { id?: string; userId: string; status: 'in_progress' | 'completed' }
              select: Record<string, unknown>
            }) {
              if (!activeSession) {
                return null
              }

              if (where.userId !== 'user_session_complete') {
                return null
              }

              if (where.id && where.id !== activeSession.id) {
                return null
              }

              if (activeSession.status !== where.status) {
                return null
              }

              return activeSession
            },
            async updateMany({
              where,
              data,
            }: {
              where: { id: string; userId: string; status: 'in_progress'; activeSessionUserId: string }
              data: { status: 'completed'; completedAt: Date; activeSessionUserId: null }
            }) {
              if (
                !activeSession ||
                where.id !== activeSession.id ||
                where.userId !== 'user_session_complete' ||
                where.activeSessionUserId !== 'user_session_complete' ||
                activeSession.status !== 'in_progress'
              ) {
                return { count: 0 }
              }

              activeSession = {
                ...activeSession,
                status: data.status,
                completedAt: data.completedAt,
              }

              return { count: 1 }
            },
          },
        } as {
          workout: {
            findFirst(args: {
              where: { id: string; userId: string }
              select: Record<string, unknown>
            }): Promise<{ id: string; name: string } | null>
          }
          workoutSession: {
            findFirst(args: {
              where: { id?: string; userId: string; status: 'in_progress' | 'completed' }
              select: Record<string, unknown>
            }): Promise<typeof activeSession>
            updateMany(args: {
              where: { id: string; userId: string; status: 'in_progress'; activeSessionUserId: string }
              data: { status: 'completed'; completedAt: Date; activeSessionUserId: null }
            }): Promise<{ count: number }>
          }
        })
      },
      user: {
        async upsert({
          where,
        }: {
          where: { clerkUserId: string }
          create: Record<string, unknown>
          update: Record<string, unknown>
        }) {
          const user = users.get(where.clerkUserId)

          if (!user) {
            throw new Error(`Missing fake user for ${where.clerkUserId}`)
          }

          return user
        },
      },
      workout: {
        async findFirst({
          where,
        }: {
          where: { id: string; userId: string }
          select: Record<string, unknown>
        }) {
          if (where.id !== 'workout_complete_1' || where.userId !== 'user_session_complete') {
            return null
          }

          return {
            id: 'workout_complete_1',
            name: 'Chest Day',
          }
        },
      },
      workoutSession: {
        async create() {
          throw new Error('create should not run while completing a workout session')
        },
        async findFirst({
          where,
        }: {
          where: { userId: string; status: 'in_progress' }
          select: Record<string, unknown>
        }) {
          if (!activeSession || where.userId !== 'user_session_complete' || activeSession.status !== 'in_progress') {
            return null
          }

          return activeSession
        },
        async updateMany() {
          throw new Error('root updateMany should not run outside transaction')
        },
      },
      workoutSetLog: {
        async update() {
          throw new Error('set log update should not run while completing a workout session')
        },
      },
    },
  })

  const response = await app.inject({
    method: 'POST',
    url: '/api/workout-sessions/active/complete',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_session_complete',
    },
    payload: {},
  })

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), {
    id: 'session_complete_1',
    workoutId: 'workout_complete_1',
    status: 'completed',
    startedAt: '2026-04-06T20:00:00.000Z',
    completedAt: activeSession?.completedAt?.toISOString() ?? null,
    workout: {
      id: 'workout_complete_1',
      name: 'Chest Day',
    },
    items: [
      {
        id: 'session_complete_item_1',
        workoutItemId: 'workout_complete_item_1',
        exerciseId: 'exercise_complete_1',
        exerciseName: 'Supino reto',
        exerciseSlug: 'supino-reto',
        plannedSets: 2,
        plannedReps: 10,
        plannedLoadKg: 40,
        plannedRestSeconds: 90,
        position: 0,
        setLogs: [
          {
            id: 'set_log_complete_1',
            setNumber: 1,
            status: 'completed',
            plannedReps: 10,
            plannedLoadKg: 40,
            actualReps: 10,
            actualLoadKg: 40,
            completedAt: '2026-04-06T20:05:00.000Z',
          },
          {
            id: 'set_log_complete_2',
            setNumber: 2,
            status: 'pending',
            plannedReps: 10,
            plannedLoadKg: 40,
            actualReps: null,
            actualLoadKg: null,
            completedAt: null,
          },
        ],
      },
    ],
  })

  const activeResponse = await app.inject({
    method: 'GET',
    url: '/api/workout-sessions/active',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_session_complete',
    },
  })

  assert.equal(activeResponse.statusCode, 404)
  assert.deepEqual(activeResponse.json(), {
    message: 'No active workout session was found.',
    code: 'ACTIVE_WORKOUT_SESSION_NOT_FOUND',
    statusCode: 404,
  })

  await app.close()
})

test('buildApp rejects workout session completion when no active session exists or no set log was completed yet', async () => {
  setTestEnv()

  const users = new Map([
    [
      'clerk_user_session_no_active',
      {
        id: 'user_session_no_active',
        clerkUserId: 'clerk_user_session_no_active',
        email: null,
        firstName: null,
        lastName: null,
        imageUrl: null,
        profile: {
          displayName: null,
          dateOfBirth: null,
          heightCm: null,
          weightKg: null,
        },
      },
    ],
    [
      'clerk_user_session_without_logs',
      {
        id: 'user_session_without_logs',
        clerkUserId: 'clerk_user_session_without_logs',
        email: null,
        firstName: null,
        lastName: null,
        imageUrl: null,
        profile: {
          displayName: null,
          dateOfBirth: null,
          heightCm: null,
          weightKg: null,
        },
      },
    ],
  ])

  const pendingOnlySession = {
    id: 'session_pending_only',
    workoutId: 'workout_pending_only',
    status: 'in_progress' as const,
    startedAt: new Date('2026-04-06T21:00:00.000Z'),
    completedAt: null,
    items: [
      {
        id: 'session_pending_item_1',
        workoutItemId: 'workout_pending_item_1',
        exerciseId: 'exercise_pending_item_1',
        exerciseName: 'Remada',
        exerciseSlug: 'remada',
        plannedSets: 1,
        plannedReps: 12,
        plannedLoadKg: 30,
        plannedRestSeconds: 75,
        position: 0,
        setLogs: [
          {
            id: 'set_log_pending_only_1',
            setNumber: 1,
            status: 'pending' as const,
            plannedReps: 12,
            plannedLoadKg: 30,
            actualReps: null,
            actualLoadKg: null,
            completedAt: null,
          },
        ],
      },
    ],
  }

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      async $transaction() {
        throw new Error('transaction should not run for invalid completion preconditions')
      },
      user: {
        async upsert({
          where,
        }: {
          where: { clerkUserId: string }
          create: Record<string, unknown>
          update: Record<string, unknown>
        }) {
          const user = users.get(where.clerkUserId)

          if (!user) {
            throw new Error(`Missing fake user for ${where.clerkUserId}`)
          }

          return user
        },
      },
      workout: {
        async findFirst() {
          return {
            id: 'workout_pending_only',
            name: 'Back Day',
          }
        },
      },
      workoutSession: {
        async create() {
          throw new Error('create should not run while completing a workout session')
        },
        async findFirst({
          where,
        }: {
          where: { userId: string; status: 'in_progress' }
          select: Record<string, unknown>
        }) {
          if (where.userId === 'user_session_without_logs') {
            return pendingOnlySession
          }

          return null
        },
        async updateMany() {
          throw new Error('updateMany should not run when completion preconditions fail')
        },
      },
      workoutSetLog: {
        async update() {
          throw new Error('set log update should not run while completing a workout session')
        },
      },
    },
  })

  const missingActiveResponse = await app.inject({
    method: 'POST',
    url: '/api/workout-sessions/active/complete',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_session_no_active',
    },
    payload: {},
  })

  assert.equal(missingActiveResponse.statusCode, 404)
  assert.deepEqual(missingActiveResponse.json(), {
    message: 'No active workout session was found.',
    code: 'ACTIVE_WORKOUT_SESSION_NOT_FOUND',
    statusCode: 404,
  })

  const noLogsResponse = await app.inject({
    method: 'POST',
    url: '/api/workout-sessions/active/complete',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_session_without_logs',
    },
    payload: {},
  })

  assert.equal(noLogsResponse.statusCode, 400)
  assert.deepEqual(noLogsResponse.json(), {
    message: 'Workout session must contain at least one completed set log before completion.',
    code: 'WORKOUT_SESSION_HAS_NO_COMPLETED_SET_LOGS',
    statusCode: 400,
  })

  await app.close()
})

test('buildApp returns null plannedWorkout for today when no planning exists for the current server day', async () => {
  setTestEnv()

  type FakePersistedUser = {
    id: string
    clerkUserId: string
    email: string | null
    firstName: string | null
    lastName: string | null
    imageUrl: string | null
    profile: {
      displayName: string | null
      dateOfBirth: Date | null
      heightCm: number | null
      weightKg: number | null
    }
  }

  type FakeWorkout = {
    id: string
    userId: string
    name: string
    createdAt: Date
    updatedAt: Date
  }

  const user: FakePersistedUser = {
    id: 'user_today_empty',
    clerkUserId: 'clerk_user_today_empty',
    email: null,
    firstName: null,
    lastName: null,
    imageUrl: null,
    profile: {
      displayName: null,
      dateOfBirth: null,
      heightCm: null,
      weightKg: null,
    },
  }

  const workouts = [
    {
      id: 'workout_full_body',
      userId: 'user_today_empty',
      name: 'Full Body',
      createdAt: new Date('2026-04-03T09:00:00.000Z'),
      updatedAt: new Date('2026-04-03T11:00:00.000Z'),
    },
  ] satisfies FakeWorkout[]

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      user: {
        async upsert() {
          return user
        },
      },
      workout: {
        async findMany({
          where,
        }: {
          where: { userId: string; id?: { in: string[] } }
          orderBy?: Array<{ updatedAt: 'asc' | 'desc' }>
          select: Record<string, unknown>
        }) {
          if (where.id) {
            return []
          }

          return workouts
            .filter((workout) => workout.userId === where.userId)
            .map((workout) => ({
              id: workout.id,
              name: workout.name,
              createdAt: workout.createdAt,
              updatedAt: workout.updatedAt,
            }))
        },
      },
      weeklyPlanningDay: {
        async findMany() {
          return []
        },
      },
    },
  })

  const RealDate = Date
  class MockDate extends Date {
    constructor(value?: string | number | Date) {
      if (value === undefined) {
        super('2026-04-07T09:15:00')
        return
      }

      super(value)
    }

    static now() {
      return new RealDate('2026-04-07T09:15:00').valueOf()
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).Date = MockDate

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/planning/today',
      headers: {
        'x-test-clerk-user-id': 'clerk_user_today_empty',
      },
    })

    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json(), {
      date: '2026-04-07',
      dayOfWeek: 'tuesday',
      plannedWorkout: null,
      manualWorkoutOptions: [
        {
          id: 'workout_full_body',
          name: 'Full Body',
          createdAt: '2026-04-03T09:00:00.000Z',
          updatedAt: '2026-04-03T11:00:00.000Z',
        },
      ],
    })
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).Date = RealDate
    await app.close()
  }
})

test('buildApp returns a progress overview with honest aggregates for the authenticated user', async () => {
  setTestEnv()

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      user: {
        async upsert() {
          return {
            id: 'user_progress_1',
            clerkUserId: 'clerk_user_progress_1',
            email: null,
            firstName: 'Rodrigo',
            lastName: null,
            imageUrl: null,
            profile: {
              displayName: 'Rodrigo',
              dateOfBirth: null,
              heightCm: 180,
              weightKg: 84,
            },
          }
        },
      },
      userProfile: {
        async findUnique({
          where,
        }: {
          where: { userId: string }
          select: Record<string, unknown>
        }) {
          assert.equal(where.userId, 'user_progress_1')

          return {
            displayName: 'Rodrigo',
            heightCm: 180,
            weightKg: 84,
          }
        },
      },
      workoutSession: {
        async findMany({
          where,
          orderBy,
        }: {
          where: { userId: string; status: 'completed' }
          orderBy: Array<{ completedAt: 'asc' | 'desc' }>
          select: Record<string, unknown>
        }) {
          assert.equal(where.userId, 'user_progress_1')
          assert.equal(where.status, 'completed')
          assert.deepEqual(orderBy, [{ completedAt: 'desc' }])

          return [
            {
              id: 'session_progress_recent',
              completedAt: new Date('2026-04-06T18:00:00.000Z'),
              items: [
                {
                  exerciseId: 'exercise_bench',
                  exerciseName: 'Supino reto',
                  exerciseSlug: 'supino-reto',
                  setLogs: [
                    {
                      status: 'completed',
                      actualReps: 10,
                      actualLoadKg: 60,
                      completedAt: new Date('2026-04-06T18:10:00.000Z'),
                    },
                    {
                      status: 'completed',
                      actualReps: 8,
                      actualLoadKg: 62.5,
                      completedAt: new Date('2026-04-06T18:14:00.000Z'),
                    },
                  ],
                },
              ],
            },
            {
              id: 'session_progress_old',
              completedAt: new Date('2026-03-30T18:00:00.000Z'),
              items: [
                {
                  exerciseId: 'exercise_bench',
                  exerciseName: 'Supino reto',
                  exerciseSlug: 'supino-reto',
                  setLogs: [
                    {
                      status: 'completed',
                      actualReps: 10,
                      actualLoadKg: 55,
                      completedAt: new Date('2026-03-30T18:10:00.000Z'),
                    },
                  ],
                },
                {
                  exerciseId: 'exercise_row',
                  exerciseName: 'Remada curvada',
                  exerciseSlug: 'remada-curvada',
                  setLogs: [
                    {
                      status: 'completed',
                      actualReps: 12,
                      actualLoadKg: 40,
                      completedAt: new Date('2026-03-30T18:25:00.000Z'),
                    },
                  ],
                },
              ],
            },
          ]
        },
      },
    },
  })

  const RealDate = Date
  class MockDate extends Date {
    constructor(value?: string | number | Date) {
      if (value === undefined) {
        super('2026-04-06T20:30:00.000Z')
        return
      }

      super(value)
    }

    static now() {
      return new RealDate('2026-04-06T20:30:00.000Z').valueOf()
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).Date = MockDate

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/progress/overview',
      headers: {
        'x-test-clerk-user-id': 'clerk_user_progress_1',
      },
    })

    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json(), {
      summary: {
        totalCompletedSessions: 2,
        completedSessionsThisWeek: 1,
        totalCompletedSets: 4,
        latestCompletedAt: '2026-04-06T18:00:00.000Z',
      },
      profileSnapshot: {
        displayName: 'Rodrigo',
        heightCm: 180,
        weightKg: 84,
      },
      exerciseProgressSummaries: [
        {
          exerciseId: 'exercise_bench',
          exerciseName: 'Supino reto',
          exerciseSlug: 'supino-reto',
          completedSetCount: 3,
          completedSessionCount: 2,
          bestActualLoadKg: 62.5,
          latestActualLoadKg: 62.5,
          latestCompletedAt: '2026-04-06T18:14:00.000Z',
        },
        {
          exerciseId: 'exercise_row',
          exerciseName: 'Remada curvada',
          exerciseSlug: 'remada-curvada',
          completedSetCount: 1,
          completedSessionCount: 1,
          bestActualLoadKg: 40,
          latestActualLoadKg: 40,
          latestCompletedAt: '2026-03-30T18:25:00.000Z',
        },
      ],
    })
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).Date = RealDate
    await app.close()
  }
})

test('buildApp returns an empty but coherent progress overview when the user has no completed history', async () => {
  setTestEnv()

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      user: {
        async upsert() {
          return {
            id: 'user_progress_empty',
            clerkUserId: 'clerk_user_progress_empty',
            email: null,
            firstName: null,
            lastName: null,
            imageUrl: null,
            profile: {
              displayName: null,
              dateOfBirth: null,
              heightCm: null,
              weightKg: null,
            },
          }
        },
      },
      userProfile: {
        async findUnique() {
          return null
        },
      },
      workoutSession: {
        async findMany() {
          return []
        },
      },
    },
  })

  const response = await app.inject({
    method: 'GET',
    url: '/api/progress/overview',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_progress_empty',
    },
  })

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), {
    summary: {
      totalCompletedSessions: 0,
      completedSessionsThisWeek: 0,
      totalCompletedSets: 0,
      latestCompletedAt: null,
    },
    profileSnapshot: {
      displayName: null,
      heightCm: null,
      weightKg: null,
    },
    exerciseProgressSummaries: [],
  })

  await app.close()
})

test('buildApp counts completed sessions this week using the configured app time zone', async () => {
  setTestEnv()
  process.env.APP_TIME_ZONE = 'America/Sao_Paulo'

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      user: {
        async upsert() {
          return {
            id: 'user_progress_timezone',
            clerkUserId: 'clerk_user_progress_timezone',
            email: null,
            firstName: null,
            lastName: null,
            imageUrl: null,
            profile: {
              displayName: null,
              dateOfBirth: null,
              heightCm: null,
              weightKg: null,
            },
          }
        },
      },
      userProfile: {
        async findUnique() {
          return null
        },
      },
      workoutSession: {
        async findMany() {
          return [
            {
              id: 'session_progress_timezone',
              completedAt: new Date('2026-04-06T01:00:00.000Z'),
              items: [
                {
                  exerciseId: 'exercise_bench',
                  exerciseName: 'Supino reto',
                  exerciseSlug: 'supino-reto',
                  setLogs: [
                    {
                      status: 'completed',
                      actualReps: 10,
                      actualLoadKg: 60,
                      completedAt: new Date('2026-04-06T01:00:00.000Z'),
                    },
                  ],
                },
              ],
            },
          ]
        },
      },
    },
  })

  const RealDate = Date
  class MockDate extends Date {
    constructor(value?: string | number | Date) {
      if (value === undefined) {
        super('2026-04-06T02:00:00.000Z')
        return
      }

      super(value)
    }

    static now() {
      return new RealDate('2026-04-06T02:00:00.000Z').valueOf()
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).Date = MockDate

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/progress/overview',
      headers: {
        'x-test-clerk-user-id': 'clerk_user_progress_timezone',
      },
    })

    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json(), {
      summary: {
        totalCompletedSessions: 1,
        completedSessionsThisWeek: 1,
        totalCompletedSets: 1,
        latestCompletedAt: '2026-04-06T01:00:00.000Z',
      },
      profileSnapshot: {
        displayName: null,
        heightCm: null,
        weightKg: null,
      },
      exerciseProgressSummaries: [
        {
          exerciseId: 'exercise_bench',
          exerciseName: 'Supino reto',
          exerciseSlug: 'supino-reto',
          completedSetCount: 1,
          completedSessionCount: 1,
          bestActualLoadKg: 60,
          latestActualLoadKg: 60,
          latestCompletedAt: '2026-04-06T01:00:00.000Z',
        },
      ],
    })
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).Date = RealDate
    await app.close()
  }
})

test('buildApp returns completed workout sessions history ordered by completedAt desc for the authenticated user', async () => {
  setTestEnv()

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      user: {
        async upsert() {
          return {
            id: 'user_history_1',
            clerkUserId: 'clerk_user_history_1',
            email: null,
            firstName: null,
            lastName: null,
            imageUrl: null,
            profile: {
              displayName: null,
              dateOfBirth: null,
              heightCm: null,
              weightKg: null,
            },
          }
        },
      },
      workout: {
        async findMany({
          where,
          select,
        }: {
          where: { userId: string; id: { in: string[] } }
          select: Record<string, unknown>
        }) {
          assert.equal(where.userId, 'user_history_1')
          assert.deepEqual(where.id.in, ['workout_b', 'workout_a'])
          assert.ok(select)

          return [
            { id: 'workout_b', name: 'Treino B' },
            { id: 'workout_a', name: 'Treino A' },
          ]
        },
      },
      workoutSession: {
        async create() {
          throw new Error('create should not run while listing history')
        },
        async findFirst() {
          throw new Error('findFirst should not run while listing history')
        },
        async findMany({
          where,
          orderBy,
          select,
        }: {
          where: { userId: string; status: 'completed' }
          orderBy: Array<{ completedAt: 'asc' | 'desc' }>
          select: Record<string, unknown>
        }) {
          assert.equal(where.userId, 'user_history_1')
          assert.equal(where.status, 'completed')
          assert.deepEqual(orderBy, [{ completedAt: 'desc' }])
          assert.ok(select)

          return [
            {
              id: 'session_recent',
              workoutId: 'workout_b',
              startedAt: new Date('2026-04-06T16:00:00.000Z'),
              completedAt: new Date('2026-04-06T17:00:00.000Z'),
              items: [
                {
                  exerciseId: 'exercise_bench',
                  setLogs: [{ status: 'completed' }, { status: 'completed' }],
                },
                {
                  exerciseId: 'exercise_row',
                  setLogs: [{ status: 'pending' }, { status: 'completed' }],
                },
              ],
            },
            {
              id: 'session_old',
              workoutId: 'workout_a',
              startedAt: new Date('2026-04-03T16:00:00.000Z'),
              completedAt: new Date('2026-04-03T17:00:00.000Z'),
              items: [
                {
                  exerciseId: 'exercise_squat',
                  setLogs: [{ status: 'completed' }],
                },
              ],
            },
          ]
        },
      },
      workoutSetLog: {
        async update() {
          throw new Error('set log update should not run while listing history')
        },
      },
    },
  })

  const response = await app.inject({
    method: 'GET',
    url: '/api/workout-sessions/history',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_history_1',
    },
  })

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), [
    {
      id: 'session_recent',
      workoutId: 'workout_b',
      workoutName: 'Treino B',
      startedAt: '2026-04-06T16:00:00.000Z',
      completedAt: '2026-04-06T17:00:00.000Z',
      completedSetCount: 3,
      exerciseCount: 2,
    },
    {
      id: 'session_old',
      workoutId: 'workout_a',
      workoutName: 'Treino A',
      startedAt: '2026-04-03T16:00:00.000Z',
      completedAt: '2026-04-03T17:00:00.000Z',
      completedSetCount: 1,
      exerciseCount: 1,
    },
  ])

  await app.close()
})

test('buildApp returns 200 with an empty array for users without completed workout history', async () => {
  setTestEnv()

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      user: {
        async upsert() {
          return {
            id: 'user_history_empty',
            clerkUserId: 'clerk_user_history_empty',
            email: null,
            firstName: null,
            lastName: null,
            imageUrl: null,
            profile: {
              displayName: null,
              dateOfBirth: null,
              heightCm: null,
              weightKg: null,
            },
          }
        },
      },
      workout: {
        async findMany() {
          throw new Error('workouts lookup should not run when there are no sessions')
        },
      },
      workoutSession: {
        async create() {
          throw new Error('create should not run while listing history')
        },
        async findFirst() {
          throw new Error('findFirst should not run while listing history')
        },
        async findMany({
          where,
          orderBy,
        }: {
          where: { userId: string; status: 'completed' }
          orderBy: Array<{ completedAt: 'asc' | 'desc' }>
          select: Record<string, unknown>
        }) {
          assert.equal(where.userId, 'user_history_empty')
          assert.equal(where.status, 'completed')
          assert.deepEqual(orderBy, [{ completedAt: 'desc' }])
          return []
        },
      },
      workoutSetLog: {
        async update() {
          throw new Error('set log update should not run while listing history')
        },
      },
    },
  })

  const response = await app.inject({
    method: 'GET',
    url: '/api/workout-sessions/history',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_history_empty',
    },
  })

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), [])

  await app.close()
})

test('buildApp returns completed workout session detail from persisted snapshot data', async () => {
  setTestEnv()

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      user: {
        async upsert() {
          return {
            id: 'user_history_detail',
            clerkUserId: 'clerk_user_history_detail',
            email: null,
            firstName: null,
            lastName: null,
            imageUrl: null,
            profile: {
              displayName: null,
              dateOfBirth: null,
              heightCm: null,
              weightKg: null,
            },
          }
        },
      },
      workout: {
        async findMany() {
          throw new Error('workout list should not run while loading history detail')
        },
        async findFirst({
          where,
        }: {
          where: { id: string; userId: string }
          select: Record<string, unknown>
        }) {
          assert.equal(where.id, 'workout_history_detail')
          assert.equal(where.userId, 'user_history_detail')

          return {
            id: 'workout_history_detail',
            name: 'Treino Superior Atual',
          }
        },
      },
      workoutSession: {
        async create() {
          throw new Error('create should not run while loading history detail')
        },
        async findFirst() {
          throw new Error('findFirst should not run while loading history detail')
        },
        async findMany({
          where,
          select,
        }: {
          where: { id: string; userId: string; status: 'completed' }
          select: Record<string, unknown>
        }) {
          assert.equal(where.id, 'session_history_detail')
          assert.equal(where.userId, 'user_history_detail')
          assert.equal(where.status, 'completed')
          assert.ok(select)

          return [
            {
              id: 'session_history_detail',
              workoutId: 'workout_history_detail',
              workoutNameSnapshot: 'Treino Superior Original',
              status: 'completed',
              startedAt: new Date('2026-04-04T18:00:00.000Z'),
              completedAt: new Date('2026-04-04T18:52:00.000Z'),
              items: [
                {
                  id: 'session_item_history_1',
                  workoutItemId: 'workout_item_history_1',
                  exerciseId: 'exercise_bench',
                  exerciseName: 'Supino reto',
                  exerciseSlug: 'supino-reto',
                  plannedSets: 3,
                  plannedReps: 10,
                  plannedLoadKg: 60,
                  plannedRestSeconds: 90,
                  position: 0,
                  setLogs: [
                    {
                      id: 'set_log_history_1',
                      setNumber: 1,
                      status: 'completed',
                      plannedReps: 10,
                      plannedLoadKg: 60,
                      actualReps: 10,
                      actualLoadKg: 60,
                      completedAt: new Date('2026-04-04T18:10:00.000Z'),
                    },
                    {
                      id: 'set_log_history_2',
                      setNumber: 2,
                      status: 'completed',
                      plannedReps: 10,
                      plannedLoadKg: 60,
                      actualReps: 8,
                      actualLoadKg: 62.5,
                      completedAt: new Date('2026-04-04T18:16:00.000Z'),
                    },
                  ],
                },
              ],
            },
          ]
        },
      },
      workoutSetLog: {
        async update() {
          throw new Error('set log update should not run while loading history detail')
        },
      },
    },
  })

  const response = await app.inject({
    method: 'GET',
    url: '/api/workout-sessions/history/session_history_detail',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_history_detail',
    },
  })

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), {
    id: 'session_history_detail',
    workoutId: 'workout_history_detail',
    workoutName: 'Treino Superior Original',
    startedAt: '2026-04-04T18:00:00.000Z',
    completedAt: '2026-04-04T18:52:00.000Z',
    items: [
      {
        id: 'session_item_history_1',
        workoutItemId: 'workout_item_history_1',
        exerciseId: 'exercise_bench',
        exerciseName: 'Supino reto',
        exerciseSlug: 'supino-reto',
        plannedSets: 3,
        plannedReps: 10,
        plannedLoadKg: 60,
        plannedRestSeconds: 90,
        position: 0,
        setLogs: [
          {
            id: 'set_log_history_1',
            setNumber: 1,
            status: 'completed',
            plannedReps: 10,
            plannedLoadKg: 60,
            actualReps: 10,
            actualLoadKg: 60,
            completedAt: '2026-04-04T18:10:00.000Z',
          },
          {
            id: 'set_log_history_2',
            setNumber: 2,
            status: 'completed',
            plannedReps: 10,
            plannedLoadKg: 60,
            actualReps: 8,
            actualLoadKg: 62.5,
            completedAt: '2026-04-04T18:16:00.000Z',
          },
        ],
      },
    ],
  })

  await app.close()
})

test('buildApp keeps completed workout history detail accessible for legacy sessions without workout name snapshot', async () => {
  setTestEnv()

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      user: {
        async upsert() {
          return {
            id: 'user_history_legacy',
            clerkUserId: 'clerk_user_history_legacy',
            email: null,
            firstName: null,
            lastName: null,
            imageUrl: null,
            profile: {
              displayName: null,
              dateOfBirth: null,
              heightCm: null,
              weightKg: null,
            },
          }
        },
      },
      workout: {
        async findMany() {
          throw new Error('workout list should not run while loading legacy history detail')
        },
        async findFirst({
          where,
        }: {
          where: { id: string; userId: string }
          select: Record<string, unknown>
        }) {
          assert.equal(where.id, 'workout_history_legacy')
          assert.equal(where.userId, 'user_history_legacy')
          return null
        },
      },
      workoutSession: {
        async create() {
          throw new Error('create should not run while loading legacy history detail')
        },
        async findFirst() {
          throw new Error('findFirst should not run while loading legacy history detail')
        },
        async findMany({
          where,
          select,
        }: {
          where: { id: string; userId: string; status: 'completed' }
          select: Record<string, unknown>
        }) {
          assert.equal(where.id, 'session_history_legacy')
          assert.equal(where.userId, 'user_history_legacy')
          assert.equal(where.status, 'completed')
          assert.ok(select)

          return [
            {
              id: 'session_history_legacy',
              workoutId: 'workout_history_legacy',
              workoutNameSnapshot: null,
              status: 'completed',
              startedAt: new Date('2026-04-01T18:00:00.000Z'),
              completedAt: new Date('2026-04-01T18:40:00.000Z'),
              items: [
                {
                  id: 'session_item_history_legacy',
                  workoutItemId: 'workout_item_history_legacy',
                  exerciseId: 'exercise_row',
                  exerciseName: 'Remada curvada',
                  exerciseSlug: 'remada-curvada',
                  plannedSets: 2,
                  plannedReps: 12,
                  plannedLoadKg: 40,
                  plannedRestSeconds: 75,
                  position: 0,
                  setLogs: [
                    {
                      id: 'set_log_history_legacy_1',
                      setNumber: 1,
                      status: 'completed',
                      plannedReps: 12,
                      plannedLoadKg: 40,
                      actualReps: 12,
                      actualLoadKg: 40,
                      completedAt: new Date('2026-04-01T18:10:00.000Z'),
                    },
                  ],
                },
              ],
            },
          ]
        },
      },
      workoutSetLog: {
        async update() {
          throw new Error('set log update should not run while loading legacy history detail')
        },
      },
    },
  })

  const response = await app.inject({
    method: 'GET',
    url: '/api/workout-sessions/history/session_history_legacy',
    headers: {
      'x-test-clerk-user-id': 'clerk_user_history_legacy',
    },
  })

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), {
    id: 'session_history_legacy',
    workoutId: 'workout_history_legacy',
    workoutName: null,
    startedAt: '2026-04-01T18:00:00.000Z',
    completedAt: '2026-04-01T18:40:00.000Z',
    items: [
      {
        id: 'session_item_history_legacy',
        workoutItemId: 'workout_item_history_legacy',
        exerciseId: 'exercise_row',
        exerciseName: 'Remada curvada',
        exerciseSlug: 'remada-curvada',
        plannedSets: 2,
        plannedReps: 12,
        plannedLoadKg: 40,
        plannedRestSeconds: 75,
        position: 0,
        setLogs: [
          {
            id: 'set_log_history_legacy_1',
            setNumber: 1,
            status: 'completed',
            plannedReps: 12,
            plannedLoadKg: 40,
            actualReps: 12,
            actualLoadKg: 40,
            completedAt: '2026-04-01T18:10:00.000Z',
          },
        ],
      },
    ],
  })

  await app.close()
})

test('buildApp returns normalized 404 responses for missing, foreign or non-completed workout history detail', async () => {
  setTestEnv()

  const app = buildApp()
  await app.ready()

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    value: {
      user: {
        async upsert() {
          return {
            id: 'user_history_detail_not_found',
            clerkUserId: 'clerk_user_history_detail_not_found',
            email: null,
            firstName: null,
            lastName: null,
            imageUrl: null,
            profile: {
              displayName: null,
              dateOfBirth: null,
              heightCm: null,
              weightKg: null,
            },
          }
        },
      },
      workout: {
        async findMany() {
          throw new Error('workout list should not run in not-found history detail cases')
        },
        async findFirst({
          where,
        }: {
          where: { id: string; userId: string }
          select: Record<string, unknown>
        }) {
          if (where.id === 'workout_foreign') {
            return null
          }

          return {
            id: 'workout_owned',
            name: 'Treino Atual',
          }
        },
      },
      workoutSession: {
        async create() {
          throw new Error('create should not run while loading history detail')
        },
        async findFirst() {
          throw new Error('findFirst should not run while loading history detail')
        },
        async findMany({
          where,
          select,
        }: {
          where: { id: string; userId: string; status: 'completed' }
          select: Record<string, unknown>
        }) {
          assert.equal(where.userId, 'user_history_detail_not_found')
          assert.equal(where.status, 'completed')
          assert.ok(select)

          if (where.id === 'session_foreign') {
            return []
          }

          if (where.id === 'session_missing' || where.id === 'session_in_progress') {
            return []
          }

          throw new Error(`Unexpected session lookup for ${where.id}`)
        },
      },
      workoutSetLog: {
        async update() {
          throw new Error('set log update should not run while loading history detail')
        },
      },
    },
  })

  for (const sessionId of ['session_missing', 'session_in_progress', 'session_foreign']) {
    const response = await app.inject({
      method: 'GET',
      url: `/api/workout-sessions/history/${sessionId}`,
      headers: {
        'x-test-clerk-user-id': 'clerk_user_history_detail_not_found',
      },
    })

    assert.equal(response.statusCode, 404)
    assert.deepEqual(response.json(), {
      message: 'Completed workout session not found.',
      code: 'WORKOUT_SESSION_HISTORY_NOT_FOUND',
      statusCode: 404,
    })
  }

  await app.close()
})
