import os
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.preprocessing import StandardScaler
import joblib
import re

def extract_phoneme_features(text):
    text = str(text)
    vowels = len(re.findall(r'[aeiou]', text.lower()))
    consonants = len(re.findall(r'[bcdfghjklmnpqrstvwxyz]', text.lower()))
    total_chars = len(text)
    vowel_ratio = vowels / total_chars if total_chars > 0 else 0
    consonant_ratio = consonants / total_chars if total_chars > 0 else 0
    return [vowels, consonants, vowel_ratio, consonant_ratio, total_chars]

def load_and_preprocess_data(file_path):
    df = pd.read_csv(file_path)
    for col in ['Question', 'Child_Response']:
        df[col] = df[col].fillna('').astype(str)
    # Text features
    df['combined_text'] = df['Question'] + ' ' + df['Child_Response']
    # Phoneme features for both question and child response
    question_phonemes = df['Question'].apply(extract_phoneme_features)
    child_phonemes = df['Child_Response'].apply(extract_phoneme_features)
    question_phoneme_df = pd.DataFrame(question_phonemes.tolist(), columns=[f'q_{x}' for x in ['vowels','consonants','vowel_ratio','consonant_ratio','total_chars']])
    child_phoneme_df = pd.DataFrame(child_phonemes.tolist(), columns=[f'c_{x}' for x in ['vowels','consonants','vowel_ratio','consonant_ratio','total_chars']])
    # Risk level mapping
    risk_level_map = {'Minimal': 0, 'Emerging': 1, 'Strong_Indicators': 2}
    df['risk_level_numeric'] = df['Risk_Level'].map(risk_level_map)
    # Combine all numeric features
    feature_df = pd.concat([question_phoneme_df, child_phoneme_df], axis=1)
    return df, feature_df

def train_model(df, feature_df):
    X_text = df['combined_text']
    X_numeric = feature_df
    y = df['risk_level_numeric']
    X_text_train, X_text_test, X_numeric_train, X_numeric_test, y_train, y_test = train_test_split(
        X_text, X_numeric, y, test_size=0.2, random_state=42, stratify=y
    )
    vectorizer = TfidfVectorizer(
        max_features=1500,
        ngram_range=(1, 2),
        stop_words='english'
    )
    X_text_train_tfidf = vectorizer.fit_transform(X_text_train)
    X_text_test_tfidf = vectorizer.transform(X_text_test)
    scaler = StandardScaler()
    X_numeric_train_scaled = scaler.fit_transform(X_numeric_train)
    X_numeric_test_scaled = scaler.transform(X_numeric_test)
    X_train_combined = np.hstack([X_text_train_tfidf.toarray(), X_numeric_train_scaled])
    X_test_combined = np.hstack([X_text_test_tfidf.toarray(), X_numeric_test_scaled])
    model = RandomForestClassifier(
        n_estimators=300,
        max_depth=20,
        random_state=42,
        class_weight='balanced'
    )
    model.fit(X_train_combined, y_train)
    return model, vectorizer, scaler, X_test_combined, y_test, y_train

def evaluate_model(model, X_test, y_test, y_train):
    y_pred = model.predict(X_test)
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=['Minimal', 'Emerging', 'Strong_Indicators']))
    print("\nConfusion Matrix:")
    print(confusion_matrix(y_test, y_pred))
    # Cross-validation
    print("\nCross-validation F1 (macro):")
    # (Optional: add cross_val_score here if you want)

def save_model(model, vectorizer, scaler, output_dir='models'):
    os.makedirs(output_dir, exist_ok=True)
    joblib.dump(model, os.path.join(output_dir, 'phonospeech_model.joblib'))
    joblib.dump(vectorizer, os.path.join(output_dir, 'vectorizer.joblib'))
    joblib.dump(scaler, os.path.join(output_dir, 'scaler.joblib'))
    print(f"\nModel and preprocessing components saved to {output_dir}/")

def main():
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    data_file = os.path.abspath(os.path.join(BASE_DIR, "..", "data", "dyslexia_training_dataset.csv"))
    print("Loading and preprocessing data...")
    df, feature_df = load_and_preprocess_data(data_file)
    print("Training model...")
    model, vectorizer, scaler, X_test, y_test, y_train = train_model(df, feature_df)
    print("Evaluating model...")
    evaluate_model(model, X_test, y_test, y_train)
    print("Saving model...")
    save_model(model, vectorizer, scaler, os.path.abspath(os.path.join(BASE_DIR, "..", "models")))
    print("\nTraining complete!")

if __name__ == "__main__":
    main()