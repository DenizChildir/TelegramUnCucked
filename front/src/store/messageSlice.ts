// messageSlice.ts
import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { Message } from '../types/types';
import * as fileStorage from './fileStorage';

interface MessageState {
    messages: Message[];
    currentUserId: string | null;
    connectedToUser: string | null;
    users: { [key: string]: User };
    loading: boolean;
    error: string | null;
}

interface User {
    id: string;
    online: boolean;
}

const initialState: MessageState = {
    messages: [],
    currentUserId: null,
    connectedToUser: null,
    users: {},
    loading: false,
    error: null
};

export const initializeAllMessagesAsync = createAsyncThunk(
    'messages/initializeAllMessagesAsync',
    async (userId: string) => {
        // Get all messages for the user
        const allMessages = await fileStorage.getAllMessages(userId);
        return allMessages;
    }
);

// Async thunks
export const setCurrentUserAsync = createAsyncThunk(
    'messages/setCurrentUserAsync',
    async (userId: string) => {
        await fileStorage.saveUser(userId);
        return userId;
    }
);

export const initializeMessagesAsync = createAsyncThunk(
    'messages/initializeMessagesAsync',
    async ({ userId1, userId2 }: { userId1: string, userId2: string }) => {
        const messages = await fileStorage.getMessages(userId1, userId2);
        return messages;
    }
);

export const addMessageAsync = createAsyncThunk(
    'messages/addMessageAsync',
    async (message: Message) => {
        await fileStorage.saveMessage(message);
        return message;
    }
);

const messageSlice = createSlice({
    name: 'messages',
    initialState,
    reducers: {
        setConnectedUser(state, action: PayloadAction<string | null>) {
            state.connectedToUser = action.payload;
            state.messages = []; // Clear messages when changing users
        },
        setUserOnlineStatus(state, action: PayloadAction<{ userId: string; online: boolean }>) {
            if (!state.users[action.payload.userId]) {
                state.users[action.payload.userId] = {
                    id: action.payload.userId,
                    online: false
                };
            }
            state.users[action.payload.userId].online = action.payload.online;
        },
        setMessageDelivered(state, action: PayloadAction<string>) {
            console.log('Setting message delivered:', action.payload);
            const message = state.messages.find(m => m.id === action.payload);
            if (message) {
                console.log('Found message to mark as delivered:', message);
                message.delivered = true;
                message.status = 'delivered';
            } else {
                console.log('Message not found for delivery, messages in state:', state.messages);
            }
        },
        setMessageRead(state, action: PayloadAction<string>) {
            console.log('Setting message read:', action.payload);
            const message = state.messages.find(m => m.id === action.payload);
            if (message) {
                console.log('Found message to mark as read:', message);
                message.readStatus = true;
                message.status = 'read';
            } else {
                console.log('Message not found for read status, messages in state:', state.messages);
            }
        },
        clearChat(state) {
            state.messages = [];
            state.connectedToUser = null;
            state.currentUserId = null;
            state.users = {};
        },
        clearError(state) {
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        // Handle setCurrentUserAsync
        builder.addCase(setCurrentUserAsync.pending, (state) => {
            state.loading = true;
            state.error = null;
        });
        builder.addCase(setCurrentUserAsync.fulfilled, (state, action) => {
            state.currentUserId = action.payload;
            state.loading = false;
        });
        builder.addCase(setCurrentUserAsync.rejected, (state, action) => {
            state.loading = false;
            state.error = action.error.message || 'Failed to set user';
        });

        // Handle initializeMessagesAsync
        builder.addCase(initializeMessagesAsync.pending, (state) => {
            state.loading = true;
            state.error = null;
        });
        builder.addCase(initializeMessagesAsync.fulfilled, (state, action) => {
            state.messages = action.payload;
            state.loading = false;
        });
        builder.addCase(initializeMessagesAsync.rejected, (state, action) => {
            state.loading = false;
            state.error = action.error.message || 'Failed to load messages';
        });

        // Handle addMessageAsync
        builder.addCase(addMessageAsync.pending, (state) => {
            state.error = null;
        });
        builder.addCase(addMessageAsync.fulfilled, (state, action) => {
            if (action.payload.content !== 'delivered') {
                state.messages.push({
                    ...action.payload,
                    status: action.payload.status || 'sent'
                });
            }
        });
        builder.addCase(addMessageAsync.rejected, (state, action) => {
            state.error = action.error.message || 'Failed to save message';
        });
        builder.addCase(initializeAllMessagesAsync.pending, (state) => {
            state.loading = true;
            state.error = null;
        });
        builder.addCase(initializeAllMessagesAsync.fulfilled, (state, action) => {
            state.messages = action.payload;
            state.loading = false;
        });
        builder.addCase(initializeAllMessagesAsync.rejected, (state, action) => {
            state.loading = false;
            state.error = action.error.message || 'Failed to load messages';
        });
    }
});

export const {
    setConnectedUser,
    setUserOnlineStatus,
    setMessageDelivered,
    setMessageRead,
    clearChat,
    clearError
} = messageSlice.actions;

export default messageSlice.reducer;