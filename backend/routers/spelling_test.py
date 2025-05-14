from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
import pandas as pd
import joblib
import numpy as np
import string
import traceback
import librosa
import os

router = APIRouter()

# === Load datasets ===
frontend_csv_path = './data/spellingfrontend_test.csv'
ground_truth_csv_path = './data/spelling_audio_dataset.csv'

try:
    frontend_df = pd.read_csv(frontend_csv_path)
    ground_truth_df = pd.read_csv(ground_truth_csv_path)
except FileNotFoundError as e:
    raise FileNotFoundError(f"CSV file not found: {e.filename}")

# === Load trained model ===
model_path = './models/dyslexia_spelling_audio_model.joblib'
try:
    model = joblib.load(model_path)
except FileNotFoundError:
    raise FileNotFoundError(f"Model file not found at {model_path}")

# === Risk classification ===
def classify_risk(score):
    if score >= 0.7:
        return "High"
    elif score >= 0.4:
        return "Medium"
    else:
        return "Low"

# === Endpoint: Get random audio ===
@router.get("/get-audio")
async def get_audio():
    try:
        random_row = frontend_df.sample(1).iloc[0]
        audio_file = random_row['audio_file']
        correct_spelling = random_row['correct_word']
        response = {"audio_file": audio_file, "correct_word": correct_spelling}
        print(f"Response: {response}")
        return response
    except Exception as e:
        print(f"Error in /get-audio: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

# === Endpoint: Validate answer using MFCC ===
@router.post("/validate-answer")
async def validate_answer(request: Request):
    try:
        data = await request.json()
        user_answer = data.get('user_answer')
        audio_file = data.get('audio_file')

        if not user_answer or not audio_file:
            return JSONResponse(
                status_code=400,
                content={"error": "Missing user_answer or audio_file in request."},
            )

        normalized_audio_file = (
            f"audio/correct/{audio_file}"
            if not audio_file.startswith("audio/correct/")
            else audio_file
        )

        # Check ground truth
        correct_row = ground_truth_df[
            ground_truth_df['audio_file'] == normalized_audio_file
        ]
        if correct_row.empty:
            return JSONResponse(
                status_code=404,
                content={"error": "Audio file not found in dataset."},
            )

        correct_word = correct_row.iloc[0]['correct_spelling']
        is_correct = user_answer.strip().lower() == correct_word.strip().lower()

        # === Audio feature extraction (MFCC) ===
        try:
            base_dir = os.path.abspath(os.path.dirname(__file__))
            audio_path = os.path.join(base_dir, '..', normalized_audio_file)

            y_audio, sr = librosa.load(audio_path, sr=16000)
            mfcc = librosa.feature.mfcc(y=y_audio, sr=sr, n_mfcc=13)

            max_len = 100
            if mfcc.shape[1] < max_len:
                pad_width = max_len - mfcc.shape[1]
                mfcc = np.pad(mfcc, ((0, 0), (0, pad_width)), mode='constant')
            else:
                mfcc = mfcc[:, :max_len]

            input_vector = mfcc.flatten().reshape(1, -1)

            if hasattr(model, "predict_proba"):
                dyslexia_prob = model.predict_proba(input_vector)[0][1]
            else:
                prediction = model.predict(input_vector)[0]
                dyslexia_prob = 0.5 if prediction == 1 else 0.1

        except Exception as model_error:
            traceback.print_exc()
            return JSONResponse(
                status_code=500,
                content={"error": f"Error during model prediction: {str(model_error)}"},
            )

        risk = classify_risk(dyslexia_prob)

        return {
            "is_correct": is_correct,
            "user_answer": user_answer,
            "correct_word": correct_word,
            "dyslexia_score": round(dyslexia_prob, 2),
            "risk": risk,
        }

    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": f"Unexpected error: {str(e)}"})
