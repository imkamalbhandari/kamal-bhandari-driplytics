"""
Driplytics - Live Social Data Collection
Collects real-time data from:
- Google Trends (search interest + related queries)
- Reddit (public JSON API - no auth needed)
- YouTube (public data via search)

For real-time hype/sentiment analysis.
"""

import requests
import time
import re
import os
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from typing import List, Dict, Optional

# Google Trends
try:
    from pytrends.request import TrendReq
    PYTRENDS_AVAILABLE = True
except ImportError:
    PYTRENDS_AVAILABLE = False
    print("pytrends not installed. Run: pip install pytrends")


class LiveGoogleTrends:
    """
    Collect live Google Trends data including:
    - Interest over time
    - Related queries (what people are searching for)
    - Related topics
    - Regional interest
    """
    
    def __init__(self):
        if not PYTRENDS_AVAILABLE:
            raise ImportError("pytrends is required")
        # Use simple initialization to avoid urllib3 compatibility issues
        try:
            self.pytrends = TrendReq(
                hl='en-US', 
                tz=360, 
                timeout=(10, 25)
            )
        except Exception as e:
            print(f"Google Trends init with timeout failed: {e}, trying simple init")
            self.pytrends = TrendReq(hl='en-US', tz=360)
        
    def get_live_interest(self, keyword: str, timeframe: str = 'now 7-d') -> Dict:
        """
        Get real-time interest data for a keyword.
        
        Timeframes:
        - 'now 1-H': Real-time (past hour)
        - 'now 4-H': Past 4 hours
        - 'now 1-d': Past day
        - 'now 7-d': Past 7 days
        - 'today 1-m': Past month
        - 'today 3-m': Past 3 months
        """
        try:
            self.pytrends.build_payload([keyword], cat=0, timeframe=timeframe, geo='US')
            
            # Get interest over time
            interest_df = self.pytrends.interest_over_time()
            
            if interest_df.empty:
                return {
                    'keyword': keyword,
                    'timeframe': timeframe,
                    'current_interest': 0,
                    'avg_interest': 0,
                    'max_interest': 0,
                    'trend_direction': 'unknown',
                    'data_points': []
                }
            
            data = interest_df[keyword]
            
            # Calculate trend direction
            if len(data) >= 2:
                recent = data.tail(len(data)//3).mean() if len(data) >= 3 else data.iloc[-1]
                earlier = data.head(len(data)//3).mean() if len(data) >= 3 else data.iloc[0]
                if recent > earlier * 1.1:
                    trend = 'rising'
                elif recent < earlier * 0.9:
                    trend = 'falling'
                else:
                    trend = 'stable'
            else:
                trend = 'unknown'
            
            return {
                'keyword': keyword,
                'timeframe': timeframe,
                'current_interest': int(data.iloc[-1]),
                'avg_interest': round(data.mean(), 2),
                'max_interest': int(data.max()),
                'min_interest': int(data.min()),
                'trend_direction': trend,
                'volatility': round(data.std(), 2),
                'data_points': [
                    {'date': str(idx), 'value': int(val)}
                    for idx, val in data.items()
                ][-50:]  # Last 50 points
            }
            
        except Exception as e:
            print(f"Error fetching Google Trends: {e}")
            return {'keyword': keyword, 'error': str(e)}
    
    def get_related_queries(self, keyword: str) -> Dict:
        """Get related search queries - shows what people are actually searching."""
        try:
            self.pytrends.build_payload([keyword], cat=0, timeframe='today 3-m', geo='US')
            related = self.pytrends.related_queries()
            
            result = {'keyword': keyword, 'top_queries': [], 'rising_queries': []}
            
            if keyword in related:
                if related[keyword]['top'] is not None:
                    result['top_queries'] = related[keyword]['top'].head(15).to_dict('records')
                if related[keyword]['rising'] is not None:
                    result['rising_queries'] = related[keyword]['rising'].head(15).to_dict('records')
            
            return result
            
        except Exception as e:
            return {'keyword': keyword, 'error': str(e)}
    
    def get_trending_sneakers(self) -> List[Dict]:
        """Get current trending sneaker searches."""
        sneaker_keywords = [
            'sneakers', 'nike shoes', 'jordan', 'yeezy', 'new balance'
        ]
        
        results = []
        for kw in sneaker_keywords:
            try:
                data = self.get_live_interest(kw, 'now 7-d')
                data['related'] = self.get_related_queries(kw)
                results.append(data)
                time.sleep(1)  # Rate limiting
            except Exception as e:
                print(f"Error for {kw}: {e}")
        
        return results


class RedditScraper:
    """
    Collect real-time Reddit discussions about sneakers.
    Uses Reddit's public JSON API (no auth needed for public data).
    """
    
    def __init__(self):
        self.headers = {
            'User-Agent': 'Driplytics/1.0 (Sneaker Analytics)'
        }
        self.subreddits = ['sneakers', 'Sneakerheads', 'SneakerDeals', 'streetwear']
    
    def get_subreddit_posts(self, subreddit: str, limit: int = 25, sort: str = 'hot') -> List[Dict]:
        """
        Get posts from a subreddit.
        
        Args:
            subreddit: Name of subreddit
            limit: Max posts (up to 100)
            sort: 'hot', 'new', 'top', 'rising'
        """
        try:
            url = f'https://www.reddit.com/r/{subreddit}/{sort}.json?limit={limit}'
            response = requests.get(url, headers=self.headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                posts = []
                
                for child in data.get('data', {}).get('children', []):
                    post_data = child.get('data', {})
                    posts.append({
                        'id': post_data.get('id'),
                        'title': post_data.get('title'),
                        'text': post_data.get('selftext', '')[:500],
                        'score': post_data.get('score', 0),
                        'upvote_ratio': post_data.get('upvote_ratio', 0),
                        'num_comments': post_data.get('num_comments', 0),
                        'created_utc': post_data.get('created_utc'),
                        'author': post_data.get('author'),
                        'url': f"https://reddit.com{post_data.get('permalink', '')}",
                        'subreddit': subreddit,
                        'flair': post_data.get('link_flair_text')
                    })
                
                return posts
            else:
                print(f"Reddit API error: {response.status_code}")
                return []
                
        except Exception as e:
            print(f"Error fetching Reddit: {e}")
            return []
    
    def get_post_comments(self, subreddit: str, post_id: str, limit: int = 50) -> List[Dict]:
        """Get comments from a specific post."""
        try:
            url = f'https://www.reddit.com/r/{subreddit}/comments/{post_id}.json?limit={limit}'
            response = requests.get(url, headers=self.headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                comments = []
                
                if len(data) > 1:
                    for child in data[1].get('data', {}).get('children', []):
                        comment_data = child.get('data', {})
                        if comment_data.get('body'):
                            comments.append({
                                'id': comment_data.get('id'),
                                'body': comment_data.get('body'),
                                'score': comment_data.get('score', 0),
                                'created_utc': comment_data.get('created_utc'),
                                'author': comment_data.get('author')
                            })
                
                return comments
            return []
            
        except Exception as e:
            print(f"Error fetching comments: {e}")
            return []
    
    def search_sneaker(self, sneaker_name: str, limit: int = 50) -> List[Dict]:
        """Search for a specific sneaker across sneaker subreddits."""
        all_posts = []
        
        for subreddit in self.subreddits:
            try:
                url = f'https://www.reddit.com/r/{subreddit}/search.json?q={requests.utils.quote(sneaker_name)}&restrict_sr=on&limit={limit//len(self.subreddits)}&sort=new'
                response = requests.get(url, headers=self.headers, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    for child in data.get('data', {}).get('children', []):
                        post_data = child.get('data', {})
                        all_posts.append({
                            'id': post_data.get('id'),
                            'title': post_data.get('title'),
                            'text': post_data.get('selftext', '')[:500],
                            'score': post_data.get('score', 0),
                            'num_comments': post_data.get('num_comments', 0),
                            'created_utc': post_data.get('created_utc'),
                            'subreddit': subreddit,
                            'url': f"https://reddit.com{post_data.get('permalink', '')}"
                        })
                
                time.sleep(1)  # Rate limiting
                
            except Exception as e:
                print(f"Error searching {subreddit}: {e}")
        
        return sorted(all_posts, key=lambda x: x.get('created_utc', 0), reverse=True)
    
    def get_live_discussions(self) -> Dict:
        """Get current hot discussions across all sneaker subreddits."""
        all_posts = []
        
        for subreddit in self.subreddits:
            posts = self.get_subreddit_posts(subreddit, limit=10, sort='hot')
            all_posts.extend(posts)
            time.sleep(0.5)
        
        # Sort by engagement (score + comments)
        all_posts.sort(key=lambda x: x.get('score', 0) + x.get('num_comments', 0) * 2, reverse=True)
        
        return {
            'timestamp': datetime.now().isoformat(),
            'total_posts': len(all_posts),
            'posts': all_posts[:30]  # Top 30
        }


class LiveSentimentAnalyzer:
    """Analyze sentiment from live social data."""
    
    # Sneaker-specific sentiment words
    POSITIVE = {
        'fire', 'amazing', 'love', 'great', 'awesome', 'clean', 'heat', 'dope',
        'sick', 'beautiful', 'perfect', 'best', 'incredible', 'stunning', 'lit',
        'grail', 'must', 'cop', 'want', 'need', 'nice', 'fresh', 'cool', 'legit',
        'hard', 'crazy', 'insane', 'underrated', 'gorgeous', 'sleek', 'w',
        'comfortable', 'comfy', 'quality', 'worth', 'favorite', 'classic', 'iconic',
        'slaps', 'hits', 'banger', 'goat', 'drip', 'flex', 'valid', 'gas', 'certified'
    }
    
    NEGATIVE = {
        'ugly', 'bad', 'hate', 'terrible', 'awful', 'trash', 'wack', 'boring',
        'overrated', 'overhyped', 'overpriced', 'fake', 'disappointing', 'meh',
        'pass', 'skip', 'waste', 'cheap', 'uncomfortable', 'wrong', 'worst',
        'garbage', 'horrible', 'disgusting', 'poor', 'mediocre', 'bland', 'l',
        'mid', 'dead', 'bricked', 'flop', 'resell', 'sits'
    }
    
    def clean_text(self, text: str) -> str:
        if not text:
            return ""
        text = str(text).lower()
        text = re.sub(r'http\S+|www\S+', '', text)
        text = re.sub(r'[^\w\s]', ' ', text)
        return text.strip()
    
    def analyze_text(self, text: str) -> Dict:
        """Analyze sentiment of a single text."""
        cleaned = self.clean_text(text)
        words = cleaned.split()
        
        positive_count = sum(1 for w in words if w in self.POSITIVE)
        negative_count = sum(1 for w in words if w in self.NEGATIVE)
        
        total = positive_count + negative_count
        if total == 0:
            sentiment = 0
        else:
            sentiment = (positive_count - negative_count) / total
        
        return {
            'sentiment_score': round(sentiment, 3),
            'positive_words': positive_count,
            'negative_words': negative_count,
            'label': 'positive' if sentiment > 0.1 else ('negative' if sentiment < -0.1 else 'neutral')
        }
    
    def analyze_reddit_posts(self, posts: List[Dict]) -> Dict:
        """Analyze sentiment across Reddit posts."""
        if not posts:
            return {'avg_sentiment': 0, 'total_analyzed': 0, 'breakdown': {}}
        
        sentiments = []
        labels = []
        
        for post in posts:
            text = f"{post.get('title', '')} {post.get('text', '')}"
            analysis = self.analyze_text(text)
            sentiments.append(analysis['sentiment_score'])
            labels.append(analysis['label'])
        
        from collections import Counter
        label_counts = Counter(labels)
        
        return {
            'avg_sentiment': round(np.mean(sentiments), 3) if sentiments else 0,
            'max_sentiment': round(max(sentiments), 3) if sentiments else 0,
            'min_sentiment': round(min(sentiments), 3) if sentiments else 0,
            'total_analyzed': len(posts),
            'breakdown': dict(label_counts),
            'sentiment_distribution': {
                'positive': label_counts.get('positive', 0) / len(posts) * 100 if posts else 0,
                'neutral': label_counts.get('neutral', 0) / len(posts) * 100 if posts else 0,
                'negative': label_counts.get('negative', 0) / len(posts) * 100 if posts else 0
            }
        }


class LiveDataCollector:
    """Main class to collect and combine live data from all sources."""
    
    def __init__(self):
        self.trends = LiveGoogleTrends() if PYTRENDS_AVAILABLE else None
        self.reddit = RedditScraper()
        self.sentiment = LiveSentimentAnalyzer()
    
    def get_sneaker_live_data(self, sneaker_name: str) -> Dict:
        """
        Get comprehensive live data for a sneaker.
        Combines Google Trends + Reddit discussions + Sentiment analysis.
        """
        result = {
            'sneaker_name': sneaker_name,
            'timestamp': datetime.now().isoformat(),
            'google_trends': None,
            'reddit': None,
            'sentiment': None,
            'hype_score': 50  # Default neutral
        }
        
        # Google Trends
        if self.trends:
            try:
                result['google_trends'] = {
                    'interest': self.trends.get_live_interest(sneaker_name, 'now 7-d'),
                    'related_queries': self.trends.get_related_queries(sneaker_name)
                }
            except Exception as e:
                result['google_trends'] = {'error': str(e)}
        
        # Reddit
        try:
            posts = self.reddit.search_sneaker(sneaker_name)
            result['reddit'] = {
                'posts_found': len(posts),
                'posts': posts[:20],  # Top 20 posts
                'sentiment': self.sentiment.analyze_reddit_posts(posts)
            }
        except Exception as e:
            result['reddit'] = {'error': str(e)}
        
        # Calculate overall hype score
        hype_score = self._calculate_hype_score(result)
        result['hype_score'] = hype_score
        
        return result
    
    def _calculate_hype_score(self, data: Dict) -> float:
        """Calculate hype score from collected data (0-100)."""
        score = 50  # Base neutral score
        
        # Google Trends contribution (0-30 points)
        if data.get('google_trends') and 'interest' in data['google_trends']:
            trends = data['google_trends']['interest']
            if 'avg_interest' in trends:
                # Higher interest = higher score
                score += min(30, trends['avg_interest'] * 0.3)
                
                # Trend direction bonus
                if trends.get('trend_direction') == 'rising':
                    score += 10
                elif trends.get('trend_direction') == 'falling':
                    score -= 5
        
        # Reddit contribution (0-30 points)
        if data.get('reddit') and 'sentiment' in data['reddit']:
            reddit = data['reddit']
            sentiment = reddit.get('sentiment', {})
            
            # Post count bonus
            post_count = reddit.get('posts_found', 0)
            score += min(15, post_count * 0.5)
            
            # Sentiment bonus
            avg_sentiment = sentiment.get('avg_sentiment', 0)
            score += avg_sentiment * 15  # -15 to +15
            
            # Engagement bonus from upvotes
            if reddit.get('posts'):
                avg_score = np.mean([p.get('score', 0) for p in reddit['posts']])
                score += min(10, avg_score / 10)
        
        return round(min(100, max(0, score)), 2)
    
    def get_trending_now(self) -> Dict:
        """Get what's trending right now in the sneaker world."""
        result = {
            'timestamp': datetime.now().isoformat(),
            'google_trends': None,
            'reddit_hot': None
        }
        
        if self.trends:
            result['google_trends'] = self.trends.get_trending_sneakers()
        
        result['reddit_hot'] = self.reddit.get_live_discussions()
        
        return result


def main():
    """Test live data collection."""
    print("="*60)
    print("DRIPLYTICS - LIVE DATA COLLECTION TEST")
    print("="*60)
    print(f"Timestamp: {datetime.now().isoformat()}")
    
    collector = LiveDataCollector()
    
    # Test sneaker search
    sneaker = "Air Jordan 1"
    print(f"\n[1] Fetching live data for: {sneaker}")
    print("-" * 40)
    
    data = collector.get_sneaker_live_data(sneaker)
    
    print(f"\nHype Score: {data['hype_score']}/100")
    
    if data.get('google_trends') and 'interest' in data['google_trends']:
        trends = data['google_trends']['interest']
        print(f"\nGoogle Trends:")
        print(f"  Current Interest: {trends.get('current_interest', 'N/A')}")
        print(f"  Trend Direction: {trends.get('trend_direction', 'N/A')}")
    
    if data.get('reddit'):
        reddit = data['reddit']
        print(f"\nReddit Discussion:")
        print(f"  Posts Found: {reddit.get('posts_found', 0)}")
        if reddit.get('sentiment'):
            sent = reddit['sentiment']
            print(f"  Avg Sentiment: {sent.get('avg_sentiment', 0)}")
            print(f"  Breakdown: {sent.get('breakdown', {})}")
    
    # Test trending
    print(f"\n[2] Fetching trending sneakers...")
    print("-" * 40)
    
    trending = collector.get_trending_now()
    
    if trending.get('reddit_hot'):
        hot = trending['reddit_hot']
        print(f"Hot Reddit Posts: {hot.get('total_posts', 0)}")
        for post in hot.get('posts', [])[:5]:
            print(f"  - {post.get('title', '')[:60]}... ({post.get('score', 0)} upvotes)")
    
    print("\n" + "="*60)
    print("LIVE DATA COLLECTION COMPLETE")
    print("="*60)


if __name__ == "__main__":
    main()
