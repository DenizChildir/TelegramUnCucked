import React, { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import {
    addMessageAsync,
    setMessageDelivered,
    setMessageRead,
    setUserOnlineStatus,
    initializeMessagesAsync, initializeAllMessagesAsync
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
        connectedToUser ? (
            (msg.fromId === currentUserId && msg.toId === connectedToUser) ||
            (msg.fromId === connectedToUser && msg.toId === currentUserId)
        ) : (
            msg.fromId === currentUserId || msg.toId === currentUserId
        )
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
            status: 'sent'  // Explicitly set initial status
        };

        console.log('Sending new message:', message);

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

    // In Chat.tsx, update the loadMessages useEffect

    useEffect(() => {
        const loadMessages = async () => {
            if (!currentUserId) return;

            setIsLoading(true);
            try {
                await dispatch(initializeAllMessagesAsync(currentUserId)).unwrap();
            } catch (error) {
                console.error('Error loading messages:', error);
                setError('Failed to load messages');
            } finally {
                setIsLoading(false);
            }
        };

        loadMessages();
    }, [currentUserId, dispatch]);

    //In Chat.tsx, update the WebSocket useEffect

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

            console.log('Attempting WebSocket connection...');
            const ws = new WebSocket(`ws://localhost:3000/ws/${currentUserId}`);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('WebSocket connected successfully');
                setIsConnected(true);
                setError(null);
                retryCount = 0;
            };

            ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                console.log('Received message:', message);

                // Handle status updates
                if (message.content === 'status_update') {
                    dispatch(setUserOnlineStatus({
                        userId: message.fromId,
                        online: message.status === 'online'
                    }));
                    return;
                }

                // Handle delivery confirmations
                if (message.content === 'delivered') {
                    console.log('Processing delivery confirmation:', message);
                    // Extract the original message ID from the delivery confirmation ID
                    const targetMessageId = message.id.startsWith('delivery_')
                        ? message.id.replace('delivery_', '')
                        : message.id;
                    console.log('Setting delivered status for message:', targetMessageId);
                    dispatch(setMessageDelivered(targetMessageId));
                    return;
                }

                // Handle read receipts
                if (message.content === 'read') {
                    console.log('Processing read receipt:', message);
                    dispatch(setMessageRead(message.id));
                    return;
                }

                // Handle regular messages
                if (!messageIdsRef.current.has(message.id)) {
                    messageIdsRef.current.add(message.id);
                    dispatch(addMessageAsync(message));

                    // Send delivery confirmation
                    if (wsRef.current && message.fromId !== currentUserId) {
                        const deliveryConfirmation = {
                            id: `delivery_${message.id}`,
                            fromId: currentUserId,
                            toId: message.fromId,
                            content: 'delivered',
                            timestamp: new Date().toISOString(),
                            delivered: true,
                            readStatus: false,
                            status: 'sent'
                        };
                        wsRef.current.send(JSON.stringify(deliveryConfirmation));
                    }
                }
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
                wsRef.current.close(1000, 'Component unmounting');
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

    // Scroll to bottom effect
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

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
                                          {console.log(`Message ${message.id} full state:`, message)}
                                            {message.status === 'read' ? '✓✓✓' :
                                                message.status === 'delivered' ? '✓✓' : message.status === 'sent' ? '✓' : '?'}
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