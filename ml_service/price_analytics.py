"""
Driplytics - Advanced Price History Analytics

Provides detailed price analysis including:
- Statistical metrics (volatility, standard deviation, moving averages)
- Technical indicators (RSI, MACD, Bollinger Bands)
- Trend analysis
- Price distribution
- Support/Resistance levels
- ROI calculations
"""

import os
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

DATASETS_DIR = os.path.join(os.path.dirname(__file__), 'datasets')


def calculate_moving_averages(prices: np.ndarray, windows: List[int] = [7, 14, 30]) -> Dict[str, List[float]]:
    """Calculate Simple Moving Averages for different windows."""
    result = {}
    for window in windows:
        if len(prices) >= window:
            ma = pd.Series(prices).rolling(window=window).mean().bfill().tolist()
            result[f'ma_{window}'] = [round(x, 2) for x in ma]
        else:
            result[f'ma_{window}'] = prices.tolist()
    return result


def calculate_ema(prices: np.ndarray, span: int = 14) -> List[float]:
    """Calculate Exponential Moving Average."""
    ema = pd.Series(prices).ewm(span=span, adjust=False).mean().tolist()
    return [round(x, 2) for x in ema]


def calculate_rsi(prices: np.ndarray, period: int = 14) -> List[float]:
    """Calculate Relative Strength Index."""
    if len(prices) < period + 1:
        return [50.0] * len(prices)
    
    deltas = np.diff(prices)
    gains = np.where(deltas > 0, deltas, 0)
    losses = np.where(deltas < 0, -deltas, 0)
    
    avg_gain = pd.Series(gains).rolling(window=period).mean()
    avg_loss = pd.Series(losses).rolling(window=period).mean()
    
    rs = avg_gain / (avg_loss + 0.0001)  # Avoid division by zero
    rsi = 100 - (100 / (1 + rs))
    
    rsi = rsi.fillna(50).tolist()
    return [50.0] + [round(x, 2) for x in rsi]


def calculate_bollinger_bands(prices: np.ndarray, window: int = 20, num_std: float = 2) -> Dict[str, List[float]]:
    """Calculate Bollinger Bands."""
    series = pd.Series(prices)
    middle = series.rolling(window=window).mean()
    std = series.rolling(window=window).std()
    
    upper = middle + (std * num_std)
    lower = middle - (std * num_std)
    
    return {
        'upper': [round(x, 2) for x in upper.bfill().tolist()],
        'middle': [round(x, 2) for x in middle.bfill().tolist()],
        'lower': [round(x, 2) for x in lower.bfill().tolist()]
    }


def calculate_macd(prices: np.ndarray, fast: int = 12, slow: int = 26, signal: int = 9) -> Dict[str, List[float]]:
    """Calculate MACD (Moving Average Convergence Divergence)."""
    series = pd.Series(prices)
    
    ema_fast = series.ewm(span=fast, adjust=False).mean()
    ema_slow = series.ewm(span=slow, adjust=False).mean()
    
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram = macd_line - signal_line
    
    return {
        'macd': [round(x, 2) for x in macd_line.tolist()],
        'signal': [round(x, 2) for x in signal_line.tolist()],
        'histogram': [round(x, 2) for x in histogram.tolist()]
    }


def calculate_volatility_metrics(prices: np.ndarray) -> Dict[str, float]:
    """Calculate various volatility metrics."""
    if len(prices) < 2:
        return {'daily_volatility': 0, 'annualized_volatility': 0, 'max_drawdown': 0}
    
    returns = np.diff(prices) / prices[:-1]
    
    daily_vol = np.std(returns)
    annualized_vol = daily_vol * np.sqrt(252)  # 252 trading days
    
    # Max drawdown
    cummax = np.maximum.accumulate(prices)
    drawdown = (cummax - prices) / cummax
    max_drawdown = np.max(drawdown)
    
    return {
        'daily_volatility': round(daily_vol * 100, 2),
        'annualized_volatility': round(annualized_vol * 100, 2),
        'max_drawdown': round(max_drawdown * 100, 2),
        'avg_daily_change': round(np.mean(np.abs(returns)) * 100, 2)
    }


