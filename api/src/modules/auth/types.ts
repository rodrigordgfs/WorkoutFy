import type { AuthenticatedClerkContext } from '../../common/auth/clerk-auth.js'
import type { CurrentUser } from '../users/types.js'

export type SignUpInput = {
  email: string
  password: string
}

export type SignInInput = {
  email: string
  password: string
}

export type AuthProviderResult = {
  sessionId: string
  sessionToken: string
  authContext: AuthenticatedClerkContext
}

export interface AuthProvider {
  signUp(input: SignUpInput): Promise<AuthProviderResult>
  signIn(input: SignInInput): Promise<AuthProviderResult>
  signOut(sessionId: string): Promise<void>
}

export type AuthSessionUser = Pick<
  CurrentUser,
  'id' | 'clerkUserId' | 'email' | 'firstName' | 'lastName' | 'imageUrl' | 'profile'
> & {
  isAdmin: boolean
}

export type AuthSessionResponse =
  | {
      authenticated: false
      user: null
    }
  | {
      authenticated: true
      user: AuthSessionUser
    }

