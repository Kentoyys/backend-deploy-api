from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse
import pandas as pd
import joblib
import numpy as np
import string
import traceback
import librosa
import os
from difflib import SequenceMatcher
from typing import List, Dict
from utils.cache import load_csv_data, load_model

router = APIRouter()

# Load and cache datasets
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
frontend_df = load_csv_data(os.path.join(base_dir, "data", "spellingfrontend_test.csv"))
ground_truth_df = load_csv_data(os.path.join(base_dir, "data", "spelling_audio_dataset.csv"))

# Load and cache model
model_bundle = load_model(os.path.join(base_dir, "models", "dyslexia_spelling_audio_model.joblib"))
model = model_bundle['model']
scaler = model_bundle['scaler']

# Cache for audio features
audio_features_cache = {}

# === Risk classification for spelling ===
def classify_spelling_risk(prob):
    if prob >= 0.7:
        return "Strong indicators"
    elif prob >= 0.4:
        return "Emerging indicators"
    else:
        return "Minimal indicators"

def extract_audio_features(audio_path: str) -> np.ndarray:
    """Extract and cache audio features"""
    if audio_path in audio_features_cache:
        return audio_features_cache[audio_path]
    
    try:
        y_audio, sr = librosa.load(audio_path, sr=16000)
        mfcc = librosa.feature.mfcc(y=y_audio, sr=sr, n_mfcc=20)
        mfcc_delta = librosa.feature.delta(mfcc)
        mfcc_delta2 = librosa.feature.delta(mfcc, order=2)
        features = np.concatenate([mfcc, mfcc_delta, mfcc_delta2], axis=0)
        
        # Pad or truncate to fixed length
        max_len = 100
        if features.shape[1] < max_len:
            pad_width = max_len - features.shape[1]
            features = np.pad(features, ((0, 0), (0, pad_width)), mode='constant')
        else:
            features = features[:, :max_len]
            
        # Cache the features
        audio_features_cache[audio_path] = features
        return features
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing audio: {str(e)}")

# === Endpoint: Get random audio ===
@router.get("/get-audio")
async def get_audio():
    try:
        # Get a random word that hasn't been used in the last 5 attempts
        random_row = frontend_df.sample(1).iloc[0]
        audio_file = random_row['audio_file']
        correct_spelling = random_row['correct_word']
        
        return {
            "audio_file": audio_file,
            "correct_word": correct_spelling
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting audio: {str(e)}")

# === Endpoint: Validate answer using MFCC ===
@router.post("/validate-answer")
async def validate_answer(data: Dict):
    try:
        user_answer = data.get('user_answer')
        audio_file = data.get('audio_file')
        attempt_number = data.get('attempt_number', 1)

        if not user_answer or not audio_file:
            raise HTTPException(status_code=400, detail="Missing user_answer or audio_file in request")

        normalized_audio_file = (
            f"audio/correct/{audio_file}"
            if not audio_file.startswith("audio/correct/")
            else audio_file
        )

        # Check ground truth
        correct_row = ground_truth_df[ground_truth_df['audio_file'] == normalized_audio_file]
        if correct_row.empty:
            raise HTTPException(status_code=404, detail="Audio file not found in dataset")

        correct_word = correct_row.iloc[0]['correct_spelling']
        is_correct = user_answer.strip().lower() == correct_word.strip().lower()

        # Extract and process audio features
        audio_path = os.path.join(base_dir, normalized_audio_file)
        features = extract_audio_features(audio_path)
        
        # Prepare input vector
        input_vector = features.flatten().reshape(1, -1)
        input_vector = scaler.transform(input_vector)
        
        # Get prediction
        if hasattr(model, "predict_proba"):
            spelling_prob = model.predict_proba(input_vector)[0][1]
        else:
            prediction = model.predict(input_vector)[0]
            spelling_prob = 1.0 if prediction == 1 else 0.0

        spelling_risk = classify_spelling_risk(spelling_prob)

        return {
            "is_correct": is_correct,
            "user_answer": user_answer,
            "correct_word": correct_word,
            "spelling_incorrect_prob": round(spelling_prob, 2),
            "spelling_risk": spelling_risk,
            "attempt_number": attempt_number
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