def calculate_support_resistance(prices: np.ndarray, num_levels: int = 3) -> Dict[str, List[float]]:
    """Calculate support and resistance levels using pivot points."""
    if len(prices) < 5:
        return {'support': [], 'resistance': []}
    
    # Find local minima and maxima
    window = max(5, len(prices) // 10)
    
    series = pd.Series(prices)
    
    # Rolling min/max
    rolling_min = series.rolling(window=window, center=True).min()
    rolling_max = series.rolling(window=window, center=True).max()
    
    # Find pivot points
    support_levels = series[series == rolling_min].unique()
    resistance_levels = series[series == rolling_max].unique()
    
    # Get most significant levels
    support = sorted(support_levels)[:num_levels]
    resistance = sorted(resistance_levels, reverse=True)[:num_levels]
    
    return {
        'support': [round(x, 2) for x in support],
        'resistance': [round(x, 2) for x in resistance]
    }


def calculate_price_distribution(prices: np.ndarray, bins: int = 10) -> Dict[str, Any]:
    """Calculate price distribution histogram."""
    hist, bin_edges = np.histogram(prices, bins=bins)
    
    return {
        'counts': hist.tolist(),
        'bin_edges': [round(x, 2) for x in bin_edges.tolist()],
        'bin_labels': [f"${round(bin_edges[i], 0)}-${round(bin_edges[i+1], 0)}" for i in range(len(bin_edges)-1)],
        'mode_price': round(bin_edges[np.argmax(hist)], 2),
        'median_price': round(np.median(prices), 2)
    }


def calculate_roi_metrics(prices: np.ndarray, retail_price: float) -> Dict[str, Any]:
    """Calculate ROI and investment metrics."""
    if len(prices) == 0 or retail_price == 0:
        return {}
    
    current_price = prices[-1]
    first_price = prices[0]
    
    # ROI calculations
    roi_from_retail = ((current_price - retail_price) / retail_price) * 100
    roi_from_first = ((current_price - first_price) / first_price) * 100
    
    # Best/worst case scenarios
    max_price = np.max(prices)
    min_price = np.min(prices)
    
    best_roi = ((max_price - retail_price) / retail_price) * 100
    worst_roi = ((min_price - retail_price) / retail_price) * 100
    
    # Time-based metrics
    days = len(prices)
    daily_roi = roi_from_retail / days if days > 0 else 0
    annualized_roi = daily_roi * 365
    
    return {
        'current_roi': round(roi_from_retail, 2),
        'roi_from_first_sale': round(roi_from_first, 2),
        'best_possible_roi': round(best_roi, 2),
        'worst_possible_roi': round(worst_roi, 2),
        'annualized_roi': round(annualized_roi, 2),
        'profit_per_pair': round(current_price - retail_price, 2),
        'max_profit_per_pair': round(max_price - retail_price, 2),
        'days_tracked': days
    }


def calculate_trend_analysis(prices: np.ndarray, dates: List[str]) -> Dict[str, Any]:
    """Analyze price trends."""
    if len(prices) < 7:
        return {'trend': 'insufficient_data', 'strength': 0}
    
    # Calculate slopes for different periods
    def get_slope(data):
        x = np.arange(len(data))
        slope, _ = np.polyfit(x, data, 1)
        return slope
    
    # Overall trend
    overall_slope = get_slope(prices)
    
    # Recent trend (last 7 days)
    recent_slope = get_slope(prices[-7:]) if len(prices) >= 7 else overall_slope
    
    # Determine trend direction
    if recent_slope > 0.5:
        trend = 'strongly_bullish'
        trend_emoji = '📈🔥'
    elif recent_slope > 0.1:
        trend = 'bullish'
        trend_emoji = '📈'
    elif recent_slope < -0.5:
        trend = 'strongly_bearish'
        trend_emoji = '📉⚠️'
    elif recent_slope < -0.1:
        trend = 'bearish'
        trend_emoji = '📉'
    else:
        trend = 'sideways'
        trend_emoji = '➡️'
    
    # Trend strength (0-100)
    strength = min(100, abs(recent_slope) * 50)
    
    # Price momentum
    momentum = (prices[-1] - prices[-7]) / prices[-7] * 100 if len(prices) >= 7 else 0
    
    return {
        'trend': trend,
        'trend_emoji': trend_emoji,
        'trend_description': trend.replace('_', ' ').title(),
        'strength': round(strength, 1),
        'momentum': round(momentum, 2),
        'overall_slope': round(overall_slope, 4),
        'recent_slope': round(recent_slope, 4),
        'is_uptrend': recent_slope > 0,
        'is_accelerating': recent_slope > overall_slope
    }


def get_detailed_price_analytics(sneaker_name: str) -> Dict[str, Any]:
    """
    Get comprehensive price analytics for a sneaker.
    
    Returns detailed statistics, technical indicators, and visualizations data.
    """
    # Load StockX dataset
    data_path = os.path.join(DATASETS_DIR, 'stockx_complete.csv')
    if not os.path.exists(data_path):
        return {'error': 'Dataset not found', 'success': False}
    
    try:
        df = pd.read_csv(data_path)
        
        # Clean data
        df['Sale_Price'] = df['Sale Price'].replace(r'[\$,]', '', regex=True).astype(float)
        df['Retail_Price'] = df['Retail Price'].replace(r'[\$,]', '', regex=True).astype(float)
        df['Order_Date'] = pd.to_datetime(df['Order Date'], format='%m/%d/%y', errors='coerce')
        
        # Filter for sneaker
        sneaker_df = df[df['Sneaker Name'].str.lower().str.contains(sneaker_name.lower(), na=False)]
        
        if len(sneaker_df) == 0:
            return {'error': f'Sneaker "{sneaker_name}" not found', 'success': False}
        
        # Get sneaker info
        sneaker_info = sneaker_df.iloc[0]
        retail_price = float(sneaker_info['Retail_Price'])
        
        # Aggregate daily prices
        daily_data = sneaker_df.groupby('Order_Date').agg({
            'Sale_Price': ['mean', 'min', 'max', 'count', 'std']
        }).reset_index()
        daily_data.columns = ['date', 'avg_price', 'min_price', 'max_price', 'volume', 'price_std']
        daily_data = daily_data.sort_values('date').dropna()
        
        if len(daily_data) < 2:
            return {'error': 'Insufficient price history', 'success': False}
        
        # Extract arrays
        dates = daily_data['date'].dt.strftime('%Y-%m-%d').tolist()
        prices = daily_data['avg_price'].values
        volumes = daily_data['volume'].values
        min_prices = daily_data['min_price'].values
        max_prices = daily_data['max_price'].values
        
        # Calculate all analytics
        moving_averages = calculate_moving_averages(prices)
        bollinger = calculate_bollinger_bands(prices)
        rsi = calculate_rsi(prices)
        macd = calculate_macd(prices)
        volatility = calculate_volatility_metrics(prices)
        support_resistance = calculate_support_resistance(prices)
        distribution = calculate_price_distribution(prices)
        roi = calculate_roi_metrics(prices, retail_price)
        trend = calculate_trend_analysis(prices, dates)
        
        # Basic statistics
        stats = {
            'current_price': round(prices[-1], 2),
            'avg_price': round(np.mean(prices), 2),
            'median_price': round(np.median(prices), 2),
            'min_price': round(np.min(prices), 2),
            'max_price': round(np.max(prices), 2),
            'price_range': round(np.max(prices) - np.min(prices), 2),
            'std_deviation': round(np.std(prices), 2),
            'total_sales': int(np.sum(volumes)),
            'avg_daily_volume': round(np.mean(volumes), 1),
            'retail_price': retail_price,
            'premium_percent': round(((prices[-1] - retail_price) / retail_price) * 100, 2),
            'data_points': len(prices),
            'date_range': {
                'start': dates[0],
                'end': dates[-1],
                'days': len(dates)
            }
        }
        
        # Weekly aggregation for charts
        weekly_df = sneaker_df.set_index('Order_Date').resample('W').agg({
            'Sale_Price': ['mean', 'min', 'max', 'count']
        }).dropna()
        weekly_df.columns = ['avg', 'min', 'max', 'volume']
        
        weekly_data = {
            'dates': weekly_df.index.strftime('%Y-%m-%d').tolist(),
            'avg_prices': [round(x, 2) for x in weekly_df['avg'].tolist()],
            'min_prices': [round(x, 2) for x in weekly_df['min'].tolist()],
            'max_prices': [round(x, 2) for x in weekly_df['max'].tolist()],
            'volumes': weekly_df['volume'].tolist()
        }
        
        # Monthly aggregation
        monthly_df = sneaker_df.set_index('Order_Date').resample('ME').agg({
            'Sale_Price': ['mean', 'min', 'max', 'count']
        }).dropna()
        monthly_df.columns = ['avg', 'min', 'max', 'volume']
        
        monthly_data = {
            'dates': monthly_df.index.strftime('%Y-%m').tolist(),
            'avg_prices': [round(x, 2) for x in monthly_df['avg'].tolist()],
            'min_prices': [round(x, 2) for x in monthly_df['min'].tolist()],
            'max_prices': [round(x, 2) for x in monthly_df['max'].tolist()],
            'volumes': monthly_df['volume'].tolist()
        }
        
        # Price by size analysis
        size_analysis = sneaker_df.groupby('Shoe Size').agg({
            'Sale_Price': ['mean', 'count']
        }).reset_index()
        size_analysis.columns = ['size', 'avg_price', 'sales']
        
        size_data = {
            'sizes': size_analysis['size'].tolist(),
            'avg_prices': [round(x, 2) for x in size_analysis['avg_price'].tolist()],
            'sales': size_analysis['sales'].tolist()
        }
        
        return {
            'success': True,
            'sneaker': {
                'name': sneaker_info['Sneaker Name'],
                'brand': sneaker_info['Brand'],
                'retail_price': retail_price,
                'release_date': str(sneaker_info['Release Date'])
            },
            'statistics': stats,
            'trend_analysis': trend,
            'volatility': volatility,
            'roi_metrics': roi,
            'technical_indicators': {
                'moving_averages': moving_averages,
                'bollinger_bands': bollinger,
                'rsi': rsi[-50:],  # Last 50 values
                'macd': {k: v[-50:] for k, v in macd.items()},
                'support_resistance': support_resistance
            },
            'price_distribution': distribution,
            'charts': {
                'daily': {
                    'dates': dates,
                    'prices': [round(x, 2) for x in prices.tolist()],
                    'min_prices': [round(x, 2) for x in min_prices.tolist()],
                    'max_prices': [round(x, 2) for x in max_prices.tolist()],
                    'volumes': volumes.tolist()
                },
                'weekly': weekly_data,
                'monthly': monthly_data,
                'by_size': size_data
            }
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {'error': str(e), 'success': False}


if __name__ == '__main__':
    print("Testing Price Analytics...")
    
    result = get_detailed_price_analytics('Yeezy-Boost-350')
    
    if result.get('success'):
        print(f"\nSneaker: {result['sneaker']['name']}")
        print(f"\nStatistics:")
        for k, v in result['statistics'].items():
            print(f"  {k}: {v}")
        print(f"\nTrend: {result['trend_analysis']['trend_emoji']} {result['trend_analysis']['trend_description']}")
        print(f"Momentum: {result['trend_analysis']['momentum']}%")
        print(f"\nROI from Retail: {result['roi_metrics']['current_roi']}%")
        print(f"Volatility: {result['volatility']['annualized_volatility']}%")
    else:
        print(f"Error: {result.get('error')}")

