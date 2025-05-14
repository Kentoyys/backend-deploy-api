import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report
import joblib
import os

# 1. Load dataset
csv_path = r'C:\Users\omlan\OneDrive\Documents\GitHub\early_edge\backend\data\dyslexia_letter_dataset_10k.csv'
df = pd.read_csv(csv_path)

# 2. Encode target label
df['target'] = df['group'].apply(lambda x: 1 if x == 'dyslexic' else 0)

# 3. Feature engineering
le_question_type = LabelEncoder()
df['question_type_enc'] = le_question_type.fit_transform(df['question_type'])

all_letters = ['b', 'd', 'p', 'q', 'm', 'n', 'u', 't', 'f', 'c', 'o', 'h', 'k', 'v', 'w', 'x', 'z', 'y', 'a', 'e', 'i', 'l', 'j']

def letters_to_multihot(shown_letters_list):
    return [1 if letter in shown_letters_list else 0 for letter in all_letters]

df['shown_letters_enc'] = df['shown_letters'].apply(lambda x: letters_to_multihot(x.split(',')))

# Features and target
features = df[['correct', 'response_time_ms', 'question_type_enc']]
features = features.join(pd.DataFrame(df['shown_letters_enc'].tolist(), columns=all_letters))
target = df['target']

# 4. Train/test split
X_train, X_test, y_train, y_test = train_test_split(features, target, test_size=0.2, random_state=42, stratify=target)

# 5. Scale numerical feature (response_time_ms)
scaler = StandardScaler()
X_train_scaled = X_train.copy()
X_test_scaled = X_test.copy()
X_train_scaled['response_time_ms'] = scaler.fit_transform(X_train[['response_time_ms']])
X_test_scaled['response_time_ms'] = scaler.transform(X_test[['response_time_ms']])

# 6. Train sklearn model
clf = RandomForestClassifier(n_estimators=100, random_state=42)
clf.fit(X_train_scaled, y_train)

# 7. Evaluation
y_pred = clf.predict(X_test_scaled)
acc = accuracy_score(y_test, y_pred)
print(f"\nTest Accuracy: {acc*100:.2f}%")
print(classification_report(y_test, y_pred))

# 8. Save model, encoder, and scaler
base_dir = os.path.dirname(__file__)
models_dir = os.path.abspath(os.path.join(base_dir, '..', 'models'))
os.makedirs(models_dir, exist_ok=True)

joblib.dump(clf, os.path.join(models_dir, 'dyslexia_letter_confusion_model.joblib'))
joblib.dump(le_question_type, os.path.join(models_dir, 'le_question_type.joblib'))
joblib.dump(scaler, os.path.join(models_dir, 'scaler.joblib'))
print("✅ Saved model, encoder, and scaler to ../models/")
