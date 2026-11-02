import Google from '@auth/core/providers/google'
import { convexAuth } from '@convex-dev/auth/server'
import { allowedRedirect } from './lib/redirects'

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Google],
  callbacks: {
    async redirect({ redirectTo }) {
      return allowedRedirect(redirectTo, process.env.SITE_URL ?? '')
    },
  },
})
