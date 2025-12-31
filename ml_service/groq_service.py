"""
Groq LLM Service for Smart Natural Language Search
Uses Groq's fast LLM to interpret natural language queries and extract search parameters.
"""

import os
import json
import requests
from typing import Dict, Any, Optional

# Groq API Configuration
GROQ_API_KEY = os.environ.get('GROQ_API_KEY')
GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

# Available brands in our dataset
AVAILABLE_BRANDS = [
    'Nike', 'Jordan', 'Adidas', 'Yeezy', 'New Balance', 'Puma', 
    'Reebok', 'Converse', 'Vans', 'Asics', 'Under Armour', 'Balenciaga'
]

def parse_natural_language_query(query: str) -> Dict[str, Any]:
    """
    Use Groq LLM to parse natural language sneaker search query.
    
    Examples:
    - "Show me Jordans under $200" -> {brand: "Jordan", max_price: 200}
    - "Find rare Nike dunks going up" -> {brand: "Nike", name: "dunk", trend: "up"}
    - "Cheap Yeezys for men" -> {brand: "Yeezy", gender: "men", price_range: "low"}
    
    Returns:
        Dict with extracted search parameters
    """
    
    system_prompt = f"""You are a sneaker search assistant. Parse the user's natural language query and extract search parameters.

Available brands: {', '.join(AVAILABLE_BRANDS)}

Return a JSON object with these optional fields:
- "brand": string (one of the available brands, or null)
- "name": string (specific sneaker name/model to search for, or null)
- "min_price": number (minimum price in USD, or null)
- "max_price": number (maximum price in USD, or null)
- "gender": string ("men", "women", "unisex", or null)
- "trend": string ("up" for increasing prices, "down" for decreasing, or null)
- "price_range": string ("low" for budget, "mid" for moderate, "high" for expensive, or null)
- "sort_by": string ("price_low", "price_high", "trending", "newest", or null)
- "keywords": array of strings (additional search keywords)
- "intent": string (brief description of what user wants)

Only include fields that are clearly indicated in the query. Return valid JSON only."""

    user_prompt = f"Parse this sneaker search query: \"{query}\""
    
    try:
        response = requests.post(
            GROQ_API_URL,
            headers={
                'Authorization': f'Bearer {GROQ_API_KEY}',
                'Content-Type': 'application/json'
            },
            json={
                'model': 'llama-3.1-70b-versatile',
                'messages': [
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': user_prompt}
                ],
                'temperature': 0.1,
                'max_tokens': 500
            },
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            content = result['choices'][0]['message']['content']
            
            # Parse JSON from response
            # Handle markdown code blocks if present
            if '```json' in content:
                content = content.split('```json')[1].split('```')[0]
            elif '```' in content:
                content = content.split('```')[1].split('```')[0]
            
            parsed = json.loads(content.strip())
            parsed['original_query'] = query
            parsed['parsed_successfully'] = True
            return parsed
        else:
            print(f"Groq API error: {response.status_code} - {response.text}")
            return {
                'original_query': query,
                'parsed_successfully': False,
                'error': f"API error: {response.status_code}"
            }
            
    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}")
        return {
            'original_query': query,
            'parsed_successfully': False,
            'keywords': [query],
            'error': 'Failed to parse LLM response'
        }
    except Exception as e:
        print(f"Groq service error: {e}")
        return {
            'original_query': query,
            'parsed_successfully': False,
            'keywords': [query],
            'error': str(e)
        }


def generate_search_summary(results: list, query: str) -> str:
    """
    Generate a natural language summary of search results using Groq.
    
    Args:
        results: List of sneaker results
        query: Original search query
        
    Returns:
        Natural language summary string
    """
    
    if not results:
        return f"No sneakers found matching '{query}'. Try a different search term."
    
    # Prepare summary data
    result_count = len(results)
    brands = list(set([r.get('brand', 'Unknown') for r in results[:10]]))
    prices = [r.get('resalePrice') or r.get('price', 0) for r in results[:10] if r.get('resalePrice') or r.get('price')]
    avg_price = sum(prices) / len(prices) if prices else 0
    min_price = min(prices) if prices else 0
    max_price = max(prices) if prices else 0
    
    summary_data = {
        'count': result_count,
        'brands': brands[:5],
        'avg_price': round(avg_price, 2),
        'min_price': round(min_price, 2),
        'max_price': round(max_price, 2),
        'top_results': [r.get('name', 'Unknown')[:50] for r in results[:3]]
    }
    
    try:
        response = requests.post(
            GROQ_API_URL,
            headers={
                'Authorization': f'Bearer {GROQ_API_KEY}',
                'Content-Type': 'application/json'
            },
            json={
                'model': 'llama-3.1-8b-instant',
                'messages': [
                    {
                        'role': 'system', 
                        'content': 'You are a sneaker expert. Generate a brief, friendly 1-2 sentence summary of search results. Be concise and helpful.'
                    },
                    {
                        'role': 'user', 
                        'content': f"Search query: '{query}'\nResults: {json.dumps(summary_data)}\n\nGenerate a brief summary."
                    }
                ],
                'temperature': 0.7,
                'max_tokens': 100
            },
            timeout=5
        )
        
        if response.status_code == 200:
            result = response.json()
            return result['choices'][0]['message']['content'].strip()
        
    except Exception as e:
        print(f"Summary generation error: {e}")
    
    # Fallback summary
    return f"Found {result_count} sneakers matching your search. Prices range from ${min_price:.0f} to ${max_price:.0f}."


def get_sneaker_recommendation(user_preferences: Dict[str, Any]) -> str:
    """
    Get personalized sneaker recommendations based on user preferences.
    
    Args:
        user_preferences: Dict with user's favorites, budget, style preferences
        
    Returns:
        Recommendation text
    """
    
    try:
        response = requests.post(
            GROQ_API_URL,
            headers={
                'Authorization': f'Bearer {GROQ_API_KEY}',
                'Content-Type': 'application/json'
            },
            json={
                'model': 'llama-3.1-70b-versatile',
                'messages': [
                    {
                        'role': 'system',
                        'content': '''You are a sneaker expert and investment advisor. Based on user preferences, 
                        provide 2-3 specific sneaker recommendations with brief reasoning. 
                        Focus on resale value potential and style. Be concise.'''
                    },
                    {
                        'role': 'user',
                        'content': f"User preferences: {json.dumps(user_preferences)}\n\nWhat sneakers would you recommend?"
                    }
                ],
                'temperature': 0.7,
                'max_tokens': 300
            },
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            return result['choices'][0]['message']['content'].strip()
            
    except Exception as e:
        print(f"Recommendation error: {e}")
    
    return "Based on current trends, consider looking at Jordan 1 Retros and Nike Dunk Lows for solid resale potential."


# Test function
if __name__ == '__main__':
    # Test natural language parsing
    test_queries = [
        "Show me Jordans under $200",
        "Find rare Nike dunks that are going up in price",
        "Cheap Yeezys for men",
        "Most expensive Balenciaga sneakers",
        "Trending sneakers this week"
    ]
    
    print("Testing Natural Language Search Parser\n" + "="*50)
    for query in test_queries:
        print(f"\nQuery: {query}")
        result = parse_natural_language_query(query)
        print(f"Parsed: {json.dumps(result, indent=2)}")
