const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Message = require('../models/Message');
const User = require('../models/User');
const Listing = require('../models/Listing');
const { authenticateToken } = require('../middleware/auth');

const toObjectId = (id) => new mongoose.Types.ObjectId(id);

/**
 * Get all conversations for the current user
 * GET /api/chat/conversations
 */
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;

    // Get all unique conversations for this user
    const messages = await Message.aggregate([
      {
        $match: {
          $or: [
            { senderId: toObjectId(userId) },
            { receiverId: toObjectId(userId) }
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: '$conversationId',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$receiverId', toObjectId(userId)] },
                    { $eq: ['$read', false] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $sort: { 'lastMessage.createdAt': -1 }
      }
    ]);

    // Format conversations with other user info
    const conversations = await Promise.all(messages.map(async (conv) => {
      const otherUserId = conv.lastMessage.senderId.toString() === userId 
        ? conv.lastMessage.receiverId 
        : conv.lastMessage.senderId;
      
      const otherUser = await User.findById(otherUserId).select('username email');
      
      return {
        conversationId: conv._id,
        otherUser: otherUser ? {
          id: otherUser._id,
          username: otherUser.username
        } : null,
        lastMessage: {
          content: conv.lastMessage.content,
          senderId: conv.lastMessage.senderId,
          createdAt: conv.lastMessage.createdAt
        },
        listingId: conv.lastMessage.listingId,
        listingName: conv.lastMessage.listingName,
        unreadCount: conv.unreadCount
      };
    }));

    res.json({
      success: true,
      data: conversations
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ success: false, message: 'Error fetching conversations' });
  }
});

/**
 * Get messages for a specific conversation
 * GET /api/chat/messages/:conversationId
 */
router.get('/messages/:conversationId', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Verify user is part of this conversation
    const userIds = conversationId.split('_');
    if (!userIds.includes(userId)) {
      return res.status(403).json({ success: false, message: 'Access denied to this conversation' });
    }

    const messages = await Message.find({ conversationId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Message.countDocuments({ conversationId });

    // Mark messages as read where current user is receiver
    await Message.updateMany(
      { conversationId, receiverId: userId, read: false },
      { read: true }
    );

    res.json({
      success: true,
      data: messages.reverse(), // Return in chronological order
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, message: 'Error fetching messages' });
  }
});

/**
 * Send a message
 * POST /api/chat/messages
 */
router.post('/messages', authenticateToken, async (req, res) => {
  try {
    const senderId = req.userId;
    const { receiverId, content, listingId } = req.body;

    if (!receiverId || !content) {
      return res.status(400).json({ success: false, message: 'Receiver and content are required' });
    }

    if (content.length > 2000) {
      return res.status(400).json({ success: false, message: 'Message too long (max 2000 characters)' });
    }

    // Prevent messaging yourself
    if (senderId === receiverId) {
      return res.status(400).json({ success: false, message: 'Cannot send message to yourself' });
    }

    // Get sender and receiver info
    const [sender, receiver] = await Promise.all([
      User.findById(senderId).select('username'),
      User.findById(receiverId).select('username')
    ]);

    if (!sender || !receiver) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Get listing info if provided
    let listing = null;
    if (listingId) {
      listing = await Listing.findById(listingId).select('name');
    }

    const conversationId = Message.createConversationId(senderId, receiverId);

    const message = new Message({
      conversationId,
      senderId,
      senderUsername: sender.username,
      receiverId,
      receiverUsername: receiver.username,
      listingId: listingId || null,
      listingName: listing?.name || null,
      content: content.trim()
    });

    await message.save();

    // Emit socket event for real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(receiverId).emit('newMessage', {
        conversationId,
        message: {
          _id: message._id,
          senderId: message.senderId,
          senderUsername: message.senderUsername,
          receiverId: message.receiverId,
          receiverUsername: message.receiverUsername,
          content: message.content,
          listingId: message.listingId,
          listingName: message.listingName,
          read: message.read,
          createdAt: message.createdAt
        }
      });
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: message
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, message: 'Error sending message' });
  }
});

/**
 * Start or get conversation with a user (optionally about a listing)
 * POST /api/chat/start
 */
router.post('/start', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { receiverId, listingId } = req.body;

    if (!receiverId) {
      return res.status(400).json({ success: false, message: 'Receiver ID is required' });
    }

    if (userId === receiverId) {
      return res.status(400).json({ success: false, message: 'Cannot start conversation with yourself' });
    }

    const [currentUser, otherUser] = await Promise.all([
      User.findById(userId).select('username'),
      User.findById(receiverId).select('username')
    ]);

    if (!currentUser || !otherUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let listing = null;
    if (listingId) {
      listing = await Listing.findById(listingId).select('name brand askingPrice');
    }

    const conversationId = Message.createConversationId(userId, receiverId);

    // Check if conversation already exists
    const existingMessages = await Message.findOne({ conversationId });

    res.json({
      success: true,
      data: {
        conversationId,
        otherUser: {
          id: otherUser._id,
          username: otherUser.username
        },
        listing: listing ? {
          id: listing._id,
          name: listing.name,
          brand: listing.brand,
          askingPrice: listing.askingPrice
        } : null,
        isNew: !existingMessages
      }
    });
  } catch (error) {
    console.error('Start conversation error:', error);
    res.status(500).json({ success: false, message: 'Error starting conversation' });
  }
});

/**
 * Mark messages as read
 * PUT /api/chat/read/:conversationId
 */
router.put('/read/:conversationId', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { conversationId } = req.params;

    await Message.updateMany(
      { conversationId, receiverId: userId, read: false },
      { read: true }
    );

    res.json({
      success: true,
      message: 'Messages marked as read'
    });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ success: false, message: 'Error marking messages as read' });
  }
});

/**
 * Get unread message count
 * GET /api/chat/unread
 */
router.get('/unread', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;

    const unreadCount = await Message.countDocuments({
      receiverId: userId,
      read: false
    });

    res.json({
      success: true,
      data: { unreadCount }
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ success: false, message: 'Error fetching unread count' });
  }
});

/**
 * Delete a conversation
 * DELETE /api/chat/conversations/:conversationId
 */
router.delete('/conversations/:conversationId', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { conversationId } = req.params;

    // Verify user is part of this conversation
    const userIds = conversationId.split('_');
    if (!userIds.includes(userId)) {
      return res.status(403).json({ success: false, message: 'Access denied to this conversation' });
    }

    await Message.deleteMany({ conversationId });

    res.json({
      success: true,
      message: 'Conversation deleted successfully'
    });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ success: false, message: 'Error deleting conversation' });
  }
});

module.exports = router;
