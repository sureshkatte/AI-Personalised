import http.server
import socketserver
import json
import sqlite3
import time
import os
import urllib.request
import math
import re
from urllib.parse import urlparse, parse_qs

PORT = 8000
DB_PATH = "coach.db"

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    cursor.executescript("""
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        password TEXT,
        domain TEXT,
        subdomain TEXT,
        current_designation TEXT,
        desired_designation TEXT,
        experience INTEGER,
        learning_goal TEXT,
        learning_style TEXT,
        current_levels TEXT DEFAULT '{}',
        current_difficulty TEXT DEFAULT '{}',
        persona TEXT DEFAULT 'Socratic Mentor'
      );

      CREATE TABLE IF NOT EXISTS quizzes (
        id TEXT PRIMARY KEY,
        title TEXT,
        domain TEXT,
        subdomain TEXT,
        level TEXT,
        difficulty INTEGER,
        tags TEXT,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY,
        quiz_id TEXT,
        question_text TEXT,
        options TEXT, -- JSON string
        correct_answer TEXT,
        explanation TEXT,
        embedding TEXT, -- JSON string
        FOREIGN KEY(quiz_id) REFERENCES quizzes(id)
      );

      CREATE TABLE IF NOT EXISTS user_quiz_attempts (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        quiz_id TEXT,
        subdomain TEXT,
        score INTEGER,
        detected_level TEXT,
        detected_difficulty INTEGER,
        weak_topics TEXT, -- JSON string
        answers TEXT, -- JSON string
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(quiz_id) REFERENCES quizzes(id)
      );
    """)
    conn.commit()
    conn.close()

init_db()

class VectorDbService:
    def __init__(self):
        self.documents = []

    def generate_embedding(self, text):
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("API_KEY")
        if not api_key: return [0.0] * 768 # Fallback
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={api_key}"
        data = json.dumps({
            "model": "models/text-embedding-004",
            "content": {"parts": [{"text": text}]}
        }).encode('utf-8')
        
        try:
            req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(req) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                return res_data['embedding']['values']
        except Exception as e:
            print(f"Embedding error: {e}")
            return [0.0] * 768

    def cosine_similarity(self, vec1, vec2):
        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        mag1 = math.sqrt(sum(a * a for a in vec1))
        mag2 = math.sqrt(sum(a * a for a in vec2))
        if mag1 == 0 or mag2 == 0: return 0
        return dot_product / (mag1 * mag2)

    def add_document(self, doc_id, content):
        embedding = self.generate_embedding(content)
        self.documents.append({"id": doc_id, "content": content, "embedding": embedding})

    def search(self, query, top_k=3):
        if not self.documents: return []
        query_embedding = self.generate_embedding(query)
        results = []
        for doc in self.documents:
            similarity = self.cosine_similarity(query_embedding, doc['embedding'])
            results.append({"doc": doc, "similarity": similarity})
        results.sort(key=lambda x: x['similarity'], reverse=True)
        return [res['doc'] for res in results[:top_k]]

vector_db = VectorDbService()

