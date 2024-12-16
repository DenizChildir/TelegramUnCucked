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
import { generateShortId } from '../store/fileStorage';
import styles from './Chat.module.css';

export const Chat = () => {
    const [messageText, setMessageText] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const messageIdsRef = useRef(new Set<string>());
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const dispatch = useAppDispatch();

    const currentUserId = useAppSelector(state => state.messages.currentUserId);
    const connectedToUser = useAppSelector(state => state.messages.connectedToUser);
    const messages = useAppSelector(state => state.messages.messages);
    const users = useAppSelector(state => state.messages.users);

    const isUserOnline = connectedToUser ? users[connectedToUser]?.online : false;

    const conversationMessages = messages.filter(msg =>
        (msg.fromId === currentUserId && msg.toId === connectedToUser) ||
        (msg.fromId === connectedToUser && msg.toId === currentUserId)
    );

    // Load messages when conversation changes
    useEffect(() => {
        const loadMessages = async () => {
            if (!currentUserId || !connectedToUser) return;

            setIsLoading(true);
            setError(null);

            try {
                await dispatch(initializeMessagesAsync({
                    userId1: currentUserId,
                    userId2: connectedToUser
                })).unwrap();
            } catch (error) {
                console.error('Error loading messages:', error);
                setError('Failed to load messages. Please try refreshing.');
            } finally {
                setIsLoading(false);
            }
        };

        loadMessages();
    }, [currentUserId, connectedToUser, dispatch]);

    // WebSocket connection
    useEffect(() => {
        if (!currentUserId) return;

        const ws = new WebSocket(`ws://localhost:3000/ws/${currentUserId}`);
        wsRef.current = ws;

        ws.onopen = () => {
            setIsConnected(true);
            setError(null);
            console.log('WebSocket Connected');
        };

        ws.onmessage = async (event) => {
            try {
                const data = JSON.parse(event.data);
                await handleWebSocketMessage(data);
            } catch (error) {
                console.error('Error handling WebSocket message:', error);
                setError('Error processing message');
            }
        };

        ws.onclose = () => {
            setIsConnected(false);
            console.log('WebSocket Disconnected');
        };

        ws.onerror = () => {
            setError('Connection error. Please check your internet connection.');
        };

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [currentUserId]);

    const handleWebSocketMessage = async (data: any) => {
        console.log('Received WebSocket message:', data);

        if (data.content === 'status_update') {
            dispatch(setUserOnlineStatus({
                userId: data.fromId,
                online: data.status === 'online'
            }));
            return;
        }

        if (data.content === 'delivered') {
            if (data.id) {
                const originalMessageId = data.id.replace('delivery_', '');
                dispatch(setMessageDelivered(originalMessageId));
            }
            return;
        }

        if (!messageIdsRef.current.has(data.id)) {
            messageIdsRef.current.add(data.id);
            if (data.content !== 'delivered') {
                try {
                    await dispatch(addMessageAsync(data)).unwrap();

                    // Send delivery receipt
                    if (wsRef.current) {
                        const deliveryReceipt = {
                            id: `delivery_${data.id}`,
                            fromId: currentUserId,
                            toId: data.fromId,
                            content: 'delivered',
                            timestamp: new Date().toISOString(),
                            status: 'delivered'
                        };
                        wsRef.current.send(JSON.stringify(deliveryReceipt));
                    }
                } catch (error) {
                    console.error('Error saving message:', error);
                    setError('Failed to save message');
                }
            }
        }
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!messageText.trim() || !wsRef.current || !connectedToUser || !isConnected) return;

        const message: Message = {
            id: generateShortId(),
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

    const formatTime = (timestamp: string) => {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className={styles.chatContainer}>
            <div className={styles.header}>
                <div className={styles.headerInfo}>
                    <div className={styles.userInfo}>
                        <span className={styles.userLabel}>Your ID:</span>
                        <span className={styles.userId}>{currentUserId}</span>
                    </div>
                    <div className={styles.userInfo}>
                        <span className={styles.userLabel}>Chatting with:</span>
                        <span className={styles.userId}>{connectedToUser}</span>
                        <span className={styles.connectionStatus}>
                            {isConnected ? (isUserOnline ? '🟢 Online' : '🟡 Away') : '🔴 Disconnected'}
                        </span>
                    </div>
                </div>
            </div>

            {error && (
                <div className={styles.errorMessage}>
                    {error}
                </div>
            )}

            <div className={styles.messagesContainer}>
                {isLoading ? (
                    <div className={styles.loadingIndicator}>Loading messages...</div>
                ) : (
                    <>
                        {conversationMessages.map((message) => (
                            <div
                                key={`${message.id}-${message.fromId}-${message.timestamp}`}
                                className={`${styles.messageWrapper} ${
                                    message.fromId === currentUserId ? styles.messageOutgoing : styles.messageIncoming
                                }`}
                            >
                                <div className={`${styles.messageBubble} ${
                                    message.fromId === currentUserId ? styles.messageBubbleOutgoing : styles.messageBubbleIncoming
                                }`}>
                                    <div className={styles.messageContent}>{message.content}</div>
                                    <div className={styles.messageFooter}>
                                        <span className={styles.messageTime}>
                                            {formatTime(message.timestamp)}
                                        </span>
                                        {message.fromId === currentUserId && (
                                            <span className={styles.messageStatus} title={message.status}>
                                                {message.status === 'read' ? '✓✓✓' :
                                                    message.status === 'delivered' ? '✓✓' : '✓'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </>
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} className={styles.inputForm}>
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
                    className={`${styles.sendButton} ${!isConnected ? styles.disabled : ''}`}
                >
                    Send
                </button>
            </form>
        </div>
    );
};