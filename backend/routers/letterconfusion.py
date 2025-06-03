from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
import numpy as np
import joblib
import os
import pandas as pd
from collections import Counter
from utils.cache import load_csv_data

router = APIRouter()

# Load model and encoders
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
model = joblib.load(os.path.join(base_dir, "models", "letter_confusion_model.joblib"))
le_risk = joblib.load(os.path.join(base_dir, "models", "risk_level_encoder.joblib"))
le_time_bins = joblib.load(os.path.join(base_dir, "models", "time_bins_encoder.joblib"))
scaler = joblib.load(os.path.join(base_dir, "models", "feature_scaler.joblib"))

class Question(BaseModel):
    question_id: int
    question_text: str
    options: str

class AnswerItem(BaseModel):
    shown_letters: List[str]  # e.g., ["b", "d", "p", "q"]
    correct: int  # 1 or 0
    response_time_ms: float  # e.g., 1234.56
    user_response: str  # The actual response given by the user

@router.get("/questions/")
async def get_questions():
    try:
        # Use cached data loading
        csv_path = os.path.join(base_dir, "data", "letterconfusion_frontend.csv")
        df = load_csv_data(csv_path)
        
        # Convert DataFrame to list of dictionaries
        questions = df.to_dict('records')
        
        return {
            "questions": questions,
            "total_questions": len(questions)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading questions: {str(e)}")

# Multi-hot encoding for shown_letters
def letters_to_multihot(shown_letters_list):
    all_letters = sorted(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 
                         'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'])
    return [1 if letter in shown_letters_list else 0 for letter in all_letters]

def preprocess_input(data: List[AnswerItem]) -> pd.DataFrame:
    features = []
    all_letters = sorted(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 
                         'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'])
    for item in data:
        # Create response time features
        response_time_log = np.log1p(item.response_time_ms)
        # Use fixed bins for response time
        bin_edges = [0, 1000, 2000, 3000, 4000, float('inf')]
        bin_labels = ['very_fast', 'fast', 'medium', 'slow', 'very_slow']
        response_time_bins = pd.cut([item.response_time_ms], bins=bin_edges, labels=bin_labels, right=False)[0]
        # Encode response time bins
        response_time_bins_enc = le_time_bins.transform([response_time_bins])[0]
        # Create features for correct/incorrect patterns
        is_correct_enc = item.correct
        has_multiple_selection = 1 if ',' in item.user_response else 0
        is_empty_response = 1 if item.user_response == '' else 0
        # One-hot encode shown_letters with letter_ prefix
        shown_letters_enc = [1 if letter in item.shown_letters else 0 for letter in all_letters]
        features.append([
            is_correct_enc,
            response_time_log,
            response_time_bins_enc,
            has_multiple_selection,
            is_empty_response
        ] + shown_letters_enc)
    # Build DataFrame with correct columns
    feature_columns = [
        'is_correct_enc',
        'response_time_log',
        'response_time_bins_enc',
        'has_multiple_selection',
        'is_empty_response'
    ] + [f'letter_{l}' for l in all_letters]
    df_features = pd.DataFrame(features, columns=feature_columns)
    # Scale response_time_log
    df_features['response_time_log'] = scaler.transform(df_features[['response_time_log']])
    # Debug print
    print('Features for model:', df_features)
    return df_features

@router.post("/dyslexia/submit_answer/")
async def submit_answer(answers: List[AnswerItem]):
    try:
        inputs = preprocess_input(answers)
        # Get predictions for each answer
        predictions = model.predict(inputs)
        probabilities = model.predict_proba(inputs)
        print('Model predictions:', predictions)
        print('Model probabilities:', probabilities)
        # Calculate mean risk level and confidence
        risk_levels = le_risk.inverse_transform(predictions)
        confidences = np.max(probabilities, axis=1)
        # Determine overall risk level based on most frequent prediction
        most_common_risk = Counter(risk_levels).most_common(1)[0][0]
        mean_confidence = float(np.mean(confidences))
        return {
            "risk_level": most_common_risk,
            "confidence": round(mean_confidence, 2),
            "next_question_id": len(answers) + 1 if len(answers) < 10 else None,
            "individual_results": [
                {
                    "risk_level": risk,
                    "confidence": float(conf)
                } for risk, conf in zip(risk_levels, confidences)
            ]
        }
    except Exception as e:
        import traceback
        print("Error in /dyslexia/submit_answer/:", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
