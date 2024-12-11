export interface Message {
    id: string;
    fromId: string;
    toId: string;
    content: string;
    timestamp: string;
    delivered: boolean;
    readStatus: boolean;
    status: 'sent' | 'delivered' | 'read';
}

export interface User {
    id: string;
    online: boolean;
}