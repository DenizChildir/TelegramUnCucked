// WebSocketManager.tsx
import React, { useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import {
    setWebSocketConnected,
    setUserOnlineStatus,
    removeFromQueue
} from '../store/messageSlice';
import { MessageProcessor } from '../service/messageProcessor';
import { CONFIG } from '../config';

interface WebSocketContextType {
    ws: WebSocket | null;
    messageProcessor: MessageProcessor | null;
}

export const WebSocketContext = createContext<WebSocketContextType>({
    ws: null,
    messageProcessor: null
});

interface WebSocketManagerProps {
    children: React.ReactNode;
}

export const WebSocketManager: React.FC<WebSocketManagerProps> = ({ children }) => {
    const dispatch = useAppDispatch();
    const currentUserId = useAppSelector(state => state.messages.currentUserId);
    const pendingMessages = useAppSelector(state => state.messages.messageQueue.pending);
    const wsRef = useRef<WebSocket | null>(null);
    const messageProcessorRef = useRef<MessageProcessor | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
    const MAX_RETRIES = 3;
    const retryCountRef = useRef(0);

    // Process pending messages
    const processPendingMessages = useCallback(() => {
        if (!messageProcessorRef.current || !pendingMessages.length) return;

        for (const message of pendingMessages) {
            try {
                messageProcessorRef.current.sendMessage(message);
                dispatch(removeFromQueue(message.id));
            } catch (error) {
                console.error('Error processing pending message:', error);
            }
        }
    }, [dispatch, pendingMessages]);

    const connectWebSocket = useCallback(() => {
        if (!currentUserId) {
            console.log('No currentUserId, skipping connection');
            return;
        }
        if (retryCountRef.current >= MAX_RETRIES) {
            console.log('Failed to connect after maximum retries');
            return;
        }

        console.log('Starting WebSocket connection attempt...');
        console.log('Current User ID:', currentUserId);

        const wsUrl = CONFIG.getWebSocketUrl(currentUserId);
        console.log('WebSocket URL:', wsUrl);

        try {
            console.log('Creating new WebSocket instance...');
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            console.log('Setting up WebSocket event handlers...');

            ws.onopen = () => {
                console.log('✅ WebSocket connection opened successfully');
                dispatch(setWebSocketConnected(true));
                retryCountRef.current = 0;

                console.log('Initializing MessageProcessor...');
                messageProcessorRef.current = new MessageProcessor(
                    wsRef,
                    dispatch,
                    currentUserId
                );
                console.log('MessageProcessor initialized:', !!messageProcessorRef.current);

                processPendingMessages();
            };

            ws.onclose = (event) => {
                console.log('❌ WebSocket closed. Code:', event.code, 'Reason:', event.reason);
                dispatch(setWebSocketConnected(false));

                if (event.wasClean) {
                    console.log('Clean websocket close');
                    return;
                }

                const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 10000);
                console.log(`Scheduling reconnection attempt in ${delay}ms...`);
                reconnectTimeoutRef.current = setTimeout(() => {
                    retryCountRef.current++;
                    console.log(`Attempting reconnection ${retryCountRef.current}/${MAX_RETRIES}`);
                    connectWebSocket();
                }, delay);
            };

            ws.onerror = (error) => {
                console.error('⚠️ WebSocket error:', error);
                console.log('WebSocket readyState:', ws.readyState);
            };

            ws.onmessage = async (event) => {
                console.log('📩 Received WebSocket message:', event.data);
                try {
                    const message = JSON.parse(event.data);
                    console.log('Parsed message:', message);

                    if (message.content === 'status_update') {
                        console.log('Processing status update message');
                        dispatch(setUserOnlineStatus({
                            userId: message.fromId,
                            online: message.status === 'online'
                        }));
                        return;
                    }

                    if (messageProcessorRef.current) {
                        console.log('Passing message to MessageProcessor');
                        await messageProcessorRef.current.processIncomingMessage(message);
                    } else {
                        console.warn('MessageProcessor not available for message processing');
                    }
                } catch (error) {
                    console.error('Error processing message:', error);
                }
            };
        } catch (error) {
            console.error('Error creating WebSocket:', error);
        }
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
            if (messageProcessorRef.current) {
                messageProcessorRef.current.clearDeliveryTimeouts();
            }
            messageProcessorRef.current = null;
        };
    }, [currentUserId, connectWebSocket]);

    return (
        <WebSocketContext.Provider value={{
            ws: wsRef.current,
            messageProcessor: messageProcessorRef.current
        }}>
            <div data-testid="websocket-manager">
                {children}
            </div>
        </WebSocketContext.Provider>
    );
};

export const useWebSocket = () => useContext(WebSocketContext);