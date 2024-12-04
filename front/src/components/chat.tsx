// components/Chat.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import {
    addMessage,
    setMessageDelivered,
    setUserOnlineStatus,
    clearChat
} from '../store/messageSlice';
import { Message } from '../types/types';

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
            // Connect to WebSocket
            const ws = new WebSocket(`ws://localhost:3000/ws/${currentUserId}`);
            wsRef.current = ws;

            ws.onopen = () => {
                setIsConnected(true);
                console.log('WebSocket Connected');
            };

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);

                if (data.content === 'delivered') {
                    // Handle delivery confirmation
                    dispatch(setMessageDelivered(data.messageId));
                } else {
                    // Handle regular message
                    dispatch(addMessage(data));
                }
            };

            ws.onclose = () => {
                setIsConnected(false);
                console.log('WebSocket Disconnected');
            };

            // Check other user's status periodically
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
            id: Date.now().toString(),
            fromId: currentUserId!,
            toId: connectedToUser!,
            content: messageText,
            timestamp: new Date().toISOString(),
            delivered: false,
            readStatus: false
        };

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
        <div>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px'
            }}>
                <h2>Chat with User: {connectedToUser}</h2>
                <button
                    onClick={handleDisconnect}
                    style={{ padding: '8px 16px' }}
                >
                    Disconnect
                </button>
            </div>

            <div style={{
                height: '400px',
                overflowY: 'auto',
                border: '1px solid #ccc',
                padding: '10px',
                marginBottom: '20px'
            }}>
                {messages.map((message) => (
                    <div
                        key={message.id}
                        style={{
                            marginBottom: '10px',
                            textAlign: message.fromId === currentUserId ? 'right' : 'left'
                        }}
                    >
                        <div style={{
                            display: 'inline-block',
                            maxWidth: '70%',
                            padding: '8px',
                            borderRadius: '8px',
                            backgroundColor: message.fromId === currentUserId ? '#007bff' : '#e9ecef',
                            color: message.fromId === currentUserId ? 'white' : 'black'
                        }}>
                            <div>{message.content}</div>
                            <div style={{
                                fontSize: '0.8em',
                                marginTop: '4px',
                                opacity: 0.8
                            }}>
                                {formatTime(message.timestamp)}
                                {message.fromId === currentUserId && (
                                    <span style={{ marginLeft: '5px' }}>
                                        {message.delivered ? '✓✓' : '✓'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <form onSubmit={sendMessage}>
                <div style={{
                    display: 'flex',
                    gap: '10px'
                }}>
                    <input
                        type="text"
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        placeholder="Type your message..."
                        style={{
                            flex: 1,
                            padding: '8px'
                        }}
                    />
                    <button
                        type="submit"
                        disabled={!isConnected || !messageText.trim()}
                        style={{
                            padding: '8px 16px'
                        }}
                    >
                        Send
                    </button>
                </div>
            </form>
        </div>
    );
};