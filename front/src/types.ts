export interface Message {
    id: string;
    messageId: string;
    from: string;
    to: string;
    content: string;
    timestamp: string; // Changed from Date to string
    delivered: boolean;
}

export enum ConnectionState {
    DISCONNECTED = 'DISCONNECTED',
    CONNECTING = 'CONNECTING',
    CONNECTED = 'CONNECTED'
}

export interface ChatState {
    messages: Message[];
    connectionState: ConnectionState;
    userId: string | null;
    recipientId: string | null;
    error: string | null;
}

export interface WSMessage {
    type: 'message' | 'connect' | 'disconnect' | 'delivery';
    payload: any;
}