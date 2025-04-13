import os
import uuid
import fitz  # PyMuPDF
import numpy as np
from pymongo import MongoClient
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv

load_dotenv()
mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
client = MongoClient(mongo_uri)
db = client["chatbot_db"]
docs_col = db["Documents"]

embedding_model = SentenceTransformer("all-MiniLM-L6-v2")

def extract_text_from_pdf(file_path):
    doc = fitz.open(file_path)  # PyMuPDF
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()
    return text

def split_text(text, chunk_size=800, overlap=100):
    chunks = []
    for i in range(0, len(text), chunk_size - overlap):
        chunks.append(text[i:i+chunk_size])
    return chunks

def process_and_store_pdf(file_path):
    print(f"📥 Traitement de : {file_path}")
    raw_text = extract_text_from_pdf(file_path)
    chunks = split_text(raw_text)

    for chunk in chunks:
        embedding = embedding_model.encode(chunk).tolist()
        docs_col.insert_one({
            "_id": str(uuid.uuid4()),
            "source": os.path.basename(file_path),
            "chunk": chunk,
            "embedding": embedding
        })
    print(f"✅ PDF '{file_path}' indexé avec {len(chunks)} chunks.")

if __name__ == "__main__":
    process_and_store_pdf("auto1.pdf")
    process_and_store_pdf("Auto2.pdf")
    process_and_store_pdf("auto3.pdf")
    process_and_store_pdf("auto4.pdf")
    process_and_store_pdf("auto5.pdf")
