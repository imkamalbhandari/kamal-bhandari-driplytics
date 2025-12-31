"""
Sneaker Image Service
Provides sneaker images using DiceBear avatars as unique placeholders.
"""

import os
import hashlib
from typing import Optional, List, Dict
from urllib.parse import quote

# Base path for sneaker images
DATASETS_DIR = os.path.join(os.path.dirname(__file__), 'datasets')
IMAGES_DIR = os.path.join(DATASETS_DIR, 'sneaker_images')


def get_sneaker_image_url(sneaker_name: str, base_url: str = None) -> str:
    """
    Get an image URL for a sneaker using DiceBear initials avatar.
    Creates a unique, visually appealing placeholder based on sneaker name.
    
    Args:
        sneaker_name: Name of the sneaker
        base_url: Not used, kept for compatibility
        
    Returns:
        URL to sneaker image placeholder
    """
    name_lower = sneaker_name.lower()
    
    # First check if local image exists
    local_filename = sneaker_name.replace(' ', '-').replace('/', '-')
    local_path = os.path.join(IMAGES_DIR, f"{local_filename}.jpg")
    if os.path.exists(local_path):
        return f"/api/sneakers/local-image/{quote(local_filename)}.jpg"
    
    # Generate a unique seed from sneaker name for consistent colors
    seed = hashlib.md5(sneaker_name.encode()).hexdigest()
    
    # Determine brand colors and initials
    if 'yeezy' in name_lower or 'adidas' in name_lower:
        bg_color = '1a1a1a'
        # Extract model number or key identifier
        if '350' in name_lower:
            initials = '350'
        elif '700' in name_lower:
            initials = '700'
        elif '500' in name_lower:
            initials = '500'
        else:
            initials = 'YZY'
    elif 'off-white' in name_lower or 'off white' in name_lower:
        bg_color = 'f5f5dc'
        initials = 'OW'
    elif 'jordan' in name_lower:
        bg_color = 'cc0000'
        if '1' in name_lower and 'high' in name_lower:
            initials = 'AJ1'
        elif '4' in name_lower:
            initials = 'AJ4'
        elif '11' in name_lower:
            initials = 'AJ11'
        else:
            initials = 'AIR'
    elif 'nike' in name_lower:
        bg_color = '111111'
        if 'dunk' in name_lower:
            initials = 'DNK'
        elif 'air force' in name_lower:
            initials = 'AF1'
        elif 'air max' in name_lower:
            initials = 'MAX'
        else:
            initials = 'NK'
    else:
        bg_color = seed[:6]
        # Get initials from first letters of words
        words = sneaker_name.replace('-', ' ').replace('_', ' ').split()
        initials = ''.join(w[0].upper() for w in words[:3] if w)
    
    # Use UI Avatars API for nice looking placeholders
    # This creates rounded, professional looking placeholders with initials
    encoded_name = quote(initials)
    image_url = f"https://ui-avatars.com/api/?name={encoded_name}&background={bg_color}&color=fff&size=400&font-size=0.4&bold=true&format=png"
    
    return image_url


def get_all_images_for_sneaker(sneaker_name: str, limit: int = 10) -> List[str]:
    """Get multiple image URLs for a sneaker."""
    return [get_sneaker_image_url(sneaker_name)]


def get_sneaker_categories_info() -> List[Dict]:
    """Get information about available sneaker categories."""
    return [
        {
            'folder': 'yeezy',
            'name': 'Yeezy',
            'brand': 'Yeezy',
            'image_count': 50,
            'sample_image': get_sneaker_image_url('Yeezy Boost 350')
        },
        {
            'folder': 'off-white',
            'name': 'Off-White',
            'brand': 'Off-White',
            'image_count': 50,
            'sample_image': get_sneaker_image_url('Off-White Nike')
        }
    ]


def get_available_categories() -> List[str]:
    """Get list of available categories."""
    return ['yeezy', 'off-white']
