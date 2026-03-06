export interface User {
  id: string;
  email: string;
  domain: string;
  subdomain: string;
  current_designation: string;
  desired_designation: string;
  experience: number;
  learning_goal: string;
  learning_style: string;
  current_levels: Record<string, Record<string, string>>; // domain -> subdomain -> level
  current_difficulty: Record<string, Record<string, number>>; // domain -> subdomain -> difficulty (1-10)
  persona: string; // New: AI persona for learning
}

export interface Quiz {
  id: string;
  title?: string;
  domain: string;
  subdomain: string;
  level: string;
  difficulty: number;
  tags: string;
  created_by: string;
  created_at: string;
  questions?: Question[];
}

export interface Question {
  id: string;
  quiz_id: string;
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  references?: string[];
}

export interface Attempt {
  id: string;
  user_id: string;
  quiz_id: string;
  subdomain: string;
  score: number;
  detected_level: string;
  detected_difficulty?: number;
  weak_topics: string[];
  answers: string[];
  timestamp: string;
}

export interface Knowledge {
  id: string;
  domain: string;
  subdomain: string;
  content: string;
}

const request = async (url: string, options: RequestInit = {}) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 10000); // 10s timeout

  const userId = localStorage.getItem("coach_user_id");
  const headers = {
    ...options.headers as any,
    ...(userId ? { "Authorization": `Bearer ${userId}` } : {})
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(id);

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(`Invalid JSON response from server: ${text.slice(0, 100)}...`);
    }

    if (!response.ok) {
      throw new Error(data.error || `Server error: ${response.status}`);
    }

    return data;
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. The server might be busy or down.');
    }
    throw error;
  }
};

export const api = {
  login: (credentials: any) => request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials)
  }),
  
  register: (credentials: any) => request("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials)
  }),
  
  getUser: (id: string) => request(`/api/user/${id}`),
  
  saveUser: (user: Partial<User>) => request("/api/user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user)
  }),
  
  getQuizzes: (domain?: string, level?: string, subdomain?: string) => {
    const params = new URLSearchParams();
    if (domain) params.append("domain", domain);
    if (level) params.append("level", level);
    if (subdomain) params.append("subdomain", subdomain);
    return request(`/api/quizzes?${params}`);
  },
  
  getQuiz: (id: string) => request(`/api/quizzes/${id}`),
  
  saveQuiz: (quiz: any) => request("/api/quizzes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(quiz)
  }),
  
  saveAttempt: (attempt: any) => request("/api/attempts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(attempt)
  }),
  
  getAttempts: (userId: string) => request(`/api/user/${userId}/attempts`),
  
  getKnowledge: (query: string) => {
    const params = new URLSearchParams();
    params.append("query", query);
    return request(`/api/knowledge?${params}`);
  },

  uploadKnowledge: (file: File, domain: string, subdomain: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('domain', domain);
    formData.append('subdomain', subdomain);
    return request("/api/knowledge/upload", {
      method: "POST",
      body: formData
    });
  }
};
