"""
Driplytics - Sentiment Analysis for Sneaker Hype Scoring
Analyzes comments to generate hype/sentiment scores for sneakers.
"""

import pandas as pd
import numpy as np
import re
import os
import joblib
from collections import Counter

# Simple sentiment lexicon for sneaker-related terms
POSITIVE_WORDS = {
    'fire', 'amazing', 'love', 'great', 'awesome', 'clean', 'heat', 'dope',
    'sick', 'beautiful', 'perfect', 'best', 'incredible', 'stunning', 'lit',
    'grail', 'must', 'cop', 'want', 'need', 'nice', 'fresh', 'cool', 'legit',
    'hard', 'crazy', 'insane', 'underrated', 'slept', 'gorgeous', 'sleek',
    'comfortable', 'comfy', 'quality', 'worth', 'favorite', 'classic', 'iconic'
}

NEGATIVE_WORDS = {
    'ugly', 'bad', 'hate', 'terrible', 'awful', 'trash', 'wack', 'boring',
    'overrated', 'overhyped', 'overpriced', 'fake', 'disappointing', 'meh',
    'pass', 'skip', 'waste', 'cheap', 'uncomfortable', 'wrong', 'worst',
    'garbage', 'horrible', 'disgusting', 'poor', 'mediocre', 'bland'
}

HYPE_MULTIPLIERS = {
    'grail': 2.0,
    'must': 1.5,
    'need': 1.3,
    'fire': 1.5,
    'heat': 1.5,
    'insane': 1.4,
    'crazy': 1.3
}

def clean_text(text):
    """Clean and preprocess text."""
    if pd.isna(text):
        return ""
    text = str(text).lower()
    # Remove URLs
    text = re.sub(r'http\S+|www\S+', '', text)
    # Remove special characters but keep emojis context
    text = re.sub(r'[^\w\s]', ' ', text)
    return text.strip()

def analyze_sentiment(text):
    """
    Analyze sentiment of a single comment.
    Returns: sentiment score (-1 to 1) and hype multiplier
    """
    if not text:
        return 0, 1.0
    
    words = text.lower().split()
    
    positive_count = sum(1 for w in words if w in POSITIVE_WORDS)
    negative_count = sum(1 for w in words if w in NEGATIVE_WORDS)
    
    # Calculate hype multiplier
    hype_mult = 1.0
    for word in words:
        if word in HYPE_MULTIPLIERS:
            hype_mult = max(hype_mult, HYPE_MULTIPLIERS[word])
    
    # Calculate sentiment score
    total = positive_count + negative_count
    if total == 0:
        return 0, hype_mult
    
    sentiment = (positive_count - negative_count) / total
    return sentiment, hype_mult

def calculate_hype_score(comments_df, shoe_name):
    """
    Calculate hype score for a specific sneaker based on comments.
    
    Returns:
        dict with hype metrics
    """
    shoe_comments = comments_df[comments_df['ShoeName'].str.lower() == shoe_name.lower()]
    
    if len(shoe_comments) == 0:
        return {
            'shoe_name': shoe_name,
            'hype_score': 50,  # Neutral
            'sentiment_score': 0,
            'comment_count': 0,
            'engagement_level': 'unknown'
        }
    
    sentiments = []
    hype_multipliers = []
    
    for comment in shoe_comments['Comments']:
        cleaned = clean_text(comment)
        sentiment, hype_mult = analyze_sentiment(cleaned)
        sentiments.append(sentiment)
        hype_multipliers.append(hype_mult)
    
    avg_sentiment = np.mean(sentiments) if sentiments else 0
    avg_hype_mult = np.mean(hype_multipliers) if hype_multipliers else 1.0
    comment_count = len(shoe_comments)
    
    # Calculate base hype score (0-100)
    # Sentiment contributes to direction, comment count to magnitude
    base_score = 50 + (avg_sentiment * 30)  # -30 to +30 from sentiment
    
    # Engagement bonus (more comments = more hype)
    engagement_bonus = min(20, np.log1p(comment_count) * 5)
    
    # Apply hype multiplier
    hype_score = min(100, max(0, (base_score + engagement_bonus) * avg_hype_mult))
    
    # Determine engagement level
    if comment_count >= 50:
        engagement = 'viral'
    elif comment_count >= 20:
        engagement = 'high'
    elif comment_count >= 10:
        engagement = 'moderate'
    elif comment_count >= 5:
        engagement = 'low'
    else:
        engagement = 'minimal'
    
    return {
        'shoe_name': shoe_name,
        'hype_score': round(hype_score, 2),
        'sentiment_score': round(avg_sentiment, 3),
        'comment_count': comment_count,
        'engagement_level': engagement,
        'avg_hype_multiplier': round(avg_hype_mult, 2)
    }

def analyze_all_sneakers(comments_path):
    """Analyze sentiment for all sneakers in the dataset."""
    print("Loading comments dataset...")
    comments_df = pd.read_csv(comments_path)
    print(f"Loaded {len(comments_df)} comments")
    
    # Get unique sneakers
    sneakers = comments_df['ShoeName'].unique()
    print(f"Found {len(sneakers)} unique sneakers")
    
    results = []
    for shoe in sneakers:
        result = calculate_hype_score(comments_df, shoe)
        results.append(result)
    
    # Create results dataframe
    results_df = pd.DataFrame(results)
    results_df = results_df.sort_values('hype_score', ascending=False)
    
    return results_df, comments_df

def main():
    """Main function to run sentiment analysis."""
    print("="*50)
    print("DRIPLYTICS - SNEAKER HYPE ANALYSIS")
    print("="*50)
    
    comments_path = os.path.join(os.path.dirname(__file__), 'datasets', 'Comments_on_30sample.csv')
    
    results_df, comments_df = analyze_all_sneakers(comments_path)
    
    print("\n" + "="*50)
    print("TOP 10 SNEAKERS BY HYPE SCORE")
    print("="*50)
    print(results_df.head(10).to_string(index=False))
    
    print("\n" + "="*50)
    print("BOTTOM 5 SNEAKERS BY HYPE SCORE")
    print("="*50)
    print(results_df.tail(5).to_string(index=False))
    
    # Save results
    models_dir = os.path.join(os.path.dirname(__file__), 'models')
    os.makedirs(models_dir, exist_ok=True)
    
    results_path = os.path.join(models_dir, 'hype_scores.csv')
    results_df.to_csv(results_path, index=False)
    print(f"\nHype scores saved to: {results_path}")
    
    # Save comments dataframe for API use
    joblib.dump(comments_df, os.path.join(models_dir, 'comments_data.pkl'))
    
    return results_df

if __name__ == "__main__":
    main()
