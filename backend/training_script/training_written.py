import os
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report
from skimage import io, transform, feature
from skimage.color import rgb2gray
import joblib

# Get base directory dynamically
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "data"))  # points to ../data
MODEL_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "models"))  # now points to backend/models
os.makedirs(MODEL_DIR, exist_ok=True)

def load_and_preprocess_images(data_dir):
    """Load and preprocess images from the data directory."""
    images = []
    labels = []
    
    # Walk through the data directory
    for class_idx, class_name in enumerate(sorted(os.listdir(data_dir))):
        class_dir = os.path.join(data_dir, class_name)
        if not os.path.isdir(class_dir):
            continue
            
        for img_name in os.listdir(class_dir):
            if not img_name.lower().endswith(('.png', '.jpg', '.jpeg')):
                continue
                
            img_path = os.path.join(class_dir, img_name)
            try:
                # Load and preprocess image
                img = io.imread(img_path)
                if len(img.shape) == 3:  # Convert to grayscale if RGB
                    img = rgb2gray(img)
                
                # Resize to 128x128
                img = transform.resize(img, (128, 128))
                
                # Extract HOG features
                hog_features = feature.hog(img, orientations=8, pixels_per_cell=(16, 16),
                                         cells_per_block=(1, 1), visualize=False)
                
                images.append(hog_features)
                labels.append(class_idx)
            except Exception as e:
                print(f"Error processing {img_path}: {str(e)}")
    
    return np.array(images), np.array(labels)

def train_model():
    """Train the model using scikit-learn pipeline."""
    print("Loading and preprocessing images...")
    X, y = load_and_preprocess_images(DATA_DIR)
    
    # Split the data
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # Create and train the pipeline
    pipeline = Pipeline([
        ('scaler', StandardScaler()),
        ('classifier', RandomForestClassifier(n_estimators=100, random_state=42))
    ])
    
    print("Training model...")
    pipeline.fit(X_train, y_train)
    
    # Evaluate the model
    y_pred = pipeline.predict(X_test)
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))
    
    # Save the model
    model_save_path = os.path.join(MODEL_DIR, "dysgraphia_handwritten_model.joblib")
    joblib.dump(pipeline, model_save_path)
    print(f"\nModel saved to {model_save_path}")

if __name__ == "__main__":
    train_model()