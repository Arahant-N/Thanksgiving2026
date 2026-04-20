import { PasswordForm } from "@/components/password-form";
import { DEV_FALLBACK_PASSWORD } from "@/lib/auth";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const showError = params.error === "1";
  const defaultPasswordHint =
    process.env.NODE_ENV !== "production" && !process.env.VACATION_SITE_PASSWORD
      ? DEV_FALLBACK_PASSWORD
      : undefined;

  return (
    <main className="login-shell">
      <section className="login-card">
        <p className="eyebrow">Private trip dashboard</p>
        <h1>Family access only.</h1>
        <p>
          This planner tracks the stay, flight snapshots, restaurant options, and rough per-family
          trip costs for Thanksgiving 2026.
        </p>
        <p className="form-message">
          Browsing uses the shared family password. Lodging voting can additionally require Google
          sign-in once configured.
        </p>
        <PasswordForm showError={showError} defaultPasswordHint={defaultPasswordHint} />
      </section>
    </main>
  );
}
