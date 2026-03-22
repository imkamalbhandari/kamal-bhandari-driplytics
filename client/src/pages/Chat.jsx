import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Layout from '../components/layout/Layout';
import { chatAPI } from '../services/api';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

function Chat() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const inputRef = useRef(null);

  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [pendingConversation, setPendingConversation] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // Capture URL params immediately on first render (survives StrictMode remount)
  const chatParamsRef = useRef(null);
  if (chatParamsRef.current === null) {
    const params = new URLSearchParams(window.location.search);
    chatParamsRef.current = {
      userId: params.get('user'),
      listingId: params.get('listing')
    };
  }

  // Initialize socket connection
  useEffect(() => {
    socketRef.current = io(SOCKET_URL);

    if (user.id) {
      socketRef.current.emit('join', user.id);
    }

    socketRef.current.on('newMessage', (data) => {
      setMessages(prev => {
        // Only add if we're in the same conversation
        if (socketRef.current._selectedConv === data.conversationId) {
          chatAPI.markAsRead(data.conversationId);
          return [...prev, data.message];
        }
        return prev;
      });

      setConversations(prev => {
        const existingIndex = prev.findIndex(c => c.conversationId === data.conversationId);
        if (existingIndex !== -1) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            lastMessage: {
              content: data.message.content,
              senderId: data.message.senderId,
              createdAt: data.message.createdAt
            },
            unreadCount: socketRef.current._selectedConv === data.conversationId ? 0 : updated[existingIndex].unreadCount + 1
          };
          const [conversation] = updated.splice(existingIndex, 1);
          return [conversation, ...updated];
        }
        fetchConversations();
        return prev;
      });

      if (socketRef.current._selectedConv !== data.conversationId) {
        setUnreadTotal(prev => prev + 1);
      }
    });

    return () => {
      if (user.id) {
        socketRef.current.emit('leave', user.id);
      }
      socketRef.current.disconnect();
    };
  }, [user.id]);

  // Track selected conversation on socket ref (avoids stale closure)
  useEffect(() => {
    if (socketRef.current) {
      socketRef.current._selectedConv = selectedConversation;
    }
  }, [selectedConversation]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle initial load and URL params
  useEffect(() => {
    const { userId, listingId } = chatParamsRef.current;

    if (userId) {
      // Clear URL params (won't affect our ref)
      window.history.replaceState({}, '', '/chat');
      startNewConversation(userId, listingId);
    } else {
      fetchConversations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchConversations = async () => {
    try {
      const response = await chatAPI.getConversations();
      if (response.success) {
        setConversations(response.data);
        // Calculate total unread
        const total = response.data.reduce((sum, c) => sum + c.unreadCount, 0);
        setUnreadTotal(total);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const startNewConversation = async (userId, listingId) => {
    try {
      setLoading(true);
      const response = await chatAPI.startConversation(userId, listingId);
      if (response.success) {
        // Store the pending conversation data for sending first message
        setPendingConversation({
          conversationId: response.data.conversationId,
          otherUser: response.data.otherUser,
          listingId: listingId
        });
        
        // Select this conversation immediately
        setSelectedConversation(response.data.conversationId);
        
        // Fetch existing conversations in background (don't await)
        fetchConversations();
        
        // Load any existing messages
        loadMessages(response.data.conversationId);
      } else {
        // If failed, go back to conversations
        fetchConversations();
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
      fetchConversations();
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId) => {
    try {
      const response = await chatAPI.getMessages(conversationId);
      if (response.success) {
        setMessages(response.data);
        // Mark as read
        await chatAPI.markAsRead(conversationId);
        // Update unread count in conversations
        setConversations(prev => prev.map(c => 
          c.conversationId === conversationId 
            ? { ...c, unreadCount: 0 } 
            : c
        ));
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const selectConversation = (conv) => {
    setSelectedConversation(conv.conversationId);
    loadMessages(conv.conversationId);
    inputRef.current?.focus();
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation || sendingMessage) return;

    // Try to find conversation in list, or use pending conversation data
    let conv = conversations.find(c => c.conversationId === selectedConversation);
    
    // If not found in conversations, use pending conversation (for first message)
    if (!conv && pendingConversation && pendingConversation.conversationId === selectedConversation) {
      conv = pendingConversation;
    }
    
    if (!conv?.otherUser?.id) return;

    setSendingMessage(true);
    try {
      const response = await chatAPI.sendMessage(
        conv.otherUser.id, 
        newMessage.trim(),
        conv.listingId
      );
      
      if (response.success) {
        setMessages(prev => [...prev, response.data]);
        setNewMessage('');
        
        // Clear pending conversation after first message sent
        if (pendingConversation) {
          setPendingConversation(null);
          // Refresh conversations to get the new one from server
          fetchConversations();
        } else {
          // Update conversation's last message
          setConversations(prev => prev.map(c => 
            c.conversationId === selectedConversation 
              ? { ...c, lastMessage: { content: newMessage.trim(), senderId: user.id, createdAt: new Date().toISOString() } }
              : c
          ));
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSendingMessage(false);
    }
  };

  const deleteConversation = async (conversationId, e) => {
    e.stopPropagation();
    if (!confirm('Delete this conversation?')) return;
    
    try {
      await chatAPI.deleteConversation(conversationId);
      setConversations(prev => prev.filter(c => c.conversationId !== conversationId));
      if (selectedConversation === conversationId) {
        setSelectedConversation(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  // Get selected conversation from list, or use pending conversation for new chats
  const selectedConv = conversations.find(c => c.conversationId === selectedConversation) 
    || (pendingConversation?.conversationId === selectedConversation ? pendingConversation : null);

  return (
    <Layout requireAuth>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Messages</h1>
          <p className="text-gray-400">Chat with buyers and sellers</p>
        </div>

        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden" style={{ height: 'calc(100vh - 250px)', minHeight: '500px' }}>
          <div className="flex h-full">
            {/* Conversations List */}
            <div className={`w-full md:w-80 lg:w-96 border-r border-white/10 flex flex-col ${selectedConversation ? 'hidden md:flex' : ''}`}>
              <div className="p-4 border-b border-white/10">
                <h2 className="text-lg font-semibold text-white">Conversations</h2>
              </div>
              
              {loading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
                </div>
              ) : conversations.length === 0 && !pendingConversation ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                  <svg className="w-16 h-16 text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-gray-400">No conversations yet</p>
                  <p className="text-gray-500 text-sm mt-1">Start a chat from the Trade page</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  {/* Show pending conversation if any */}
                  {pendingConversation && !conversations.find(c => c.conversationId === pendingConversation.conversationId) && (
                    <div
                      key={pendingConversation.conversationId}
                      className={`p-4 border-b border-white/5 cursor-pointer bg-indigo-600/20`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold text-lg">
                            {pendingConversation.otherUser?.username?.charAt(0).toUpperCase() || '?'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">
                            {pendingConversation.otherUser?.username || 'Unknown User'}
                          </p>
                          <p className="text-gray-400 text-sm mt-1">New conversation</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {conversations.map((conv) => (
                    <div
                      key={conv.conversationId}
                      onClick={() => selectConversation(conv)}
                      className={`p-4 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-all relative group ${
                        selectedConversation === conv.conversationId ? 'bg-indigo-600/20' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold text-lg">
                            {conv.otherUser?.username?.charAt(0).toUpperCase() || '?'}
                          </span>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-white font-medium truncate">
                              {conv.otherUser?.username || 'Unknown User'}
                            </p>
                            <span className="text-gray-500 text-xs">
                              {conv.lastMessage?.createdAt && formatTime(conv.lastMessage.createdAt)}
                            </span>
                          </div>
                          
                          {conv.listingName && (
                            <p className="text-indigo-400 text-xs truncate mt-0.5">
                              Re: {conv.listingName}
                            </p>
                          )}
                          
                          <p className="text-gray-400 text-sm truncate mt-1">
                            {conv.lastMessage?.senderId === user.id ? 'You: ' : ''}
                            {conv.lastMessage?.content || 'No messages yet'}
                          </p>
                        </div>

                        {conv.unreadCount > 0 && (
                          <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs font-medium">{conv.unreadCount}</span>
                          </div>
                        )}
                      </div>

                      {/* Delete button */}
                      <button
                        onClick={(e) => deleteConversation(conv.conversationId, e)}
                        className="absolute right-2 top-2 p-1.5 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Chat Area */}
            <div className={`flex-1 flex flex-col ${!selectedConversation ? 'hidden md:flex' : ''}`}>
              {selectedConversation ? (
                <>
                  {/* Chat Header */}
                  <div className="p-4 border-b border-white/10 flex items-center gap-3">
                    <button
                      onClick={() => setSelectedConversation(null)}
                      className="md:hidden p-2 text-gray-400 hover:text-white"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                      <span className="text-white font-bold">
                        {selectedConv?.otherUser?.username?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
                    
                    <div>
                      <p className="text-white font-medium">{selectedConv?.otherUser?.username || 'Unknown'}</p>
                      {selectedConv?.listingName && (
                        <p className="text-indigo-400 text-xs">Re: {selectedConv.listingName}</p>
                      )}
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((msg) => (
                      <div
                        key={msg._id}
                        className={`flex ${msg.senderId === user.id ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] px-4 py-2 rounded-2xl ${
                            msg.senderId === user.id
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white/10 text-white'
                          }`}
                        >
                          <p className="break-words">{msg.content}</p>
                          <p className={`text-xs mt-1 ${msg.senderId === user.id ? 'text-indigo-200' : 'text-gray-500'}`}>
                            {formatTime(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input */}
                  <form onSubmit={sendMessage} className="p-4 border-t border-white/10">
                    <div className="flex gap-3">
                      <input
                        ref={inputRef}
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                        maxLength={2000}
                      />
                      <button
                        type="submit"
                        disabled={!newMessage.trim() || sendingMessage}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {sendingMessage ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        )}
                        <span className="hidden sm:inline">Send</span>
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <svg className="w-24 h-24 text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <h3 className="text-xl font-semibold text-white mb-2">Select a conversation</h3>
                  <p className="text-gray-400">Choose a conversation from the list or start a new chat from the Trade page</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default Chat;
