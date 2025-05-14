from fastapi import APIRouter, File, UploadFile, HTTPException
from typing import List
from PIL import Image
import numpy as np
import io
import joblib
from skimage import transform, feature
from skimage.color import rgb2gray
import os

router = APIRouter()

# Load trained sklearn model
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.abspath(os.path.join(BASE_DIR, "..", "models", "dysgraphia_handwritten_model.joblib"))
model = joblib.load(MODEL_PATH)

labels = ["Dysgraphic", "Non-Dysgraphic"]

def preprocess_image(image_bytes):
    # Load image and convert to grayscale
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    image = np.array(image)
    if image.ndim == 3:
        image = rgb2gray(image)
    # Resize to 128x128
    image = transform.resize(image, (128, 128))
    # Extract HOG features
    hog_features = feature.hog(image, orientations=8, pixels_per_cell=(16, 16),
                               cells_per_block=(1, 1), visualize=False)
    return hog_features

@router.post("/dysgraphia/predict")
async def predict(files: List[UploadFile] = File(...)):
    if not (1 <= len(files) <= 3):
        raise HTTPException(status_code=400, detail="Please upload 1 to 3 images.")

    predictions = []

    for file in files:
        image_data = await file.read()
        features = preprocess_image(image_data).reshape(1, -1)
        proba = model.predict_proba(features)[0]
        predicted_index = int(np.argmax(proba))
        confidence = float(proba[predicted_index])
        prediction_label = labels[predicted_index] if predicted_index < len(labels) else "Unknown Classification"

        # Severity Mapping
        if 0.01 <= confidence <= 0.25:
            severity_level = "Minimal Indicators"
        elif 0.26 <= confidence <= 0.50:
            severity_level = "Emerging Indicators"
        elif 0.51 <= confidence <= 0.75:
            severity_level = "Emerging Indicators"
        elif 0.76 <= confidence <= 1.0:
            severity_level = "Strong Indicators"
        else:
            severity_level = "No significant impairment detected"

        predictions.append({
            "Filename": file.filename,
            "Prediction": prediction_label,
            "Confidence": confidence,
            "Severity": severity_level
        })

    return {"Results": predictions}
