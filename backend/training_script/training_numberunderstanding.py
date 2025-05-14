import pandas as pd
import os
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report
import joblib

# Paths
base_dir = os.path.dirname(__file__)
data_path = os.path.join(base_dir, '../data/number_understanding_dataset_10k.csv')
model_path = os.path.join(base_dir, '../models/dyscalculia_numberunderstanding.joblib')
scaler_path = os.path.join(base_dir, '../models/number_understanding_scaler.pkl')

# Load dataset
data = pd.read_csv(data_path)

# Feature engineering
data['user_correct'] = (data['user_answer'] == data['correct_answer']).astype(int)

# Input features and label
X = data[['left_number', 'right_number', 'response_time_sec', 'user_correct']]
y = data['at_risk']

# Normalize
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# Save the scaler (for backend inference consistency)
joblib.dump(scaler, scaler_path)

# Train-test split
X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2, random_state=42)

# Train sklearn model
clf = RandomForestClassifier(n_estimators=100, random_state=42)
clf.fit(X_train, y_train)

# Evaluation
y_pred = clf.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)
print(f'✅ Accuracy on test set: {accuracy * 100:.2f}%')
print(classification_report(y_test, y_pred))

# Save model
joblib.dump(clf, model_path)
print(f'✅ Model saved to: {model_path}')
print(f'✅ Scaler saved to: {scaler_path}')
