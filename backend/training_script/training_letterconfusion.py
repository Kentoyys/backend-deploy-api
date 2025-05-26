import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import joblib
import os

# 1. Load dataset
csv_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'letter_training_dataset.csv')
df = pd.read_csv(csv_path)

# Handle missing values
df['is_correct'] = df['is_correct'].fillna(0).astype(int)
df['user_response'] = df['user_response'].fillna('')
df['response_time_ms'] = df['response_time_ms'].fillna(df['response_time_ms'].median())
df['risk_level'] = df['risk_level'].fillna('Minimal')
df['options'] = df['options'].fillna('')

# 2. Feature engineering
# Encode risk levels
le_risk = LabelEncoder()
df['risk_level_enc'] = le_risk.fit_transform(df['risk_level'])

# Extract letters from options
def extract_letters(options_str):
    return options_str.split(',')

# Create one-hot encoding for letters in options
all_letters = sorted(list(set([letter for options in df['options'] for letter in extract_letters(options)])))
def letters_to_multihot(options_str):
    letters = extract_letters(options_str)
    return [1 if letter in letters else 0 for letter in all_letters]

# Create features
df['letters_enc'] = df['options'].apply(letters_to_multihot)

# Create response time features
df['response_time_log'] = np.log1p(df['response_time_ms'])
df['response_time_bins'] = pd.qcut(df['response_time_ms'], q=5, labels=['very_fast', 'fast', 'medium', 'slow', 'very_slow'])
le_time_bins = LabelEncoder()
df['response_time_bins_enc'] = le_time_bins.fit_transform(df['response_time_bins'])

# Create features for correct/incorrect patterns
df['is_correct_enc'] = df['is_correct'].astype(int)
df['has_multiple_selection'] = df['user_response'].str.contains(',').astype(int)
df['is_empty_response'] = (df['user_response'] == '').astype(int)

# Create letter features DataFrame
letter_features = pd.DataFrame(df['letters_enc'].tolist(), columns=[f'letter_{l}' for l in all_letters])

# Combine all features
feature_columns = [
    'is_correct_enc',
    'response_time_log',
    'response_time_bins_enc',
    'has_multiple_selection',
    'is_empty_response'
]

# Prepare final feature matrix
X = pd.concat([
    df[feature_columns],
    letter_features
], axis=1)

y = df['risk_level_enc']

# 3. Train/test split with stratification
X_train, X_test, y_train, y_test = train_test_split(
    X, y, 
    test_size=0.2, 
    random_state=42,
    stratify=y
)

# 4. Scale numerical features
scaler = StandardScaler()
numerical_features = ['response_time_log']
X_train[numerical_features] = scaler.fit_transform(X_train[numerical_features])
X_test[numerical_features] = scaler.transform(X_test[numerical_features])

# 5. Train model with class weights
class_weights = dict(zip(
    np.unique(y_train),
    len(y_train) / (len(np.unique(y_train)) * np.bincount(y_train))
))

clf = RandomForestClassifier(
    n_estimators=200,
    max_depth=10,
    min_samples_split=5,
    min_samples_leaf=2,
    class_weight=class_weights,
    random_state=42
)

clf.fit(X_train, y_train)

# 6. Evaluation
y_pred = clf.predict(X_test)
y_pred_proba = clf.predict_proba(X_test)

print("\nModel Performance:")
print("-----------------")
print(f"Accuracy: {accuracy_score(y_test, y_pred):.3f}")
print("\nClassification Report:")
print(classification_report(y_test, y_pred, target_names=le_risk.classes_))
print("\nConfusion Matrix:")
print(confusion_matrix(y_test, y_pred))

# 7. Feature importance
feature_importance = pd.DataFrame({
    'feature': X.columns,
    'importance': clf.feature_importances_
}).sort_values('importance', ascending=False)

print("\nTop 10 Most Important Features:")
print(feature_importance.head(10))

# 8. Save model and encoders
models_dir = os.path.join(os.path.dirname(__file__), '..', 'models')
os.makedirs(models_dir, exist_ok=True)

joblib.dump(clf, os.path.join(models_dir, 'letter_confusion_model.joblib'))
joblib.dump(le_risk, os.path.join(models_dir, 'risk_level_encoder.joblib'))
joblib.dump(le_time_bins, os.path.join(models_dir, 'time_bins_encoder.joblib'))
joblib.dump(scaler, os.path.join(models_dir, 'feature_scaler.joblib'))

print("\n✅ Model and encoders saved to ../models/")
