import os
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
import joblib

# Get the absolute path to the CSV
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.abspath(os.path.join(BASE_DIR, "..", "data", "dyslexia_dataset.csv"))

df = pd.read_csv(CSV_PATH)

# Create a new DataFrame for training
data = []
for _, row in df.iterrows():
    # Positive example (correct)
    data.append({
        "text": f"{row['Question']} {row['Correct_Response']}",
        "label": 1
    })
    # Negative example (incorrect)
    data.append({
        "text": f"{row['Question']} {row['Incorrect_Response']}",
        "label": 0
    })

train_df = pd.DataFrame(data)
X = train_df["text"]
y = train_df["label"]

vectorizer = TfidfVectorizer()
X_vec = vectorizer.fit_transform(X)

model = LogisticRegression()
model.fit(X_vec, y)

os.makedirs(os.path.abspath(os.path.join(BASE_DIR, "..", "models")), exist_ok=True)
joblib.dump(model, os.path.abspath(os.path.join(BASE_DIR, "..", "models", "dyslexia_speech_model.joblib")))
joblib.dump(vectorizer, os.path.abspath(os.path.join(BASE_DIR, "..", "models", "vectorizer_speech.pkl")))

print("Model and vectorizer saved!")
