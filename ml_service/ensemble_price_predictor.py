"""
Driplytics - Ensemble Price Prediction
Combines multiple AI models for the most accurate sneaker price prediction:

1. Random Forest Regressor - Pattern recognition from historical data
2. Gradient Boosting Regressor - Boosted trees for better accuracy
3. Ridge/Linear Regression - Statistical baseline
4. Prophet Time Series - Temporal patterns and seasonality
5. Sentiment Analysis - Social hype scoring
6. Google Trends Integration - Real-time interest data
7. Groq LLM - AI-powered market insights

Ensemble Method: Weighted average with confidence-based weighting
"""

import os
import numpy as np
import pandas as pd
import joblib
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
import traceback

# Local imports
from sentiment_analysis import analyze_sentiment, clean_text, calculate_hype_score
from time_series import generate_historical_prices, predict_with_prophet, get_sneaker_price_history

# Model paths
MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')
DATASETS_DIR = os.path.join(os.path.dirname(__file__), 'datasets')


class EnsemblePricePredictor:
    """
    Ensemble model that combines all AI prediction methods for 
    the most accurate sneaker price prediction.
    """
    
    def __init__(self):
        """Initialize and load all models."""
        self.models = {}
        self.encoders = {}
        self.loaded = False
        self.load_models()
        
    def load_models(self):
        """Load all trained ML models and encoders."""
        try:
            # Load ML models
            self.models['random_forest'] = joblib.load(os.path.join(MODELS_DIR, 'random_forest_model.pkl'))
            self.models['gradient_boosting'] = joblib.load(os.path.join(MODELS_DIR, 'gradient_boosting_model.pkl'))
            
            # Try to load linear regression models
            try:
                self.models['linear_regression'] = joblib.load(os.path.join(MODELS_DIR, 'linear_regression_model.pkl'))
            except:
                pass
                
            try:
                self.models['ridge_regression'] = joblib.load(os.path.join(MODELS_DIR, 'ridge_regression_model.pkl'))
            except:
                pass
            
            # Load encoders and scaler
            self.encoders['brand'] = joblib.load(os.path.join(MODELS_DIR, 'brand_encoder.pkl'))
            self.encoders['region'] = joblib.load(os.path.join(MODELS_DIR, 'region_encoder.pkl'))
            self.scaler = joblib.load(os.path.join(MODELS_DIR, 'scaler.pkl'))
            self.feature_columns = joblib.load(os.path.join(MODELS_DIR, 'feature_columns.pkl'))
            
            # Load training metadata
            self.metadata = joblib.load(os.path.join(MODELS_DIR, 'training_metadata.pkl'))
            
            self.loaded = True
            print(f"✅ Ensemble Predictor: Loaded {len(self.models)} ML models")
            
        except Exception as e:
            print(f"❌ Error loading models: {e}")
            self.loaded = False
    
    def encode_brand(self, brand: str) -> int:
        """Encode brand to numeric value."""
        try:
            return self.encoders['brand'].transform([brand])[0]
        except:
            # Default to Yeezy if unknown
            return 1
    
    def encode_region(self, region: str) -> int:
        """Encode region to numeric value."""
        try:
            return self.encoders['region'].transform([region])[0]
        except:
            return len(self.encoders['region'].classes_) // 2
    
    def prepare_features(self, data: Dict[str, Any]) -> np.ndarray:
        """Prepare feature vector for ML models."""
        # Extract data
        brand = data.get('brand', 'Yeezy').strip()
        retail_price = float(data.get('retail_price', 220))
        release_date = data.get('release_date', datetime.now().strftime('%Y-%m-%d'))
        shoe_size = float(data.get('shoe_size', 10))
        region = data.get('region', 'California')
        
        # Parse release date
        try:
            release_dt = datetime.strptime(release_date, '%Y-%m-%d')
        except:
            try:
                release_dt = datetime.strptime(release_date, '%m/%d/%y')
            except:
                release_dt = datetime.now()
        
        order_date = datetime.now()
        days_since_release = max(0, (order_date - release_dt).days)
        
        # Create feature vector
        features = np.array([[
            self.encode_brand(brand),
            self.encode_region(region),
            retail_price,
            shoe_size,
            days_since_release,
            release_dt.year,
            release_dt.month,
            order_date.month,
            order_date.weekday()
        ]])
        
        return features
    
    def predict_with_ml_models(self, features: np.ndarray) -> Dict[str, Dict[str, float]]:
        """Get predictions from all ML models."""
        predictions = {}
        
        # Random Forest prediction
        if 'random_forest' in self.models:
            rf_pred = self.models['random_forest'].predict(features)[0]
            predictions['random_forest'] = {
                'predicted_price': float(max(0, rf_pred)),  # Ensure non-negative
                'confidence': 0.93,  # Based on R² from training
                'weight': 0.35,
                'model_type': 'Tree-based Ensemble'
            }
        
        # Gradient Boosting prediction
        if 'gradient_boosting' in self.models:
            gb_pred = self.models['gradient_boosting'].predict(features)[0]
            predictions['gradient_boosting'] = {
                'predicted_price': float(max(0, gb_pred)),  # Ensure non-negative
                'confidence': 0.91,
                'weight': 0.30,
                'model_type': 'Boosted Trees'
            }
        
        # Linear models (require scaling) - give them less weight as they can be unstable
        try:
            scaled_features = self.scaler.transform(features)
            
            if 'ridge_regression' in self.models:
                ridge_pred = self.models['ridge_regression'].predict(scaled_features)[0]
                # Only use ridge if prediction is reasonable (within 5x retail price range)
                retail_est = features[0][2] if len(features[0]) > 2 else 200
                if ridge_pred > 0 and ridge_pred < retail_est * 5:
                    predictions['ridge_regression'] = {
                        'predicted_price': float(max(0, ridge_pred)),
                        'confidence': 0.75,
                        'weight': 0.10,
                        'model_type': 'Regularized Linear'
                    }
            
            if 'linear_regression' in self.models:
                lr_pred = self.models['linear_regression'].predict(scaled_features)[0]
                # Only use linear if prediction is reasonable
                retail_est = features[0][2] if len(features[0]) > 2 else 200
                if lr_pred > 0 and lr_pred < retail_est * 5:
                    predictions['linear_regression'] = {
                        'predicted_price': float(max(0, lr_pred)),
                        'confidence': 0.72,
                        'weight': 0.05,
                        'model_type': 'Linear Baseline'
                    }
        except Exception as e:
            print(f"Linear models error: {e}")
        
        return predictions
    
    def predict_with_prophet(self, sneaker_name: str, retail_price: float) -> Optional[Dict[str, Any]]:
        """Get time series prediction using Prophet."""
        try:
            if not sneaker_name:
                return None
            
            # Get historical data and forecast
            history_result = get_sneaker_price_history(sneaker_name=sneaker_name)
            
            if history_result.get('success') and history_result.get('forecast'):
                forecast = history_result['forecast']
                
                # Get predictions at different time horizons
                return {
                    'predicted_price_7d': forecast[6]['predicted_price'] if len(forecast) > 6 else None,
                    'predicted_price_14d': forecast[13]['predicted_price'] if len(forecast) > 13 else None,
                    'predicted_price_30d': forecast[-1]['predicted_price'] if forecast else None,
                    'lower_bound': forecast[-1]['lower_bound'] if forecast else None,
                    'upper_bound': forecast[-1]['upper_bound'] if forecast else None,
                    'confidence': 0.85,
                    'weight': 0.20,
                    'model_type': history_result.get('forecast_model', 'Time Series'),
                    'historical_data_points': history_result.get('history', {}).get('data_points', 0)
                }
        except Exception as e:
            print(f"Prophet prediction error: {e}")
        
        return None
    
    def get_sentiment_adjustment(self, sneaker_name: str) -> Dict[str, Any]:
        """Get sentiment-based price adjustment."""
        try:
            from live_data_collector import RedditScraper, LiveSentimentAnalyzer
            
            # Try to get Reddit sentiment
            scraper = RedditScraper()
            posts = scraper.search_sneaker(sneaker_name, limit=20)
            
            if posts:
                analyzer = LiveSentimentAnalyzer()
                analysis = analyzer.analyze_sneaker(sneaker_name, posts)
                
                sentiment_score = analysis.get('overall_sentiment', 0)
                hype_score = analysis.get('hype_score', 50)
                
                # Calculate adjustment factor (±10% based on sentiment)
                adjustment_factor = 1.0 + (sentiment_score * 0.10)
                
                return {
                    'sentiment_score': sentiment_score,
                    'hype_score': hype_score,
                    'adjustment_factor': adjustment_factor,
                    'sample_size': len(posts),
                    'source': 'reddit',
                    'weight': 0.10,
                    'model_type': 'Sentiment Analysis'
                }
        except Exception as e:
            print(f"Sentiment analysis error: {e}")
        
        # Default neutral sentiment
        return {
            'sentiment_score': 0,
            'hype_score': 50,
            'adjustment_factor': 1.0,
            'sample_size': 0,
            'source': 'default',
            'weight': 0.05,
            'model_type': 'Sentiment Analysis'
        }
    
    def get_trends_adjustment(self, sneaker_name: str) -> Dict[str, Any]:
        """Get Google Trends based price adjustment."""
        try:
            from live_data_collector import LiveGoogleTrends
            
            trends = LiveGoogleTrends()
            interest_data = trends.get_live_interest(sneaker_name, timeframe='now 7-d')
            
            current_interest = interest_data.get('current_interest', 50)
            avg_interest = interest_data.get('avg_interest', 50)
            trend_direction = interest_data.get('trend_direction', 'stable')
            
            # Calculate adjustment based on trend
            if trend_direction == 'rising':
                adjustment_factor = 1.0 + (current_interest - avg_interest) / 200
            elif trend_direction == 'falling':
                adjustment_factor = 1.0 - (avg_interest - current_interest) / 200
            else:
                adjustment_factor = 1.0
            
            return {
                'current_interest': current_interest,
                'avg_interest': avg_interest,
                'trend_direction': trend_direction,
                'adjustment_factor': min(1.2, max(0.8, adjustment_factor)),
                'weight': 0.05,
                'model_type': 'Google Trends'
            }
        except Exception as e:
            print(f"Trends analysis error: {e}")
        
        return {
            'current_interest': 50,
            'avg_interest': 50,
            'trend_direction': 'stable',
            'adjustment_factor': 1.0,
            'weight': 0.02,
            'model_type': 'Google Trends'
        }
    
    def get_groq_analysis(self, sneaker_data: Dict[str, Any], ml_predictions: Dict) -> Optional[Dict[str, Any]]:
        """Get AI-powered market analysis from Groq LLM."""
        try:
            from groq_service import GROQ_API_KEY, GROQ_API_URL
            import requests
            
            # Prepare context for LLM
            avg_prediction = np.mean([p['predicted_price'] for p in ml_predictions.values()])
            retail_price = sneaker_data.get('retail_price', 220)
            sneaker_name = sneaker_data.get('sneaker_name', sneaker_data.get('name', 'Unknown'))
            brand = sneaker_data.get('brand', 'Unknown')
            
            prompt = f"""Analyze this sneaker for resale price prediction:

Sneaker: {sneaker_name}
Brand: {brand}
Retail Price: ${retail_price}
ML Predicted Price: ${avg_prediction:.2f}
Days Since Release: {sneaker_data.get('days_since_release', 0)}

Based on your knowledge of the sneaker market:
1. Is this prediction reasonable for this sneaker?
2. What factors should adjust the price (collaboration, colorway rarity, celebrity association)?
3. Suggest a confidence-adjusted price range (low, mid, high)

Return ONLY a JSON object with:
{{"confidence": 0.0-1.0, "adjusted_price": number, "price_low": number, "price_high": number, "factors": ["list of factors"], "market_insight": "brief insight"}}"""

            response = requests.post(
                GROQ_API_URL,
                headers={
                    'Authorization': f'Bearer {GROQ_API_KEY}',
                    'Content-Type': 'application/json'
                },
                json={
                    'model': 'llama-3.1-70b-versatile',
                    'messages': [
                        {'role': 'system', 'content': 'You are a sneaker market expert. Respond with ONLY valid JSON.'},
                        {'role': 'user', 'content': prompt}
                    ],
                    'temperature': 0.3,
                    'max_tokens': 300
                },
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                content = result['choices'][0]['message']['content']
                
                # Parse JSON
                import json
                if '```json' in content:
                    content = content.split('```json')[1].split('```')[0]
                elif '```' in content:
                    content = content.split('```')[1].split('```')[0]
                
                analysis = json.loads(content.strip())
                analysis['weight'] = 0.10
                analysis['model_type'] = 'LLM Market Analysis'
                return analysis
                
        except Exception as e:
            print(f"Groq analysis error: {e}")
        
        return None
    
    def calculate_ensemble_prediction(self, 
                                       ml_predictions: Dict[str, Dict],
                                       prophet_prediction: Optional[Dict],
                                       sentiment: Dict,
                                       trends: Dict,
                                       groq_analysis: Optional[Dict],
                                       retail_price: float) -> Dict[str, Any]:
        """
        Calculate weighted ensemble prediction from all models.
        Uses confidence-weighted averaging with adjustments.
        """
        
        all_predictions = []
        total_weight = 0
        model_breakdown = []
        
        # Add ML model predictions
        for model_name, pred in ml_predictions.items():
            price = pred['predicted_price']
            weight = pred['weight']
            confidence = pred['confidence']
            
            all_predictions.append((price, weight * confidence))
            total_weight += weight * confidence
            
            model_breakdown.append({
                'model': model_name.replace('_', ' ').title(),
                'type': pred['model_type'],
                'predicted_price': round(price, 2),
                'confidence': pred['confidence'],
                'weight': pred['weight']
            })
        
        # Add Prophet prediction if available
        if prophet_prediction and prophet_prediction.get('predicted_price_30d'):
            price = prophet_prediction['predicted_price_30d']
            weight = prophet_prediction['weight']
            confidence = prophet_prediction['confidence']
            
            all_predictions.append((price, weight * confidence))
            total_weight += weight * confidence
            
            model_breakdown.append({
                'model': 'Prophet Time Series',
                'type': prophet_prediction['model_type'],
                'predicted_price': round(price, 2),
                'confidence': confidence,
                'weight': weight,
                'forecast_7d': prophet_prediction.get('predicted_price_7d'),
                'forecast_14d': prophet_prediction.get('predicted_price_14d'),
                'forecast_30d': prophet_prediction.get('predicted_price_30d')
            })
        
        # Calculate base ensemble price
        if total_weight > 0:
            ensemble_price = sum(p * w for p, w in all_predictions) / total_weight
        else:
            ensemble_price = retail_price * 1.1  # Fallback
        
        # Apply sentiment adjustment (±10%)
        sentiment_adjusted_price = ensemble_price * sentiment['adjustment_factor']
        
        # Apply trends adjustment (±5%)
        final_price = sentiment_adjusted_price * trends['adjustment_factor']
        
        # Add Groq LLM analysis
        if groq_analysis:
            llm_price = groq_analysis.get('adjusted_price', final_price)
            llm_confidence = groq_analysis.get('confidence', 0.5)
            
            # Blend LLM insight (10% weight if confident)
            if llm_confidence > 0.6:
                final_price = final_price * 0.9 + llm_price * 0.1
            
            model_breakdown.append({
                'model': 'Groq LLM Analysis',
                'type': groq_analysis['model_type'],
                'predicted_price': round(llm_price, 2),
                'confidence': llm_confidence,
                'weight': 0.10,
                'market_insight': groq_analysis.get('market_insight', ''),
                'factors': groq_analysis.get('factors', [])
            })
        
        # Add sentiment to breakdown
        model_breakdown.append({
            'model': 'Sentiment Analysis',
            'type': sentiment['model_type'],
            'adjustment_factor': round(sentiment['adjustment_factor'], 3),
            'hype_score': sentiment['hype_score'],
            'sentiment_score': round(sentiment['sentiment_score'], 3),
            'source': sentiment['source'],
            'sample_size': sentiment['sample_size']
        })
        
        # Add trends to breakdown
        model_breakdown.append({
            'model': 'Google Trends',
            'type': trends['model_type'],
            'adjustment_factor': round(trends['adjustment_factor'], 3),
            'current_interest': trends['current_interest'],
            'trend_direction': trends['trend_direction']
        })
        
        # Calculate price range (confidence interval)
        predictions_list = [p for p, w in all_predictions]
        price_std = np.std(predictions_list) if len(predictions_list) > 1 else final_price * 0.1
        
        # Calculate overall confidence based on model agreement
        if len(predictions_list) > 1:
            cv = price_std / np.mean(predictions_list)  # Coefficient of variation
            overall_confidence = max(0.6, min(0.95, 1 - cv))
        else:
            overall_confidence = 0.80
        
        # Price change calculation
        price_change = final_price - retail_price
        price_change_pct = (price_change / retail_price) * 100 if retail_price > 0 else 0
        
        return {
            'best_predicted_price': round(final_price, 2),
            'price_range': {
                'low': round(final_price - price_std, 2),
                'mid': round(final_price, 2),
                'high': round(final_price + price_std, 2)
            },
            'price_change': round(price_change, 2),
            'price_change_percent': round(price_change_pct, 2),
            'overall_confidence': round(overall_confidence, 2),
            'models_used': len(model_breakdown),
            'model_breakdown': model_breakdown,
            'adjustments': {
                'sentiment_factor': round(sentiment['adjustment_factor'], 3),
                'trends_factor': round(trends['adjustment_factor'], 3),
                'combined_adjustment': round(sentiment['adjustment_factor'] * trends['adjustment_factor'], 3)
            }
        }
    
    def get_recommendation(self, price_change_pct: float, confidence: float) -> Dict[str, Any]:
        """Generate buy/sell recommendation based on prediction."""
        
        if price_change_pct > 75:
            action = "STRONG BUY"
            emoji = "🔥"
            description = "Exceptional investment - High resale potential"
            risk_level = "Low"
        elif price_change_pct > 40:
            action = "BUY"
            emoji = "📈"
            description = "Great investment opportunity"
            risk_level = "Low-Medium"
        elif price_change_pct > 15:
            action = "CONSIDER BUYING"
            emoji = "👍"
            description = "Good resale value potential"
            risk_level = "Medium"
        elif price_change_pct > 0:
            action = "HOLD"
            emoji = "📊"
            description = "Modest appreciation expected"
            risk_level = "Medium"
        elif price_change_pct > -15:
            action = "CAUTION"
            emoji = "⚠️"
            description = "May not appreciate significantly"
            risk_level = "Medium-High"
        else:
            action = "AVOID"
            emoji = "❌"
            description = "Expected to depreciate"
            risk_level = "High"
        
        # Adjust recommendation based on confidence
        confidence_note = ""
        if confidence < 0.7:
            confidence_note = "⚠️ Low confidence - limited historical data"
        elif confidence > 0.9:
            confidence_note = "✅ High confidence prediction"
        
        return {
            'action': action,
            'emoji': emoji,
            'description': description,
            'risk_level': risk_level,
            'confidence_note': confidence_note
        }
    
    def predict_best_price(self, data: Dict[str, Any], 
                           include_sentiment: bool = True,
                           include_trends: bool = True,
                           include_groq: bool = True) -> Dict[str, Any]:
        """
        Main prediction method - combines all AI models for best price prediction.
        
        Args:
            data: Input data with sneaker details
            include_sentiment: Whether to include sentiment analysis
            include_trends: Whether to include Google Trends
            include_groq: Whether to include Groq LLM analysis
            
        Returns:
            Complete prediction result with all model contributions
        """
        
        if not self.loaded:
            return {'error': 'Models not loaded. Run train_model.py first.', 'success': False}
        
        try:
            start_time = datetime.now()
            
            # Extract input data
            sneaker_name = data.get('sneaker_name', data.get('name', ''))
            retail_price = float(data.get('retail_price', 220))
            brand = data.get('brand', 'Yeezy')
            
            # Prepare features
            features = self.prepare_features(data)
            
            # Get ML model predictions
            ml_predictions = self.predict_with_ml_models(features)
            
            # Get Prophet time series prediction
            prophet_prediction = self.predict_with_prophet(sneaker_name, retail_price)
            
            # Get sentiment adjustment
            if include_sentiment:
                sentiment = self.get_sentiment_adjustment(sneaker_name)
            else:
                sentiment = {'sentiment_score': 0, 'hype_score': 50, 'adjustment_factor': 1.0, 
                            'sample_size': 0, 'source': 'disabled', 'weight': 0, 'model_type': 'Disabled'}
            
            # Get trends adjustment
            if include_trends:
                trends = self.get_trends_adjustment(sneaker_name)
            else:
                trends = {'current_interest': 50, 'avg_interest': 50, 'trend_direction': 'stable',
                         'adjustment_factor': 1.0, 'weight': 0, 'model_type': 'Disabled'}
            
            # Get Groq LLM analysis
            if include_groq:
                groq_analysis = self.get_groq_analysis(data, ml_predictions)
            else:
                groq_analysis = None
            
            # Calculate ensemble prediction
            ensemble_result = self.calculate_ensemble_prediction(
                ml_predictions=ml_predictions,
                prophet_prediction=prophet_prediction,
                sentiment=sentiment,
                trends=trends,
                groq_analysis=groq_analysis,
                retail_price=retail_price
            )
            
            # Generate recommendation
            recommendation = self.get_recommendation(
                ensemble_result['price_change_percent'],
                ensemble_result['overall_confidence']
            )
            
            # Calculate processing time
            processing_time = (datetime.now() - start_time).total_seconds()
            
            return {
                'success': True,
                'input': {
                    'sneaker_name': sneaker_name,
                    'brand': brand,
                    'retail_price': retail_price,
                    'release_date': data.get('release_date', ''),
                    'shoe_size': data.get('shoe_size', 10),
                    'region': data.get('region', 'California')
                },
                'prediction': ensemble_result,
                'recommendation': recommendation,
                'metadata': {
                    'processing_time_seconds': round(processing_time, 3),
                    'prediction_date': datetime.now().isoformat(),
                    'models_ensemble': [
                        'Random Forest',
                        'Gradient Boosting',
                        'Ridge Regression',
                        'Prophet Time Series',
                        'Sentiment Analysis',
                        'Google Trends',
                        'Groq LLM'
                    ]
                }
            }
            
        except Exception as e:
            traceback.print_exc()
            return {
                'success': False,
                'error': str(e)
            }


# Singleton instance
_predictor_instance = None

def get_predictor() -> EnsemblePricePredictor:
    """Get or create singleton predictor instance."""
    global _predictor_instance
    if _predictor_instance is None:
        _predictor_instance = EnsemblePricePredictor()
    return _predictor_instance


def predict_best_price(data: Dict[str, Any], **kwargs) -> Dict[str, Any]:
    """Convenience function for price prediction."""
    predictor = get_predictor()
    return predictor.predict_best_price(data, **kwargs)


if __name__ == "__main__":
    # Test the ensemble predictor
    print("=" * 60)
    print("ENSEMBLE PRICE PREDICTOR - TEST")
    print("=" * 60)
    
    predictor = EnsemblePricePredictor()
    
    test_data = {
        'sneaker_name': 'Adidas Yeezy Boost 350 V2 Beluga',
        'brand': 'Yeezy',
        'retail_price': 220,
        'release_date': '2023-01-15',
        'shoe_size': 10,
        'region': 'California'
    }
    
    print(f"\nTest Input: {test_data}")
    print("\nRunning ensemble prediction...")
    
    result = predictor.predict_best_price(test_data)
    
    if result['success']:
        print(f"\n✅ Best Predicted Price: ${result['prediction']['best_predicted_price']}")
        print(f"   Price Range: ${result['prediction']['price_range']['low']} - ${result['prediction']['price_range']['high']}")
        print(f"   Change: {result['prediction']['price_change_percent']:.1f}%")
        print(f"   Confidence: {result['prediction']['overall_confidence'] * 100:.0f}%")
        print(f"\n   Recommendation: {result['recommendation']['emoji']} {result['recommendation']['action']}")
        print(f"   {result['recommendation']['description']}")
        
        print(f"\nModels Used ({result['prediction']['models_used']}):")
        for model in result['prediction']['model_breakdown']:
            if 'predicted_price' in model:
                print(f"   - {model['model']}: ${model['predicted_price']}")
            else:
                print(f"   - {model['model']}: adjustment {model.get('adjustment_factor', 'N/A')}")
    else:
        print(f"\n❌ Error: {result.get('error')}")
