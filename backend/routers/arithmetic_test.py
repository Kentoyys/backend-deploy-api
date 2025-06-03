from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
import os
import joblib
import numpy as np

router = APIRouter(prefix="/api/arithmetic")
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

models = {
    "model": joblib.load(os.path.join(base_dir, "models", "dyscalculia_arithmetic.joblib")),
    "scaler": joblib.load(os.path.join(base_dir, "models", "arithmetic_scaler.pkl")),
    "op_encoder": joblib.load(os.path.join(base_dir, "models", "arithmetic_op_encoder.joblib"))
}

class Attempt(BaseModel):
    op1: int
    op2: int
    operation: str
    user_choice: int  # 0 for correct, 1 for incorrect
    response_time: float

@router.post("/summary")
async def get_summary(attempts: List[Attempt]):
    try:
        features = []
        for attempt in attempts:
            op_encoded = models["op_encoder"].transform([attempt.operation])[0]
            feature_vector = [
                attempt.op1,
                attempt.op2,
                op_encoded,
                attempt.user_choice,
                attempt.response_time
            ]
            features.append(feature_vector)
        X = np.array(features)
        X_scaled = models["scaler"].transform(X)
        predictions = models["model"].predict(X_scaled)
        probabilities = models["model"].predict_proba(X_scaled)
        total_attempts = len(attempts)
        correct_attempts = sum(1 for p in predictions if p == 0)
        avg_response_time = sum(a.response_time for a in attempts) / total_attempts
        return {
            "total_attempts": total_attempts,
            "correct_attempts": correct_attempts,
            "accuracy": correct_attempts / total_attempts,
            "average_response_time": avg_response_time,
            "risk_level": "High" if correct_attempts / total_attempts < 0.6 else "Low",
            "confidence": float(max(probabilities[-1])),
            "individual_results": [
                {
                    "question": f"{a.op1} {a.operation} {a.op2}",
                    "is_correct": p == 0,
                    "response_time": a.response_time,
                    "confidence": float(max(prob))
                }
                for a, p, prob in zip(attempts, predictions, probabilities)
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing summary: {str(e)}")
