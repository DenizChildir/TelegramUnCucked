// App.tsx
import React from 'react';
import { Provider } from 'react-redux';
import { store } from './store/store';
import { UserSetup } from './components/UserSetup';
import { Chat } from './components/chat';
import { useAppSelector } from './hooks/redux';
import { UserMenu } from './components/UserMenu';
import { ConnectUser } from './components/ConnectUser';
import { DataManager } from './components/DataManagment';

const AppContent = () => {
    const currentUserId = useAppSelector(state => state.messages.currentUserId);
    const connectedToUser = useAppSelector(state => state.messages.connectedToUser);

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