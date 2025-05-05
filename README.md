# 🧠 AutoChat – Chatbot Automobile & Mécanique

**AutoChat** est une application web intelligente qui répond aux questions sur l’automobile et la mécanique. Grâce à un système de génération assistée par l’intelligence artificielle, elle fournit des réponses précises, documentées et personnalisées.

---

## 🚗 Fonctionnalités

- ✅ Chat en langage naturel avec un assistant spécialisé automobile
- 🔐 Authentification JWT sécurisée avec mot de passe hashé (bcrypt)
- 💬 Sessions de discussion avec historique complet
- 📄 RAG (Recherche Augmentée) sur des documents PDF techniques
- 🧠 Génération de réponses via LLM (Mistral)
- 🌙 Interface responsive avec thème clair/sombre

---

## 🧠 Technologies IA utilisées

Le backend utilise plusieurs outils d'intelligence artificielle :

| Composant                  | Description                                                                 |
|---------------------------|-----------------------------------------------------------------------------|
| `Mistral-7B-Instruct`     | Modèle de génération de texte, via Hugging Face Inference API               |
| `all-MiniLM-L6-v2`        | Modèle d'embedding pour vectorisation des questions et documents            |
| RAG (Retrieval-Augmented) | Recherche des passages pertinents dans des documents pour enrichir les réponses |
| Mémoire de session        | Prise en compte de l’historique de la conversation                         |

---

## 🧰 Stack technique

- **Frontend** : Angular
- **Backend** : Flask
- **Base de données** : MongoDB
- **Authentification** : JWT + bcrypt
- **Hébergement** : Compatible VPS (Gunicorn + Nginx)

---

## ⚙️ Démarrage de l’application

### 📦 1. Cloner le projet

```bash
git clone https://github.com/youneschrimni/ChatBotAutomobile.git
cd ChatBotAutomobile
```
### 🌐 2. Lancer le frontend (Angular)
```bash
cd frontend
npm install
npm start
```
L’application Angular sera accessible sur http://localhost:4200

### 🧪 3. Lancer le backend (Flask)
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Sur Windows : venv\Scripts\activate
pip install -r requirements.txt
python app.py
```
Le backend tourne sur http://localhost:5000


