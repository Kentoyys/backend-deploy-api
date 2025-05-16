import pandas as pd
import librosa
import numpy as np
import os
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
from sklearn.preprocessing import StandardScaler
import joblib

# Set random seed for reproducibility
RANDOM_SEED = 42
np.random.seed(RANDOM_SEED)

# Paths
base_dir = os.path.abspath(os.path.dirname(__file__))
csv_path = os.path.join(base_dir, '../data/spelling_audio_dataset.csv')
model_path = os.path.join(base_dir, '../models/dyslexia_spelling_audio_model.joblib')

# Load dataset
print(f"Loading dataset from: {csv_path}")
df = pd.read_csv(csv_path)

X = []
y = []

for _, row in df.iterrows():
    audio_path = row['audio_file']
    full_path = os.path.join(base_dir, '..', audio_path)
    label = row.get('is_incorrect', None)
    if label is None:
        print(f"⚠️ Skipping row with missing label: {audio_path}")
        continue
    try:
        y_audio, sr = librosa.load(full_path, sr=16000)
        mfcc = librosa.feature.mfcc(y=y_audio, sr=sr, n_mfcc=20)  # Use 20 MFCCs for richer features
        mfcc_delta = librosa.feature.delta(mfcc)
        mfcc_delta2 = librosa.feature.delta(mfcc, order=2)
        features = np.concatenate([mfcc, mfcc_delta, mfcc_delta2], axis=0)
        max_len = 100
        if features.shape[1] < max_len:
            pad_width = max_len - features.shape[1]
            features = np.pad(features, ((0, 0), (0, pad_width)), mode='constant')
        else:
            features = features[:, :max_len]
        X.append(features.flatten())
        y.append(label)
    except Exception as e:
        print(f"❌ Failed to process {audio_path}: {e}")

X = np.array(X)
y = np.array(y, dtype=int)

# Label check
unique_labels, counts = np.unique(y, return_counts=True)
print(f"✅ Label distribution: {dict(zip(unique_labels, counts))}")
if len(unique_labels) < 2:
    raise ValueError("❌ Dataset must contain both classes.")

# Feature scaling
scaler = StandardScaler()
X = scaler.fit_transform(X)

# Train/test split
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=RANDOM_SEED, stratify=y
)

# Train model (RandomForest)
model = RandomForestClassifier(n_estimators=100, random_state=RANDOM_SEED)
model.fit(X_train, y_train)

# Save model and scaler
os.makedirs(os.path.dirname(model_path), exist_ok=True)
joblib.dump({'model': model, 'scaler': scaler}, model_path)
print(f"✅ Model and scaler saved to: {model_path}")

# Evaluate
y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)
print(f"✅ Accuracy: {accuracy:.2%}")
print("\nClassification Report:")
print(classification_report(y_test, y_pred, target_names=["Correct", "Incorrect"]))
