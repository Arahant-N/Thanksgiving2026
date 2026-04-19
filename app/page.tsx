import { Dashboard } from "@/components/dashboard";
import { loadDashboardData } from "@/lib/data";

export default async function HomePage() {
  const data = await loadDashboardData();

  return (
    <>
      <div className="page-shell">
        <nav className="top-nav">
          <form className="logout-form" action="/api/logout" method="post">
            <button className="ghost-button" type="submit">
              Lock planner
            </button>
          </form>
        </nav>
      </div>
      <Dashboard {...data} />
    </>
  );
}
