"""
Driplytics - Social Media-Based Price Prediction

Predicts sneaker prices based on:
1. Social Media Presence (Reddit sentiment + Google Trends)
2. Time Series Forecasting (Prophet)
3. Linear Regression
4. Real StockX Price Data

Shows price changes with proper UP/DOWN percentage indicators.
"""

import os
import numpy as np
import pandas as pd
import joblib
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import traceback

# Local imports
from time_series import get_sneaker_price_history, simple_forecast

# Model paths
MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')
DATASETS_DIR = os.path.join(os.path.dirname(__file__), 'datasets')


def get_real_price_from_stockx(sneaker_name: str) -> Optional[Dict[str, Any]]:
    """
    Get real price data from StockX dataset.
    Returns average sale price, retail price, and price change.
    """
    try:
        stockx_path = os.path.join(DATASETS_DIR, 'stockx_complete.csv')
        if not os.path.exists(stockx_path):
            return None
        
        df = pd.read_csv(stockx_path)
        
        # Clean price columns
        df['Sale_Price'] = df['Sale Price'].replace(r'[\$,]', '', regex=True).astype(float)
        df['Retail_Price'] = df['Retail Price'].replace(r'[\$,]', '', regex=True).astype(float)
        
        # Search for sneaker (fuzzy match)
        name_lower = sneaker_name.lower().replace('-', ' ').replace('_', ' ')
        matches = df[df['Sneaker Name'].str.lower().str.replace('-', ' ').str.replace('_', ' ').str.contains(name_lower[:20], na=False)]
        
        if matches.empty:
            # Try partial match with key words
            keywords = name_lower.split()[:3]
            for kw in keywords:
                if len(kw) > 3:
                    partial_matches = df[df['Sneaker Name'].str.lower().str.contains(kw, na=False)]
                    if not partial_matches.empty:
                        matches = partial_matches
                        break
        
        if matches.empty:
            return None
        
        # Aggregate stats
        avg_sale_price = float(matches['Sale_Price'].mean())
        min_price = float(matches['Sale_Price'].min())
        max_price = float(matches['Sale_Price'].max())
        retail_price = float(matches['Retail_Price'].iloc[0])
        sale_count = int(len(matches))
        brand = str(matches['Brand'].iloc[0])
        
        # Calculate price change from retail
        price_change = avg_sale_price - retail_price
        price_change_pct = (price_change / retail_price) * 100 if retail_price > 0 else 0
        
        return {
            'found': True,
            'sneaker_name': str(matches['Sneaker Name'].iloc[0]),
            'brand': brand,
            'current_price': round(avg_sale_price, 2),
            'retail_price': round(retail_price, 2),
            'min_price': round(min_price, 2),
            'max_price': round(max_price, 2),
            'sale_count': sale_count,
            'price_change': round(price_change, 2),
            'price_change_pct': round(price_change_pct, 2),
            'is_above_retail': bool(avg_sale_price > retail_price)
        }
        
    except Exception as e:
        print(f"Error getting StockX price: {e}")
        return None


