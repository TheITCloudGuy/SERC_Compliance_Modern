import NextAuth from "next-auth"
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_AZURE_AD_ID,
      clientSecret: process.env.AUTH_AZURE_AD_SECRET,
      issuer: `https://login.microsoftonline.com/${process.env.AUTH_AZURE_AD_TENANT_ID}/v2.0`,
      profile(profile) {
        console.log("Entra ID Profile:", JSON.stringify(profile, null, 2));
        return {
          id: profile.sub || profile.oid,
          name: profile.name,
          email: profile.email,
          image: null,
          roles: profile.roles || [],
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, profile }) {
      if (profile) {
        console.log("Profile received in JWT:", JSON.stringify(profile, null, 2));
        // Azure AD returns roles in the 'roles' claim
        token.roles = (profile as any).roles || (user as any).roles || []
      }

      // Re-evaluate isAdmin to catch role name changes or updates
      if (token.roles && Array.isArray(token.roles)) {
        token.isAdmin = token.roles.includes("Admin") || token.roles.includes("admin") || token.roles.includes("Administrator");
      }

      if (profile) {
        console.log("Roles extracted:", token.roles);
        console.log("Is Admin:", token.isAdmin);
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.roles = token.roles
        session.user.isAdmin = token.isAdmin
        console.log("Session user roles:", session.user.roles);
        console.log("Session user isAdmin:", session.user.isAdmin);
      }
      return session
    },
  },
})
