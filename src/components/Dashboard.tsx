import { User } from "firebase/auth";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { useState, useEffect } from "react";
import { Play, Trophy, Target, BookOpen, Settings } from "lucide-react";

interface DashboardProps {
  user: User;
  onStartQuiz: () => void;
  onAdmin: () => void;
  isAdmin: boolean;
}

export default function Dashboard({ user, onStartQuiz, onAdmin, isAdmin }: DashboardProps) {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) setProfile(snap.data());
    };
    fetchProfile();
  }, [user.uid]);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 tracking-tight">Welcome back, {user.displayName?.split(' ')[0]}!</h1>
          <p className="text-zinc-500">Ready to level up your Ruby skills today?</p>
        </div>
        {isAdmin && (
          <button
            onClick={onAdmin}
            className="p-3 bg-zinc-100 rounded-xl hover:bg-zinc-200 transition-colors"
            title="Admin Panel"
          >
            <Settings className="w-6 h-6 text-zinc-600" />
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          icon={<Trophy className="w-5 h-5 text-amber-600" />}
          label="Ruby Level"
          value={profile?.rubyLevel || 1}
          color="bg-amber-50"
        />
        <StatCard 
          icon={<Target className="w-5 h-5 text-emerald-600" />}
          label="Accuracy"
          value={`${profile?.stats?.totalAttempted ? Math.round((profile.stats.totalCorrect / profile.stats.totalAttempted) * 100) : 0}%`}
          color="bg-emerald-50"
        />
        <StatCard 
          icon={<BookOpen className="w-5 h-5 text-indigo-600" />}
          label="Total Attempted"
          value={profile?.stats?.totalAttempted || 0}
          color="bg-indigo-50"
        />
      </div>

      <div className="bg-zinc-900 rounded-[2.5rem] p-12 text-center text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.15),transparent)] pointer-events-none" />
        <h2 className="text-4xl font-black mb-4 relative z-10">Start Adaptive Quiz</h2>
        <p className="text-zinc-400 mb-8 max-w-md mx-auto relative z-10">
          Our AI will analyze your performance and generate questions tailored to your skill level and weak areas.
        </p>
        <button
          onClick={onStartQuiz}
          className="bg-emerald-500 hover:bg-emerald-400 text-zinc-900 font-black py-4 px-12 rounded-2xl text-lg flex items-center gap-3 mx-auto transition-all active:scale-95 relative z-10"
        >
          <Play className="w-6 h-6 fill-current" />
          Begin Session
        </button>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: any, label: string, value: any, color: string }) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm flex items-center gap-4">
      <div className={`p-3 rounded-2xl ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{label}</p>
        <p className="text-2xl font-black text-zinc-900">{value}</p>
      </div>
    </div>
  );
}
