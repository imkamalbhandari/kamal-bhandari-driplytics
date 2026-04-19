from datetime import datetime

import numpy as np

from ensemble_price_predictor import EnsemblePricePredictor


class DummyEncoder:
    def __init__(self, classes):
        self.classes_ = np.array(classes)

    def transform(self, values):
        mapping = {v: i for i, v in enumerate(self.classes_)}
        return np.array([mapping.get(values[0], 0)])


class DummyScaler:
    def transform(self, x):
        return x


def _predictor_with_stubbed_load(monkeypatch):
    def fake_load_models(self):
        self.models = {
            'random_forest': object(),
            'gradient_boosting': object(),
        }
        self.encoders = {
            'brand': DummyEncoder(['Yeezy', 'Nike', 'Adidas']),
            'region': DummyEncoder(['California', 'New York']),
        }
        self.scaler = DummyScaler()
        self.feature_columns = []
        self.metadata = {}
        self.loaded = True

    monkeypatch.setattr(EnsemblePricePredictor, 'load_models', fake_load_models)
    return EnsemblePricePredictor()


def test_prepare_features_returns_expected_shape(monkeypatch):
    predictor = _predictor_with_stubbed_load(monkeypatch)

    features = predictor.prepare_features(
        {
            'brand': 'Nike',
            'retail_price': 200,
            'release_date': '2024-01-01',
            'shoe_size': 10,
            'region': 'California',
        }
    )

    assert features.shape == (1, 9)
    assert features[0][2] == 200


def test_calculate_ensemble_prediction_returns_positive_price(monkeypatch):
    predictor = _predictor_with_stubbed_load(monkeypatch)

    ml_predictions = {
        'random_forest': {
            'predicted_price': 300,
            'confidence': 0.9,
            'weight': 0.35,
            'model_type': 'Tree-based Ensemble',
        },
        'gradient_boosting': {
            'predicted_price': 320,
            'confidence': 0.85,
            'weight': 0.30,
            'model_type': 'Boosted Trees',
        },
    }

    result = predictor.calculate_ensemble_prediction(
        ml_predictions=ml_predictions,
        prophet_prediction=None,
        sentiment={
            'adjustment_factor': 1.0,
            'hype_score': 50,
            'sentiment_score': 0,
            'source': 'default',
            'sample_size': 0,
            'model_type': 'Sentiment Analysis',
            'weight': 0.05,
        },
        trends={
            'adjustment_factor': 1.0,
            'current_interest': 50,
            'trend_direction': 'stable',
            'model_type': 'Google Trends',
            'weight': 0.02,
        },
        groq_analysis=None,
        retail_price=220,
    )

    assert result['best_predicted_price'] > 0
    assert result['price_range']['low'] <= result['price_range']['mid'] <= result['price_range']['high']
    assert 0.6 <= result['overall_confidence'] <= 0.95


def test_get_recommendation_for_high_growth(monkeypatch):
    predictor = _predictor_with_stubbed_load(monkeypatch)

    rec = predictor.get_recommendation(price_change_pct=80, confidence=0.92)

    assert rec['action'] == 'STRONG BUY'
    assert rec['risk_level'] == 'Low'


def test_predict_best_price_success_with_stubbed_methods(monkeypatch):
    predictor = _predictor_with_stubbed_load(monkeypatch)

    monkeypatch.setattr(
        predictor,
        'predict_with_ml_models',
        lambda _features: {
            'random_forest': {
                'predicted_price': 300,
                'confidence': 0.9,
                'weight': 0.35,
                'model_type': 'Tree-based Ensemble',
            }
        },
    )
    monkeypatch.setattr(predictor, 'predict_with_prophet', lambda _name, _retail: None)
    monkeypatch.setattr(
        predictor,
        'get_sentiment_adjustment',
        lambda _name: {
            'sentiment_score': 0,
            'hype_score': 50,
            'adjustment_factor': 1.0,
            'sample_size': 0,
            'source': 'default',
            'weight': 0.05,
            'model_type': 'Sentiment Analysis',
        },
    )
    monkeypatch.setattr(
        predictor,
        'get_trends_adjustment',
        lambda _name: {
            'current_interest': 50,
            'avg_interest': 50,
            'trend_direction': 'stable',
            'adjustment_factor': 1.0,
            'weight': 0.02,
            'model_type': 'Google Trends',
        },
    )
    monkeypatch.setattr(predictor, 'get_groq_analysis', lambda _data, _ml: None)

    result = predictor.predict_best_price(
        {
            'sneaker_name': 'Test Sneaker',
            'brand': 'Nike',
            'retail_price': 220,
            'release_date': datetime.now().strftime('%Y-%m-%d'),
            'shoe_size': 10,
            'region': 'California',
        },
        include_sentiment=True,
        include_trends=True,
        include_groq=False,
    )

    assert result['success'] is True
    assert result['prediction']['best_predicted_price'] > 0
    assert 'recommendation' in result
