import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Message } from '../types/types';

interface MessageState {
    messages: Message[];
    currentUserId: string | null;
    connectedToUser: string | null;
    users: { [key: string]: User };
}

const initialState: MessageState = {
    messages: [],
    currentUserId: null,
    connectedToUser: null,
    users: {}
};

interface User {
    id: string;
    online: boolean;
}

interface MessageState {
    messages: Message[];
    currentUserId: string | null;
    connectedToUser: string | null;
    users: { [key: string]: User };
}

const messageSlice = createSlice({
    name: 'messages',
    initialState,
    reducers: {
        setCurrentUser(state, action: PayloadAction<string>) {
            state.currentUserId = action.payload;
        },
        setConnectedUser(state, action: PayloadAction<string | null>) {
            state.connectedToUser = action.payload;
            // Clear messages when changing users
            state.messages = [];
        },
        setUserOnlineStatus(state, action: PayloadAction<{ userId: string; online: boolean }>) {
            // Create the user entry if it doesn't exist
            if (!state.users[action.payload.userId]) {
                state.users[action.payload.userId] = {
                    id: action.payload.userId,
                    online: false
                };
            }

            // Update the online status
            state.users[action.payload.userId].online = action.payload.online;
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
        },
        setMessageDelivered(state, action: PayloadAction<string>) {
            // Remove 'delivery_' prefix if it exists
            const originalMessageId = action.payload.replace('delivery_', '');
            console.log('Setting message delivered for ID:', originalMessageId);

            const message = state.messages.find(m => m.id === originalMessageId);
            if (message) {
                console.log('Found message to update:', message);
                message.delivered = true;
                message.status = 'delivered';
            }
        },

        setMessageRead(state, action: PayloadAction<string>) {
            const message = state.messages.find(m => m.id === action.payload);
            if (message) {
                message.readStatus = true;
                message.status = 'read';
            }
        },
        addMessage(state, action: PayloadAction<Message>) {
            // Don't add delivery confirmation messages to the message list
            if (action.payload.content === 'delivered') {
                return;
            }

            const message = {
                ...action.payload,
                status: action.payload.status || 'sent'
            };
            state.messages.push(message);
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
    initializeMessages,
    setMessageRead,
} = messageSlice.actions;

export default messageSlice.reducer;