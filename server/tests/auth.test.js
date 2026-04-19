const jwt = require('jsonwebtoken');

describe('Table 2 - Testing User Authentication Module', () => {
  const secret = 'test-auth-secret';

  beforeAll(() => {
    process.env.JWT_SECRET = secret;
  });

  test('returns 401 when token is missing', () => {
    jest.resetModules();
    const { authenticateToken } = require('../middleware/auth');

    const req = { headers: {} };
    const json = jest.fn();
    const res = { status: jest.fn(() => ({ json })) };
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ success: false, message: 'Access token required' });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 403 when token is invalid', () => {
    jest.resetModules();
    const { authenticateToken } = require('../middleware/auth');

    const req = { headers: { authorization: 'Bearer invalid.token.value' } };
    const json = jest.fn();
    const res = { status: jest.fn(() => ({ json })) };
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ success: false, message: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  test('accepts valid token and sets req.userId', () => {
    jest.resetModules();
    const { authenticateToken } = require('../middleware/auth');

    const token = jwt.sign({ userId: 'user-123' }, secret, { expiresIn: '1h' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = { status: jest.fn(() => ({ json: jest.fn() })) };
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(req.userId).toBe('user-123');
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('returns 401 when authorization header is empty', () => {
    jest.resetModules();
    const { authenticateToken } = require('../middleware/auth');

    const req = { headers: { authorization: '' } };
    const json = jest.fn();
    const res = { status: jest.fn(() => ({ json })) };
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ success: false, message: 'Access token required' });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when bearer token value is missing', () => {
    jest.resetModules();
    const { authenticateToken } = require('../middleware/auth');

    const req = { headers: { authorization: 'Bearer' } };
    const json = jest.fn();
    const res = { status: jest.fn(() => ({ json })) };
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ success: false, message: 'Access token required' });
    expect(next).not.toHaveBeenCalled();
  });

  test('accepts valid token even with lowercase bearer prefix', () => {
    jest.resetModules();
    const { authenticateToken } = require('../middleware/auth');

    const token = jwt.sign({ userId: 'user-lowercase' }, secret, { expiresIn: '1h' });
    const req = { headers: { authorization: `bearer ${token}` } };
    const res = { status: jest.fn(() => ({ json: jest.fn() })) };
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(req.userId).toBe('user-lowercase');
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('accepts valid token even with non-bearer scheme text', () => {
    jest.resetModules();
    const { authenticateToken } = require('../middleware/auth');

    const token = jwt.sign({ userId: 'user-basic-scheme' }, secret, { expiresIn: '1h' });
    const req = { headers: { authorization: `Basic ${token}` } };
    const res = { status: jest.fn(() => ({ json: jest.fn() })) };
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(req.userId).toBe('user-basic-scheme');
    expect(next).toHaveBeenCalledTimes(1);
  });
});
