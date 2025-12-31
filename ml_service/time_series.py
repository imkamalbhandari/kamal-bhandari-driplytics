"""
Time Series Price Prediction using Prophet
Generates historical price data and forecasts future prices.
"""

import os
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import json

# Try to import Prophet (optional dependency)
try:
    from prophet import Prophet
    PROPHET_AVAILABLE = True
except ImportError:
    PROPHET_AVAILABLE = False
    print("Prophet not installed. Install with: pip install prophet")

DATASETS_DIR = os.path.join(os.path.dirname(__file__), 'datasets')
MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')


def generate_historical_prices(sneaker_name: str, retail_price: float, 
                               change_percent: float, volatility: float,
                               release_date: str = None, days: int = 365) -> pd.DataFrame:
    """
    Generate synthetic historical price data for a sneaker.
    
    Uses the sneaker's volatility and change percent to simulate realistic price movements.
    
    Args:
        sneaker_name: Name of the sneaker
        retail_price: Original retail price
        change_percent: Overall price change (e.g., 0.15 for +15%)
        volatility: Price volatility factor
        release_date: Release date string (YYYY-MM-DD)
        days: Number of days of history to generate
        
    Returns:
        DataFrame with date and price columns
    """
    # Parse release date or use default
    if release_date and release_date != '0':
        try:
            start_date = datetime.strptime(release_date, '%Y-%m-%d')
        except:
            start_date = datetime.now() - timedelta(days=days)
    else:
        start_date = datetime.now() - timedelta(days=days)
    
    # Generate date range
    dates = pd.date_range(start=start_date, periods=days, freq='D')
    
    # Calculate target final price
    final_price = retail_price * (1 + change_percent)
    
    # Generate price path with realistic movements
    np.random.seed(hash(sneaker_name) % 2**32)  # Consistent randomness per sneaker
    
    # Base trend (linear from retail to final)
    trend = np.linspace(retail_price, final_price, days)
    
    # Add volatility (random walk component)
    noise_scale = retail_price * volatility * 0.5
    noise = np.cumsum(np.random.randn(days) * noise_scale / np.sqrt(days))
    noise = noise - noise[-1] * np.linspace(0, 1, days)  # Mean revert to target
    
    # Add seasonal pattern (weekly cycles for drops/restocks)
    seasonal = np.sin(np.linspace(0, 8 * np.pi, days)) * retail_price * 0.02
    
    # Add hype spikes (random events)
    spikes = np.zeros(days)
    spike_days = np.random.choice(days, size=int(days * 0.05), replace=False)
    spikes[spike_days] = np.random.randn(len(spike_days)) * retail_price * volatility * 0.3
    
    # Combine components
    prices = trend + noise + seasonal + spikes
    
    # Ensure prices are positive and reasonable
    prices = np.clip(prices, retail_price * 0.5, retail_price * 5)
    
    # Create DataFrame
    df = pd.DataFrame({
        'ds': dates,
        'y': prices,
        'date': dates.strftime('%Y-%m-%d'),
        'price': np.round(prices, 2)
    })
    
    return df


def predict_with_prophet(historical_data: pd.DataFrame, periods: int = 30) -> dict:
    """
    Use Prophet to forecast future prices.
    Falls back to simple statistical forecast if Prophet fails.
    
    Args:
        historical_data: DataFrame with 'ds' (date) and 'y' (price) columns
        periods: Number of days to forecast
        
    Returns:
        Dictionary with forecast data
    """
    if not PROPHET_AVAILABLE:
        return simple_forecast(historical_data, periods)
    
    try:
        # Prepare data for Prophet
        df = historical_data[['ds', 'y']].copy()
        df = df.dropna()
        
        if len(df) < 10:
            return simple_forecast(historical_data, periods)
        
        # Initialize Prophet with sneaker-appropriate settings
        model = Prophet(
            changepoint_prior_scale=0.05,
            seasonality_prior_scale=10,
            yearly_seasonality=False,
            weekly_seasonality=True,
            daily_seasonality=False
        )
        
        # Suppress cmdstanpy output
        import logging
        logging.getLogger('cmdstanpy').setLevel(logging.WARNING)
        
        # Fit model
        model.fit(df)
        
        # Create future dataframe
        future = model.make_future_dataframe(periods=periods)
        
        # Predict
        forecast = model.predict(future)
        
        # Extract forecast for future dates only
        future_forecast = forecast.tail(periods)[['ds', 'yhat', 'yhat_lower', 'yhat_upper']]
        
        if len(future_forecast) == 0:
            return simple_forecast(historical_data, periods)
        
        return {
            'success': True,
            'forecast': [
                {
                    'date': row['ds'].strftime('%Y-%m-%d'),
                    'predicted_price': round(max(0, row['yhat']), 2),
                    'lower_bound': round(max(0, row['yhat_lower']), 2),
                    'upper_bound': round(max(0, row['yhat_upper']), 2)
                }
                for _, row in future_forecast.iterrows()
            ],
            'model': 'Prophet',
            'periods': periods
        }
        
    except Exception as e:
        print(f"Prophet error: {e}, using simple forecast")
        return simple_forecast(historical_data, periods)


