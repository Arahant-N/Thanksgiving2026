import { getServerSession, type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const googleConfigured = Boolean(process.env.AUTH_GOOGLE_ID) && Boolean(process.env.AUTH_GOOGLE_SECRET);

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt"
  },
  providers: googleConfigured
    ? [
        GoogleProvider({
          clientId: process.env.AUTH_GOOGLE_ID!,
          clientSecret: process.env.AUTH_GOOGLE_SECRET!
        })
      ]
    : [],
  callbacks: {
    async jwt({ token, profile, account }) {
      if (account?.provider === "google") {
        token.googleSub =
          (typeof (profile as { sub?: unknown } | undefined)?.sub === "string"
            ? (profile as { sub: string }).sub
            : undefined) ??
          account.providerAccountId ??
          token.googleSub ??
          null;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.googleSub =
          typeof token.googleSub === "string"
            ? token.googleSub
            : typeof token.sub === "string"
              ? token.sub
              : null;
      }

      return session;
    }
  }
};

export function getAuthSession() {
  return getServerSession(authOptions);
}
