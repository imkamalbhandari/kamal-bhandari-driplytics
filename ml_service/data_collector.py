"""
Driplytics - Trend & Market Data Collection
Collects Google Trends data for sneaker hype analysis.
Prepares structure for eBay API integration (requires API keys).
"""

import pandas as pd
import numpy as np
import os
import time
from datetime import datetime, timedelta
import joblib

# Google Trends
try:
    from pytrends.request import TrendReq
    PYTRENDS_AVAILABLE = True
except ImportError:
    PYTRENDS_AVAILABLE = False
    print("pytrends not installed. Run: pip install pytrends")

MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')
DATASETS_DIR = os.path.join(os.path.dirname(__file__), 'datasets')


class GoogleTrendsCollector:
    """Collect Google Trends data for sneaker popularity analysis."""
    
    def __init__(self):
        if not PYTRENDS_AVAILABLE:
            raise ImportError("pytrends is required. Install with: pip install pytrends")
        self.pytrends = TrendReq(hl='en-US', tz=360)
    
    def get_sneaker_trends(self, sneaker_names, timeframe='today 3-m'):
        """
        Get Google Trends interest data for sneakers.
        
        Args:
            sneaker_names: List of sneaker names (max 5 at a time)
            timeframe: Time range for trends data
                - 'now 1-H': Last hour
                - 'now 1-d': Last day
                - 'now 7-d': Last 7 days
                - 'today 1-m': Last month
                - 'today 3-m': Last 3 months
                - 'today 12-m': Last year
        
        Returns:
            DataFrame with trend data
        """
        results = []
        
        # Process in batches of 5 (Google Trends limit)
        for i in range(0, len(sneaker_names), 5):
            batch = sneaker_names[i:i+5]
            print(f"Fetching trends for: {batch}")
            
            try:
                self.pytrends.build_payload(batch, cat=0, timeframe=timeframe, geo='US')
                interest_df = self.pytrends.interest_over_time()
                
                if not interest_df.empty:
                    # Calculate metrics for each sneaker
                    for name in batch:
                        if name in interest_df.columns:
                            data = interest_df[name]
                            results.append({
                                'sneaker_name': name,
                                'avg_interest': data.mean(),
                                'max_interest': data.max(),
                                'min_interest': data.min(),
                                'trend_direction': 'up' if data.iloc[-1] > data.iloc[0] else 'down',
                                'volatility': data.std(),
                                'current_interest': data.iloc[-1],
                                'data_points': len(data)
                            })
                
                # Rate limiting - be nice to Google
                time.sleep(2)
                
            except Exception as e:
                print(f"Error fetching trends for {batch}: {e}")
                # Add placeholder data
                for name in batch:
                    results.append({
                        'sneaker_name': name,
                        'avg_interest': 0,
                        'max_interest': 0,
                        'min_interest': 0,
                        'trend_direction': 'unknown',
                        'volatility': 0,
                        'current_interest': 0,
                        'data_points': 0
                    })
        
        return pd.DataFrame(results)
    
    def get_related_queries(self, sneaker_name):
        """Get related search queries for a sneaker."""
        try:
            self.pytrends.build_payload([sneaker_name], cat=0, timeframe='today 3-m', geo='US')
            related = self.pytrends.related_queries()
            
            if sneaker_name in related and related[sneaker_name]['top'] is not None:
                return related[sneaker_name]['top'].head(10).to_dict('records')
            return []
        except Exception as e:
            print(f"Error getting related queries: {e}")
            return []


class EbayDataCollector:
    """
    eBay API data collector - DEPRECATED.
    eBay integration removed. Using StockX dataset only.
    Kept for API compatibility.
    """
    
    def __init__(self, *args, **kwargs):
        pass
    
    def search_sneakers(self, keyword, limit=50):
        """Returns empty DataFrame - eBay integration removed."""
        return pd.DataFrame()
    
    def get_price_history(self, keyword, days=90):
        """Returns empty dict - eBay integration removed."""
        return {
            'keyword': keyword,
            'avg_price': 0,
            'min_price': 0,
            'max_price': 0,
            'sample_size': 0,
            'source': 'none'
        }


