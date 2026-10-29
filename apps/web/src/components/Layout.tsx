import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { FolderKanban, LogOut, Sparkles } from "lucide-react";
import { useAuth } from "../auth";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex items-center justify-between gap-4 border-b border-line bg-surface px-4 py-3 md:w-60 md:flex-col md:items-stretch md:justify-start md:border-b-0 md:border-r md:py-6">
        <Link to="/" className="flex items-center gap-2 text-base font-semibold">
          <Sparkles className="h-5 w-5 text-brand" aria-hidden />
          RemindQA
        </Link>
        <nav aria-label="Principal" className="md:mt-8 md:flex-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${isActive ? "bg-brand/15 text-brand-300" : "text-zinc-300 hover:bg-white/5"}`
            }
          >
            <FolderKanban className="h-4 w-4" aria-hidden />
            Projetos
          </NavLink>
        </nav>
        <div className="flex items-center gap-2 md:flex-col md:items-stretch">
          <p className="hidden truncate text-xs text-zinc-400 md:block" title={user?.email}>
            {user?.email}
          </p>
          <button onClick={handleLogout} className="btn btn-ghost">
            <LogOut className="h-4 w-4" aria-hidden />
            Sair
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">
        <Outlet />
      </main>
    </div>
  );
}
