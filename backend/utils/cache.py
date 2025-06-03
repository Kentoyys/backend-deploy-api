from functools import lru_cache
import pandas as pd
import joblib
import os

# Cache for CSV data
@lru_cache(maxsize=10)
def load_csv_data(file_path: str) -> pd.DataFrame:
    """Load and cache CSV data"""
    return pd.read_csv(file_path)

# Cache for models
@lru_cache(maxsize=10)
def load_model(model_path: str):
    """Load and cache ML models"""
    return joblib.load(model_path)

# Cache for JSON data
@lru_cache(maxsize=10)
def load_json_data(file_path: str):
    """Load and cache JSON data"""
    import json
    with open(file_path, 'r') as f:
        return json.load(f)

# Clear all caches
def clear_all_caches():
    """Clear all cached data"""
    load_csv_data.cache_clear()
    load_model.cache_clear()
    load_json_data.cache_clear() 