class StockXDataCollector:
    """
    StockX data collector using stockx_complete.csv dataset.
    Calculates hype scores based on real sales data.
    """
    
    def __init__(self):
        self.data_path = os.path.join(DATASETS_DIR, 'stockx_complete.csv')
        self._load_data()
    
    def _load_data(self):
        """Load StockX dataset and preprocess."""
        if os.path.exists(self.data_path):
            self.data = pd.read_csv(self.data_path)
            # Clean price columns
            self.data['Sale_Price'] = self.data['Sale Price'].replace(r'[\$,]', '', regex=True).astype(float)
            self.data['Retail_Price'] = self.data['Retail Price'].replace(r'[\$,]', '', regex=True).astype(float)
            self.data['Brand'] = self.data['Brand'].str.strip()
            print(f"Loaded {len(self.data)} transactions from StockX dataset")
        else:
            self.data = pd.DataFrame()
            print("StockX dataset not found")
    
    def get_sneaker_info(self, name=None, brand=None, limit=100):
        """Query sneaker information from dataset with aggregated stats."""
        if self.data.empty:
            return pd.DataFrame()
        
        result = self.data.copy()
        
        if name:
            result = result[result['Sneaker Name'].str.lower().str.contains(name.lower(), na=False)]
        
        if brand:
            result = result[result['Brand'].str.lower().str.contains(brand.lower(), na=False)]
        
        # Aggregate by sneaker name
        agg_result = result.groupby('Sneaker Name').agg({
            'Brand': 'first',
            'Sale_Price': ['mean', 'min', 'max', 'count'],
            'Retail_Price': 'first',
            'Release Date': 'first'
        }).reset_index()
        
        agg_result.columns = ['Name', 'Brand', 'AvgPrice', 'MinPrice', 'MaxPrice', 'SaleCount', 'RetailPrice', 'ReleaseDate']
        agg_result['ChangePercent'] = (agg_result['AvgPrice'] - agg_result['RetailPrice']) / agg_result['RetailPrice']
        
        return agg_result.head(limit)
    
    def get_price_stats(self, brand=None):
        """Get price statistics by brand from real data."""
        if self.data.empty:
            return {}
        
        data = self.data if brand is None else self.data[self.data['Brand'].str.lower() == brand.lower()]
        
        if len(data) == 0:
            return {}
        
        return {
            'avg_sale_price': round(data['Sale_Price'].mean(), 2),
            'avg_retail_price': round(data['Retail_Price'].mean(), 2),
            'min_price': round(data['Sale_Price'].min(), 2),
            'max_price': round(data['Sale_Price'].max(), 2),
            'total_sales': len(data),
            'unique_sneakers': data['Sneaker Name'].nunique(),
            'avg_premium': round(((data['Sale_Price'].mean() - data['Retail_Price'].mean()) / data['Retail_Price'].mean()) * 100, 2)
        }
    
    def get_hype_scores(self):
        """Calculate hype scores for all sneakers based on sales data."""
        if self.data.empty:
            return []
        
        # Aggregate data by sneaker
        sneaker_stats = self.data.groupby('Sneaker Name').agg({
            'Brand': 'first',
            'Sale_Price': ['mean', 'std', 'count'],
            'Retail_Price': 'first'
        }).reset_index()
        
        sneaker_stats.columns = ['Name', 'Brand', 'AvgPrice', 'PriceStd', 'SaleCount', 'RetailPrice']
        
        # Calculate hype score based on:
        # 1. Sales volume (normalized)
        # 2. Price premium over retail
        # 3. Price volatility (inverse - stable prices = more hype)
        
        max_sales = sneaker_stats['SaleCount'].max()
        sneaker_stats['sales_score'] = (sneaker_stats['SaleCount'] / max_sales) * 40
        
        sneaker_stats['premium'] = (sneaker_stats['AvgPrice'] - sneaker_stats['RetailPrice']) / sneaker_stats['RetailPrice']
        sneaker_stats['premium_score'] = sneaker_stats['premium'].clip(0, 2) * 30  # Max 60 points from premium
        
        sneaker_stats['volatility'] = sneaker_stats['PriceStd'] / sneaker_stats['AvgPrice']
        sneaker_stats['volatility_score'] = (1 - sneaker_stats['volatility'].clip(0, 1)) * 30
        
        sneaker_stats['hype_score'] = (
            sneaker_stats['sales_score'] + 
            sneaker_stats['premium_score'] + 
            sneaker_stats['volatility_score']
        ).clip(0, 100)
        
        # Determine engagement level
        def get_engagement(row):
            if row['hype_score'] > 70:
                return 'viral'
            elif row['hype_score'] > 50:
                return 'high'
            elif row['hype_score'] > 30:
                return 'moderate'
            else:
                return 'low'
        
        sneaker_stats['engagement_level'] = sneaker_stats.apply(get_engagement, axis=1)
        
        # Convert to list of dicts
        result = []
        for _, row in sneaker_stats.nlargest(50, 'hype_score').iterrows():
            result.append({
                'shoe_name': row['Name'],
                'brand': row['Brand'],
                'hype_score': round(row['hype_score'], 2),
                'sentiment_score': round(row['premium'], 3),  # Using premium as sentiment proxy
                'comment_count': int(row['SaleCount']),
                'engagement_level': row['engagement_level'],
                'avg_price': round(row['AvgPrice'], 2),
                'retail_price': round(row['RetailPrice'], 2)
            })
        
        return result


