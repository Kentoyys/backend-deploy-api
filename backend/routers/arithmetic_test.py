from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
import joblib
import numpy as np
import os

# ======= Load Model, Scaler, and Encoder =======
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
model = joblib.load(os.path.join(base_dir, "models", "dyscalculia_arithmetic.joblib"))
scaler = joblib.load(os.path.join(base_dir, "models", "arithmetic_scaler.pkl"))
op_encoder = joblib.load(os.path.join(base_dir, "models", "arithmetic_op_encoder.joblib"))

router = APIRouter(prefix="/api/arithmetic")

class Attempt(BaseModel):
    op1: int
    op2: int
    operation: str
    user_choice: int  # 0 for correct, 1 for incorrect
    response_time: float

class SummaryRequest(BaseModel):
    attempts: List[Attempt]

@router.post("/summary")
async def calculate_summary(request: SummaryRequest):
    try:
        total_correct = 0
        total_time = 0
        slow_count = 0
        fast_count = 0
        moderate_count = 0
        risk_count = 0

        features_list = []
        for attempt in request.attempts:
            # Encode operation using the saved encoder
            try:
                op_encoded = int(op_encoder.transform([attempt.operation])[0])
            except Exception:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid operation: {attempt.operation}. Allowed: {list(op_encoder.classes_)}"
                )
            features = [
                attempt.op1,
                attempt.op2,
                op_encoded,
                attempt.user_choice,
                attempt.response_time
            ]
            features_list.append(features)

        # Scale features
        X = scaler.transform(np.array(features_list))

        # Predict with sklearn model
        proba = model.predict_proba(X)[:, 1]  # Probability of 'at risk'
        preds = (proba > 0.5).astype(int)

        for i, attempt in enumerate(request.attempts):
            is_at_risk = preds[i]
            if attempt.user_choice == 0:
                is_at_risk = 0  # If user was correct, not at risk

            if attempt.response_time > 3:
                slow_count += 1
            elif attempt.response_time < 1.5:
                fast_count += 1
            else:
                moderate_count += 1

            risk_count += is_at_risk
            if attempt.user_choice == 0:
                total_correct += 1

            total_time += attempt.response_time

        total_attempts = len(request.attempts)
        avg_time = total_time / total_attempts if total_attempts > 0 else 0

        # Determine risk level
        if total_correct == total_attempts:
            overall_risk = "No risk"
        else:
            risk_ratio = risk_count / total_attempts
            if risk_ratio < 0.33:
                overall_risk = "Minimal Indicators (denoting Low Risk)"
            elif risk_ratio < 0.66:
                overall_risk = "Emerging Indicators (denoting Moderate Risk)"
            else:
                overall_risk = "Strong Indicators (denoting High Risk)"

        # Determine speed category
        speed_category = "Slow" if slow_count > fast_count and slow_count > moderate_count else \
                         "Fast" if fast_count > slow_count and fast_count > moderate_count else \
                         "Moderate"

        # Assessment recommendation
        if total_attempts == 3:
            assessment_quality = "Minimal (fast screening)"
        elif total_attempts == 4:
            assessment_quality = "Moderate (balanced reliability)"
        elif total_attempts >= 5:
            assessment_quality = "Ideal (optimal for ML pattern detection)"
        else:
            assessment_quality = "Insufficient attempts"

        return {
            "total_correct": total_correct,
            "average_time": avg_time,
            "overall_risk": overall_risk,
            "speed_category": speed_category,
            "risk_count": int(risk_count),
            "total_attempts": total_attempts,
            "assessment_quality": assessment_quality
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in summary calculation: {e}")
