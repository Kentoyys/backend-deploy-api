from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
import os
import joblib
import numpy as np
import pandas as pd

router = APIRouter()
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def get_confidence_indicator(confidence: float) -> str:
    if confidence < 0.4:
        return "minimal"
    elif confidence < 0.7:
        return "emerging"
    else:
        return "strong"

# Load models
try:
    models = {
        "model": joblib.load(os.path.join(base_dir, "models", "dyscalculia_arithmetic.joblib")),
        "scaler": joblib.load(os.path.join(base_dir, "models", "arithmetic_scaler.pkl")),
        "op_encoder": joblib.load(os.path.join(base_dir, "models", "arithmetic_op_encoder.joblib"))
    }
except Exception as e:
    print(f"Error loading models: {str(e)}")
    raise

class Attempt(BaseModel):
    op1: int
    op2: int
    operation: str
    user_choice: int  # 0 for correct, 1 for incorrect
    response_time: float

@router.post("/api/arithmetic/summary")
async def get_summary(attempts: List[Attempt]):
    if not attempts:
        raise HTTPException(status_code=400, detail="No attempts provided")

    try:
        # Prepare features
        features = []
        for attempt in attempts:
            # Encode operation
            op_encoded = models["op_encoder"].transform([attempt.operation])[0]
            
            # Create feature vector
            feature_vector = [
                float(attempt.op1),
                float(attempt.op2),
                float(op_encoded),
                float(attempt.user_choice),
                float(attempt.response_time)
            ]
            features.append(feature_vector)

        # Convert to DataFrame with feature names that match training
        feature_names = ['op1', 'op2', 'operation', 'user_choice', 'response_time']
        X = pd.DataFrame(features, columns=feature_names)

        # Scale features
        X_scaled = models["scaler"].transform(X)

        # Get predictions and probabilities
        predictions = models["model"].predict(X_scaled)
        probabilities = models["model"].predict_proba(X_scaled)

        # Calculate summary statistics
        total_attempts = len(attempts)
        correct_attempts = sum(1 for p in predictions if p == 0)
        accuracy = correct_attempts / total_attempts
        avg_response_time = sum(a.response_time for a in attempts) / total_attempts

        # Determine risk level
        risk_level = "High" if accuracy < 0.6 else "Low"

        # Calculate overall confidence and convert to indicator
        overall_confidence = float(np.mean([max(prob) for prob in probabilities]))
        confidence_indicator = get_confidence_indicator(overall_confidence)

        # Prepare individual results with confidence indicators
        individual_results = [
            {
                "question": f"{a.op1} {a.operation} {a.op2}",
                "is_correct": bool(p == 0),  # Convert numpy.bool_ to Python bool
                "response_time": float(a.response_time),
                "confidence": get_confidence_indicator(float(max(prob)))
            }
            for a, p, prob in zip(attempts, predictions, probabilities)
        ]

        return {
            "total_attempts": total_attempts,
            "correct_attempts": correct_attempts,
            "accuracy": accuracy,
            "average_response_time": avg_response_time,
            "risk_level": risk_level,
            "confidence": confidence_indicator,
            "individual_results": individual_results
        }

    except Exception as e:
        print(f"Error in get_summary: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing summary: {str(e)}")