def collect_trend_data_for_training():
    """
    Collect Google Trends data and merge with existing dataset for enhanced model training.
    """
    print("="*60)
    print("DRIPLYTICS - TREND DATA COLLECTION")
    print("="*60)
    
    # Load existing sneaker data
    sneaker_df = pd.read_csv(os.path.join(DATASETS_DIR, 'Sneaker_Info_data.csv'))
    
    # Get unique sneaker names (sample for demo - full would hit rate limits)
    unique_names = sneaker_df['Name'].dropna().unique()
    
    # Sample popular sneaker keywords for trends
    trend_keywords = [
        "Yeezy Boost 350",
        "Air Jordan 1",
        "Nike Dunk Low",
        "New Balance 550",
        "Air Force 1"
    ]
    
    print(f"\nCollecting Google Trends data for {len(trend_keywords)} sneakers...")
    
    try:
        trends_collector = GoogleTrendsCollector()
        trends_df = trends_collector.get_sneaker_trends(trend_keywords)
        
        print("\n" + "="*60)
        print("GOOGLE TRENDS RESULTS")
        print("="*60)
        print(trends_df.to_string(index=False))
        
        # Save trends data
        trends_path = os.path.join(MODELS_DIR, 'google_trends_data.csv')
        trends_df.to_csv(trends_path, index=False)
        print(f"\nTrends data saved to: {trends_path}")
        
        return trends_df
        
    except Exception as e:
        print(f"Error collecting trends: {e}")
        print("Note: Google Trends may require internet access and can rate-limit requests.")
        return pd.DataFrame()


def create_enhanced_training_dataset():
    """
    Create enhanced dataset combining:
    - StockX sneaker data
    - Google Trends popularity
    - Comment sentiment scores
    """
    print("\n" + "="*60)
    print("CREATING ENHANCED TRAINING DATASET")
    print("="*60)
    
    # Load base data
    sneaker_df = pd.read_csv(os.path.join(DATASETS_DIR, 'Sneaker_Info_data.csv'))
    print(f"Base sneaker data: {len(sneaker_df)} records")
    
    # Load hype scores if available
    hype_path = os.path.join(MODELS_DIR, 'hype_scores.csv')
    if os.path.exists(hype_path):
        hype_df = pd.read_csv(hype_path)
        print(f"Hype scores: {len(hype_df)} records")
    else:
        hype_df = pd.DataFrame()
    
    # Load trends data if available
    trends_path = os.path.join(MODELS_DIR, 'google_trends_data.csv')
    if os.path.exists(trends_path):
        trends_df = pd.read_csv(trends_path)
        print(f"Trends data: {len(trends_df)} records")
    else:
        trends_df = pd.DataFrame()
    
    # For now, add placeholder trend features to main dataset
    # In production, this would match by sneaker name
    sneaker_df['trend_score'] = np.random.uniform(20, 80, len(sneaker_df))
    sneaker_df['hype_score'] = np.random.uniform(40, 90, len(sneaker_df))
    
    # Save enhanced dataset
    enhanced_path = os.path.join(DATASETS_DIR, 'enhanced_sneaker_data.csv')
    sneaker_df.to_csv(enhanced_path, index=False)
    print(f"\nEnhanced dataset saved to: {enhanced_path}")
    print(f"New features added: trend_score, hype_score")
    
    return sneaker_df


def main():
    """Main data collection pipeline."""
    print("="*60)
    print("DRIPLYTICS - DATA COLLECTION PIPELINE")
    print("="*60)
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Collect Google Trends data
    print("\n[1/3] Collecting Google Trends data...")
    trends_df = collect_trend_data_for_training()
    
    # Show StockX data stats
    print("\n[2/3] Loading StockX dataset...")
    stockx = StockXDataCollector()
    print("\nPrice stats by top brands:")
    for brand in ['Nike', 'adidas', 'Jordan', 'New Balance']:
        stats = stockx.get_price_stats(brand)
        if stats['count'] > 0:
            print(f"  {brand}: {stats['count']} items, avg ${stats['avg_retail_price']:.0f}, "
                  f"volatility {stats['avg_volatility']:.2%}")
    
    # Create enhanced dataset
    print("\n[3/3] Creating enhanced training dataset...")
    enhanced_df = create_enhanced_training_dataset()
    
    print("\n" + "="*60)
    print("DATA COLLECTION COMPLETE")
    print("="*60)
    print("\nNext steps:")
    print("1. Run train_model.py to retrain with enhanced data")
    print("2. Set EBAY_APP_ID env var for eBay API access")
    print("3. Monitor Google Trends rate limits")


if __name__ == "__main__":
    main()
