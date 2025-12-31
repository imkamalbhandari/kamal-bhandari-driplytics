"""
Driplytics - Sneaker Price Prediction API
Flask-based API for serving ML predictions as mentioned in the proposal.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
import joblib
import os
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from sentiment_analysis import calculate_hype_score, analyze_sentiment, clean_text
from data_collector import GoogleTrendsCollector, StockXDataCollector
from live_data_collector import LiveDataCollector, LiveGoogleTrends, RedditScraper, LiveSentimentAnalyzer
from social_price_predictor import predict_social_price, get_social_predictor
from price_analytics import get_detailed_price_analytics

app = Flask(__name__)
CORS(app)

# Load models and encoders
MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')

def load_models():
    """Load trained models and encoders."""
    models = {}
    try:
        models['rf_model'] = joblib.load(os.path.join(MODELS_DIR, 'random_forest_model.pkl'))
        models['gb_model'] = joblib.load(os.path.join(MODELS_DIR, 'gradient_boosting_model.pkl'))
        models['lr_model'] = joblib.load(os.path.join(MODELS_DIR, 'linear_regression_model.pkl'))
        models['scaler'] = joblib.load(os.path.join(MODELS_DIR, 'scaler.pkl'))
        models['brand_encoder'] = joblib.load(os.path.join(MODELS_DIR, 'brand_encoder.pkl'))
        models['region_encoder'] = joblib.load(os.path.join(MODELS_DIR, 'region_encoder.pkl'))
        models['feature_columns'] = joblib.load(os.path.join(MODELS_DIR, 'feature_columns.pkl'))
        models['metadata'] = joblib.load(os.path.join(MODELS_DIR, 'training_metadata.pkl'))
        print("Models loaded successfully!")
        print(f"Best model: {models['metadata'].get('best_model', 'random_forest')}")
    except Exception as e:
        print(f"Error loading models: {e}")
        print("Please run train_model.py first to train the models.")
    return models

# Load models at startup
models = load_models()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'models_loaded': len(models) > 0,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/predict', methods=['POST'])
def predict():
    """
    Predict sneaker resale price using trained ML models.
    
    Request body:
    {
        "brand": "Yeezy",
        "retail_price": 220,
        "release_date": "2023-05-15",
        "shoe_size": 10,
        "region": "California",
        "sneaker_name": "Adidas Yeezy Boost 350"
    }
    
    Returns predicted sale price based on the StockX dataset model.
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Extract features
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
        
        # Calculate date features
        order_date = datetime.now()
        days_since_release = (order_date - release_dt).days
        if days_since_release < 0:
            days_since_release = 0
        
        release_year = release_dt.year
        release_month = release_dt.month
        order_month = order_date.month
        order_day_of_week = order_date.weekday()
        
        # Encode brand
        try:
            brand_encoded = models['brand_encoder'].transform([brand])[0]
        except:
            # Unknown brand - use Yeezy (index 1) as default
            brand_encoded = 1
        
        # Encode region
        try:
            region_encoded = models['region_encoder'].transform([region])[0]
        except:
            # Unknown region - use median
            region_encoded = len(models['region_encoder'].classes_) // 2
        
        # Prepare feature vector matching training features:
        # ['Brand_Encoded', 'Region_Encoded', 'Retail_Price', 'Shoe Size', 
        #  'Days_Since_Release', 'Release_Year', 'Release_Month', 'Order_Month', 'Order_DayOfWeek']
        features = np.array([[
            brand_encoded,
            region_encoded,
            retail_price,
            shoe_size,
            days_since_release,
            release_year,
            release_month,
            order_month,
            order_day_of_week
        ]])
        
        # Make predictions with Random Forest (best model)
        rf_prediction = models['rf_model'].predict(features)[0]
        
        # Make predictions with Gradient Boosting
        gb_prediction = models['gb_model'].predict(features)[0]
        
        # Use only tree-based models for ensemble (linear models didn't perform well)
        # Weight RF more heavily since it has higher R² score
        ensemble_prediction = (rf_prediction * 0.6 + gb_prediction * 0.4)
        
        # Get Prophet time-series forecast
        prophet_forecast = None
        sneaker_name = data.get('sneaker_name', data.get('name', ''))
        if sneaker_name:
            try:
                from time_series import get_sneaker_price_history
                history_result = get_sneaker_price_history(sneaker_name=sneaker_name)
                if history_result.get('success') and history_result.get('forecast'):
                    forecast_data = history_result['forecast']
                    if forecast_data:
                        # Get the last forecast (30 days out)
                        last_forecast = forecast_data[-1] if forecast_data else None
                        prophet_prediction = last_forecast['predicted_price'] if last_forecast else None
                        
                        prophet_forecast = {
                            'predicted_price_7d': forecast_data[6]['predicted_price'] if len(forecast_data) > 6 else None,
                            'predicted_price_14d': forecast_data[13]['predicted_price'] if len(forecast_data) > 13 else None,
                            'predicted_price_30d': forecast_data[-1]['predicted_price'] if forecast_data else None,
                            'lower_bound_30d': forecast_data[-1]['lower_bound'] if forecast_data else None,
                            'upper_bound_30d': forecast_data[-1]['upper_bound'] if forecast_data else None,
                            'model': history_result.get('forecast_model', 'Linear Trend'),
                            'historical_data_points': history_result.get('history', {}).get('data_points', 0)
                        }
                        
                        # Use Prophet prediction if available and adjust ensemble
                        if prophet_prediction and prophet_prediction > 0:
                            # Blend Prophet with ML models (Prophet gets 30% weight for time-series insight)
                            ensemble_prediction = (rf_prediction * 0.4 + gb_prediction * 0.3 + prophet_prediction * 0.3)
            except Exception as e:
                print(f"Prophet forecast error: {e}")
                prophet_forecast = None
        
        # Calculate price premium
        price_premium = ensemble_prediction - retail_price
        price_premium_pct = ((ensemble_prediction - retail_price) / retail_price) * 100
        
        # Calculate confidence based on model agreement
        predictions = [rf_prediction, gb_prediction]
        if prophet_forecast and prophet_forecast.get('predicted_price_30d'):
            predictions.append(prophet_forecast['predicted_price_30d'])
        pred_std = np.std(predictions)
        pred_mean = np.mean(predictions)
        confidence = max(0.7, min(0.95, 1 - (pred_std / pred_mean) if pred_mean > 0 else 0.85))
        
        # Generate recommendation
        if price_premium_pct > 50:
            recommendation = "Strong Buy 🔥 - High resale potential"
        elif price_premium_pct > 20:
            recommendation = "Buy 📈 - Good investment opportunity"
        elif price_premium_pct > 0:
            recommendation = "Hold 📊 - Moderate resale value"
        elif price_premium_pct > -10:
            recommendation = "Sell ⚠️ - Consider selling at retail"
        else:
            recommendation = "Avoid ❌ - Below retail value expected"
        
        response_data = {
            'success': True,
            'input': {
                'brand': brand,
                'retail_price': retail_price,
                'release_date': release_date,
                'shoe_size': shoe_size,
                'region': region,
                'days_since_release': days_since_release,
                'sneaker_name': sneaker_name
            },
            'predictions': {
                'random_forest': {
                    'predicted_price': round(rf_prediction, 2),
                    'change_percent': round(((rf_prediction - retail_price) / retail_price) * 100, 2)
                },
                'gradient_boosting': {
                    'predicted_price': round(gb_prediction, 2),
                    'change_percent': round(((gb_prediction - retail_price) / retail_price) * 100, 2)
                },
                'ensemble': {
                    'predicted_price': round(ensemble_prediction, 2),
                    'change_percent': round(price_premium_pct, 2)
                }
            },
            'price_premium': round(price_premium, 2),
            'confidence_score': round(confidence, 2),
            'recommendation': recommendation,
            'model_info': {
                'best_model': models.get('metadata', {}).get('best_model', 'random_forest'),
                'r2_score': models.get('metadata', {}).get('results', {}).get('random_forest', {}).get('r2', 0.93)
            }
        }
        
        # Add Prophet forecast if available
        if prophet_forecast:
            response_data['predictions']['prophet'] = prophet_forecast
            response_data['model_info']['includes_time_series'] = True
        
        return jsonify(response_data)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