def simple_forecast(historical_data: pd.DataFrame, periods: int = 30) -> dict:
    """
    Simple statistical forecast when Prophet is unavailable or fails.
    Uses linear trend + recent volatility.
    """
    try:
        df = historical_data.copy()
        if 'y' not in df.columns:
            return {'error': 'No price data', 'forecast': []}
        
        prices = df['y'].dropna().values
        if len(prices) < 5:
            return {'error': 'Insufficient data', 'forecast': []}
        
        # Calculate trend using linear regression
        x = np.arange(len(prices))
        slope, intercept = np.polyfit(x, prices, 1)
        
        # Calculate volatility
        volatility = np.std(prices) if len(prices) > 1 else prices[-1] * 0.1
        
        # Get last date
        if 'ds' in df.columns:
            last_date = pd.to_datetime(df['ds'].dropna().iloc[-1])
        else:
            last_date = datetime.now()
        
        # Generate forecast
        forecast = []
        for i in range(1, periods + 1):
            future_date = last_date + timedelta(days=i)
            predicted = intercept + slope * (len(prices) + i)
            
            # Add slight random walk
            np.random.seed(i)
            predicted += np.random.normal(0, volatility * 0.1)
            
            forecast.append({
                'date': future_date.strftime('%Y-%m-%d'),
                'predicted_price': round(max(0, predicted), 2),
                'lower_bound': round(max(0, predicted - volatility), 2),
                'upper_bound': round(predicted + volatility, 2)
            })
        
        return {
            'success': True,
            'forecast': forecast,
            'model': 'Linear Trend',
            'periods': periods
        }
        
    except Exception as e:
        return {'error': str(e), 'forecast': []}


def get_sneaker_price_history(sneaker_id: str = None, sneaker_name: str = None) -> dict:
    """
    Get historical price data for a sneaker from StockX dataset.
    Uses REAL transaction data from stockx_complete.csv.
    
    Args:
        sneaker_id: Sneaker ID from dataset
        sneaker_name: Sneaker name (if ID not provided)
        
    Returns:
        Dictionary with historical prices and forecast
    """
    # Load StockX dataset
    data_path = os.path.join(DATASETS_DIR, 'stockx_complete.csv')
    if not os.path.exists(data_path):
        return {'error': 'StockX dataset not found'}
    
    df = pd.read_csv(data_path)
    
    # Clean price columns
    df['Sale_Price'] = df['Sale Price'].replace(r'[\$,]', '', regex=True).astype(float)
    df['Retail_Price'] = df['Retail Price'].replace(r'[\$,]', '', regex=True).astype(float)
    df['Order_Date'] = pd.to_datetime(df['Order Date'], format='%m/%d/%y', errors='coerce')
    df['Brand'] = df['Brand'].str.strip()
    
    # Find sneaker by name
    if sneaker_name:
        sneaker_df = df[df['Sneaker Name'].str.lower().str.contains(sneaker_name.lower(), na=False)]
    else:
        return {'error': 'Sneaker name required'}
    
    if len(sneaker_df) == 0:
        return {'error': f'Sneaker "{sneaker_name}" not found in dataset'}
    
    # Get sneaker info
    sneaker_info = sneaker_df.iloc[0]
    sneaker_full_name = sneaker_info['Sneaker Name']
    brand = sneaker_info['Brand']
    retail_price = sneaker_info['Retail_Price']
    release_date = sneaker_info['Release Date']
    
    # Aggregate price history by date
    price_history = sneaker_df.groupby('Order_Date').agg({
        'Sale_Price': ['mean', 'min', 'max', 'count']
    }).reset_index()
    price_history.columns = ['date', 'avg_price', 'min_price', 'max_price', 'sale_count']
    price_history = price_history.sort_values('date')
    
    # Prepare data for Prophet
    prophet_df = pd.DataFrame({
        'ds': price_history['date'],
        'y': price_history['avg_price']
    })
    
    # Get Prophet forecast
    forecast_result = predict_with_prophet(prophet_df, periods=30)
    
    # Calculate statistics
    current_price = price_history['avg_price'].iloc[-1] if len(price_history) > 0 else retail_price
    avg_price = price_history['avg_price'].mean()
    min_price = price_history['min_price'].min()
    max_price = price_history['max_price'].max()
    total_sales = sneaker_df['Sale_Price'].count()
    
    # Determine price trend
    if len(price_history) > 1:
        first_price = price_history['avg_price'].iloc[0]
        price_trend = 'up' if current_price > first_price else 'down'
        change_percent = ((current_price - first_price) / first_price) * 100
    else:
        price_trend = 'stable'
        change_percent = 0
    
    return {
        'success': True,
        'sneaker': {
            'name': sneaker_full_name,
            'brand': brand,
            'retail_price': float(retail_price),
            'release_date': str(release_date)
        },
        'history': {
            'dates': price_history['date'].dt.strftime('%Y-%m-%d').tolist(),
            'prices': price_history['avg_price'].round(2).tolist(),
            'min_prices': price_history['min_price'].round(2).tolist(),
            'max_prices': price_history['max_price'].round(2).tolist(),
            'sale_counts': price_history['sale_count'].tolist(),
            'data_points': len(price_history)
        },
        'statistics': {
            'current_price': round(current_price, 2),
            'average_price': round(avg_price, 2),
            'min_price': round(min_price, 2),
            'max_price': round(max_price, 2),
            'price_trend': price_trend,
            'change_percent': round(change_percent, 2),
            'total_sales': int(total_sales),
            'premium_over_retail': round(((avg_price - retail_price) / retail_price) * 100, 2)
        },
        'forecast': forecast_result.get('forecast', []),
        'forecast_model': forecast_result.get('model', 'Linear Trend')
    }


