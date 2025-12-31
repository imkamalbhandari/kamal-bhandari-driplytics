"""
Driplytics - Sneaker Price Prediction Model Training
Based on proposal: Train ML models (Random Forest, Linear Regression) to forecast resale prices.

Dataset: stockx_complete.csv with columns:
- Order Date, Brand, Sneaker Name, Sale Price, Retail Price, Release Date, Shoe Size, Buyer Region
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import joblib
import os
from datetime import datetime

# Create models directory
MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')
os.makedirs(MODELS_DIR, exist_ok=True)

def load_and_prepare_data():
    """Load and prepare StockX sneaker data for training."""
    print("Loading StockX dataset...")
    
    data_path = os.path.join(os.path.dirname(__file__), 'datasets', 'stockx_complete.csv')
    df = pd.read_csv(data_path)
    
    print(f"Loaded {len(df)} sneaker records")
    print(f"Columns: {df.columns.tolist()}")
    
    # Clean price columns - remove $ and commas, convert to float
    df['Sale_Price'] = df['Sale Price'].replace(r'[\$,]', '', regex=True).astype(float)
    df['Retail_Price'] = df['Retail Price'].replace(r'[\$,]', '', regex=True).astype(float)
    
    # Calculate price premium (target for prediction)
    df['Price_Premium'] = df['Sale_Price'] - df['Retail_Price']
    df['Price_Premium_Pct'] = ((df['Sale_Price'] - df['Retail_Price']) / df['Retail_Price']) * 100
    
    # Parse dates
    df['Order_Date'] = pd.to_datetime(df['Order Date'], format='%m/%d/%y', errors='coerce')
    df['Release_Date'] = pd.to_datetime(df['Release Date'], format='%m/%d/%y', errors='coerce')
    
    # Extract date features
    df['Order_Year'] = df['Order_Date'].dt.year
    df['Order_Month'] = df['Order_Date'].dt.month
    df['Order_DayOfWeek'] = df['Order_Date'].dt.dayofweek
    df['Release_Year'] = df['Release_Date'].dt.year
    df['Release_Month'] = df['Release_Date'].dt.month
    
    # Days since release at time of sale
    df['Days_Since_Release'] = (df['Order_Date'] - df['Release_Date']).dt.days
    
    # Clean Brand column (strip whitespace)
    df['Brand'] = df['Brand'].str.strip()
    
    # Remove invalid rows
    df = df.dropna(subset=['Sale_Price', 'Retail_Price', 'Brand'])
    df = df[df['Sale_Price'] > 0]
    df = df[df['Retail_Price'] > 0]
    df = df[df['Days_Since_Release'] >= 0]  # Remove future releases
    
    # Fill missing values
    df['Shoe Size'] = df['Shoe Size'].fillna(df['Shoe Size'].median())
    df['Days_Since_Release'] = df['Days_Since_Release'].fillna(df['Days_Since_Release'].median())
    df['Order_Month'] = df['Order_Month'].fillna(6)
    df['Order_DayOfWeek'] = df['Order_DayOfWeek'].fillna(3)
    df['Release_Year'] = df['Release_Year'].fillna(df['Release_Year'].median())
    df['Release_Month'] = df['Release_Month'].fillna(6)
    
    print(f"After cleaning: {len(df)} records")
    print(f"\nPrice Statistics:")
    print(f"  Sale Price - Mean: ${df['Sale_Price'].mean():.2f}, Median: ${df['Sale_Price'].median():.2f}")
    print(f"  Retail Price - Mean: ${df['Retail_Price'].mean():.2f}, Median: ${df['Retail_Price'].median():.2f}")
    print(f"  Price Premium - Mean: ${df['Price_Premium'].mean():.2f}, Median: ${df['Price_Premium'].median():.2f}")
    print(f"\nBrands: {df['Brand'].unique().tolist()}")
    
    return df

def encode_features(df):
    """Encode categorical features."""
    print("\nEncoding features...")
    
    # Initialize encoders
    brand_encoder = LabelEncoder()
    region_encoder = LabelEncoder()
    sneaker_encoder = LabelEncoder()
    
    # Encode categorical variables
    df['Brand_Encoded'] = brand_encoder.fit_transform(df['Brand'].astype(str))
    df['Region_Encoded'] = region_encoder.fit_transform(df['Buyer Region'].fillna('Unknown').astype(str))
    
    # Encode sneaker names (for sneaker-specific patterns)
    df['Sneaker_Encoded'] = sneaker_encoder.fit_transform(df['Sneaker Name'].astype(str))
    
    print(f"  Brands encoded: {len(brand_encoder.classes_)}")
    print(f"  Regions encoded: {len(region_encoder.classes_)}")
    print(f"  Unique sneakers: {len(sneaker_encoder.classes_)}")
    
    return df, brand_encoder, region_encoder, sneaker_encoder

def prepare_features(df):
    """Prepare features for training resale price prediction."""
    
    # Features based on proposal requirements
    feature_columns = [
        'Brand_Encoded',        # Brand influence on price
        'Region_Encoded',       # Buyer region demand
        'Retail_Price',         # Base retail price
        'Shoe Size',            # Size (certain sizes are more valuable)
        'Days_Since_Release',   # Time since release (freshness/rarity)
        'Release_Year',         # Release year (vintage factor)
        'Release_Month',        # Seasonality of release
        'Order_Month',          # Seasonality of purchase
        'Order_DayOfWeek',      # Day of week patterns
    ]
    
    # Target: Sale Price (what we want to predict)
    target_column = 'Sale_Price'
    
    X = df[feature_columns].copy()
    y = df[target_column].copy()
    
    # Handle any remaining NaN values
    X = X.fillna(0)
    
    print(f"\nFeature matrix shape: {X.shape}")
    print(f"Target shape: {y.shape}")
    print(f"Features used: {feature_columns}")
    
    return X, y, feature_columns, df

def train_models(X, y, df):
    """Train Random Forest, Gradient Boosting, and Linear Regression models."""
    print("\n" + "="*50)
    print("TRAINING MODELS")
    print("="*50)
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    print(f"Training set: {len(X_train)}, Test set: {len(X_test)}")
    
    # Scale features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    results = {}
    models = {}
    
    # 1. Random Forest Regressor (primary model from proposal)
    print("\n--- Random Forest Regressor ---")
    rf_model = RandomForestRegressor(
        n_estimators=200,
        max_depth=15,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1
    )
    rf_model.fit(X_train, y_train)
    rf_pred = rf_model.predict(X_test)
    
    rf_metrics = evaluate_model(y_test, rf_pred, "Random Forest")
    results['random_forest'] = rf_metrics
    models['random_forest'] = rf_model
    
    # Feature importance
    print("\nFeature Importance (Random Forest):")
    feature_importance = pd.DataFrame({
        'feature': X.columns,
        'importance': rf_model.feature_importances_
    }).sort_values('importance', ascending=False)
    print(feature_importance.to_string(index=False))
    
    # 2. Gradient Boosting Regressor
    print("\n--- Gradient Boosting Regressor ---")
    gb_model = GradientBoostingRegressor(
        n_estimators=150,
        max_depth=8,
        learning_rate=0.1,
        min_samples_split=5,
        random_state=42
    )
    gb_model.fit(X_train, y_train)
    gb_pred = gb_model.predict(X_test)
    
    gb_metrics = evaluate_model(y_test, gb_pred, "Gradient Boosting")
    results['gradient_boosting'] = gb_metrics
    models['gradient_boosting'] = gb_model
    
    # 3. Ridge Regression (regularized linear model)
    print("\n--- Ridge Regression ---")
    ridge_model = Ridge(alpha=1.0)
    ridge_model.fit(X_train_scaled, y_train)
    ridge_pred = ridge_model.predict(X_test_scaled)
    
    ridge_metrics = evaluate_model(y_test, ridge_pred, "Ridge Regression")
    results['ridge_regression'] = ridge_metrics
    models['ridge_regression'] = ridge_model
    
    # 4. Linear Regression (baseline)
    print("\n--- Linear Regression ---")
    lr_model = LinearRegression()
    lr_model.fit(X_train_scaled, y_train)
    lr_pred = lr_model.predict(X_test_scaled)
    
    lr_metrics = evaluate_model(y_test, lr_pred, "Linear Regression")
    results['linear_regression'] = lr_metrics
    models['linear_regression'] = lr_model
    
    # Find best model
    best_model_name = max(results.keys(), key=lambda k: results[k]['r2'])
    print(f"\n*** Best Model: {best_model_name.replace('_', ' ').title()} (R² = {results[best_model_name]['r2']:.4f}) ***")
    
    return models, scaler, results, best_model_name

def evaluate_model(y_true, y_pred, model_name):
    """Evaluate model performance."""
    mse = mean_squared_error(y_true, y_pred)
    rmse = np.sqrt(mse)
    mae = mean_absolute_error(y_true, y_pred)
    r2 = r2_score(y_true, y_pred)
    
    # MAPE (Mean Absolute Percentage Error)
    mape = np.mean(np.abs((y_true - y_pred) / (y_true + 1e-8))) * 100
    
    print(f"\n{model_name} Evaluation Metrics:")
    print(f"  RMSE:  {rmse:.4f}")
    print(f"  MAE:   {mae:.4f}")
    print(f"  R²:    {r2:.4f}")
    print(f"  MAPE:  {mape:.2f}%")
    
    return {
        'rmse': rmse,
        'mae': mae,
        'r2': r2,
        'mape': mape
    }

def save_models(models, scaler, brand_encoder, region_encoder, sneaker_encoder, feature_columns, results, best_model_name):
    """Save trained models and encoders."""
    print("\n" + "="*50)
    print("SAVING MODELS")
    print("="*50)
    
    # Save all models
    for model_name, model in models.items():
        joblib.dump(model, os.path.join(MODELS_DIR, f'{model_name}_model.pkl'))
    
    # Save scaler and encoders
    joblib.dump(scaler, os.path.join(MODELS_DIR, 'scaler.pkl'))
    joblib.dump(brand_encoder, os.path.join(MODELS_DIR, 'brand_encoder.pkl'))
    joblib.dump(region_encoder, os.path.join(MODELS_DIR, 'region_encoder.pkl'))
    joblib.dump(sneaker_encoder, os.path.join(MODELS_DIR, 'sneaker_encoder.pkl'))
    
    # Save feature columns for reference
    joblib.dump(feature_columns, os.path.join(MODELS_DIR, 'feature_columns.pkl'))
    
    # Save training metadata
    metadata = {
        'trained_at': datetime.now().isoformat(),
        'best_model': best_model_name,
        'results': results,
        'feature_columns': feature_columns
    }
    joblib.dump(metadata, os.path.join(MODELS_DIR, 'training_metadata.pkl'))
    
    print(f"Models saved to: {MODELS_DIR}")
    print("Files created:")
    for f in sorted(os.listdir(MODELS_DIR)):
        if f.endswith('.pkl'):
            print(f"  - {f}")

def main():
    """Main training pipeline."""
    print("="*60)
    print("DRIPLYTICS - SNEAKER RESALE PRICE PREDICTION MODEL")
    print("Based on StockX Complete Dataset")
    print("="*60)
    print(f"Training started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Load and prepare data
    df = load_and_prepare_data()
    
    # Encode features
    df, brand_encoder, region_encoder, sneaker_encoder = encode_features(df)
    
    # Prepare features
    X, y, feature_columns, df = prepare_features(df)
    
    # Train models
    models, scaler, results, best_model_name = train_models(X, y, df)
    
    # Save models
    save_models(models, scaler, brand_encoder, region_encoder, sneaker_encoder, 
                feature_columns, results, best_model_name)
    
    # Summary
    print("\n" + "="*60)
    print("TRAINING COMPLETE - SUMMARY")
    print("="*60)
    print(f"\nModels trained: {list(models.keys())}")
    print(f"Best Model: {best_model_name.replace('_', ' ').title()}")
    print(f"  R²:   {results[best_model_name]['r2']:.4f}")
    print(f"  RMSE: ${results[best_model_name]['rmse']:.2f}")
    print(f"  MAE:  ${results[best_model_name]['mae']:.2f}")
    print(f"  MAPE: {results[best_model_name]['mape']:.2f}%")
    print(f"\nTraining completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    return results

if __name__ == "__main__":
    main()
