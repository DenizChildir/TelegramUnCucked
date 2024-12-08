import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Message {
    id: string;
    fromId: string;
    toId: string;
    content: string;
    timestamp: string;
    delivered: boolean;
    readStatus: boolean;
}

interface User {
    id: string;
    online: boolean;
}

interface MessageState {
    messages: Message[];
    currentUserId: string | null;
    connectedToUser: string | null;
    users: { [key: string]: User };
    websocket: WebSocket | null;
}

const initialState: MessageState = {
    messages: [],
    currentUserId: null,
    connectedToUser: null,
    users: {},
    websocket: null
};

const messageSlice = createSlice({
    name: 'messages',
    initialState,
    reducers: {
        setCurrentUser(state, action: PayloadAction<string>) {
            state.currentUserId = action.payload;
        },
        setConnectedUser(state, action: PayloadAction<string>) {
            state.connectedToUser = action.payload;
        },
        addMessage(state, action: PayloadAction<Message>) {
            state.messages.push(action.payload);
        },
        setMessageDelivered(state, action: PayloadAction<string>) {
            const message = state.messages.find(m => m.id === action.payload);
            if (message) {
                message.delivered = true;
            }
        },
        setUserOnlineStatus(state, action: PayloadAction<{ userId: string; online: boolean }>) {
            state.users[action.payload.userId] = {
                id: action.payload.userId,
                online: action.payload.online
            };
        },
        initializeMessages(state, action: PayloadAction<Message[]>) {
            // Replace all messages with the initial set
            state.messages = action.payload;
        },
        clearChat(state) {
            state.messages = [];
            state.connectedToUser = null;
            state.currentUserId = null;  // Also clear the current user
            state.users = {};  // Optionally clear users too
        }
    }
});

export const {
    setCurrentUser,
    setConnectedUser,
    addMessage,
    setMessageDelivered,
    setUserOnlineStatus,
    clearChat,
    initializeMessages
} = messageSlice.actions;

export default messageSlice.reducer;