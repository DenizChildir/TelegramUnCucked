import React, { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import {
    addMessageAsync,
    setMessageDelivered,
    setMessageRead,
    setUserOnlineStatus,
    initializeMessagesAsync
} from '../store/messageSlice';
import { Message } from '../types/types';
import styles from '../styles/modules/Chat.module.css';

export const Chat = () => {
    const dispatch = useAppDispatch();
    const currentUserId = useAppSelector(state => state.messages.currentUserId);
    const connectedToUser = useAppSelector(state => state.messages.connectedToUser);
    const messages = useAppSelector(state => state.messages.messages);
    const users = useAppSelector(state => state.messages.users);

    const [messageText, setMessageText] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const messageIdsRef = useRef(new Set<string>());
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const isUserOnline = connectedToUser ? users[connectedToUser]?.online : false;

    const conversationMessages = messages.filter(msg =>
        (msg.fromId === currentUserId && msg.toId === connectedToUser) ||
        (msg.fromId === connectedToUser && msg.toId === currentUserId)
    );

    const formatTime = (timestamp: string) => {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!messageText.trim() || !wsRef.current || !connectedToUser || !isConnected) return;

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
            await dispatch(addMessageAsync(message)).unwrap();
            wsRef.current.send(JSON.stringify(message));
            setMessageText('');
            setError(null);
        } catch (error) {
            console.error('Error sending message:', error);
            setError('Failed to send message. Please try again.');
        }
    };

    // WebSocket connection effect
    useEffect(() => {
        if (!currentUserId) return;

        let reconnectTimeout: NodeJS.Timeout;
        const MAX_RETRIES = 3;
        let retryCount = 0;

        const connectWebSocket = () => {
            if (retryCount >= MAX_RETRIES) {
                setError('Failed to connect after multiple attempts');
                return;
            }

            const ws = new WebSocket(`ws://localhost:3000/ws/${currentUserId}`);
            wsRef.current = ws;

            ws.onopen = () => {
                setIsConnected(true);
                setError(null);
                retryCount = 0; // Reset retry count on successful connection
                console.log('WebSocket connected');
            };

            ws.onclose = (event) => {
                setIsConnected(false);
                console.log('WebSocket disconnected with code:', event.code);

                // Don't retry if the close was clean
                if (event.wasClean) {
                    console.log('Clean websocket close');
                    return;
                }

                // Attempt reconnection with exponential backoff
                const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
                reconnectTimeout = setTimeout(() => {
                    retryCount++;
                    console.log(`Attempting reconnection ${retryCount}/${MAX_RETRIES}`);
                    connectWebSocket();
                }, delay);
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                // Don't set error state here as it will be handled by onclose
            };
        };

        connectWebSocket();

        // Cleanup function
        return () => {
            clearTimeout(reconnectTimeout);
            if (wsRef.current) {
                wsRef.current.close(1000, 'Component unmounting'); // Clean close
            }
        };
    }, [currentUserId, dispatch]);

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
                                                message.status === 'delivered' ? '✓✓' : '✓'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className={styles.inputForm}>
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