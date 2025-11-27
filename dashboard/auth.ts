import NextAuth from "next-auth"
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_AZURE_AD_ID,
      clientSecret: process.env.AUTH_AZURE_AD_SECRET,
      issuer: `https://login.microsoftonline.com/${process.env.AUTH_AZURE_AD_TENANT_ID}/v2.0`,
    }),
  ],
  callbacks: {
    async jwt({ token, profile }) {
      if (profile) {
        // Azure AD returns roles in the 'roles' claim
        token.roles = (profile as any).roles || []
        token.isAdmin = token.roles?.includes("Admin") || token.roles?.includes("admin")
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.roles = token.roles
        session.user.isAdmin = token.isAdmin
      }
      return session
    },
  },
})
