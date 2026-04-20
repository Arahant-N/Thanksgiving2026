import { getServerSession, type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const googleConfigured = Boolean(process.env.AUTH_GOOGLE_ID) && Boolean(process.env.AUTH_GOOGLE_SECRET);
const authSecretConfigured = Boolean(process.env.AUTH_SECRET);
const authReady = googleConfigured && authSecretConfigured;

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET || "disabled-google-voting-secret",
  session: {
    strategy: "jwt"
  },
  providers: authReady
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

export function isAuthReady() {
  return authReady;
}

export function getAuthSession() {
  if (!authReady) {
    return Promise.resolve(null);
  }

  return getServerSession(authOptions);
}
