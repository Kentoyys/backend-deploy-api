from fastapi import APIRouter, HTTPException
import os
from utils.cache import load_csv_data, load_model
import pandas as pd
import numpy as np

router = APIRouter()
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Load and cache the dataset
dataset = load_csv_data(os.path.join(base_dir, "data", "number_understanding_dataset_10k.csv"))

# Load and cache the model
model = load_model(os.path.join(base_dir, "models", "dyscalculia_numberunderstanding.joblib"))
scaler = load_model(os.path.join(base_dir, "models", "number_understanding_scaler.pkl"))

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
        # Prepare features
        features = np.array([[
            data["left_number"],
            data["right_number"],
            data["response_time_sec"],
            data["user_correct"]
        ]])
        
        # Scale features
        features_scaled = scaler.transform(features)
        
        # Make prediction
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
