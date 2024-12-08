import React, { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import {
    addMessage,
    setMessageDelivered,
    setUserOnlineStatus,
    clearChat,
    initializeMessages
} from '../store/messageSlice';
import { Message } from '../types/types';
import { saveMessage, getMessages, generateShortId } from '../store/storage';
import styles from './Chat.module.css';


export const Chat = () => {
    const [messageText, setMessageText] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const messageIdsRef = useRef(new Set<string>());
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const dispatch = useAppDispatch();

    const currentUserId = useAppSelector(state => state.messages.currentUserId);
    const connectedToUser = useAppSelector(state => state.messages.connectedToUser);
    const messages = useAppSelector(state => state.messages.messages);

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Load initial messages
    useEffect(() => {
        if (currentUserId && connectedToUser) {
            const savedMessages = getMessages(currentUserId, connectedToUser);
            dispatch(initializeMessages(savedMessages));
            messageIdsRef.current = new Set(savedMessages.map(msg => msg.id));
        }

        return () => {
            messageIdsRef.current.clear();
        };
    }, [currentUserId, connectedToUser, dispatch]);

    // WebSocket connection
    useEffect(() => {
        if (currentUserId && connectedToUser) {
            const ws = new WebSocket(`ws://localhost:3000/ws/${currentUserId}`);
            wsRef.current = ws;

            ws.onopen = () => {
                setIsConnected(true);
                console.log('WebSocket Connected');
            };

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.content === 'delivered') {
                    dispatch(setMessageDelivered(data.messageId));
                } else if (!messageIdsRef.current.has(data.id)) {
                    messageIdsRef.current.add(data.id);
                    saveMessage(data);
                    dispatch(addMessage(data));
                }
            };

            ws.onclose = () => {
                setIsConnected(false);
                console.log('WebSocket Disconnected');
            };

            // Check online status periodically
            const statusInterval = setInterval(async () => {
                try {
                    const response = await fetch(`http://localhost:3000/status/${connectedToUser}`);
                    const data = await response.json();
                    dispatch(setUserOnlineStatus({
                        userId: connectedToUser,
                        online: data.online
                    }));
                } catch (error) {
                    console.error('Error checking user status:', error);
                }
            }, 5000);

            return () => {
                clearInterval(statusInterval);
                if (wsRef.current) {
                    wsRef.current.close();
                }
            };
        }
    }, [currentUserId, connectedToUser, dispatch]);

    const handleDisconnect = () => {
        if (wsRef.current) {
            wsRef.current.close();
        }
        dispatch(clearChat());
    };

    const sendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!messageText.trim() || !wsRef.current) return;

        const message: Message = {
            id: generateShortId(),
            fromId: currentUserId!,
            toId: connectedToUser!,
            content: messageText.trim(),
            timestamp: new Date().toISOString(),
            delivered: false,
            readStatus: false
        };

        if (!messageIdsRef.current.has(message.id)) {
            messageIdsRef.current.add(message.id);
            saveMessage(message);
            wsRef.current.send(JSON.stringify(message));
            dispatch(addMessage(message));
        }
        setMessageText('');
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
                    <h2 className={styles.title}>Chat with {connectedToUser}</h2>
                    <span className={styles.connectionStatus}>
                        {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
                    </span>
                </div>
                <button
                    onClick={handleDisconnect}
                    className={styles.disconnectButton}
                >
                    Disconnect
                </button>
            </div>

            <div className={styles.messagesContainer}>
                {messages.map((message) => (
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
                                    <span className={styles.messageStatus}>
                                        {message.delivered ? '✓✓' : '✓'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} className={styles.inputForm}>
                <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Type your message..."
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