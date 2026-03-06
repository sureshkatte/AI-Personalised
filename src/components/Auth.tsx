import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useState, useEffect } from "react";
import { GraduationCap, LogIn } from "lucide-react";

interface AuthProps {
  onAuth: (user: User) => void;
}

export default function Auth({ onAuth }: AuthProps) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Ensure user profile exists in Firestore
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            userId: user.uid,
            email: user.email,
            rubyLevel: 1,
            stats: { totalAttempted: 0, totalCorrect: 0 },
            incorrectQuestionIds: []
          });
        }
        onAuth(user);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [onAuth]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-zinc-200 p-8 text-center">
        <div className="w-20 h-20 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <GraduationCap className="w-12 h-12 text-emerald-600" />
        </div>
        <h1 className="text-3xl font-black text-zinc-900 mb-2 tracking-tight">Ruby Mastery AI</h1>
        <p className="text-zinc-500 mb-8">Master the Ruby language with our adaptive AI-powered learning platform.</p>
        
        <button
          onClick={handleLogin}
          className="w-full bg-zinc-900 text-white py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-zinc-800 transition-all active:scale-95"
        >
          <LogIn className="w-5 h-5" />
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
