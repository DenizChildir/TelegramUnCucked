// Chat.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { useWebSocket } from './WebSocketManager';
import {
    addMessageAsync,
    setMessageRead,
    initializeMessagesAsync
} from '../store/messageSlice';
import { Message } from '../types/types';
import { MessageProcessor } from '../service/messageProcessor';
import styles from '../styles/modules/Chat.module.css';

export const Chat = () => {
    const dispatch = useAppDispatch();
    const currentUserId = useAppSelector(state => state.messages.currentUserId);
    const connectedToUser = useAppSelector(state => state.messages.connectedToUser);
    const messages = useAppSelector(state => state.messages.messages);
    const isConnected = useAppSelector(state => state.messages.isWebSocketConnected);
    const users = useAppSelector(state => state.messages.users);

    const [messageText, setMessageText] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { ws, messageProcessor } = useWebSocket();
    const visibilityTimeoutRef = useRef<NodeJS.Timeout>();

    const isUserOnline = connectedToUser ? users[connectedToUser]?.online : false;

    // Filter and prepare messages for display
    const conversationMessages = messages
        .filter(msg =>
            msg.content !== 'delivered' &&
            msg.content !== 'read' &&
            msg.content !== 'status_update' &&
            ((msg.fromId === currentUserId && msg.toId === connectedToUser) ||
                (msg.fromId === connectedToUser && msg.toId === currentUserId))
        )
        .map(msg => ({
            ...msg,
            status: msg.status || (msg.readStatus ? 'read' : (msg.delivered ? 'delivered' : 'sent'))
        }));

    // Handle message visibility and read status
    const handleVisibilityChange = useCallback(() => {
        if (document.visibilityState === 'visible') {
            // Mark received messages as read when chat becomes visible
            const unreadMessages = conversationMessages
                .filter(msg =>
                    msg.fromId === connectedToUser &&
                    !msg.readStatus &&
                    msg.delivered
                );

            unreadMessages.forEach(msg => {
                if (ws && messageProcessor) {
                    const readReceipt: Message = {
                        id: msg.id,
                        fromId: currentUserId!,
                        toId: msg.fromId,
                        content: 'read',
                        timestamp: new Date().toISOString(),
                        delivered: true,
                        readStatus: true,
                        status: 'read'
                    };
                    messageProcessor.sendMessage(readReceipt);
                }
                dispatch(setMessageRead(msg.id));
            });
        }
    }, [dispatch, currentUserId, connectedToUser, conversationMessages]);

    // Initialize visibility change listener
    useEffect(() => {
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [handleVisibilityChange]);

    // Handle visibility changes for read receipts
    useEffect(() => {
        if (document.visibilityState === 'visible') {
            handleVisibilityChange();
        }
    }, [handleVisibilityChange]);

    // Load initial messages
    useEffect(() => {
        const loadMessages = async () => {
            if (!currentUserId || !connectedToUser) return;

            setIsLoading(true);
            try {
                await dispatch(initializeMessagesAsync({
                    userId1: currentUserId,
                    userId2: connectedToUser
                })).unwrap();
            } catch (error) {
                console.error('Error loading messages:', error);
                setError('Failed to load messages');
            } finally {
                setIsLoading(false);
            }
        };

        loadMessages();
    }, [currentUserId, connectedToUser, dispatch]);

    // Auto-scroll to bottom effect
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    // Format timestamp for display
    const formatTime = (timestamp: string) => {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Handle message submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!messageText.trim() || !connectedToUser || !isConnected || !messageProcessor || !ws) return;

        const message: Message = {
            id: crypto.randomUUID(),
            fromId: currentUserId!,
            toId: connectedToUser,
            content: messageText.trim(),
            timestamp: new Date().toISOString(),
            delivered: false,
            readStatus: false,
            status: 'sent'
        };

        try {
            await messageProcessor.sendMessage(message);
            setMessageText('');
            setError(null);
        } catch (error) {
            console.error('Error sending message:', error);
            setError('Failed to send message. Please try again.');
        }
    };

    return (
        <div className={styles.chatContainer}>
            <div className={styles.header}>
                <div className={styles.headerInfo}>
                    <div className={styles.userInfo}>
                        <span className={styles.userLabel}>Your ID:</span>
                        <span className={styles.userId}>{currentUserId}</span>
                        <span className={styles.connectionStatus}>
                            {isConnected ? (isUserOnline ? '🟢 Online' : '🟡 Away') : '🔴 Offline'}
                        </span>
                    </div>
                </div>
            </div>

            <div className={styles.messagesContainer}>
                {isLoading ? (
                    <div className={styles.loadingIndicator}>Loading messages...</div>
                ) : (
                    conversationMessages.map((message: Message) => (
                        <div
                            key={message.id}
                            className={`${styles.messageWrapper} ${
                                message.fromId === currentUserId ? styles.messageOutgoing : styles.messageIncoming
                            }`}
                        >
                            <div className={`${styles.messageBubble} ${
                                message.fromId === currentUserId ?
                                    styles.messageBubbleOutgoing :
                                    styles.messageBubbleIncoming
                            }`}>
                                {message.content}
                                <div className={styles.messageTime}>
                                    {formatTime(message.timestamp)}
                                    {message.fromId === currentUserId && (
                                        <span className={styles.messageStatus}>
                                            {message.status === 'read' ? '✓✓✓' :
                                                message.status === 'delivered' ? '✓✓' :
                                                    message.status === 'sent' ? '✓' : '✓'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef}/>
            </div>

            <form onSubmit={handleSubmit} className={styles.inputForm}>
                {error && <div className={styles.errorMessage}>{error}</div>}
                <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder={isConnected ? "Type your message..." : "Connecting..."}
                    className={styles.messageInput}
                    disabled={!isConnected}
                />
                <button
                    type="submit"
                    disabled={!isConnected || !messageText.trim()}
                    className={styles.sendButton}
                >
                    Send
                </button>
            </form>
        </div>
    );
};