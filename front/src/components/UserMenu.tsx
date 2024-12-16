// UserMenu.tsx
import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { setCurrentUserAsync, setConnectedUser, clearChat } from '../store/messageSlice';
import { getRecentUsers, getRecentContacts, StoredUser } from '../store/fileStorage';
import styles from './UserMenu.module.css';

export const UserMenu = () => {
    const dispatch = useAppDispatch();
    const currentUserId = useAppSelector(state => state.messages.currentUserId);
    const connectedToUser = useAppSelector(state => state.messages.connectedToUser);

    const [recentUsers, setRecentUsers] = useState<StoredUser[]>([]);
    const [recentContacts, setRecentContacts] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load both recent users and contacts
    useEffect(() => {
        const loadData = async () => {
            setIsLoadingData(true);
            setError(null);

            try {
                const [users, contacts] = await Promise.all([
                    getRecentUsers(),
                    currentUserId ? getRecentContacts(currentUserId) : Promise.resolve([])
                ]);

                setRecentUsers(users);
                setRecentContacts(contacts.map(contact => contact.userId));
            } catch (error) {
                console.error('Error loading user data:', error);
                setError('Failed to load recent users and contacts');
            } finally {
                setIsLoadingData(false);
            }
        };

        loadData();
    }, [currentUserId]);

    const handleUserChange = async (userId: string) => {
        setIsLoading(true);
        setError(null);

        try {
            dispatch(clearChat());
            await dispatch(setCurrentUserAsync(userId)).unwrap();
        } catch (error) {
            console.error('Error switching user:', error);
            setError('Failed to switch user');
        } finally {
            setIsLoading(false);
        }
    };

    const handleContactSwitch = (contactId: string) => {
        if (connectedToUser === contactId) return;
        dispatch(setConnectedUser(contactId));
    };

    const handleDisconnect = () => {
        dispatch(setConnectedUser(null));
    };

    const handleLogout = () => {
        dispatch(clearChat());
    };

    if (isLoadingData) {
        return (
            <div className={styles.menuContainer}>
                <div className={styles.loadingIndicator}>
                    Loading user data...
                </div>
            </div>
        );
    }

    return (
        <div className={styles.menuContainer}>
            {error && (
                <div className={styles.errorMessage}>
                    {error}
                    <button
                        onClick={() => window.location.reload()}
                        className={styles.retryButton}
                    >
                        Retry
                    </button>
                </div>
            )}

            <div className={styles.currentStatus}>
                <span>Current User: {currentUserId}</span>
                <div className={styles.buttonGroup}>
                    {connectedToUser && (
                        <button
                            onClick={handleDisconnect}
                            className={styles.disconnectButton}
                            disabled={isLoading}
                        >
                            Disconnect
                        </button>
                    )}
                    <button
                        onClick={handleLogout}
                        className={styles.logoutButton}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Processing...' : 'Logout'}
                    </button>
                </div>
            </div>

            <div className={styles.menuSections}>
                {recentContacts.length > 0 && (
                    <div className={styles.section}>
                        <h4 className={styles.sectionTitle}>Recent Contacts</h4>
                        <div className={styles.contactsList}>
                            {recentContacts.map(contact => (
                                <button
                                    key={contact}
                                    onClick={() => handleContactSwitch(contact)}
                                    className={`${styles.contactButton} ${
                                        contact === connectedToUser ? styles.activeContact : ''
                                    }`}
                                    disabled={isLoading}
                                >
                                    {contact}
                                    {contact === connectedToUser && (
                                        <span className={styles.currentIndicator}> (Current)</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className={styles.section}>
                    <h4 className={styles.sectionTitle}>Switch User</h4>
                    <div className={styles.userList}>
                        {recentUsers.map(user => (
                            <button
                                key={user.id}
                                onClick={() => handleUserChange(user.id)}
                                className={`${styles.userButton} ${
                                    user.id === currentUserId ? styles.activeUser : ''
                                }`}
                                disabled={isLoading || user.id === currentUserId}
                            >
                                {user.id}
                                {user.id === currentUserId && (
                                    <span className={styles.currentIndicator}> (Current)</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};