def get_recommendation(change_percent):
    """Generate buy/sell recommendation based on predicted change."""
    if change_percent > 0.1:
        return "Strong Buy - Expected significant price increase"
    elif change_percent > 0.05:
        return "Buy - Expected moderate price increase"
    elif change_percent > -0.05:
        return "Hold - Price expected to remain stable"
    elif change_percent > -0.1:
        return "Sell - Expected moderate price decrease"
    else:
        return "Strong Sell - Expected significant price decrease"

@app.route('/brands', methods=['GET'])
def get_brands():
    """Get list of supported brands."""
    try:
        brands = models['brand_encoder'].classes_.tolist()
        return jsonify({
            'success': True,
            'brands': brands,
            'count': len(brands)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/model-info', methods=['GET'])
def model_info():
    """Get information about the trained models."""
    return jsonify({
        'models': ['Random Forest', 'Linear Regression'],
        'features': models.get('feature_columns', []),
        'description': 'Sneaker resale price prediction models trained on StockX data',
        'version': '1.0.0'
    })

@app.route('/hype-score', methods=['POST'])
def get_hype_score():
    """
    Get hype/sentiment score for a sneaker.
    
    Request body:
    {
        "shoe_name": "Nike Air Jordan 1"
    }
    """
    try:
        data = request.get_json()
        shoe_name = data.get('shoe_name', '')
        
        if not shoe_name:
            return jsonify({'error': 'shoe_name is required'}), 400
        
        # Load comments data
        comments_path = os.path.join(MODELS_DIR, 'comments_data.pkl')
        if os.path.exists(comments_path):
            comments_df = joblib.load(comments_path)
            result = calculate_hype_score(comments_df, shoe_name)
        else:
            # Return default if no comments data
            result = {
                'shoe_name': shoe_name,
                'hype_score': 50,
                'sentiment_score': 0,
                'comment_count': 0,
                'engagement_level': 'unknown'
            }
        
        return jsonify({
            'success': True,
            **result
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/hype-scores', methods=['GET'])
def get_all_hype_scores():
    """Get hype scores for all sneakers calculated from StockX sales data."""
    try:
        from data_collector import StockXDataCollector
        
        collector = StockXDataCollector()
        hype_scores = collector.get_hype_scores()
        
        if hype_scores:
            return jsonify({
                'success': True,
                'data': hype_scores,
                'count': len(hype_scores),
                'source': 'stockx_sales_data'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'No hype scores available',
                'data': []
            }), 404
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/analyze-comment', methods=['POST'])
def analyze_comment():
    """
    Analyze sentiment of a single comment.
    
    Request body:
    {
        "comment": "These shoes are fire! Must cop!"
    }
    """
    try:
        data = request.get_json()
        comment = data.get('comment', '')
        
        if not comment:
            return jsonify({'error': 'comment is required'}), 400
        
        cleaned = clean_text(comment)
        sentiment, hype_mult = analyze_sentiment(cleaned)
        
        return jsonify({
            'success': True,
            'original_comment': comment,
            'cleaned_comment': cleaned,
            'sentiment_score': round(sentiment, 3),
            'hype_multiplier': round(hype_mult, 2),
            'sentiment_label': 'positive' if sentiment > 0.1 else ('negative' if sentiment < -0.1 else 'neutral')
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/google-trends', methods=['POST'])
def get_google_trends():
    """
    Get Google Trends data for sneakers.
    
    Request body:
    {
        "keywords": ["Air Jordan 1", "Yeezy Boost 350"],
        "timeframe": "today 3-m"
    }
    """
    try:
        data = request.get_json()
        keywords = data.get('keywords', [])
        timeframe = data.get('timeframe', 'today 3-m')
        
        if not keywords:
            return jsonify({'error': 'keywords list is required'}), 400
        
        if len(keywords) > 5:
            return jsonify({'error': 'Maximum 5 keywords allowed per request'}), 400
        
        collector = GoogleTrendsCollector()
        trends_df = collector.get_sneaker_trends(keywords, timeframe)
        
        return jsonify({
            'success': True,
            'timeframe': timeframe,
            'data': trends_df.to_dict('records')
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/google-trends/cached', methods=['GET'])
def get_cached_trends():
    """Get cached Google Trends data."""
    try:
        trends_path = os.path.join(MODELS_DIR, 'google_trends_data.csv')
        if os.path.exists(trends_path):
            df = pd.read_csv(trends_path)
            return jsonify({
                'success': True,
                'data': df.to_dict('records'),
                'count': len(df)
            })
        else:
            return jsonify({'error': 'No cached trends data. Run data_collector.py first.'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/sneakers/search', methods=['GET'])
def search_sneakers():
    """
    Search sneakers from StockX dataset.
    
    Query params:
    - name: Search by sneaker name (partial match)
    - brand: Filter by brand (Yeezy, Off-White)
    - limit: Max results (default 50)
    """
    try:
        from image_service import get_sneaker_image_url
        
        name = request.args.get('name', '')
        brand = request.args.get('brand', '')
        limit = int(request.args.get('limit', 50))
        
        # Load the StockX dataset
        data_path = os.path.join(os.path.dirname(__file__), 'datasets', 'stockx_complete.csv')
        df = pd.read_csv(data_path)
        
        # Clean price columns
        df['Sale_Price'] = df['Sale Price'].replace(r'[\$,]', '', regex=True).astype(float)
        df['Retail_Price'] = df['Retail Price'].replace(r'[\$,]', '', regex=True).astype(float)
        df['Brand'] = df['Brand'].str.strip()
        
        # Apply filters
        if name:
            df = df[df['Sneaker Name'].str.lower().str.contains(name.lower(), na=False)]
        
        if brand and brand.lower() != 'all':
            df = df[df['Brand'].str.lower().str.contains(brand.lower(), na=False)]
        
        # Get unique sneakers with aggregated stats
        sneaker_stats = df.groupby('Sneaker Name').agg({
            'Brand': 'first',
            'Sale_Price': ['mean', 'min', 'max', 'count'],
            'Retail_Price': 'first',
            'Release Date': 'first',
            'local_image_path': 'first'
        }).reset_index()
        
        sneaker_stats.columns = ['Name', 'Brand', 'Avg_Sale_Price', 'Min_Price', 'Max_Price', 
                                  'Sale_Count', 'Retail_Price', 'Release_Date', 'Image_Path']
        
        # Calculate price change percentage
        sneaker_stats['Price_Change_Pct'] = ((sneaker_stats['Avg_Sale_Price'] - sneaker_stats['Retail_Price']) 
                                              / sneaker_stats['Retail_Price'] * 100)
        
        # Sort by sale count (popularity)
        sneaker_stats = sneaker_stats.sort_values('Sale_Count', ascending=False)
        
        # Limit results
        sneaker_stats = sneaker_stats.head(limit)
        
        # Format response with proper image URLs
        results = []
        for _, row in sneaker_stats.iterrows():
            # Get image URL from image service
            image_url = get_sneaker_image_url(row['Name'])
            
            results.append({
                'Name': row['Name'],
                'Brand': row['Brand'],
                'RetailPrice': round(row['Retail_Price'], 2),
                'AvgSalePrice': round(row['Avg_Sale_Price'], 2),
                'MinPrice': round(row['Min_Price'], 2),
                'MaxPrice': round(row['Max_Price'], 2),
                'SaleCount': int(row['Sale_Count']),
                'ReleaseDate': row['Release_Date'],
                'ChangePercent': round(row['Price_Change_Pct'] / 100, 4),
                'Image': image_url
            })
        
        return jsonify({
            'success': True,
            'data': results,
            'count': len(results)
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/sneakers/stats', methods=['GET'])
def get_sneaker_stats():
    """Get price statistics by brand."""
    try:
        brand = request.args.get('brand', None)
        
        collector = StockXDataCollector()
        stats = collector.get_price_stats(brand)
        
        return jsonify({
            'success': True,
            'brand': brand or 'all',
            'stats': stats
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/market-analysis', methods=['POST'])
def market_analysis():
    """
    Market analysis using StockX dataset and Google Trends.
    
    Request body:
    {
        "sneaker_name": "Yeezy Boost 350",
        "brand": "Yeezy",
        "retail_price": 220
    }
    """
    try:
        data = request.get_json()
        sneaker_name = data.get('sneaker_name', '')
        brand = data.get('brand', '')
        retail_price = float(data.get('retail_price', 220))
        
        if not sneaker_name:
            return jsonify({'error': 'sneaker_name is required'}), 400
        
        from data_collector import StockXDataCollector, GoogleTrendsCollector
        
        # Get StockX data
        stockx = StockXDataCollector()
        sneaker_info = stockx.get_sneaker_info(name=sneaker_name, limit=1)
        
        stockx_data = {}
        if len(sneaker_info) > 0:
            row = sneaker_info.iloc[0]
            stockx_data = {
                'avg_price': float(row.get('AvgPrice', retail_price)),
                'min_price': float(row.get('MinPrice', retail_price * 0.8)),
                'max_price': float(row.get('MaxPrice', retail_price * 2)),
                'sale_count': int(row.get('SaleCount', 0)),
                'source': 'stockx_dataset'
            }
        else:
            stockx_data = {
                'avg_price': retail_price * 1.2,
                'min_price': retail_price * 0.9,
                'max_price': retail_price * 2,
                'sale_count': 0,
                'source': 'estimated'
            }
        
        # Get Google Trends
        trends_data = {}
        try:
            trends = GoogleTrendsCollector()
            trends_df = trends.get_sneaker_trends([sneaker_name])
            if not trends_df.empty:
                trends_data = trends_df.iloc[0].to_dict()
        except Exception as e:
            print(f"Trends error: {e}")
            trends_data = {'avg_interest': 50, 'trend_direction': 'stable'}
        
        # Calculate market metrics
        avg_market_price = stockx_data.get('avg_price', retail_price * 1.2)
        trend_interest = trends_data.get('avg_interest', 50)
        trend_direction = trends_data.get('trend_direction', 'stable')
        
        # Price prediction adjustment based on trends
        trend_multiplier = 1.0
        if trend_direction == 'up':
            trend_multiplier = 1 + (trend_interest / 500)
        elif trend_direction == 'down':
            trend_multiplier = 1 - (trend_interest / 1000)
        
        predicted_price = avg_market_price * trend_multiplier
        price_premium = ((predicted_price - retail_price) / retail_price) * 100
        
        return jsonify({
            'success': True,
            'sneaker_name': sneaker_name,
            'brand': brand,
            'retail_price': retail_price,
            'market_data': {
                'avg_market_price': round(avg_market_price, 2),
                'min_price': round(stockx_data.get('min_price', 0), 2),
                'max_price': round(stockx_data.get('max_price', 0), 2),
                'sale_count': stockx_data.get('sale_count', 0),
                'source': stockx_data.get('source', 'stockx')
            },
            'trends_data': {
                'interest_score': round(trend_interest, 1),
                'trend_direction': trend_direction,
                'volatility': trends_data.get('volatility', 0)
            },
            'prediction': {
                'predicted_price': round(predicted_price, 2),
                'price_premium': round(price_premium, 1),
                'confidence': min(90, 50 + stockx_data.get('sale_count', 0) // 100),
                'recommendation': 'Buy' if price_premium > 20 else ('Hold' if price_premium > 0 else 'Sell')
            }
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/smart-search', methods=['POST'])
def smart_search():
    """
    AI-powered natural language search using Groq LLM.
    
    Request body:
    {
        "query": "Show me Jordans under $200 that are trending"
    }
    
    Returns parsed search parameters and optional results.
    """
    try:
        from groq_service import parse_natural_language_query, generate_search_summary
        
        data = request.get_json()
        query = data.get('query', '')
        
        if not query:
            return jsonify({'error': 'Query is required'}), 400
        
        # Parse natural language query
        parsed = parse_natural_language_query(query)
        
        # Build search filters from parsed query
        search_results = []
        if parsed.get('parsed_successfully'):
            # Load dataset and filter
            data_path = os.path.join(os.path.dirname(__file__), 'datasets', 'Sneaker_Info_data.csv')
            if os.path.exists(data_path):
                df = pd.read_csv(data_path)
                
                # Apply filters
                if parsed.get('brand'):
                    brand = parsed['brand']
                    df = df[df['Brand'].str.lower().str.contains(brand.lower(), na=False)]
                
                if parsed.get('name'):
                    name = parsed['name']
                    df = df[df['Name'].str.lower().str.contains(name.lower(), na=False)]
                
                if parsed.get('max_price'):
                    df = df[df['RetailPrice'] <= parsed['max_price']]
                
                if parsed.get('min_price'):
                    df = df[df['RetailPrice'] >= parsed['min_price']]
                
                if parsed.get('gender') and 'Gender' in df.columns:
                    gender = parsed['gender']
                    df = df[df['Gender'].str.lower() == gender.lower()]
                
                # Sort results
                if parsed.get('sort_by') == 'price_low':
                    df = df.sort_values('RetailPrice', ascending=True)
                elif parsed.get('sort_by') == 'price_high':
                    df = df.sort_values('RetailPrice', ascending=False)
                
                # Convert to results
                search_results = df.head(20).to_dict('records')
        
        # Generate summary
        summary = generate_search_summary(search_results, query) if search_results else None
        
        return jsonify({
            'success': True,
            'query': query,
            'parsed': parsed,
            'summary': summary,
            'results': search_results,
            'count': len(search_results)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/ai-recommend', methods=['POST'])
def ai_recommend():
    """
    Get AI-powered sneaker recommendations based on user preferences.
    
    Request body:
    {
        "favorites": ["Jordan 1", "Yeezy 350"],
        "budget": "200-400",
        "style": "streetwear"
    }
    """
    try:
        from groq_service import get_sneaker_recommendation
        
        data = request.get_json()
        
        recommendation = get_sneaker_recommendation(data)
        
        return jsonify({
            'success': True,
            'recommendation': recommendation
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/sneakers/images/<folder>/<filename>')
def serve_sneaker_image(folder, filename):
    """Serve sneaker images from the dataset."""
    from flask import send_from_directory
    images_dir = os.path.join(os.path.dirname(__file__), 'datasets', 'sneakers-dataset', 'sneakers-dataset', folder)
    return send_from_directory(images_dir, filename)

@app.route('/sneakers/image-url', methods=['GET'])
def get_sneaker_image_url_endpoint():
    """
    Get image URL for a sneaker by name.
    
    Query params:
    - name: Sneaker name (e.g., "Nike Air Jordan 1 High")
    """
    try:
        from image_service import get_sneaker_image_url, get_all_images_for_sneaker
        
        name = request.args.get('name', '')
        multiple = request.args.get('multiple', 'false').lower() == 'true'
        
        if not name:
            return jsonify({'error': 'name is required'}), 400
        
        if multiple:
            urls = get_all_images_for_sneaker(name, limit=10)
            return jsonify({
                'success': True,
                'sneaker': name,
                'images': urls,
                'count': len(urls)
            })
        else:
            url = get_sneaker_image_url(name)
            return jsonify({
                'success': True,
                'sneaker': name,
                'image_url': url
            })
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/sneakers/categories', methods=['GET'])
def get_sneaker_categories():
    """Get all available sneaker categories with sample images."""
    try:
        from image_service import get_sneaker_categories_info
        
        categories = get_sneaker_categories_info()
        return jsonify({
            'success': True,
            'categories': categories,
            'count': len(categories)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/sneakers/enhanced', methods=['GET'])
def get_enhanced_sneakers():
    """
    Get sneakers from enhanced dataset with trend and hype scores.
    
    Query params:
    - brand: Filter by brand
    - limit: Max results (default 50)
    - sort_by: Sort by 'hype_score', 'trend_score', 'price' (default 'hype_score')
    """
    try:
        from image_service import get_sneaker_image_url
        
        enhanced_path = os.path.join(os.path.dirname(__file__), 'datasets', 'enhanced_sneaker_data.csv')
        
        if not os.path.exists(enhanced_path):
            return jsonify({'error': 'Enhanced dataset not found'}), 404
        
        df = pd.read_csv(enhanced_path)
        
        # Apply filters
        brand = request.args.get('brand')
        if brand:
            df = df[df['Brand'].str.lower().str.contains(brand.lower(), na=False)]
        
        # Sort
        sort_by = request.args.get('sort_by', 'hype_score')
        if sort_by in df.columns:
            df = df.sort_values(sort_by, ascending=False)
        
        # Limit
        limit = int(request.args.get('limit', 50))
        df = df.head(limit)
        
        # Add image URLs
        results = []
        for _, row in df.iterrows():
            sneaker = row.to_dict()
            sneaker['image_url'] = get_sneaker_image_url(row.get('Name', ''))
            results.append(sneaker)
        
        return jsonify({
            'success': True,
            'data': results,
            'count': len(results)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/price-history', methods=['GET'])
def get_price_history():
    """
    Get historical price data and forecast for a sneaker.
    
    Query params:
    - id: Sneaker ID
    - name: Sneaker name (if ID not provided)
    """
    try:
        from time_series import get_sneaker_price_history
        
        sneaker_id = request.args.get('id')
        sneaker_name = request.args.get('name')
        
        if not sneaker_id and not sneaker_name:
            return jsonify({'error': 'id or name is required'}), 400
        
        result = get_sneaker_price_history(sneaker_id=sneaker_id, sneaker_name=sneaker_name)
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/price-comparison', methods=['POST'])
def get_price_comparison():
    """
    Compare price history across multiple sneakers.
    
    Request body:
    {
        "sneakers": ["Air Jordan 1", "Yeezy 350", "Nike Dunk Low"]
    }
    """
    try:
        from time_series import get_market_price_comparison
        
        data = request.get_json()
        sneaker_names = data.get('sneakers', [])
        
        if not sneaker_names:
            return jsonify({'error': 'sneakers array is required'}), 400
        
        result = get_market_price_comparison(sneaker_names)
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# =============================================================================
# LIVE DATA ENDPOINTS - Real-time social data from Google Trends & Reddit
# =============================================================================

@app.route('/live/sneaker', methods=['POST'])
def get_live_sneaker_data():
    """
    Get LIVE real-time data for a sneaker from Google Trends and Reddit.
    
    Request body:
    {
        "sneaker_name": "Air Jordan 1"
    }
    
    Returns:
    - Live Google Trends interest data
    - Live Reddit discussions and sentiment
    - Real-time hype score
    """
    try:
        data = request.get_json()
        sneaker_name = data.get('sneaker_name', '')
        
        if not sneaker_name:
            return jsonify({'error': 'sneaker_name is required'}), 400
        
        collector = LiveDataCollector()
        result = collector.get_sneaker_live_data(sneaker_name)
        
        return jsonify({
            'success': True,
            **result
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/live/trends', methods=['POST'])
def get_live_google_trends():
    """
    Get LIVE Google Trends data for a sneaker.
    
    Request body:
    {
        "keyword": "Yeezy Boost 350",
        "timeframe": "now 7-d"  // 'now 1-H', 'now 1-d', 'now 7-d', 'today 1-m', 'today 3-m'
    }
    """
    try:
        data = request.get_json()
        keyword = data.get('keyword', '')
        timeframe = data.get('timeframe', 'now 7-d')
        
        if not keyword:
            return jsonify({'error': 'keyword is required'}), 400
        
        trends = LiveGoogleTrends()
        interest = trends.get_live_interest(keyword, timeframe)
        related = trends.get_related_queries(keyword)
        
        return jsonify({
            'success': True,
            'interest': interest,
            'related_queries': related
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/live/reddit', methods=['POST'])
def get_live_reddit():
    """
    Get LIVE Reddit discussions for a sneaker.
    
    Request body:
    {
        "sneaker_name": "Nike Dunk Low",
        "limit": 30
    }
    """
    try:
        data = request.get_json()
        sneaker_name = data.get('sneaker_name', '')
        limit = int(data.get('limit', 30))
        
        if not sneaker_name:
            return jsonify({'error': 'sneaker_name is required'}), 400
        
        reddit = RedditScraper()
        posts = reddit.search_sneaker(sneaker_name, limit)
        
        # Analyze sentiment
        analyzer = LiveSentimentAnalyzer()
        sentiment = analyzer.analyze_reddit_posts(posts)
        
        return jsonify({
            'success': True,
            'sneaker_name': sneaker_name,
            'posts_found': len(posts),
            'posts': posts,
            'sentiment_analysis': sentiment
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/live/reddit/hot', methods=['GET'])
def get_reddit_hot():
    """Get current HOT discussions from sneaker subreddits."""
    try:
        reddit = RedditScraper()
        hot = reddit.get_live_discussions()
        
        # Add sentiment analysis
        analyzer = LiveSentimentAnalyzer()
        hot['sentiment'] = analyzer.analyze_reddit_posts(hot.get('posts', []))
        
        return jsonify({
            'success': True,
            **hot
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/live/trending', methods=['GET'])
def get_trending_now():
    """Get what's trending RIGHT NOW in the sneaker world."""
    try:
        collector = LiveDataCollector()
        result = collector.get_trending_now()
        
        return jsonify({
            'success': True,
            **result
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/live/hype-score', methods=['POST'])
def get_live_hype_score():
    """
    Calculate LIVE hype score from real-time data.
    
    Request body:
    {
        "sneaker_name": "Air Jordan 4 Military Black"
    }
    """
    try:
        data = request.get_json()
        sneaker_name = data.get('sneaker_name', '')
        
        if not sneaker_name:
            return jsonify({'error': 'sneaker_name is required'}), 400
        
        collector = LiveDataCollector()
        result = collector.get_sneaker_live_data(sneaker_name)
        
        return jsonify({
            'success': True,
            'sneaker_name': sneaker_name,
            'live_hype_score': result.get('hype_score', 50),
            'timestamp': result.get('timestamp'),
            'data_sources': {
                'google_trends': 'interest' in (result.get('google_trends') or {}),
                'reddit': result.get('reddit', {}).get('posts_found', 0) > 0
            },
            'sentiment_breakdown': result.get('reddit', {}).get('sentiment', {})
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# =============================================================================

@app.route('/price-analytics', methods=['GET'])
def get_price_analytics():
    """
    📊 DETAILED PRICE ANALYTICS
    
    Get comprehensive price analysis including:
    - Statistical metrics (avg, median, std dev, range)
    - Technical indicators (RSI, MACD, Bollinger Bands, Moving Averages)
    - Trend analysis (direction, strength, momentum)
    - Volatility metrics (daily, annualized, max drawdown)
    - ROI calculations
    - Price distribution
    - Support/Resistance levels
    - Charts data (daily, weekly, monthly, by size)
    
    Query params:
    - name: Sneaker name to analyze
    
    Returns comprehensive analytics for charts and insights.
    """
    try:
        sneaker_name = request.args.get('name', '')
        
        if not sneaker_name:
            return jsonify({'error': 'name parameter is required'}), 400
        
        result = get_detailed_price_analytics(sneaker_name)
        
        return jsonify(result)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/prophet-forecast', methods=['POST'])
def prophet_forecast():
    """
    Get Prophet time-series forecast for a sneaker.
    
    Request body:
    {
        "sneaker_name": "Air Jordan 1",
        "periods": 30
    }
    """
    try:
        from time_series import get_sneaker_price_history
        
        data = request.get_json()
        sneaker_name = data.get('sneaker_name')
        periods = int(data.get('periods', 30))
        
        if not sneaker_name:
            return jsonify({'error': 'sneaker_name is required'}), 400
        
        result = get_sneaker_price_history(sneaker_name=sneaker_name)
        
        if result.get('success'):
            return jsonify({
                'success': True,
                'sneaker': result['sneaker'],
                'forecast': result['forecast'],
                'model': result['forecast_model'],
                'current_price': result['statistics']['current_price']
            })
        else:
            return jsonify(result), 404
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# =============================================================================
# ENSEMBLE AI PREDICTION - Combines ALL AI Models for Best Price
# =============================================================================

@app.route('/predict-social', methods=['POST'])
def predict_social():
    """
    📱 SOCIAL MEDIA-BASED PRICE PREDICTION
    
    Predicts sneaker prices based on social media presence using:
    1. Time Series Forecasting (Prophet) - Historical price patterns
    2. Linear Regression - Statistical baseline
    3. Social Media Data - Reddit sentiment + Google Trends
    
    Shows price changes with proper UP ↑ / DOWN ↓ percentage indicators.
    
    Request body:
    {
        "sneaker_name": "Nike Air Jordan 1 Retro High",
        "brand": "Off-White",
        "retail_price": 190,
        "release_date": "2023-05-15",
        "shoe_size": 10,
        "region": "California"
    }
    
    Returns:
    {
        "success": true,
        "prediction": {
            "predicted_price": 285.50,
            "price_change": 95.50,
            "price_change_percent": 50.26,
            "is_increase": true,
            "trend_indicator": "↑",
            "trend_label": "UP",
            "trend_color": "green"
        },
        "social_media": {
            "combined_score": 72,
            "reddit": {...},
            "google_trends": {...}
        }
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        result = predict_social_price(data)
        
        if result.get('success'):
            return jsonify(result)
        else:
            return jsonify(result), 500
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/predict-best-price', methods=['POST'])
def predict_best_price():
    """
    🔥 BEST PRICE PREDICTION - Uses ALL AI Models for Most Accurate Prediction
    
    This endpoint combines multiple AI models for the most accurate sneaker price prediction:
    
    Models Used:
    1. Random Forest Regressor - Pattern recognition from historical data
    2. Gradient Boosting Regressor - Boosted trees for better accuracy
    3. Ridge/Linear Regression - Statistical baseline
    4. Prophet Time Series - Temporal patterns and seasonality
    5. Sentiment Analysis - Social hype scoring from Reddit
    6. Google Trends Integration - Real-time search interest data
    7. Groq LLM - AI-powered market insights and analysis
    
    Request body:
    {
        "sneaker_name": "Adidas Yeezy Boost 350 V2 Beluga",
        "brand": "Yeezy",
        "retail_price": 220,
        "release_date": "2023-01-15",
        "shoe_size": 10,
        "region": "California",
        "include_sentiment": true,
        "include_trends": true,
        "include_groq": true
    }
    
    Returns:
    {
        "success": true,
        "prediction": {
            "best_predicted_price": 387.50,
            "price_range": {"low": 350, "mid": 387.50, "high": 425},
            "price_change_percent": 76.1,
            "overall_confidence": 0.89,
            "model_breakdown": [...]
        },
        "recommendation": {
            "action": "STRONG BUY",
            "emoji": "🔥",
            "description": "Exceptional investment - High resale potential"
        }
    }
    """
    try:
        from ensemble_price_predictor import predict_best_price as ensemble_predict
        
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Get optional flags
        include_sentiment = data.get('include_sentiment', True)
        include_trends = data.get('include_trends', True)
        include_groq = data.get('include_groq', True)
        
        # Run ensemble prediction
        result = ensemble_predict(
            data=data,
            include_sentiment=include_sentiment,
            include_trends=include_trends,
            include_groq=include_groq
        )
        
        if result.get('success'):
            return jsonify(result)
        else:
            return jsonify(result), 500
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/predict-best-price/quick', methods=['POST'])
def predict_best_price_quick():
    """
    ⚡ QUICK BEST PRICE PREDICTION - Fast prediction using only ML models
    
    Faster version that uses only the pre-trained ML models without
    real-time sentiment/trends analysis. Good for batch predictions.
    
    Request body:
    {
        "sneaker_name": "Nike Air Jordan 1 Retro High OG",
        "brand": "Off-White",
        "retail_price": 190,
        "release_date": "2022-07-25",
        "shoe_size": 10,
        "region": "New York"
    }
    """
    try:
        from ensemble_price_predictor import predict_best_price as ensemble_predict
        
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Run quick prediction (ML models only)
        result = ensemble_predict(
            data=data,
            include_sentiment=False,
            include_trends=False,
            include_groq=False
        )
        
        if result.get('success'):
            return jsonify(result)
        else:
            return jsonify(result), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/predict-best-price/batch', methods=['POST'])
def predict_best_price_batch():
    """
    📦 BATCH PRICE PREDICTION - Predict prices for multiple sneakers
    
    Request body:
    {
        "sneakers": [
            {
                "sneaker_name": "Yeezy Boost 350 V2 Zebra",
                "brand": "Yeezy",
                "retail_price": 220,
                "release_date": "2022-04-09"
            },
            {
                "sneaker_name": "Air Jordan 1 Retro High OG Chicago",
                "brand": "Off-White",
                "retail_price": 170
            }
        ]
    }
    """
    try:
        from ensemble_price_predictor import get_predictor
        
        data = request.get_json()
        sneakers = data.get('sneakers', [])
        
        if not sneakers:
            return jsonify({'error': 'sneakers array is required'}), 400
        
        if len(sneakers) > 20:
            return jsonify({'error': 'Maximum 20 sneakers per batch'}), 400
        
        predictor = get_predictor()
        results = []
        
        for sneaker in sneakers:
            result = predictor.predict_best_price(
                data=sneaker,
                include_sentiment=False,  # Faster batch mode
                include_trends=False,
                include_groq=False
            )
            
            if result.get('success'):
                results.append({
                    'sneaker_name': sneaker.get('sneaker_name', 'Unknown'),
                    'retail_price': sneaker.get('retail_price', 0),
                    'best_predicted_price': result['prediction']['best_predicted_price'],
                    'price_change_percent': result['prediction']['price_change_percent'],
                    'recommendation': result['recommendation']['action'],
                    'confidence': result['prediction']['overall_confidence']
                })
            else:
                results.append({
                    'sneaker_name': sneaker.get('sneaker_name', 'Unknown'),
                    'error': result.get('error', 'Prediction failed')
                })
        
        return jsonify({
            'success': True,
            'predictions': results,
            'count': len(results)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/models/info', methods=['GET'])
def get_all_models_info():
    """
    📊 Get information about all available AI models
    
    Returns details about each model in the ensemble:
    - Model type and name
    - Training metrics (R², RMSE, MAE)
    - Feature importance
    - Last training date
    """
    try:
        from ensemble_price_predictor import get_predictor
        
        predictor = get_predictor()
        
        models_info = {
            'total_models': 7,
            'ensemble_method': 'Weighted Average with Confidence Scoring',
            'models': [
                {
                    'name': 'Random Forest',
                    'type': 'Tree-based Ensemble',
                    'description': 'Ensemble of decision trees for pattern recognition',
                    'weight': 0.35,
                    'metrics': predictor.metadata.get('results', {}).get('random_forest', {})
                },
                {
                    'name': 'Gradient Boosting',
                    'type': 'Boosted Trees',
                    'description': 'Sequential tree boosting for improved accuracy',
                    'weight': 0.30,
                    'metrics': predictor.metadata.get('results', {}).get('gradient_boosting', {})
                },
                {
                    'name': 'Ridge Regression',
                    'type': 'Regularized Linear',
                    'description': 'L2 regularized linear regression',
                    'weight': 0.10,
                    'metrics': predictor.metadata.get('results', {}).get('ridge_regression', {})
                },
                {
                    'name': 'Linear Regression',
                    'type': 'Linear Baseline',
                    'description': 'Simple linear regression baseline',
                    'weight': 0.05,
                    'metrics': predictor.metadata.get('results', {}).get('linear_regression', {})
                },
                {
                    'name': 'Prophet Time Series',
                    'type': 'Time Series Forecasting',
                    'description': 'Facebook Prophet for temporal patterns and seasonality',
                    'weight': 0.20
                },
                {
                    'name': 'Sentiment Analysis',
                    'type': 'NLP / Social Analysis',
                    'description': 'Reddit sentiment and hype scoring',
                    'weight': 0.10
                },
                {
                    'name': 'Groq LLM',
                    'type': 'Large Language Model',
                    'description': 'AI-powered market insights using Llama 3.1',
                    'weight': 0.10
                }
            ],
            'trained_at': predictor.metadata.get('trained_at', 'Unknown'),
            'best_model': predictor.metadata.get('best_model', 'random_forest'),
            'feature_columns': predictor.feature_columns
        }
        
        return jsonify({
            'success': True,
            **models_info
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    print("Starting Driplytics ML API Server...")
    print("\nEndpoints:")
    print("  GET  /health              - Health check")
    print("  POST /predict             - Predict sneaker price")
    print("  GET  /brands              - List supported brands")
    print("  GET  /model-info          - Model information")
    print("  POST /hype-score          - Get hype score for a sneaker")
    print("  GET  /hype-scores         - Get all hype scores (from StockX data)")
    print("  POST /analyze-comment     - Analyze comment sentiment")
    print("  POST /google-trends       - Get live Google Trends data")
    print("  GET  /google-trends/cached - Get cached trends data")
    print("  GET  /sneakers/search     - Search sneakers from dataset")
    print("  GET  /sneakers/stats      - Get price statistics")
    print("  GET  /price-analytics     - Detailed price analytics (charts, indicators)")
    print("  POST /market-analysis     - Market analysis (StockX + Trends)")
    print("  POST /smart-search        - AI-powered natural language search")
    print("  POST /ai-recommend        - AI-powered recommendations")
    print("\n  === LIVE DATA ENDPOINTS (Real-Time) ===")
    print("  POST /live/sneaker        - Get LIVE data from Google Trends + Reddit")
    print("  POST /live/trends         - Get LIVE Google Trends interest data")
    print("  POST /live/reddit         - Get LIVE Reddit discussions + sentiment")
    print("  GET  /live/reddit/hot     - Get current HOT Reddit discussions")
    print("  GET  /live/trending       - Get what's trending RIGHT NOW")
    print("  POST /live/hype-score     - Calculate LIVE hype score from real-time data")
    print("\n  === 📱 SOCIAL MEDIA PREDICTION (Recommended) ===")
    print("  POST /predict-social           - Social media-based prediction (Time Series + Linear + Social)")
    print("\n  === 🔥 ENSEMBLE AI PREDICTION (All Models) ===")
    print("  POST /predict-best-price       - Best price using ALL 7 AI models")
    print("  POST /predict-best-price/quick - Fast prediction (ML models only)")
    print("  POST /predict-best-price/batch - Batch prediction for multiple sneakers")
    print("  GET  /models/info              - Get all models information")
    app.run(host='0.0.0.0', port=5002, debug=True)
