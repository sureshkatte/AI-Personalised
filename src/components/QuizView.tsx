import { useState, useEffect } from "react";
import { User } from "firebase/auth";
import { db } from "../firebase";
import { collection, query, where, getDocs, doc, updateDoc, getDoc, arrayUnion, increment } from "firebase/firestore";
import { generateAdaptiveQuestions, GeneratedQuestion } from "../services/geminiService";
import { CheckCircle2, XCircle, ArrowRight, Loader2, BrainCircuit } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface QuizViewProps {
  user: User;
  onComplete: () => void;
}

export default function QuizView({ user, onComplete }: QuizViewProps) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const initQuiz = async () => {
      setLoading(true);
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();
      setProfile(userData);

      let quizQuestions: any[] = [];

      // Level 1: Start with Admin questions
      if (userData?.rubyLevel === 1) {
        const q = query(collection(db, "questions"), where("source", "==", "admin"));
        const snap = await getDocs(q);
        quizQuestions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } else {
        // Level 2+: AI Adaptive questions
        const aiQuestions = await generateAdaptiveQuestions(
          userData?.rubyLevel || 1,
          userData?.incorrectTopics || []
        );
        quizQuestions = aiQuestions.map((q, i) => ({ id: `ai-${i}`, ...q }));
      }

      // If no questions found (e.g. admin hasn't uploaded), fallback to AI
      if (quizQuestions.length === 0) {
        const fallback = await generateAdaptiveQuestions(userData?.rubyLevel || 1, []);
        quizQuestions = fallback.map((q, i) => ({ id: `ai-fallback-${i}`, ...q }));
      }

      setQuestions(quizQuestions.sort(() => Math.random() - 0.5).slice(0, 5));
      setLoading(false);
    };

    initQuiz();
  }, [user.uid]);

  const handleAnswer = async (optionIndex: number) => {
    if (isAnswered) return;
    setSelectedOption(optionIndex);
    setIsAnswered(true);

    const currentQ = questions[currentIndex];
    const isCorrect = optionIndex === currentQ.correctAnswer;

    if (isCorrect) {
      setScore(s => s + 1);
    }

    // Update user stats
    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, {
      "stats.totalAttempted": increment(1),
      "stats.totalCorrect": isCorrect ? increment(1) : increment(0),
      ...(isCorrect ? {} : { 
        incorrectQuestionIds: arrayUnion(currentQ.id),
        incorrectTopics: arrayUnion(currentQ.topic)
      })
    });
  };

  const nextQuestion = async () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      // Quiz complete
      const userRef = doc(db, "users", user.uid);
      // If score is high, level up
      if (score >= 3) {
        await updateDoc(userRef, {
          rubyLevel: increment(1)
        });
      }
      onComplete();
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
        <p className="text-zinc-500 font-medium animate-pulse">AI is preparing your custom quiz...</p>
      </div>
    );
  }

  const currentQ = questions[currentIndex];

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white font-bold">
            {currentIndex + 1}
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Question {currentIndex + 1} of {questions.length}</p>
            <p className="text-sm font-bold text-zinc-900">{currentQ.topic}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full">
          <BrainCircuit className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest">Level {profile?.rubyLevel}</span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-8"
        >
          <h2 className="text-2xl font-black text-zinc-900 leading-tight">
            {currentQ.text}
          </h2>

          <div className="grid grid-cols-1 gap-4">
            {currentQ.options.map((option: string, i: number) => {
              const isCorrect = i === currentQ.correctAnswer;
              const isSelected = i === selectedOption;
              
              let bgColor = "bg-white";
              let borderColor = "border-zinc-200";
              
              if (isAnswered) {
                if (isCorrect) {
                  bgColor = "bg-emerald-50";
                  borderColor = "border-emerald-500";
                } else if (isSelected) {
                  bgColor = "bg-rose-50";
                  borderColor = "border-rose-500";
                }
              } else if (isSelected) {
                borderColor = "border-zinc-900";
              }

              return (
                <button
                  key={i}
                  disabled={isAnswered}
                  onClick={() => handleAnswer(i)}
                  className={`w-full text-left p-6 rounded-2xl border-2 transition-all flex items-center justify-between group ${bgColor} ${borderColor} ${!isAnswered && "hover:border-zinc-400 hover:bg-zinc-50"}`}
                >
                  <span className={`font-bold ${isAnswered && isCorrect ? "text-emerald-700" : isAnswered && isSelected ? "text-rose-700" : "text-zinc-700"}`}>
                    {option}
                  </span>
                  {isAnswered && isCorrect && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
                  {isAnswered && isSelected && !isCorrect && <XCircle className="w-6 h-6 text-rose-500" />}
                </button>
              );
            })}
          </div>

          {isAnswered && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 bg-zinc-900 rounded-3xl text-white"
            >
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Explanation</p>
              <p className="text-sm text-zinc-300 leading-relaxed mb-6">
                {currentQ.explanation || "The correct answer is " + currentQ.options[currentQ.correctAnswer] + "."}
              </p>
              <button
                onClick={nextQuestion}
                className="w-full bg-white text-zinc-900 py-4 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-zinc-100 transition-all active:scale-95"
              >
                {currentIndex === questions.length - 1 ? "Finish Quiz" : "Next Question"}
                <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