class SocialPricePredictor:
    """
    Price predictor based on social media presence and time series analysis.
    Uses only:
    - Time Series Forecasting (Prophet/Linear)
    - Linear Regression
    - Social Media Data (Reddit + Google Trends)
    """
    
    def __init__(self):
        """Initialize and load models."""
        self.models = {}
        self.encoders = {}
        self.feature_columns = [
            'Brand_Encoded',
            'Region_Encoded',
            'Retail_Price',
            'Shoe Size',
            'Days_Since_Release',
            'Release_Year',
            'Release_Month',
            'Order_Month',
            'Order_DayOfWeek',
        ]
        self.loaded = False
        self.load_models()

    @staticmethod
    def _safe_str(value: Any, default: str) -> str:
        if value is None:
            return default
        value_str = str(value).strip()
        return value_str if value_str else default

    @staticmethod
    def _safe_float(value: Any, default: float) -> float:
        try:
            if value is None:
                return float(default)
            return float(value)
        except (TypeError, ValueError):
            return float(default)
        
    def load_models(self):
        """
        Load ML models as specified in the proposal:
        - Linear Regression
        - Random Forest
        - Prophet (Time Series) - loaded separately
        """
        try:
            # Load Linear Regression model (from proposal)
            lr_path = os.path.join(MODELS_DIR, 'linear_regression_model.pkl')
            if os.path.exists(lr_path):
                self.models['linear_regression'] = joblib.load(lr_path)
                print("  ✓ Linear Regression model loaded")
            
            # Load Random Forest model (from proposal)
            rf_path = os.path.join(MODELS_DIR, 'random_forest_model.pkl')
            if os.path.exists(rf_path):
                self.models['random_forest'] = joblib.load(rf_path)
                print("  ✓ Random Forest model loaded")
            
            # Load encoders
            self.encoders['brand'] = joblib.load(os.path.join(MODELS_DIR, 'brand_encoder.pkl'))
            self.encoders['region'] = joblib.load(os.path.join(MODELS_DIR, 'region_encoder.pkl'))
            self.scaler = joblib.load(os.path.join(MODELS_DIR, 'scaler.pkl'))
            feature_columns_path = os.path.join(MODELS_DIR, 'feature_columns.pkl')
            if os.path.exists(feature_columns_path):
                self.feature_columns = joblib.load(feature_columns_path)
            
            # Load metadata
            self.metadata = joblib.load(os.path.join(MODELS_DIR, 'training_metadata.pkl'))
            
            self.loaded = True
            print("✅ Social Price Predictor: Models loaded (Linear Regression, Random Forest, Prophet)")
            
        except Exception as e:
            print(f"❌ Error loading models: {e}")
            self.loaded = False
    
    def encode_brand(self, brand: str) -> int:
        """Encode brand to numeric value."""
        try:
            return self.encoders['brand'].transform([brand])[0]
        except:
            return 1  # Default to Yeezy
    
    def encode_region(self, region: str) -> int:
        """Encode region to numeric value."""
        try:
            return self.encoders['region'].transform([region])[0]
        except:
            return len(self.encoders['region'].classes_) // 2
    
    def prepare_features(self, data: Dict[str, Any]) -> pd.DataFrame:
        """Prepare feature vector for Linear Regression."""
        brand = self._safe_str(data.get('brand'), 'Yeezy')
        retail_price = self._safe_float(data.get('retail_price'), 220)
        release_date = self._safe_str(data.get('release_date'), datetime.now().strftime('%Y-%m-%d'))
        shoe_size = self._safe_float(data.get('shoe_size'), 10)
        region = self._safe_str(data.get('region'), 'California')
        
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
        
        # Create feature vector with training column names
        features = pd.DataFrame([{
            'Brand_Encoded': self.encode_brand(brand),
            'Region_Encoded': self.encode_region(region),
            'Retail_Price': retail_price,
            'Shoe Size': shoe_size,
            'Days_Since_Release': days_since_release,
            'Release_Year': release_dt.year,
            'Release_Month': release_dt.month,
            'Order_Month': order_date.month,
            'Order_DayOfWeek': order_date.weekday()
        }])

        features = features.reindex(columns=self.feature_columns, fill_value=0)
        
        return features
    
    def get_random_forest_prediction(self, features: pd.DataFrame, current_price: float) -> Dict[str, Any]:
        """Get prediction from Random Forest model (from proposal)."""
        try:
            if 'random_forest' not in self.models:
                return None
            
            # Random Forest doesn't need scaled features (tree-based model)
            prediction = self.models['random_forest'].predict(features)[0]
            
            # Ensure reasonable prediction (cap at 2x current price for sanity)
            if prediction <= 0:
                prediction = current_price * 1.10
            elif prediction > current_price * 2:
                # Scale down unrealistic predictions
                prediction = current_price * (1 + min((prediction / current_price - 1) * 0.3, 0.5))
            
            return {
                'predicted_price': float(prediction),
                'model': 'Random Forest',
                'confidence': 0.80
            }
            
        except Exception as e:
            print(f"Random Forest error: {e}")
            return None
    
    def get_linear_regression_prediction(self, features: pd.DataFrame, current_price: float) -> Dict[str, Any]:
        """Get prediction from Linear Regression model (from proposal)."""
        try:
            # Use linear regression with raw features (consistent with training)
            if 'linear_regression' in self.models:
                scaled_features = self.scaler.transform(features)
                prediction = self.models['linear_regression'].predict(scaled_features)[0]
                model_name = 'Linear Regression'
            else:
                # Fallback to simple estimate
                prediction = current_price * 1.10
                model_name = 'Estimated'
            
            # Ensure reasonable prediction
            if prediction <= 0 or prediction > current_price * 5:
                prediction = current_price * 1.10
            
            return {
                'predicted_price': float(prediction),
                'model': model_name,
                'confidence': 0.75
            }
            
        except Exception as e:
            print(f"Linear regression error: {e}")
            return {
                'predicted_price': current_price * 1.10,
                'model': 'Fallback',
                'confidence': 0.5
            }
    
    def get_time_series_forecast(self, sneaker_name: str, retail_price: float) -> Dict[str, Any]:
        """Get Prophet/Time Series forecast."""
        try:
            if not sneaker_name:
                return None
            
            # Get historical data and forecast from StockX
            result = get_sneaker_price_history(sneaker_name=sneaker_name)
            
            if result.get('success') and result.get('forecast'):
                forecast = result['forecast']
                history = result.get('history', {})
                stats = result.get('statistics', {})
                
                return {
                    'predicted_price_7d': forecast[6]['predicted_price'] if len(forecast) > 6 else None,
                    'predicted_price_14d': forecast[13]['predicted_price'] if len(forecast) > 13 else None,
                    'predicted_price_30d': forecast[-1]['predicted_price'] if forecast else None,
                    'lower_bound': forecast[-1]['lower_bound'] if forecast else None,
                    'upper_bound': forecast[-1]['upper_bound'] if forecast else None,
                    'model': result.get('forecast_model', 'Time Series'),
                    'historical_data_points': history.get('data_points', 0),
                    'current_price': stats.get('current_price', retail_price),
                    'price_trend': stats.get('price_trend', 'stable'),
                    'total_sales': stats.get('total_sales', 0),
                    'confidence': 0.85 if history.get('data_points', 0) > 30 else 0.70
                }
            
            return None
            
        except Exception as e:
            print(f"Time series error: {e}")
            return None
    
    def get_social_media_data(self, sneaker_name: str) -> Dict[str, Any]:
        """Get social media presence data from Reddit and Google Trends."""
        social_data = {
            'reddit': None,
            'google_trends': None,
            'combined_score': 50,
            'price_adjustment': 1.0
        }
        
        # Get Reddit sentiment - REAL DATA from Reddit API
        try:
            from live_data_collector import RedditScraper, LiveSentimentAnalyzer
            
            scraper = RedditScraper()
            posts = scraper.search_sneaker(sneaker_name, limit=50)
            
            if posts:
                analyzer = LiveSentimentAnalyzer()
                sentiment = analyzer.analyze_reddit_posts(posts)
                
                avg_sentiment = sentiment.get('avg_sentiment', 0)
                hype_score = min(100, max(0, 50 + (avg_sentiment * 50)))
                
                # Calculate total engagement (upvotes + comments)
                total_upvotes = sum(p.get('score', 0) for p in posts)
                total_comments = sum(p.get('num_comments', 0) for p in posts)
                
                # Get top posts for display
                top_posts = sorted(posts, key=lambda x: x.get('score', 0), reverse=True)[:5]
                
                social_data['reddit'] = {
                    'posts_found': len(posts),
                    'total_upvotes': total_upvotes,
                    'total_comments': total_comments,
                    'avg_sentiment': round(avg_sentiment, 3),
                    'hype_score': round(hype_score, 1),
                    'sentiment_distribution': sentiment.get('sentiment_distribution', {}),
                    'sentiment_breakdown': sentiment.get('breakdown', {}),
                    'sentiment_label': 'Positive' if avg_sentiment > 0.1 else ('Negative' if avg_sentiment < -0.1 else 'Neutral'),
                    'subreddits_searched': ['r/sneakers', 'r/Sneakerheads', 'r/SneakerDeals', 'r/streetwear'],
                    'top_posts': [
                        {
                            'title': p.get('title', '')[:100],
                            'score': p.get('score', 0),
                            'comments': p.get('num_comments', 0),
                            'subreddit': p.get('subreddit', ''),
                            'url': p.get('url', '')
                        }
                        for p in top_posts
                    ]
                }
            else:
                social_data['reddit'] = {
                    'posts_found': 0,
                    'total_upvotes': 0,
                    'total_comments': 0,
                    'avg_sentiment': 0,
                    'hype_score': 50,
                    'sentiment_label': 'No Data',
                    'message': 'No Reddit posts found for this sneaker'
                }
                
        except Exception as e:
            print(f"Reddit error: {e}")
            social_data['reddit'] = {
                'posts_found': 0,
                'error': str(e),
                'sentiment_label': 'Error'
            }
        
        # Get Google Trends
        try:
            from live_data_collector import LiveGoogleTrends
            
            trends = LiveGoogleTrends()
            interest = trends.get_live_interest(sneaker_name, timeframe='now 7-d')
            
            if interest:
                current_interest = interest.get('current_interest', 50)
                avg_interest = interest.get('avg_interest', 50)
                trend_direction = interest.get('trend_direction', 'stable')
                
                social_data['google_trends'] = {
                    'current_interest': current_interest,
                    'avg_interest': avg_interest,
                    'trend_direction': trend_direction,
                    'peak_interest': interest.get('peak_interest', current_interest)
                }
                
        except Exception as e:
            print(f"Google Trends error: {e}")
        
        # Calculate combined social score and price adjustment
        scores = []
        adjustments = []
        
        if social_data['reddit']:
            reddit_score = social_data['reddit']['hype_score']
            scores.append(reddit_score)
            
            # Sentiment-based adjustment (±15% max)
            sentiment = social_data['reddit']['avg_sentiment']
            reddit_adjustment = 1.0 + (sentiment * 0.15)
            adjustments.append(reddit_adjustment)
        
        if social_data['google_trends']:
            trends = social_data['google_trends']
            trend_score = trends['current_interest']
            scores.append(trend_score)
            
            # Trend-based adjustment (±10% max)
            if trends['trend_direction'] == 'rising':
                trend_adjustment = 1.0 + ((trend_score - 50) / 500)
            elif trends['trend_direction'] == 'falling':
                trend_adjustment = 1.0 - ((50 - trend_score) / 500)
            else:
                trend_adjustment = 1.0
            
            trend_adjustment = max(0.9, min(1.1, trend_adjustment))
            adjustments.append(trend_adjustment)
        
        if scores:
            social_data['combined_score'] = round(np.mean(scores), 1)
        
        if adjustments:
            social_data['price_adjustment'] = round(np.mean(adjustments), 4)
        
        return social_data
    
    def calculate_final_prediction(self, 
                                    random_forest_pred: Optional[Dict],
                                    linear_pred: Dict,
                                    time_series: Optional[Dict],
                                    social_data: Dict,
                                    current_price: float) -> Dict[str, Any]:
        """
        Calculate final price prediction using algorithms from proposal:
        - Random Forest (40% weight)
        - Linear Regression (30% weight)  
        - Prophet/Time Series (30% weight)
        
        Social media data adjusts the final prediction.
        """
        
        predictions = []
        weights = []
        models_used = []
        
        # Random Forest prediction (from proposal) - highest weight
        if random_forest_pred and random_forest_pred.get('predicted_price'):
            rf_price = random_forest_pred['predicted_price']
            rf_confidence = random_forest_pred.get('confidence', 0.80)
            predictions.append(rf_price)
            weights.append(0.40 * rf_confidence)
            models_used.append('Random Forest')
        
        # Linear Regression prediction (from proposal)
        lr_price = linear_pred['predicted_price']
        lr_confidence = linear_pred.get('confidence', 0.75)
        predictions.append(lr_price)
        weights.append(0.30 * lr_confidence)
        models_used.append('Linear Regression')
        
        # Prophet/Time Series prediction (from proposal)
        if time_series and time_series.get('predicted_price_30d'):
            ts_price = time_series['predicted_price_30d']
            ts_confidence = time_series.get('confidence', 0.8)
            predictions.append(ts_price)
            weights.append(0.30 * ts_confidence)
            models_used.append('Prophet (Time Series)')
        
        # If no Random Forest or Time Series, give more weight to linear regression
        if len(predictions) == 1:
            weights[0] = 1.0
        
        # Calculate weighted average
        if sum(weights) > 0:
            base_prediction = sum(p * w for p, w in zip(predictions, weights)) / sum(weights)
        else:
            base_prediction = lr_price
        
        # Apply social media adjustment
        social_adjustment = social_data.get('price_adjustment', 1.0)
        final_prediction = base_prediction * social_adjustment
        
        # Calculate price change from current market price
        price_change = final_prediction - current_price
        price_change_percent = (price_change / current_price) * 100 if current_price > 0 else 0
        
        # Calculate confidence based on models and data
        data_points = time_series.get('historical_data_points', 0) if time_series else 0
        reddit_posts = social_data.get('reddit', {}).get('posts_found', 0) if social_data.get('reddit') else 0
        
        confidence = 0.70
        if random_forest_pred:
            confidence += 0.05
        if data_points > 50:
            confidence += 0.10
        if reddit_posts > 10:
            confidence += 0.10
        if social_data.get('google_trends'):
            confidence += 0.05
        
        confidence = min(0.95, confidence)
        
        # Calculate price range
        std_dev = abs(final_prediction - base_prediction) + (final_prediction * 0.05)
        
        return {
            'predicted_price': round(float(final_prediction), 2),
            'price_change': round(float(price_change), 2),
            'price_change_percent': round(float(price_change_percent), 2),
            'is_increase': bool(price_change >= 0),
            'price_range': {
                'low': round(float(final_prediction - std_dev), 2),
                'mid': round(float(final_prediction), 2),
                'high': round(float(final_prediction + std_dev), 2)
            },
            'confidence': round(float(confidence), 2),
            'social_adjustment': round(float((social_adjustment - 1) * 100), 2),
            'models_used': models_used
        }
    
    def get_recommendation(self, price_change_percent: float, is_increase: bool, confidence: float) -> Dict[str, Any]:
        """Generate buy/sell recommendation with proper UP/DOWN indicators."""
        
        if price_change_percent > 50:
            action = "STRONG BUY"
            emoji = "🔥"
            description = "High resale potential - Strong demand"
        elif price_change_percent > 25:
            action = "BUY"
            emoji = "📈"
            description = "Good investment opportunity"
        elif price_change_percent > 10:
            action = "CONSIDER"
            emoji = "👍"
            description = "Moderate resale value expected"
        elif price_change_percent > 0:
            action = "HOLD"
            emoji = "📊"
            description = "Slight appreciation expected"
        elif price_change_percent > -10:
            action = "CAUTION"
            emoji = "⚠️"
            description = "May not hold value"
        else:
            action = "AVOID"
            emoji = "❌"
            description = "Expected to lose value"
        
        return {
            'action': action,
            'emoji': emoji,
            'description': description,
            'trend_indicator': '↑' if is_increase else '↓',
            'trend_label': 'UP' if is_increase else 'DOWN',
            'trend_color': 'green' if is_increase else 'red'
        }
    
    def predict(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Main prediction method.
        
        Uses:
        1. Real StockX Price Data (current market price)
        2. Social Media Presence (Reddit + Google Trends)
        3. Time Series Forecasting (Prophet)
        4. Linear Regression
        
        Returns prediction with proper UP/DOWN percentage display.
        """
        
        if not self.loaded:
            return {'success': False, 'error': 'Models not loaded'}
        
        try:
            start_time = datetime.now()
            
            # Extract input
            sneaker_name = data.get('sneaker_name', data.get('name', ''))
            retail_price = float(data.get('retail_price', 220))
            brand = data.get('brand', 'Unknown')
            
            # Get REAL current price from StockX data
            stockx_data = get_real_price_from_stockx(sneaker_name)
            
            # Use real current price if available, otherwise use retail as base
            if stockx_data and stockx_data.get('current_price'):
                current_market_price = stockx_data['current_price']
                real_retail_price = stockx_data['retail_price']
                brand = stockx_data.get('brand', brand)
                has_real_data = True
            else:
                current_market_price = retail_price
                real_retail_price = retail_price
                has_real_data = False
            
            # Prepare features
            features = self.prepare_features(data)
            
            # Get Random Forest prediction (from proposal)
            random_forest_pred = self.get_random_forest_prediction(features, current_market_price)
            
            # Get Linear Regression prediction (from proposal)
            linear_pred = self.get_linear_regression_prediction(features, current_market_price)
            
            # Get Prophet/Time Series forecast (from proposal)
            time_series = self.get_time_series_forecast(sneaker_name, current_market_price)
            
            # Get Social Media data (Reddit + Google Trends)
            social_data = self.get_social_media_data(sneaker_name)
            
            # Calculate final FUTURE prediction using all models from proposal
            prediction = self.calculate_final_prediction(
                random_forest_pred, linear_pred, time_series, social_data, current_market_price
            )
            
            # Add real market data to prediction
            prediction['current_market_price'] = current_market_price
            prediction['retail_price'] = real_retail_price
            prediction['has_real_data'] = has_real_data
            if stockx_data:
                prediction['stockx_data'] = stockx_data
            
            # Get recommendation
            recommendation = self.get_recommendation(
                prediction['price_change_percent'],
                prediction['is_increase'],
                prediction['confidence']
            )
            
            # Build response - SIMPLIFIED for user-friendly display
            processing_time = (datetime.now() - start_time).total_seconds()
            
            # Create user-friendly factors list
            factors_considered = []
            if has_real_data:
                factors_considered.append("Historical sales data from StockX")
            if social_data.get('reddit') and social_data['reddit'].get('posts_found', 0) > 0:
                factors_considered.append(f"Social media buzz ({social_data['reddit']['posts_found']} Reddit discussions)")
            if social_data.get('google_trends'):
                trend_dir = social_data['google_trends'].get('trend_direction', 'stable')
                factors_considered.append(f"Market interest trends ({trend_dir})")
            if time_series and time_series.get('historical_data_points', 0) > 0:
                factors_considered.append(f"Price patterns ({time_series['historical_data_points']} data points)")
            factors_considered.append("Seasonal demand patterns")
            factors_considered.append("Brand value analysis")
            
            return {
                'success': True,
                'input': {
                    'sneaker_name': sneaker_name,
                    'brand': brand,
                    'retail_price': real_retail_price,
                    'current_market_price': current_market_price,
                    'has_real_data': has_real_data,
                    'release_date': data.get('release_date', ''),
                    'shoe_size': data.get('shoe_size', 10),
                    'region': data.get('region', 'California')
                },
                'prediction': {
                    'predicted_price': prediction['predicted_price'],
                    'current_price': current_market_price,
                    'retail_price': real_retail_price,
                    'price_change': prediction['price_change'],
                    'price_change_percent': prediction['price_change_percent'],
                    'is_increase': prediction['is_increase'],
                    'trend_indicator': recommendation['trend_indicator'],
                    'trend_label': recommendation['trend_label'],
                    'trend_color': recommendation['trend_color'],
                    'price_range': prediction['price_range'],
                    'confidence': prediction['confidence'],
                    'social_impact': f"{'+' if prediction['social_adjustment'] >= 0 else ''}{prediction['social_adjustment']}%",
                    'stockx_data': stockx_data if stockx_data else None,
                    # User-friendly factors instead of algorithm names
                    'factors_considered': factors_considered,
                    # Simplified forecast
                    'forecast': {
                        '7_days': time_series.get('predicted_price_7d') if time_series else None,
                        '14_days': time_series.get('predicted_price_14d') if time_series else None,
                        '30_days': time_series.get('predicted_price_30d') if time_series else None,
                        'price_range_low': time_series.get('lower_bound') if time_series else prediction['price_range']['low'],
                        'price_range_high': time_series.get('upper_bound') if time_series else prediction['price_range']['high']
                    }
                },
                # Keep models for internal use but simplified
                'models': {
                    'time_series': {
                        'price_7d': time_series.get('predicted_price_7d') if time_series else None,
                        'price_14d': time_series.get('predicted_price_14d') if time_series else None,
                        'price_30d': time_series.get('predicted_price_30d') if time_series else None,
                        'lower_bound': time_series.get('lower_bound') if time_series else None,
                        'upper_bound': time_series.get('upper_bound') if time_series else None,
                        'historical_data_points': time_series.get('historical_data_points', 0) if time_series else 0,
                        'confidence': time_series.get('confidence', 0) if time_series else 0
                    },
                    'linear_regression': {
                        'predicted_price': round(linear_pred['predicted_price'], 2),
                        'confidence': linear_pred['confidence']
                    }
                },
                'social_media': {
                    'combined_score': social_data['combined_score'],
                    'price_adjustment_percent': prediction['social_adjustment'],
                    'reddit': social_data.get('reddit'),
                    'google_trends': social_data.get('google_trends')
                },
                'recommendation': recommendation,
                'metadata': {
                    'processing_time': round(processing_time, 3),
                    'prediction_date': datetime.now().isoformat(),
                    'data_source': 'StockX + Social Media + Market Trends' if has_real_data else 'AI Analysis'
                }
            }
            
        except Exception as e:
            traceback.print_exc()
            return {
                'success': False,
                'error': str(e)
            }


# Singleton instance
_predictor = None

def get_social_predictor() -> SocialPricePredictor:
    """Get or create singleton predictor instance."""
    global _predictor
    if _predictor is None:
        _predictor = SocialPricePredictor()
    return _predictor


def predict_social_price(data: Dict[str, Any]) -> Dict[str, Any]:
    """Convenience function for price prediction."""
    predictor = get_social_predictor()
    return predictor.predict(data)


if __name__ == "__main__":
    print("=" * 60)
    print("SOCIAL MEDIA PRICE PREDICTOR - TEST")
    print("=" * 60)
    
    predictor = SocialPricePredictor()
    
    test_data = {
        'sneaker_name': 'Adidas Yeezy Boost 350 V2',
        'brand': 'Yeezy',
        'retail_price': 220,
        'release_date': '2023-01-15',
        'shoe_size': 10,
        'region': 'California'
    }
    
    print(f"\nTest Input: {test_data}")
    print("\nRunning social media-based prediction...")
    
    result = predictor.predict(test_data)
    
    if result['success']:
        pred = result['prediction']
        rec = result['recommendation']
        
        print(f"\n✅ Predicted Price: ${pred['predicted_price']}")
        print(f"   Change: {pred['trend_indicator']} {abs(pred['price_change_percent'])}% ({pred['trend_label']})")
        print(f"   Price Range: ${pred['price_range']['low']} - ${pred['price_range']['high']}")
        print(f"   Confidence: {pred['confidence'] * 100:.0f}%")
        print(f"   Social Impact: {pred['social_impact']}")
        print(f"\n   Recommendation: {rec['emoji']} {rec['action']}")
        print(f"   {rec['description']}")
        
        print(f"\nModels Used:")
        print(f"   - Time Series: {result['models']['time_series']['model']}")
        print(f"   - Linear: {result['models']['linear_regression']['model']}")
        
        if result['social_media']['reddit']:
            r = result['social_media']['reddit']
            print(f"\n   Reddit: {r['posts_found']} posts, {r['sentiment_label']} sentiment, Hype: {r['hype_score']}")
        
        if result['social_media']['google_trends']:
            t = result['social_media']['google_trends']
            print(f"   Google Trends: Interest {t['current_interest']}, {t['trend_direction']}")
    else:
        print(f"\n❌ Error: {result.get('error')}")

