import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ChatState, ConnectionState, Message } from './types';

const initialState: ChatState = {
    messages: [],
    connectionState: ConnectionState.DISCONNECTED,
    userId: null,
    recipientId: null,
    error: null
};

const chatSlice = createSlice({
    name: 'chat',
    initialState,
    reducers: {
        setUserId: (state, action: PayloadAction<string>) => {
            state.userId = action.payload;
        },
        setRecipientId: (state, action: PayloadAction<string>) => {
            state.recipientId = action.payload;
        },
        setConnectionState: (state, action: PayloadAction<ConnectionState>) => {
            state.connectionState = action.payload;
        },
        addMessage: (state, action: PayloadAction<Message>) => {
            state.messages.push(action.payload);
        },
        setError: (state, action: PayloadAction<string | null>) => {
            state.error = action.payload;
        },
        clearMessages: (state) => {
            state.messages = [];
        }
    }
});
// In your chatSlice reducers:
updateMessageDelivery: (state, action: PayloadAction<{messageId: string, delivered: boolean}>) => {
    const message = state.messages.find(m => m.messageId === action.payload.messageId);
    if (message) {
        message.delivered = action.payload.delivered;
    }
}

// Export actions
export const {
    setUserId,
    setRecipientId,
    setConnectionState,
    addMessage,
    setError,
    clearMessages
} = chatSlice.actions;

// Create store
export const store = configureStore({
    reducer: {
        chat: chatSlice.reducer
    }
});

// Export types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Create hooks for TypeScript
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;