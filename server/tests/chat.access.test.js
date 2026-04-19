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

jest.mock('../models/Message', () => ({
  find: jest.fn(),
  countDocuments: jest.fn(),
  updateMany: jest.fn(),
  deleteMany: jest.fn(),
  createConversationId: jest.fn((a, b) => [a, b].sort().join('_'))
}));

const Message = require('../models/Message');
const chatRouter = require('../routes/chat');

describe('Table 4 - Testing Conversation Access Control Module', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/chat', chatRouter);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('denies access to conversation not containing current user', async () => {
    const res = await request(app).get('/api/chat/messages/user2_user3');
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Access denied to this conversation');
  });

  test('allows access when user is in conversation', async () => {
    const messagesQuery = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([
        { content: 'newer', createdAt: new Date('2026-01-02') },
        { content: 'older', createdAt: new Date('2026-01-01') }
      ])
    };

    Message.find.mockReturnValue(messagesQuery);
    Message.countDocuments.mockResolvedValue(2);
    Message.updateMany.mockResolvedValue({ acknowledged: true, modifiedCount: 1 });

    const res = await request(app).get('/api/chat/messages/user1_user2?page=1&limit=50');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0].content).toBe('older');
    expect(res.body.pagination.total).toBe(2);
    expect(Message.updateMany).toHaveBeenCalledWith(
      { conversationId: 'user1_user2', receiverId: 'user1', read: false },
      { read: true }
    );
  });

  test('denies deleting conversation not containing current user', async () => {
    const res = await request(app).delete('/api/chat/conversations/user2_user3');
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Access denied to this conversation');
  });

  test('allows deleting conversation containing current user', async () => {
    Message.deleteMany.mockResolvedValue({ acknowledged: true, deletedCount: 4 });

    const res = await request(app).delete('/api/chat/conversations/user1_user2');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Conversation deleted successfully');
    expect(Message.deleteMany).toHaveBeenCalledWith({ conversationId: 'user1_user2' });
  });
});
