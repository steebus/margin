import { useAuthActions as useConvexAuthActions } from '@convex-dev/auth/react'

const nowhere = { signIn: async () => ({ signingIn: false }), signOut: async () => {} } as unknown as ReturnType<typeof useConvexAuthActions>

/** Signing in and out. In fixture mode there's no account to sign in to or out of, so both do nothing. */
export const useAuthActions = () => useConvexAuthActions() ?? nowhere
