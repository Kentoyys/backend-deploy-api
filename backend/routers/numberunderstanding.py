from fastapi import APIRouter, HTTPException
import os
import pandas as pd
import joblib
import numpy as np
from pydantic import BaseModel

router = APIRouter()
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

dataset = pd.read_csv(os.path.join(base_dir, "data", "number_understanding_dataset_10k.csv"))
model = joblib.load(os.path.join(base_dir, "models", "dyscalculia_numberunderstanding.joblib"))
scaler = joblib.load(os.path.join(base_dir, "models", "number_understanding_scaler.pkl"))

class PredictionInput(BaseModel):
    left_number: float
    right_number: float
    response_time_sec: float
    user_correct: int

@router.get("/getQuestions")
async def get_questions():
    try:
        row = dataset.sample(n=1).iloc[0]
        return {
            "question_type": row["question_type"],
            "left_number": int(row["left_number"]),
            "right_number": int(row["right_number"]),
            "correct_answer": row["correct_answer"],
            "at_risk": int(row["at_risk"])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching question: {str(e)}")

@router.post("/predict")
async def predict(data: dict):
    try:
        features = np.array([
            [
                data["left_number"],
                data["right_number"],
                data["response_time_sec"],
                data["user_correct"]
            ]
        ])
        features_scaled = scaler.transform(features)
        prediction = model.predict(features_scaled)[0]
        probability = model.predict_proba(features_scaled)[0]
        return {
            "result": "At Risk" if prediction == 1 else "Not At Risk",
            "confidence": float(max(probability)),
            "speed_category": "Fast" if data["response_time_sec"] < 3 else "Slow",
            "speed_message": "Quick response" if data["response_time_sec"] < 3 else "Took longer than usual"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error making prediction: {str(e)}")
