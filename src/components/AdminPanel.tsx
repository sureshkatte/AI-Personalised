import { useState } from "react";
import { db } from "../firebase";
import { collection, addDoc } from "firebase/firestore";
import { Plus, Send, Trash2 } from "lucide-react";

export default function AdminPanel() {
  const [text, setText] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctAnswer, setCorrectAnswer] = useState(0);
  const [difficulty, setDifficulty] = useState(1);
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      await addDoc(collection(db, "questions"), {
        text,
        options,
        correctAnswer,
        difficulty,
        topic,
        source: "admin",
        createdAt: new Date().toISOString()
      });
      setMessage("Question added successfully!");
      setText("");
      setOptions(["", "", "", ""]);
      setCorrectAnswer(0);
      setTopic("");
    } catch (error) {
      console.error("Error adding question:", error);
      setMessage("Failed to add question. Check permissions.");
    } finally {
      setLoading(false);
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-indigo-50 rounded-xl">
            <Plus className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Add Ruby Question</h2>
            <p className="text-zinc-500 text-sm">Create new learning material for the community.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Question Text</label>
            <textarea
              required
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="e.g., What is the difference between procs and lambdas in Ruby?"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Topic</label>
              <input
                required
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="e.g., Blocks & Procs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Difficulty (1-5)</label>
              <input
                required
                type="number"
                min="1"
                max="5"
                value={difficulty}
                onChange={(e) => setDifficulty(parseInt(e.target.value))}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Options</label>
            {options.map((opt, i) => (
              <div key={i} className="flex gap-3">
                <input
                  required
                  type="text"
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value)}
                  className={`flex-1 bg-zinc-50 border rounded-xl p-3 outline-none transition-all ${
                    correctAnswer === i ? "border-emerald-500 ring-1 ring-emerald-500" : "border-zinc-200"
                  }`}
                  placeholder={`Option ${i + 1}`}
                />
                <button
                  type="button"
                  onClick={() => setCorrectAnswer(i)}
                  className={`px-4 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${
                    correctAnswer === i ? "bg-emerald-500 text-white" : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200"
                  }`}
                >
                  Correct
                </button>
              </div>
            ))}
          </div>

          <div className="pt-4">
            <button
              disabled={loading}
              className="w-full bg-zinc-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-800 transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? "Adding..." : <><Send className="w-4 h-4" /> Publish Question</>}
            </button>
            {message && (
              <p className={`mt-4 text-center font-bold text-sm ${message.includes("success") ? "text-emerald-600" : "text-rose-600"}`}>
                {message}
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
