// WebSocketManager.tsx
import React, {useCallback, useEffect, useRef} from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import {
    setWebSocketConnected,
    setUserOnlineStatus,
    setMessageDelivered,
    setMessageRead,
    addMessageAsync, moveToFailedQueue, removeFromQueue
} from '../store/messageSlice';
import { Message } from '../types/types';

interface WebSocketManagerProps {
    children: React.ReactNode;
}

export const WebSocketManager: React.FC<WebSocketManagerProps> = ({ children }) => {
    const dispatch = useAppDispatch();
    const currentUserId = useAppSelector(state => state.messages.currentUserId);
    const pendingMessages = useAppSelector(state => state.messages.messageQueue.pending);
    const wsRef = useRef<WebSocket | null>(null);
    const messageIdsRef = useRef(new Set<string>());
    const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
    const MAX_RETRIES = 3;
    const retryCountRef = useRef(0);

    const processPendingMessages = useCallback(() => {
        if (!wsRef.current || !pendingMessages.length) return;

        pendingMessages.forEach(message => {
            try {
                wsRef.current?.send(JSON.stringify(message));
                dispatch(removeFromQueue(message.id));
            } catch (error) {
                console.error('Error sending pending message:', error);
                dispatch(moveToFailedQueue(message.id));
            }
        });
    }, [dispatch, pendingMessages]);

    const connectWebSocket = useCallback(() => {
        if (!currentUserId) return;
        if (retryCountRef.current >= MAX_RETRIES) {
            console.error('Failed to connect after maximum retries');
            return;
        }

        console.log('Attempting WebSocket connection...');
        const ws = new WebSocket(`ws://localhost:3000/ws/${currentUserId}`);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('WebSocket connected successfully');
            dispatch(setWebSocketConnected(true));
            retryCountRef.current = 0;
            processPendingMessages();
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
            const existingMessage = useAppSelector(state =>
                state.messages.messages.find(m => m.id === message.id)
            );

            if (!existingMessage && !messageIdsRef.current.has(message.id)) {
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
            dispatch(setWebSocketConnected(false));
            console.log('WebSocket disconnected with code:', event.code);

            if (event.wasClean) {
                console.log('Clean websocket close');
                return;
            }

            // Attempt reconnection with exponential backoff
            const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 10000);
            reconnectTimeoutRef.current = setTimeout(() => {
                retryCountRef.current++;
                console.log(`Attempting reconnection ${retryCountRef.current}/${MAX_RETRIES}`);
                connectWebSocket();
            }, delay);
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }, [currentUserId, dispatch, processPendingMessages]);

    useEffect(() => {
        if (currentUserId) {
            connectWebSocket();
        }

        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (wsRef.current) {
                wsRef.current.close(1000, 'Component unmounting');
            }
        };
    }, [currentUserId, connectWebSocket]);

    useEffect(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            processPendingMessages();
        }
    }, [processPendingMessages]);

    // Expose WebSocket instance to children components if needed
    return (
        <div data-testid="websocket-manager">
            {children}
        </div>
    );
};