import os
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score
import joblib
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

# Paths
def get_paths():
    base_dir = os.path.dirname(__file__)
    data_path = os.path.join(base_dir, '../data/dysgraphia_tracing_dataset_revised.csv')
    model_dir = os.path.join(base_dir, '../models')
    os.makedirs(model_dir, exist_ok=True)
    model_path = os.path.join(model_dir, 'dysgraphia_tracing_model.joblib')
    return data_path, model_path

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

if __name__ == '__main__':
    # Obtain paths
    csv_path, model_path = get_paths()

    # Load and prepare data
    data = pd.read_csv(csv_path)
    
    # Encode labels
    label_encoder = LabelEncoder()
    data['label'] = label_encoder.fit_transform(data['label'])

    # Prepare features and target
    X = data[['duration_seconds', 'accuracy']].values
    y = data['label'].values

    # Split the data
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # Initialize and train the model
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)

    # Make predictions on test set
    y_pred = model.predict(X_test)

    # Calculate and print accuracy
    accuracy = accuracy_score(y_test, y_pred)
    print(f"\nTest Accuracy: {accuracy * 100:.2f}%")

    # Save the model
    joblib.dump(model, model_path)
    print(f"Model saved to {model_path}")

    # Save the label encoder
    label_encoder_path = os.path.join(os.path.dirname(model_path), 'dysgraphia_tracing_label_encoder.joblib')
    joblib.dump(label_encoder, label_encoder_path)
    print(f"Label encoder saved to {label_encoder_path}")
