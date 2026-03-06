import { useState } from "react";
import { api, User } from "../lib/api";
import { agents } from "../lib/gemini";
import { motion } from "motion/react";
import { ChevronRight, BrainCircuit, Target, BookOpen, Briefcase, AlertCircle, MessageSquare } from "lucide-react";
import { AI_PERSONAS } from "../constants";

interface OnboardingProps {
  onComplete: (user: User) => void;
  userId: string;
}

export default function Onboarding({ onComplete, userId }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    domain: "Technology",
    subdomain: "",
    current_designation: "Student",
    desired_designation: "Intern",
    experience: 1,
    learning_goal: "Skill upgrade",
    learning_style: "MCQ",
    persona: "Socratic Mentor" // New: Default persona
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const domains = ["Technology", "Finance", "Health", "Business", "Design", "Custom"];
  const goals = ["Job prep", "Skill upgrade", "Interview prep", "Certification"];
  const styles = ["MCQ", "Coding", "Case-based", "Concept"];

  const designationMappings: Record<string, string[]> = {
    "Student": ["Intern", "Junior Developer", "Junior Analyst", "Junior Designer"],
    "Intern": ["Junior Developer", "Junior Analyst", "Junior Designer", "Associate"],
    "Junior Developer": ["Senior Developer", "Full Stack Developer", "Backend Engineer", "Frontend Engineer"],
    "Senior Developer": ["Tech Lead", "Software Architect", "Engineering Manager", "CTO"],
    "Analyst": ["Senior Analyst", "Data Scientist", "Business Analyst", "Product Manager"],
    "Senior Analyst": ["Analytics Manager", "Director of Data", "Product Lead"],
    "Designer": ["Senior Designer", "UX Lead", "Art Director", "Product Designer"],
    "Manager": ["Senior Manager", "Director", "VP", "CEO"],
    "Other": ["Specialist", "Consultant", "Lead", "Expert"]
  };

  const currentDesignations = Object.keys(designationMappings);

  const handleNext = () => setStep(s => s + 1);
  const handleBack = () => setStep(s => s - 1);

  const handleSubmit = async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      // 1. Profile Analysis Agent
      const analysis = await agents.analyzeProfile(formData);
      
      const newUser: User = {
        id: userId,
        email: "", // Email is set during registration, not onboarding
        ...formData,
        current_levels: { // Initialize with current domain/subdomain level
          [formData.domain]: {
            [formData.subdomain]: analysis.initial_level_assessment || "Beginner"
          }
        },
        current_difficulty: {
          [formData.domain]: {
            [formData.subdomain]: 5 // Start with a default difficulty of 5
          }
        }
      };

      // 2. Save to DB
      const result = await api.saveUser(newUser);
      if (result.error) throw new Error(result.error);
      
      onComplete(newUser);
    } catch (error: any) {
      console.error("Onboarding failed:", error);
      let msg = error.message || "Failed to analyze profile. Please try again.";
      if (msg.toLowerCase().includes("quota")) {
        msg = "Gemini API quota exceeded. Please click the 'API Key' button in the header to use your own key, or try again later.";
      }
      setError(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isAnalyzing) {
    return (
      <div className="max-w-xl mx-auto mt-20 text-center px-6">
        <div className="relative inline-block mb-10">
          <div className="absolute inset-0 bg-brand-500 rounded-full blur-2xl opacity-20 animate-pulse" />
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="relative bg-white p-6 rounded-[2rem] shadow-xl border border-brand-100"
          >
            <BrainCircuit className="w-12 h-12 text-brand-600" />
          </motion.div>
        </div>
        <h2 className="text-3xl font-extrabold text-zinc-900 mb-4 tracking-tight">Analyzing Your Profile</h2>
        <p className="text-zinc-500 mb-10 font-medium">Our AI Agent is crafting your personalized mastery path based on your experience and goals...</p>
        <div className="w-full bg-zinc-100 h-3 rounded-full overflow-hidden border border-zinc-200/50">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ duration: 4 }}
            className="bg-brand-600 h-full"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-8 sm:mt-16 px-4">
      <div className="bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-zinc-200/50 overflow-hidden">
        <div className="bg-zinc-900 px-10 py-10 text-white relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-3xl font-extrabold tracking-tight mb-2">Welcome to AI Coach</h2>
            <p className="text-zinc-400 font-medium">Let's build your personalized learning profile.</p>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/20 rounded-full blur-3xl -mr-16 -mt-16" />
        </div>

        <div className="p-10">
          {/* Progress Dots */}
          <div className="flex gap-2 mb-10">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${step >= i ? "w-8 bg-brand-600" : "w-2 bg-zinc-100"}`} />
            ))}
          </div>

          {step === 1 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              <div>
                <label className="text-sm font-extrabold text-zinc-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <Target className="w-4 h-4 text-brand-600" />
                  Primary Domain
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {domains.map(d => (
                    <button
                      key={d}
                      onClick={() => setFormData({ ...formData, domain: d })}
                      className={`px-4 py-4 rounded-2xl border-2 text-sm font-bold transition-all ${
                        formData.domain === d 
                          ? "bg-brand-50 border-brand-600 text-brand-700 shadow-md shadow-brand-100" 
                          : "bg-white border-zinc-100 text-zinc-500 hover:border-zinc-200"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-extrabold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-brand-600" />
                  Sub-domain / Technology
                </label>
                <input
                  type="text"
                  placeholder="e.g. React, Python, Corporate Finance..."
                  value={formData.subdomain}
                  onChange={e => setFormData({ ...formData, subdomain: e.target.value })}
                  className="w-full px-6 py-4 rounded-2xl border-2 border-zinc-100 focus:border-brand-600 outline-none transition-all font-bold text-zinc-900 placeholder:text-zinc-300"
                />
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              <div>
                <label className="text-sm font-extrabold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-brand-600" />
                  Current Designation
                </label>
                <select
                  value={formData.current_designation}
                  onChange={e => {
                    const val = e.target.value;
                    setFormData({ 
                      ...formData, 
                      current_designation: val,
                      desired_designation: designationMappings[val][0]
                    });
                  }}
                  className="w-full px-6 py-4 rounded-2xl border-2 border-zinc-100 focus:border-brand-600 outline-none transition-all font-bold text-zinc-900 bg-white"
                >
                  {currentDesignations.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-extrabold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Target className="w-4 h-4 text-brand-600" />
                  Desired Designation
                </label>
                <select
                  value={formData.desired_designation}
                  onChange={e => setFormData({ ...formData, desired_designation: e.target.value })}
                  className="w-full px-6 py-4 rounded-2xl border-2 border-zinc-100 focus:border-brand-600 outline-none transition-all font-bold text-zinc-900 bg-white"
                >
                  {designationMappings[formData.current_designation].map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              <div>
                <label className="text-sm font-extrabold text-zinc-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-brand-600" />
                  Experience Level
                </label>
                <div className="px-4">
                  <input
                    type="range"
                    min="0"
                    max="20"
                    value={formData.experience}
                    onChange={e => setFormData({ ...formData, experience: parseInt(e.target.value) })}
                    className="w-full h-2 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-brand-600 mb-4"
                  />
                  <div className="text-center">
                    <span className="text-4xl font-black text-zinc-900">{formData.experience}</span>
                    <span className="text-sm font-bold text-zinc-400 ml-2 uppercase tracking-widest">Years</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-extrabold text-zinc-400 uppercase tracking-widest mb-6">Learning Goal</label>
                <div className="grid grid-cols-2 gap-3">
                  {goals.map(g => (
                    <button
                      key={g}
                      onClick={() => setFormData({ ...formData, learning_goal: g })}
                      className={`px-4 py-4 rounded-2xl border-2 text-sm font-bold transition-all ${
                        formData.learning_goal === g 
                          ? "bg-brand-50 border-brand-600 text-brand-700 shadow-md shadow-brand-100" 
                          : "bg-white border-zinc-100 text-zinc-500 hover:border-zinc-200"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              {error && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 text-sm font-medium">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  {error}
                </div>
              )}
              <div>
                <label className="text-sm font-extrabold text-zinc-400 uppercase tracking-widest mb-6">Learning Style</label>
                <div className="grid grid-cols-2 gap-3">
                  {styles.map(s => (
                    <button
                      key={s}
                      onClick={() => setFormData({ ...formData, learning_style: s })}
                      className={`px-4 py-4 rounded-2xl border-2 text-sm font-bold transition-all ${
                        formData.learning_style === s 
                          ? "bg-brand-50 border-brand-600 text-brand-700 shadow-md shadow-brand-100" 
                          : "bg-white border-zinc-100 text-zinc-500 hover:border-zinc-200"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100">
                <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3">Profile Summary</h4>
                <p className="text-sm text-zinc-600 font-medium leading-relaxed">
                  You are a <span className="text-zinc-900 font-bold">{formData.current_designation}</span> with <span className="text-zinc-900 font-bold">{formData.experience} years</span> of experience in <span className="text-zinc-900 font-bold">{formData.domain}</span>. 
                  You are aiming to become a <span className="text-zinc-900 font-bold">{formData.desired_designation}</span>.
                  Your goal is <span className="text-zinc-900 font-bold">{formData.learning_goal}</span> using <span className="text-zinc-900 font-bold">{formData.learning_style}</span> assessments.
                </p>
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              {error && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 text-sm font-medium">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  {error}
                </div>
              )}
              <div>
                <label className="text-sm font-extrabold text-zinc-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-brand-600" />
                  Choose Your AI Persona
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {AI_PERSONAS.map(p => (
                    <button
                      key={p}
                      onClick={() => setFormData({ ...formData, persona: p })}
                      className={`px-4 py-4 rounded-2xl border-2 text-sm font-bold transition-all ${
                        formData.persona === p 
                          ? "bg-brand-50 border-brand-600 text-brand-700 shadow-md shadow-brand-100" 
                          : "bg-white border-zinc-100 text-zinc-500 hover:border-zinc-200"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100">
                <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3">Final Profile Summary</h4>
                <p className="text-sm text-zinc-600 font-medium leading-relaxed">
                  You are a <span className="text-zinc-900 font-bold">{formData.current_designation}</span> with <span className="text-zinc-900 font-bold">{formData.experience} years</span> of experience in <span className="text-zinc-900 font-bold">{formData.domain}</span>. 
                  You are aiming to become a <span className="text-zinc-900 font-bold">{formData.desired_designation}</span>.
                  Your goal is <span className="text-zinc-900 font-bold">{formData.learning_goal}</span> using <span className="text-zinc-900 font-bold">{formData.learning_style}</span> assessments.
                  Your AI Coach will interact with you as a <span className="text-zinc-900 font-bold">{formData.persona}</span>.
                </p>
              </div>
            </motion.div>
          )}

          <div className="flex items-center justify-between mt-12">
            {step > 1 ? (
              <button
                onClick={handleBack}
                className="px-8 py-4 text-sm font-bold text-zinc-400 hover:text-zinc-900 transition-colors"
              >
                Back
              </button>
            ) : <div />}
            
            <button
              onClick={step === 5 ? handleSubmit : handleNext}
              disabled={step === 1 && !formData.subdomain}
              className="group flex items-center gap-3 bg-zinc-900 text-white px-10 py-4 rounded-2xl font-bold hover:bg-brand-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl shadow-zinc-200"
            >
              {step === 5 ? "Start Journey" : "Next Step"}
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
