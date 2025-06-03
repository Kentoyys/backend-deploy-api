from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import pandas as pd
import os
import joblib
import numpy as np

router = APIRouter()

# Load sklearn model and scaler
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
model_path = os.path.join(base_dir, "models", "dyscalculia_numberunderstanding.joblib")
scaler_path = os.path.join(base_dir, "models", "number_understanding_scaler.pkl")

try:
    model = joblib.load(model_path)
    scaler = joblib.load(scaler_path)
except Exception as e:
    raise RuntimeError(f"Failed to load model or scaler: {str(e)}")

dataset_path = os.path.join(base_dir, "data", "number_understanding_dataset_10k.csv")
try:
    dataset = pd.read_csv(dataset_path)
except Exception as e:
    raise RuntimeError(f"Failed to load dataset: {str(e)}")

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
async def predict(input_data: PredictionInput):
    try:
        # Prepare and scale input
        X = np.array([[input_data.left_number, input_data.right_number, input_data.response_time_sec, input_data.user_correct]])
        X_scaled = scaler.transform(X)

        # Predict
        proba = model.predict_proba(X_scaled)[0]
        is_at_risk = int(np.argmax(proba))
        confidence = float(proba[1])  # Probability of 'at risk' class

        rt = input_data.response_time_sec
        if rt < 3:
            speed = "Minimal Indicators"
            message = "The child responded quickly. This may indicate good number recognition."
        elif rt <= 6:
            speed = "Emerging Indicators"
            message = "The response time is within a normal range."
        else:
            speed = "Strong Indicators"
            message = "The child took longer to respond. This might indicate difficulty in understanding numbers."

        return {
            "at_risk": is_at_risk,
            "result": "At Risk for Learning Difficulty" if is_at_risk else "Not At Risk",
            "confidence": round(confidence, 4),
            "response_time_sec": rt,
            "speed_category": speed,
            "speed_message": message
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")
