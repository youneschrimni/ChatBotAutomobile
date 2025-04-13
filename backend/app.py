# =========================
# BACKEND - app.py (avec RAG + mémoire de session + log des sources)
# =========================

from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient
from huggingface_hub import InferenceClient
import uuid
import os
import bcrypt
import jwt
import numpy as np
from datetime import datetime, timedelta
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer

# ========== Initialisation ==========
load_dotenv()

app = Flask(__name__)
CORS(app)

app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "supersecret")
mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
client = MongoClient(mongo_uri)

try:
    client.admin.command('ping')
    print("Connexion MongoDB OK")
except Exception as e:
    print("Connexion MongoDB échouée :", e)

# ========== Base de données ==========
db = client["chatbot_db"]
users_col = db["Users"]
sessions_col = db["Sessions"]
messages_col = db["Messages"]
docs_col = db["Documents"]

# ========== Modèle LLM et Embedding ==========
os.environ["HF_TOKEN"] = os.getenv("HF_TOKEN")
llm_client = InferenceClient("mistralai/Mistral-7B-Instruct-v0.3", token=os.getenv("HF_TOKEN"))
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")

# ========== Fonctions Utiles ==========
def hash_password(password):
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def check_password(password, hashed_str):
    return bcrypt.checkpw(password.encode(), hashed_str.encode())

def create_token(user_id):
    return jwt.encode({"user_id": str(user_id), "exp": datetime.utcnow() + timedelta(hours=2)}, app.config["SECRET_KEY"], algorithm="HS256")

def decode_token(token):
    return jwt.decode(token, app.config["SECRET_KEY"], algorithms=["HS256"])

def cosine_similarity(a, b):
    a, b = np.array(a), np.array(b)
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

def find_top_chunks(question, top_k=3):
    question_emb = embedding_model.encode(question).tolist()
    all_docs = list(docs_col.find({}))
    scored = []
    for doc in all_docs:
        sim = cosine_similarity(question_emb, doc["embedding"])
        scored.append((sim, doc["chunk"], doc.get("source", "inconnu")))
    scored.sort(reverse=True)
    return scored[:top_k]

import traceback

@app.errorhandler(Exception)
def handle_exception(e):
    print("\n====== ERREUR GLOBALE ======")
    traceback.print_exc()
    print("Erreur :", str(e))
    print("====== FIN ERREUR ======\n")
    return jsonify({"msg": "Erreur serveur", "error": str(e)}), 500


# ========== Authentification ==========
@app.route("/register", methods=["POST"])
def register():
    data = request.json
    if users_col.find_one({"email": data["email"]}):
        return jsonify({"msg": "Email déjà utilisé"}), 400
    user = {
        "_id": str(uuid.uuid4()),
        "username": data["username"],
        "email": data["email"],
        "password": hash_password(data["password"]),
        "created_at": datetime.utcnow()
    }
    users_col.insert_one(user)
    return jsonify({"msg": "Utilisateur créé"}), 201

@app.route("/login", methods=["POST"])
def login():
    data = request.json
    user = users_col.find_one({"email": data["email"]})
    if not user or not check_password(data["password"], user["password"]):
        return jsonify({"msg": "Identifiants incorrects"}), 401
    return jsonify({"token": create_token(user["_id"])}), 200

# ========== Sessions ==========
@app.route("/session", methods=["POST"])
def create_session():
    data = request.json
    try:
        user_id = decode_token(data["token"])["user_id"]
    except:
        return jsonify({"msg": "Token invalide"}), 401

    session = {
        "_id": str(uuid.uuid4()),
        "user_id": user_id,
        "label": data.get("label", "Nouvelle discussion"),
        "context": data.get("context", "Tu es un assistant automobile expert et bienveillant."),
        "created_at": datetime.utcnow()
    }
    sessions_col.insert_one(session)
    return jsonify({"session_id": session["_id"]}), 201

@app.route("/sessions", methods=["GET"])
def get_sessions():
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return jsonify({"msg": "Token manquant"}), 401

    try:
        token = auth_header.split(" ")[1]
        user_id = decode_token(token)["user_id"]
    except:
        return jsonify({"msg": "Token invalide"}), 401

    user_sessions = sessions_col.find({"user_id": user_id})
    data = [
        {"session_id": s["_id"], "label": s["label"], "created_at": s["created_at"]}
        for s in user_sessions
    ]
    return jsonify({"sessions": data}), 200

# ========== RAG - Pose de question avec mémoire ==========
@app.route("/ask", methods=["POST"])
def ask():
    data = request.json
    session_id = data["session_id"]
    question = data["question"]

    session = sessions_col.find_one({"_id": session_id})
    if not session:
        return jsonify({"msg": "Session inconnue"}), 404

    previous = list(messages_col.find({"session_id": session_id}).sort("timestamp", 1))
    history = ""
    for msg in previous:
        prefix = "Utilisateur" if msg["role"] == "user" else "Assistant"
        history += f"{prefix} : {msg['content']}\n"

    try:
        top_chunks_info = find_top_chunks(question, top_k=3)
        context = ""
        chunks_used = []
        for sim, chunk, source in top_chunks_info:
            context += chunk + "\n"
            chunks_used.append({"chunk": chunk, "source": source})
    except Exception as e:
        print("Erreur RAG:", e)
        context = ""
        chunks_used = []

    prompt = f"""Tu es un assistant automobile expert. Voici l'historique de la conversation :
{history}
Voici des informations externes utiles :
{context}

Question : {question}
Réponse :"""

    try:
        response = llm_client.text_generation(prompt=prompt, max_new_tokens=512)
        answer = response.strip()
    except Exception as e:
        return jsonify({"msg": "Erreur LLM", "error": str(e)}), 500

    messages_col.insert_many([
        {"session_id": session_id, "role": "user", "content": question, "timestamp": datetime.utcnow()},
        {"session_id": session_id, "role": "assistant", "content": answer, "timestamp": datetime.utcnow()}
    ])

    return jsonify({"answer": answer, "sources": chunks_used}), 200

# ========== Historique ==========
@app.route("/history/<session_id>", methods=["GET"])
def history(session_id):
    session = sessions_col.find_one({"_id": session_id})
    if not session:
        return jsonify({"msg": "Session inconnue"}), 404
    messages = messages_col.find({"session_id": session_id}).sort("timestamp", 1)
    return jsonify({
        "history": [
            {"role": m["role"], "content": m["content"], "timestamp": m["timestamp"]} for m in messages
        ]
    }), 200

if __name__ == "__main__":
    app.run(debug=True, use_reloader=False, port=5000)