class RequestHandler(http.server.BaseHTTPRequestHandler):
    def check_auth(self):
        # Normalize path: remove query string and trailing slashes
        path = self.path.split('?')[0].rstrip('/')
        if not path: path = "/"
        
        # Public routes: check if path ends with these patterns
        public_patterns = ["/auth/login", "/auth/register", "/health"]
        if any(path.endswith(p) for p in public_patterns):
            return True
        
        auth_header = self.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            self.send_error(401, "Unauthorized: Missing Authorization header")
            return False
        
        # For this demo, we'll just check if the token exists as a user_id
        token = auth_header.split(" ")[1]
        conn = get_db()
        user = conn.execute("SELECT id FROM users WHERE id = ?", (token,)).fetchone()
        conn.close()
        
        if not user:
            self.send_error(401, "Unauthorized: Invalid token")
            return False
        
        return True

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def do_GET(self):
        if not self.check_auth(): return
        
        path = self.path.split('?')[0].rstrip('/')
        if not path: path = "/"
        query = parse_qs(urlparse(self.path).query)

        if path == "/api/health" or path == "/health":
            self.send_json({"status": "ok"})
        
        elif path == "/api/quizzes" or path == "/quizzes":
            domain = query.get("domain", [None])[0]
            level = query.get("level", [None])[0]
            subdomain = query.get("subdomain", [None])[0]
            
            sql = "SELECT * FROM quizzes"
            params = []
            conds = []
            if domain: conds.append("domain = ?"); params.append(domain)
            if level: conds.append("level = ?"); params.append(level)
            if subdomain: conds.append("subdomain = ?"); params.append(subdomain)
            if conds: sql += " WHERE " + " AND ".join(conds)
            
            conn = get_db()
            quizzes = conn.execute(sql, params).fetchall()
            conn.close()
            self.send_json([dict(q) for q in quizzes])

        elif path.startswith("/api/quizzes/") or path.startswith("/quizzes/"):
            quiz_id = path.split("/")[-1]
            conn = get_db()
            quiz = conn.execute("SELECT * FROM quizzes WHERE id = ?", (quiz_id,)).fetchone()
            if not quiz:
                conn.close()
                self.send_error(404, "Quiz not found")
                return
            questions = conn.execute("SELECT * FROM questions WHERE quiz_id = ?", (quiz_id,)).fetchall()
            conn.close()
            qd = dict(quiz)
            qd['questions'] = [dict(q) for q in questions]
            for q in qd['questions']: q['options'] = json.loads(q['options'])
            self.send_json(qd)

        elif (path.startswith("/api/user/") or path.startswith("/user/")) and path.endswith("/attempts"):
            user_id = path.split("/")[-2]
            conn = get_db()
            attempts = conn.execute("SELECT * FROM user_quiz_attempts WHERE user_id = ? ORDER BY timestamp DESC", (user_id,)).fetchall()
            conn.close()
            res = []
            for a in attempts:
                ad = dict(a)
                ad['weak_topics'] = json.loads(ad['weak_topics'] or "[]")
                ad['answers'] = json.loads(ad['answers'] or "[]")
                res.append(ad)
            self.send_json(res)

        elif path.startswith("/api/user/") or path.startswith("/user/"):
            user_id = path.split("/")[-1]
            conn = get_db()
            user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            conn.close()
            if user:
                ud = dict(user)
                ud['current_levels'] = json.loads(ud['current_levels'] or "{}")
                ud['current_difficulty'] = json.loads(ud['current_difficulty'] or "{}")
                self.send_json(ud)
            else:
                self.send_error(404, "User not found")

        elif path == "/api/knowledge" or path == "/knowledge":
            q = query.get("query", [None])[0]
            if not q: self.send_error(400, "Query required"); return
            results = vector_db.search(q, 5)
            self.send_json([{"id": r['id'], "content": r['content']} for r in results])

        elif path == "/api/generate-quiz" or path == "/generate-quiz":
            # New endpoint for AI generated quizzes
            user_id = query.get("user_id", [None])[0]
            domain = query.get("domain", [None])[0]
            subdomain = query.get("subdomain", [None])[0]
            
            if not user_id or not domain or not subdomain:
                self.send_error(400, "Missing parameters"); return
                
            conn = get_db()
            user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            conn.close()
            
            if not user: self.send_error(404, "User not found"); return
            
            cl = json.loads(user['current_levels'] or "{}")
            cd = json.loads(user['current_difficulty'] or "{}")
            level = cl.get(domain, {}).get(subdomain, "Beginner")
            difficulty = cd.get(domain, {}).get(subdomain, 5)
            
            # Search knowledge base for context
            context_docs = vector_db.search(f"{domain} {subdomain}", 3)
            context_text = "\n".join([d['content'] for d in context_docs])
            
            # Call Gemini to generate quiz
            api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("API_KEY")
            prompt = f"""
            Generate a 5-question quiz for a {user['persona']} style coach.
            Topic: {domain} - {subdomain}
            Level: {level}
            Difficulty: {difficulty}/10
            Context: {context_text}
            
            Return ONLY a JSON object with:
            {{
              "title": "Quiz Title",
              "questions": [
                {{
                  "id": "q1",
                  "question_text": "...",
                  "options": ["A", "B", "C", "D"],
                  "correct_answer": "...",
                  "explanation": "Detailed explanation with references to context if applicable."
                }}
              ]
            }}
            """
            
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
            data = json.dumps({"contents": [{"parts": [{"text": prompt}]}]}).encode('utf-8')
            
            try:
                req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
                with urllib.request.urlopen(req) as response:
                    res_data = json.loads(response.read().decode('utf-8'))
                    text = res_data['candidates'][0]['content']['parts'][0]['text']
                    # Extract JSON from markdown
                    json_match = re.search(r'\{.*\}', text, re.DOTALL)
                    if json_match:
                        quiz_json = json.loads(json_match.group())
                        self.send_json(quiz_json)
                    else:
                        self.send_error(500, "Failed to parse AI response")
            except Exception as e:
                self.send_error(500, str(e))

        else:
            self.send_error(404)

    def do_POST(self):
        if not self.check_auth(): return
        
        path = self.path.split('?')[0].rstrip('/')
        if not path: path = "/"
        
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        data = json.loads(post_data.decode('utf-8'))

        if path == "/api/auth/register" or path == "/auth/register":
            email = data.get("email")
            password = data.get("password")
            user_id = f"user_{int(time.time() * 1000)}"
            conn = get_db()
            try:
                conn.execute("INSERT INTO users (id, email, password, current_levels, current_difficulty, persona) VALUES (?, ?, ?, ?, ?, ?)",
                             (user_id, email, password, json.dumps({}), json.dumps({}), "Socratic Mentor"))
                conn.commit()
                user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
                ud = dict(user)
                ud['current_levels'] = json.loads(ud['current_levels'] or "{}")
                ud['current_difficulty'] = json.loads(ud['current_difficulty'] or "{}")
                self.send_json(ud)
            except sqlite3.IntegrityError:
                self.send_error(400, "Email exists")
            finally:
                conn.close()

        elif path == "/api/auth/login" or path == "/auth/login":
            email = data.get("email")
            password = data.get("password")
            conn = get_db()
            user = conn.execute("SELECT * FROM users WHERE email = ? AND password = ?", (email, password)).fetchone()
            conn.close()
            if user:
                ud = dict(user)
                ud['current_levels'] = json.loads(ud['current_levels'] or "{}")
                ud['current_difficulty'] = json.loads(ud['current_difficulty'] or "{}")
                self.send_json(ud)
            else:
                self.send_error(401, "Invalid credentials")

        elif path == "/api/user" or path == "/user":
            user_id = data.get("id")
            conn = get_db()
            conn.execute("""
                UPDATE users 
                SET domain = ?, subdomain = ?, current_designation = ?, desired_designation = ?, experience = ?, learning_goal = ?, learning_style = ?, current_levels = ?, current_difficulty = ?, persona = ?
                WHERE id = ?
            """, (data.get("domain"), data.get("subdomain"), data.get("current_designation"), data.get("desired_designation"), data.get("experience"), data.get("learning_goal"), data.get("learning_style"), json.dumps(data.get("current_levels")), json.dumps(data.get("current_difficulty")), data.get("persona"), user_id))
            conn.commit()
            conn.close()
            self.send_json({"success": True})

        elif path == "/api/quizzes" or path == "/quizzes":
            quiz_id = data.get("id")
            questions = data.get("questions", [])
            conn = get_db()
            try:
                conn.execute("INSERT INTO quizzes (id, title, domain, subdomain, level, difficulty, tags, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                             (quiz_id, data.get("title"), data.get("domain"), data.get("subdomain"), data.get("level"), data.get("difficulty"), data.get("tags"), data.get("created_by")))
                for q in questions:
                    conn.execute("INSERT INTO questions (id, quiz_id, question_text, options, correct_answer, explanation) VALUES (?, ?, ?, ?, ?, ?)",
                                 (q.get("id"), quiz_id, q.get("question_text"), json.dumps(q.get("options")), q.get("correct_answer"), q.get("explanation")))
                conn.commit()
                self.send_json({"success": True})
            except Exception as e:
                self.send_error(500, str(e))
            finally:
                conn.close()

        elif path == "/api/attempts" or path == "/attempts":
            user_id = data.get("user_id")
            quiz_id = data.get("quiz_id")
            subdomain = data.get("subdomain")
            conn = get_db()
            conn.execute("""
                INSERT INTO user_quiz_attempts (id, user_id, quiz_id, subdomain, score, detected_level, detected_difficulty, weak_topics, answers)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (data.get("id"), user_id, quiz_id, subdomain, data.get("score"), data.get("detected_level"), data.get("detected_difficulty"), json.dumps(data.get("weak_topics")), json.dumps(data.get("answers", []))))
            
            user_record = conn.execute("SELECT current_levels, current_difficulty FROM users WHERE id = ?", (user_id,)).fetchone()
            quiz_record = conn.execute("SELECT domain FROM quizzes WHERE id = ?", (quiz_id,)).fetchone()
            if user_record and quiz_record:
                cl = json.loads(user_record['current_levels'] or "{}")
                cd = json.loads(user_record['current_difficulty'] or "{}")
                dom = quiz_record['domain']
                if dom not in cl: cl[dom] = {}
                if dom not in cd: cd[dom] = {}
                cl[dom][subdomain] = data.get("detected_level")
                cd[dom][subdomain] = data.get("detected_difficulty") or 5
                conn.execute("UPDATE users SET current_levels = ?, current_difficulty = ? WHERE id = ?", (json.dumps(cl), json.dumps(cd), user_id))
            conn.commit()
            conn.close()
            self.send_json({"success": True})

        elif path == "/api/knowledge/upload" or path == "/knowledge/upload":
            # Simplified for now
            self.send_json({"success": True, "message": "Received"})

        else:
            self.send_error(404)

    def send_json(self, data):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def send_error(self, code, message=None):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({"error": message or "Error"}).encode('utf-8'))

with socketserver.TCPServer(("0.0.0.0", PORT), RequestHandler) as httpd:
    print(f"Python API serving at port {PORT}")
    httpd.serve_forever()
