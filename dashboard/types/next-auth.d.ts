import NextAuth, { DefaultSession } from "next-auth"
import { JWT } from "next-auth/jwt"

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      /** The user's roles */
      roles?: string[]
      /** Whether the user is an admin */
      isAdmin?: boolean
    } & DefaultSession["user"]
  }

  interface User {
    roles?: string[]
  }
}

declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT {
    roles?: string[]
    isAdmin?: boolean
  }
}
