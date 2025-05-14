from fastapi import APIRouter, HTTPException
import joblib
import pandas as pd
from pathlib import Path

router = APIRouter()

# Define Base Directory (Relative Paths)
BASE_DIR = Path(__file__).resolve().parent.parent

# Model & Vectorizer Paths
model_path = BASE_DIR / "models/dyslexia_speech_model.joblib"
vectorizer_path = BASE_DIR / "models/vectorizer_speech.pkl"

# Load Vectorizer and Model
try:
    vectorizer = joblib.load(vectorizer_path)
    model = joblib.load(model_path)
except Exception as e:
    raise HTTPException(status_code=500, detail=f"Failed to load model or vectorizer: {str(e)}")

# Get Dyslexia Test Questions
@router.get("/dyslexia/questions")
def get_questions():
    dataset_path = BASE_DIR / "data/dyslexia_dataset.csv"
    if not dataset_path.exists():
        raise HTTPException(status_code=500, detail="Dataset file is missing.")

    df = pd.read_csv(dataset_path)
    if "Question" not in df.columns:
        raise HTTPException(status_code=500, detail="Dataset is missing 'Question' column.")

    return {"questions": df["Question"].tolist()}

# Analyze User Response
@router.post("/dyslexia/analyze")
def analyze_response(data: dict):
    question = data.get("question", "").strip()
    response = data.get("response", "").strip()

    if not question or not response:
        raise HTTPException(status_code=400, detail="Both question and response are required.")

    try:
        input_text = [question + " " + response]
        input_vector = vectorizer.transform(input_text)
        prediction_proba = model.predict_proba(input_vector)[0]
        predicted_label = int(prediction_proba.argmax())
        confidence = float(prediction_proba[predicted_label])

        return {
            "result": {
                "prediction": "High Risk of Dyslexia" if predicted_label == 1 else "No Dyslexia Risk",
                "confidence": confidence,
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing response: {str(e)}")
