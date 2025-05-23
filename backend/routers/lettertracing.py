import os
import joblib
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

# --- 1. Define request/response schemas ---
class TraceRequest(BaseModel):
    letter: str
    drawing: str         # data URL (not used here, but could be used for future enhancements)
    duration: float
    accuracy: float      # Accuracy from the frontend tracing

class TraceResponse(BaseModel):
    label: str
    confidence: float
    duration_seconds: float  # Return the time for tracing in seconds
    accuracy: float         # Return the accuracy score for feedback

# --- 2. Load the trained model and label encoder on startup ---
model_path = os.path.join(os.path.dirname(__file__), '../models/dysgraphia_tracing_model.joblib')
label_encoder_path = os.path.join(os.path.dirname(__file__), '../models/dysgraphia_tracing_label_encoder.joblib')

model = joblib.load(model_path)
label_encoder = joblib.load(label_encoder_path)

# --- 3. Create router ---
router = APIRouter()

@router.post("/trace", response_model=TraceResponse)
async def trace_letter(req: TraceRequest):
    # Validate inputs
    if req.duration < 0 or not (0.0 <= req.accuracy <= 1.0):
        raise HTTPException(status_code=400, detail="Invalid duration or accuracy")

    # Prepare features for model: duration and accuracy
    features = [[req.duration, req.accuracy]]

    # Get prediction probabilities
    probabilities = model.predict_proba(features)[0]
    pred_idx = probabilities.argmax()
    confidence = float(probabilities[pred_idx])

    # Convert numeric prediction back to original label
    label = label_encoder.inverse_transform([pred_idx])[0]

    # Threshold confidence level to ensure a more reliable prediction
    if confidence < 0.7:  # Adjust this threshold as needed
        label = "uncertain"  # or any other fallback

    # Return prediction label, confidence, duration, and accuracy for the frontend
    return TraceResponse(
        label=label,
        confidence=confidence,
        duration_seconds=req.duration,
        accuracy=req.accuracy
    ) 