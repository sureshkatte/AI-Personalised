import { ReactNode } from "react";
import { User } from "../lib/api";
import { LayoutDashboard, GraduationCap, Settings, Home, User as UserIcon, LogOut, Key } from "lucide-react";
import { motion } from "motion/react";

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

interface LayoutProps {
  children: ReactNode;
  user: User | null;
  setView: (view: any) => void;
  currentView: string;
  onLogout?: () => void;
}

export function Layout({ children, user, setView, currentView, onLogout }: LayoutProps) {
  const handleKeySelection = async () => {
    try {
      await window.aistudio.openSelectKey();
    } catch (error) {
      console.error("Failed to open key selection:", error);
    }
  };
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-zinc-200/50 px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div 
          className="flex items-center gap-2.5 cursor-pointer group" 
          onClick={() => setView("dashboard")}
        >
          <div className="bg-brand-600 p-2 rounded-xl shadow-lg shadow-brand-200 group-hover:scale-105 transition-transform">
            <GraduationCap className="text-white w-5 h-5" />
          </div>
          <h1 className="text-lg font-extrabold tracking-tight text-zinc-900">
            AI<span className="text-brand-600">Coach</span>
          </h1>
        </div>

        {user && (
          <div className="flex items-center gap-4 sm:gap-8">
            <nav className="flex items-center gap-1">
              <button 
                onClick={() => setView("dashboard")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${currentView === "dashboard" ? "bg-zinc-900 text-white shadow-lg shadow-zinc-200" : "text-zinc-500 hover:bg-zinc-100"}`}
              >
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">Home</span>
              </button>
              <button 
                onClick={() => setView("admin")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${currentView === "admin" ? "bg-brand-50 text-brand-700" : "text-zinc-500 hover:bg-zinc-100"}`}
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Admin</span>
              </button>
              <button 
                onClick={() => setView("onboarding")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${currentView === "onboarding" ? "bg-rose-50 text-rose-700" : "text-zinc-500 hover:bg-zinc-100"}`}
              >
                <UserIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Profile</span>
              </button>
              {onLogout && (
                <button 
                  onClick={onLogout}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-zinc-500 hover:bg-rose-50 hover:text-rose-600 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              )}
            </nav>

            <div className="h-6 w-px bg-zinc-200 hidden sm:block" />

            <div className="flex items-center gap-3">
              <div className="text-right hidden md:block">
                <p className="text-xs font-bold text-zinc-900 leading-none mb-1">{user.domain || "New Learner"}</p>
                <div className="flex items-center justify-end gap-1">
                  {user.current_levels && user.current_levels[user.domain] && user.current_levels[user.domain][user.subdomain] && (
                    <span className="text-[10px] font-black uppercase tracking-wider text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-md">
                      {user.current_levels[user.domain][user.subdomain]}
                    </span>
                  )}
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center border border-brand-200 shadow-inner">
                <UserIcon className="w-4 h-4 text-brand-700" />
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full p-4 sm:p-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="py-12 px-6 text-center">
        <div className="max-w-6xl mx-auto border-t border-zinc-200/50 pt-8">
          <p className="text-zinc-400 text-xs font-medium tracking-wide uppercase">
            © 2026 AI Personalised Coach • Crafted with Gemini AI
          </p>
        </div>
      </footer>
    </div>
  );
}
