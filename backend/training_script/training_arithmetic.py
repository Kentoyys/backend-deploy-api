import os
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report
import joblib

# ======= Setup paths =======
base_dir = os.path.dirname(os.path.abspath(__file__))
data_path = os.path.join(base_dir, '../data/arithmetic_data_1k.csv')
model_path = os.path.join(base_dir, '../models/dyscalculia_arithmetic.joblib')
op_encoder_path = os.path.join(base_dir, '../models/arithmetic_op_encoder.joblib')
scaler_path = os.path.join(base_dir, '../models/arithmetic_scaler.pkl')

# ======= Load Dataset =======
df = pd.read_csv(data_path)

# ======= Feature Engineering =======
df['op1'] = df['question'].str.extract(r'(\d+)').astype(int)
df['op2'] = df['question'].str.extract(r'[\+\-\*/] (\d+)').astype(int)
df['operation'] = df['question'].str.extract(r'(\+|\-|\*|\/)')

# Encode operations
op_encoder = LabelEncoder()
df['operation'] = op_encoder.fit_transform(df['operation'])

# Encode choices
df['user_choice'] = df['user_choice'].apply(lambda x: 0 if x == 'choice_1' else 1)
df['correct_choice'] = df['correct_choice'].apply(lambda x: 0 if x == 'choice_1' else 1)

# ======= Add response_time as a feature =======
df['response_time'] = df['response_time'].astype(float)

# ======= Prepare Data =======
X = df[['op1', 'op2', 'operation', 'user_choice', 'response_time']]
y = df['is_correct'].astype(int)

# ======= Normalize =======
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# Save the scaler and encoder for backend inference
joblib.dump(scaler, scaler_path)
joblib.dump(op_encoder, op_encoder_path)

# ======= Train-Test Split =======
X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2, random_state=42)

# ======= Train sklearn model =======
clf = RandomForestClassifier(n_estimators=100, random_state=42)
clf.fit(X_train, y_train)

# ======= Evaluation =======
y_pred = clf.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)
print(f'✅ Accuracy on test set: {accuracy * 100:.2f}%')
print(classification_report(y_test, y_pred))

# ======= Save Model =======
os.makedirs(os.path.dirname(model_path), exist_ok=True)
joblib.dump(clf, model_path)
print(f'✅ Model saved at: {model_path}')
print(f'✅ Scaler saved at: {scaler_path}')
print(f'✅ Operation encoder saved at: {op_encoder_path}')
