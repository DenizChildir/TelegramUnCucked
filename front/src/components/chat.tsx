import React, { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import {
    addMessage,
    setMessageDelivered,
    setUserOnlineStatus,
    clearChat
} from '../store/messageSlice';
import { Message } from '../types/types';
import { saveMessage, getMessages, generateShortId } from '../store/storage.ts';
import styles from './Chat.module.css';

export const Chat = () => {
    const [messageText, setMessageText] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const dispatch = useAppDispatch();

    const currentUserId = useAppSelector(state => state.messages.currentUserId);
    const connectedToUser = useAppSelector(state => state.messages.connectedToUser);
    const messages = useAppSelector(state => state.messages.messages);

    useEffect(() => {
        if (currentUserId && connectedToUser) {
            // Load existing messages
            const savedMessages = getMessages(currentUserId, connectedToUser);
            if (savedMessages.length > 0) {
                savedMessages.forEach(msg => dispatch(addMessage(msg)));
            }

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
                } else {
                    saveMessage(data);
                    dispatch(addMessage(data));
                }
            };

            ws.onclose = () => {
                setIsConnected(false);
                console.log('WebSocket Disconnected');
            };

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

    const sendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!messageText.trim() || !wsRef.current) return;

        const message: Message = {
            id: generateShortId(),
            fromId: currentUserId!,
            toId: connectedToUser!,
            content: messageText,
            timestamp: new Date().toISOString(),
            delivered: false,
            readStatus: false
        };

        saveMessage(message);
        wsRef.current.send(JSON.stringify(message));
        dispatch(addMessage(message));
        setMessageText('');
    };

    const handleDisconnect = () => {
        if (wsRef.current) {
            wsRef.current.close();
        }
        dispatch(clearChat());
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
                <div>
                    <h2 className={styles.title}>Chat: {currentUserId} → {connectedToUser}</h2>
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
                        key={message.id}
                        className={`${styles.messageWrapper} ${
                            message.fromId === currentUserId ? styles.messageOutgoing : styles.messageIncoming
                        }`}
                    >
                        <div className={`${styles.messageBubble} ${
                            message.fromId === currentUserId ? styles.messageBubbleOutgoing : styles.messageBubbleIncoming
                        }`}>
                            <div>{message.content}</div>
                            <div className={styles.messageTime}>
                                {formatTime(message.timestamp)}
                                {message.fromId === currentUserId && (
                                    <span className={styles.messageStatus}>
                                        {message.delivered ? '✓✓' : '✓'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <form onSubmit={sendMessage} className={styles.inputForm}>
                <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Type your message..."
                    className={styles.messageInput}
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