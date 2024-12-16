// App.tsx
import React, { useState } from 'react';
import { Provider } from 'react-redux';
import { store } from './store/store';
import { UserSetup } from './components/UserSetup';
import { Chat } from './components/chat';
import { useAppSelector, useAppDispatch } from './hooks/redux';
import { UserMenu } from './components/UserMenu';
import { ConnectUser } from './components/ConnectUser';
import { DataManager } from './components/DataManagment';
import { initializeStorage } from './store/fileStorage';
import { clearChat } from './store/messageSlice';

const AppContent = () => {
    const currentUserId = useAppSelector(state => state.messages.currentUserId);
    const connectedToUser = useAppSelector(state => state.messages.connectedToUser);
    const dispatch = useAppDispatch();

    const [storageState, setStorageState] = useState<{
        isInitialized: boolean;
        error: string | null;
        hasPermission: boolean;
    }>({
        isInitialized: false,
        error: null,
        hasPermission: false
    });

    const initializeApp = async () => {
        try {
            await initializeStorage();
            setStorageState({
                isInitialized: true,
                error: null,
                hasPermission: true
            });
        } catch (error) {
            console.error('Storage initialization error:', error);

            if (error instanceof Error && error.name === 'NotAllowedError') {
                setStorageState({
                    isInitialized: false,
                    error: 'Permission to access file system was denied. Please try again.',
                    hasPermission: false
                });
            } else {
                setStorageState({
                    isInitialized: false,
                    error: 'Failed to initialize storage system. Please try again.',
                    hasPermission: false
                });
            }

            dispatch(clearChat());
        }
    };

    if (!storageState.isInitialized) {
        return (
            <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
                <div style={{
                    textAlign: 'center',
                    padding: '20px',
                    backgroundColor: storageState.error ? '#fff3f3' : '#f0f0f0',
                    borderRadius: '8px'
                }}>
                    <h2 style={{ marginBottom: '16px' }}>Welcome to Chat App</h2>
                    <p style={{ marginBottom: '16px' }}>
                        To get started, please select a directory where your chat messages will be stored.
                    </p>
                    {storageState.error && (
                        <div style={{ color: '#e53e3e', marginBottom: '16px' }}>
                            {storageState.error}
                        </div>
                    )}
                    <button
                        onClick={initializeApp}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#3182ce',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '16px'
                        }}
                    >
                        Select Storage Directory
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
            {!currentUserId ? (
                <UserSetup />
            ) : (
                <>
                    <UserMenu />
                    {!connectedToUser ? (
                        <ConnectUser />
                    ) : (
                        <>
                            <DataManager />
                            <Chat />
                        </>
                    )}
                </>
            )}
        </div>
    );
};

export const App = () => (
    <Provider store={store}>
        <AppContent />
    </Provider>
);