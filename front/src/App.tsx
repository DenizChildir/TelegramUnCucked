// App.tsx
import React, { useState, useEffect } from 'react';
import { Provider } from 'react-redux';
import { store } from './store/store';
import { UserSetup } from './components/UserSetup';
import { Chat } from './components/chat';
import { useAppSelector, useAppDispatch } from './hooks/redux';
import { UserMenu } from './components/UserMenu';
import { ConnectUser } from './components/ConnectUser';
import { DataManager } from './components/DataManagment';
import { WebSocketManager } from './components/WebSocketManager';
import { initializeStorage } from './store/fileStorage';
import { initializeAllMessagesAsync } from './store/messageSlice';
import './App.css';

interface StorageState {
    isInitialized: boolean;
    error: string | null;
    hasPermission: boolean;
}

const InitializationScreen = ({
                                  error,
                                  onInitialize
                              }: {
    error: string | null;
    onInitialize: () => void;
}) => (
    <div className="initContainer">
        <h2 className="initTitle">Welcome to Chat App</h2>
        <p className="initDescription">
            To get started, please select a directory where your chat messages will be stored.
        </p>
        {error && (
            <div className="errorContainer">
                <p>{error}</p>
                <button className="retryButton" onClick={onInitialize}>
                    Try Again
                </button>
            </div>
        )}
        {!error && (
            <button className="initButton" onClick={onInitialize}>
                Select Storage Directory
            </button>
        )}
    </div>
);

const AppContent = () => {
    const dispatch = useAppDispatch();
    const currentUserId = useAppSelector(state => state.messages.currentUserId);
    const connectedToUser = useAppSelector(state => state.messages.connectedToUser);
    const [storageState, setStorageState] = useState<StorageState>({
        isInitialized: false,
        error: null,
        hasPermission: false
    });
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);

    const handleInitialize = async () => {
        try {
            await initializeStorage();
            setStorageState({
                isInitialized: true,
                error: null,
                hasPermission: true
            });
        } catch (error) {
            console.error('Storage initialization error:', error);
            const errorMessage = error instanceof Error && error.name === 'NotAllowedError'
                ? 'Permission to access file system was denied. Please try again.'
                : 'Failed to initialize storage system. Please try again.';

            setStorageState({
                isInitialized: false,
                error: errorMessage,
                hasPermission: false
            });
        }
    };

    // Load all messages when user logs in
    useEffect(() => {
        const loadAllMessages = async () => {
            if (!currentUserId || isLoadingMessages) return;

            setIsLoadingMessages(true);
            try {
                await dispatch(initializeAllMessagesAsync(currentUserId)).unwrap();
            } catch (error) {
                console.error('Error loading all messages:', error);
            } finally {
                setIsLoadingMessages(false);
            }
        };

        loadAllMessages();
    }, [currentUserId, dispatch]);

    if (!storageState.isInitialized) {
        return (
            <div className="appContainer">
                <InitializationScreen
                    error={storageState.error}
                    onInitialize={handleInitialize}
                />
            </div>
        );
    }

    // Wrap authenticated content in WebSocketManager
    if (currentUserId) {
        return (
            <div className="appContainer">
                <WebSocketManager>
                    <UserMenu />
                    {!connectedToUser ? (
                        <ConnectUser />
                    ) : (
                        <>
                            <DataManager />
                            <Chat />
                        </>
                    )}
                </WebSocketManager>
            </div>
        );
    }

    // Show setup screen for unauthenticated users
    return (
        <div className="appContainer">
            <UserSetup />
        </div>
    );
};

export const App = () => (
    <Provider store={store}>
        <div className="appWrapper">
            <header className="appHeader">
                <h1 className="appTitle">Real-Time Chat</h1>
            </header>
            <AppContent />
        </div>
    </Provider>
);

export default App;