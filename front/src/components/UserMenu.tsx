// UserMenu.tsx
import React from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { setCurrentUser, setConnectedUser, clearChat } from '../store/messageSlice';
import { getRecentUsers } from '../store/storage';
import styles from './UserMenu.module.css';

export const UserMenu = () => {
    const dispatch = useAppDispatch();
    const currentUserId = useAppSelector(state => state.messages.currentUserId);
    const connectedToUser = useAppSelector(state => state.messages.connectedToUser);

    const handleUserChange = (userId: string) => {
        dispatch(clearChat());
        dispatch(setCurrentUser(userId));
    };

    const handleDisconnect = () => {
        dispatch(setConnectedUser(null));
    };

    const handleLogout = () => {
        dispatch(clearChat());
    };

    const recentUsers = getRecentUsers();

    return (
        <div className={styles.menuContainer}>
            <div className={styles.currentStatus}>
                <span>Current User: {currentUserId}</span>
                <div className={styles.buttonGroup}>
                    {connectedToUser && (
                        <button
                            onClick={handleDisconnect}
                            className={styles.disconnectButton}
                        >
                            Disconnect
                        </button>
                    )}
                    <button
                        onClick={handleLogout}
                        className={styles.logoutButton}
                    >
                        Logout
                    </button>
                </div>
            </div>

            <div className={styles.recentUsers}>
                <h4>Switch User</h4>
                <div className={styles.userList}>
                    {recentUsers.map(user => (
                        <button
                            key={user.id}
                            onClick={() => handleUserChange(user.id)}
                            className={`${styles.userButton} ${
                                user.id === currentUserId ? styles.activeUser : ''
                            }`}
                        >
                            {user.id}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};