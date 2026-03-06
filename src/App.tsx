import { useState, useEffect } from "react";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";
import Auth from "./components/Auth";
import Dashboard from "./components/Dashboard";
import QuizView from "./components/QuizView";
import AdminPanel from "./components/AdminPanel";
import { GraduationCap, LogOut, LayoutDashboard, Settings } from "lucide-react";

type View = "dashboard" | "quiz" | "admin";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [loading, setLoading] = useState(true);

  const adminEmail = "sureshbabuitsoft@gmail.com";
  const isAdmin = user?.email === adminEmail;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleLogout = () => {
    signOut(auth);
    setView("dashboard");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <GraduationCap className="w-12 h-12 text-emerald-600 animate-bounce" />
      </div>
    );
  }

  if (!user) {
    return <Auth onAuth={setUser} />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900">
      <nav className="bg-white border-b border-zinc-200 px-6 py-4 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView("dashboard")}>
            <div className="p-2 bg-emerald-50 rounded-lg">
              <GraduationCap className="w-6 h-6 text-emerald-600" />
            </div>
            <span className="font-black text-xl tracking-tight">Ruby Mastery AI</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setView("dashboard")}
              className={`p-2 rounded-lg transition-colors ${view === "dashboard" ? "bg-zinc-100 text-zinc-900" : "text-zinc-400 hover:text-zinc-600"}`}
            >
              <LayoutDashboard className="w-5 h-5" />
            </button>
            {isAdmin && (
              <button
                onClick={() => setView("admin")}
                className={`p-2 rounded-lg transition-colors ${view === "admin" ? "bg-zinc-100 text-zinc-900" : "text-zinc-400 hover:text-zinc-600"}`}
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
            <div className="h-6 w-px bg-zinc-200 mx-2" />
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm font-bold text-zinc-400 hover:text-rose-600 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <main className="py-12">
        {view === "dashboard" && (
          <Dashboard 
            user={user} 
            onStartQuiz={() => setView("quiz")} 
            onAdmin={() => setView("admin")}
            isAdmin={isAdmin}
          />
        )}
        {view === "quiz" && (
          <QuizView user={user} onComplete={() => setView("dashboard")} />
        )}
        {view === "admin" && isAdmin && (
          <AdminPanel />
        )}
      </main>
    </div>
  );
}