def get_market_price_comparison(sneaker_names: list) -> dict:
    """
    Compare price history across multiple sneakers using StockX data.
    
    Args:
        sneaker_names: List of sneaker names to compare
        
    Returns:
        Dictionary with comparison data
    """
    data_path = os.path.join(DATASETS_DIR, 'stockx_complete.csv')
    if not os.path.exists(data_path):
        return {'error': 'StockX dataset not found'}
    
    df = pd.read_csv(data_path)
    
    # Clean data
    df['Sale_Price'] = df['Sale Price'].replace(r'[\$,]', '', regex=True).astype(float)
    df['Retail_Price'] = df['Retail Price'].replace(r'[\$,]', '', regex=True).astype(float)
    df['Order_Date'] = pd.to_datetime(df['Order Date'], format='%m/%d/%y', errors='coerce')
    df['Brand'] = df['Brand'].str.strip()
    
    comparisons = []
    for name in sneaker_names[:5]:  # Limit to 5 sneakers
        sneaker_df = df[df['Sneaker Name'].str.lower().str.contains(name.lower(), na=False)]
        
        if len(sneaker_df) > 0:
            # Get sneaker info
            sneaker_info = sneaker_df.iloc[0]
            
            # Aggregate by week for cleaner comparison
            price_history = sneaker_df.groupby(pd.Grouper(key='Order_Date', freq='W')).agg({
                'Sale_Price': 'mean'
            }).reset_index()
            price_history = price_history.dropna()
            
            if len(price_history) > 0:
                first_price = price_history['Sale_Price'].iloc[0]
                current_price = price_history['Sale_Price'].iloc[-1]
                change_pct = ((current_price - first_price) / first_price) * 100 if first_price > 0 else 0
                
                comparisons.append({
                    'name': sneaker_info['Sneaker Name'],
                    'brand': sneaker_info['Brand'],
                    'dates': price_history['Order_Date'].dt.strftime('%Y-%m-%d').tolist(),
                    'prices': price_history['Sale_Price'].round(2).tolist(),
                    'current_price': round(current_price, 2),
                    'retail_price': float(sneaker_info['Retail_Price']),
                    'change_percent': round(change_pct, 1),
                    'total_sales': len(sneaker_df)
                })
    
    return {
        'success': True,
        'comparisons': comparisons,
        'count': len(comparisons)
    }


# Test
if __name__ == '__main__':
    print("Testing Time Series Module with StockX Data...")
    print(f"Prophet Available: {PROPHET_AVAILABLE}")
    
    # Test historical price from real StockX data
    result = get_sneaker_price_history(sneaker_name='Yeezy-Boost-350')
    if result.get('success'):
        print(f"\nSneaker: {result['sneaker']['name']}")
        print(f"Brand: {result['sneaker']['brand']}")
        print(f"Retail Price: ${result['sneaker']['retail_price']}")
        print(f"Current Avg Price: ${result['statistics']['current_price']}")
        print(f"Price Range: ${result['statistics']['min_price']} - ${result['statistics']['max_price']}")
        print(f"Price Trend: {result['statistics']['price_trend']} ({result['statistics']['change_percent']}%)")
        print(f"Total Sales: {result['statistics']['total_sales']}")
        print(f"Premium: {result['statistics']['premium_over_retail']}%")
        print(f"Data Points: {result['history']['data_points']}")
        if result['forecast']:
            print(f"30-day Forecast: ${result['forecast'][-1]['predicted_price']}")
    else:
        print(f"Error: {result.get('error')}")
