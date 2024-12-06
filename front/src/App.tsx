import React from 'react';
import { Provider } from 'react-redux';
import { store } from './store/store';
import { UserSetup } from './components/UserSetup';
import { Chat } from './components/Chat';
import { useAppSelector } from './hooks/redux';
import { ConnectUser } from "./components/ConnectUser";
import { DataManager } from "./components/DataManagment.tsx";

const AppContent = () => {
    const currentUserId = useAppSelector(state => state.messages.currentUserId);
    const connectedToUser = useAppSelector(state => state.messages.connectedToUser);

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
            {currentUserId && <DataManager />}
            {!currentUserId ? (
                <UserSetup />
            ) : !connectedToUser ? (
                <ConnectUser />
            ) : (
                <Chat />
            )}
        </div>
    );
};

export const App = () => (
    <Provider store={store}>
        <AppContent />
    </Provider>
);