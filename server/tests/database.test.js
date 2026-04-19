const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Message = require('../models/Message');

describe('Table 1 - Testing Database', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await Message.deleteMany({});
  });

  test('createConversationId is deterministic regardless of order', () => {
    const id1 = Message.createConversationId('user-b', 'user-a');
    const id2 = Message.createConversationId('user-a', 'user-b');
    expect(id1).toBe(id2);
  });

  test('can create and query message documents', async () => {
    const senderId = new mongoose.Types.ObjectId();
    const receiverId = new mongoose.Types.ObjectId();

    const msg = await Message.create({
      conversationId: Message.createConversationId(senderId.toString(), receiverId.toString()),
      senderId,
      senderUsername: 'sender',
      receiverId,
      receiverUsername: 'receiver',
      content: 'hello from test'
    });

    expect(msg._id).toBeDefined();

    const found = await Message.findOne({ conversationId: msg.conversationId });
    expect(found).not.toBeNull();
    expect(found.content).toBe('hello from test');

    const total = await Message.countDocuments({});
    expect(total).toBe(1);
  });
});
