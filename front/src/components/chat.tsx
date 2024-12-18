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

        const ws = new WebSocket(`ws://localhost:3000/ws/${currentUserId}`);
        wsRef.current = ws;

        ws.onopen = () => {
            setIsConnected(true);
            setError(null);
        };

        ws.onmessage = async (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.content === 'status_update') {  // Changed from data.type === 'status'
                    dispatch(setUserOnlineStatus({
                        userId: data.fromId,  // Changed from data.userId
                        online: data.status === 'online'
                    }));
                    return;
                }
            } catch (error) {
                console.error('Error processing message:', error);
                setError('Error processing incoming message');
            }
        };

        ws.onclose = () => setIsConnected(false);
        ws.onerror = () => setError('Connection error. Please try again.');

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
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