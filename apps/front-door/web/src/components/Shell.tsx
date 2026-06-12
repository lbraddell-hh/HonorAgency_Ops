import { Link, NavLink } from "react-router-dom";
import type { ReactNode } from "react";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
    isActive ? "bg-plum text-white" : "text-ink-soft hover:bg-plum-soft hover:text-plum"
  }`;

export function Shell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-ink/8 bg-cream/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/honorhealth-logo.png" alt="HonorHealth" className="h-6 w-auto" />
            <span className="hidden text-sm font-semibold tracking-wide text-ink-soft sm:inline">
              Front Door
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/projects" className={navClass}>
              Job reqs
            </NavLink>
            <NavLink to="/me" className={navClass}>
              My profile
            </NavLink>
          </nav>
        </div>
      </header>
      <main className={`mx-auto flex w-full flex-1 flex-col px-4 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>
        {children}
      </main>
    </div>
  );
}
