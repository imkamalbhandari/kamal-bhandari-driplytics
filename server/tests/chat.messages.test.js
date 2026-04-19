const express = require('express');
const request = require('supertest');

jest.mock('../middleware/auth', () => ({
  authenticateToken: (req, _res, next) => {
    req.userId = 'user1';
    next();
  }
}));

jest.mock('../models/User', () => ({
  findById: jest.fn()
}));

jest.mock('../models/Listing', () => ({
  findById: jest.fn()
}));

jest.mock('../models/Message', () => {
  const saveMock = jest.fn().mockResolvedValue(undefined);
  const Message = jest.fn().mockImplementation((data) => ({
    ...data,
    _id: 'msg1',
    read: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    save: saveMock
  }));

  Message.createConversationId = jest.fn(() => 'user1_user2');
  Message.__saveMock = saveMock;
  return Message;
});

const User = require('../models/User');
const Listing = require('../models/Listing');
const Message = require('../models/Message');
const chatRouter = require('../routes/chat');

describe('Table 3 - Testing Chat Message Validation Module', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/chat', chatRouter);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('rejects missing receiver/content', async () => {
    const res = await request(app).post('/api/chat/messages').send({ content: 'hi' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Receiver and content are required');
  });

  test('rejects too long message content', async () => {
    const res = await request(app)
      .post('/api/chat/messages')
      .send({ receiverId: 'user2', content: 'a'.repeat(2001) });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Message too long (max 2000 characters)');
  });

  test('rejects sending message to yourself', async () => {
    const res = await request(app)
      .post('/api/chat/messages')
      .send({ receiverId: 'user1', content: 'self message' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Cannot send message to yourself');
  });

  test('returns 404 when receiver does not exist', async () => {
    User.findById.mockImplementation((id) => ({
      select: jest.fn().mockResolvedValue(id === 'user1' ? { _id: 'user1', username: 'alice' } : null)
    }));

    const res = await request(app)
      .post('/api/chat/messages')
      .send({ receiverId: 'user2', content: 'hello' });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('User not found');
  });

  test('sends valid message successfully', async () => {
    User.findById.mockImplementation((id) => ({
      select: jest.fn().mockResolvedValue({ _id: id, username: id === 'user1' ? 'alice' : 'bob' })
    }));
    Listing.findById.mockImplementation(() => ({
      select: jest.fn().mockResolvedValue({ _id: 'listing1', name: 'Sneaker X' })
    }));

    const res = await request(app)
      .post('/api/chat/messages')
      .send({ receiverId: 'user2', content: '  hello bob  ', listingId: 'listing1' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.content).toBe('hello bob');
    expect(Message.createConversationId).toHaveBeenCalledWith('user1', 'user2');
    expect(Message.__saveMock).toHaveBeenCalledTimes(1);
  });
});
