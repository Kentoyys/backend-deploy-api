import pandas as pd
import librosa
import numpy as np
import os
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
import joblib

# Paths
base_dir = os.path.abspath(os.path.dirname(__file__))
csv_path = os.path.join(base_dir, '../data/spelling_audio_dataset.csv')
model_path = os.path.join(base_dir, '../models/dyslexia_spelling_audio_model.joblib')

# Load dataset
df = pd.read_csv(csv_path)

X = []
y = []

for _, row in df.iterrows():
    audio_path = row['audio_file']
    full_path = os.path.join(base_dir, '..', audio_path)

    if '/correct/' in audio_path:
        label = 1
    elif '/incorrect/' in audio_path:
        label = 0
    else:
        print(f"⚠️ Skipping unknown label: {audio_path}")
        continue

    try:
        y_audio, sr = librosa.load(full_path, sr=16000)
        mfcc = librosa.feature.mfcc(y=y_audio, sr=sr, n_mfcc=13)

        max_len = 100
        if mfcc.shape[1] < max_len:
            pad_width = max_len - mfcc.shape[1]
            mfcc = np.pad(mfcc, ((0, 0), (0, pad_width)), mode='constant')
        else:
            mfcc = mfcc[:, :max_len]

        X.append(mfcc.flatten())
        y.append(label)

    except Exception as e:
        print(f"❌ Failed to process {audio_path}: {e}")

X = np.array(X)
y = np.array(y)

# Label check
unique_labels, counts = np.unique(y, return_counts=True)
print(f"✅ Label distribution: {dict(zip(unique_labels, counts))}")

if len(unique_labels) < 2:
    raise ValueError("❌ Dataset must contain both 'correct' and 'incorrect' samples.")

# Train/test split
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# Train model
model = LogisticRegression(max_iter=1000)
model.fit(X_train, y_train)

# Save model
os.makedirs(os.path.dirname(model_path), exist_ok=True)
joblib.dump(model, model_path)
print(f"✅ Model saved to: {model_path}")

# Evaluate
y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)
print(f"✅ Accuracy: {accuracy:.2%}")
