from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import joblib
import os
import pandas as pd
import numpy as np
import re

def extract_phoneme_features(text):
    text = str(text)
    vowels = len(re.findall(r'[aeiou]', text.lower()))
    consonants = len(re.findall(r'[bcdfghjklmnpqrstvwxyz]', text.lower()))
    total_chars = len(text)
    vowel_ratio = vowels / total_chars if total_chars > 0 else 0
    consonant_ratio = consonants / total_chars if total_chars > 0 else 0
    return [vowels, consonants, vowel_ratio, consonant_ratio, total_chars]

# Load model, vectorizer, scaler at startup
MODEL_DIR = os.path.join(os.path.dirname(__file__), '..', 'models')
model = joblib.load(os.path.join(MODEL_DIR, 'phonospeech_model.joblib'))
vectorizer = joblib.load(os.path.join(MODEL_DIR, 'vectorizer.joblib'))
scaler = joblib.load(os.path.join(MODEL_DIR, 'scaler.joblib'))

router = APIRouter(
    prefix="/phonospeech",
    tags=["phonospeech"]
)

class PhonoSpeechRequest(BaseModel):
    question: str
    child_response: str

class PhonoSpeechResponse(BaseModel):
    risk_level: str
    confidence_score: float

@router.get("/questions")
def get_questions():
    csv_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'dyslexia_training_dataset.csv')
    if not os.path.exists(csv_path):
        raise HTTPException(status_code=404, detail="Questions file not found.")
    df = pd.read_csv(csv_path)
    if 'Question' not in df.columns:
        raise HTTPException(status_code=500, detail="'Question' column not found in dataset.")
    questions = df[['Question']].drop_duplicates().to_dict(orient='records')
    return {"questions": questions}

@router.post("/predict", response_model=PhonoSpeechResponse)
def predict_phonospeech(data: PhonoSpeechRequest):
    question = str(data.question)
    child_response = str(data.child_response)
    # Text features
    text_features = question + ' ' + child_response
    X_text = vectorizer.transform([text_features])
    # Phoneme features for both question and child response
    question_phonemes = extract_phoneme_features(question)
    child_phonemes = extract_phoneme_features(child_response)
    X_numeric = scaler.transform([question_phonemes + child_phonemes])
    # Combine features
    X_combined = np.hstack([X_text.toarray(), X_numeric])
    # Predict
    pred = model.predict(X_combined)[0]
    proba = model.predict_proba(X_combined)[0]
    risk_map = {0: 'Minimal', 1: 'Emerging', 2: 'Strong_Indicators'}
    confidence = float(proba[pred])
    return PhonoSpeechResponse(
        risk_level=risk_map[pred],
        confidence_score=confidence
    )