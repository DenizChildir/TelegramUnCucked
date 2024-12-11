// UserMenu.tsx
import React from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { setCurrentUser, setConnectedUser, clearChat } from '../store/messageSlice';
import { getRecentUsers, getRecentContacts, StoredUser } from '../store/storage';
import styles from './UserMenu.module.css';

export const UserMenu = () => {
    const dispatch = useAppDispatch();
    const currentUserId = useAppSelector(state => state.messages.currentUserId);
    const connectedToUser = useAppSelector(state => state.messages.connectedToUser);

    // Get both recent users and contacts
    const recentUsers = getRecentUsers();
    const recentContacts = currentUserId ? getRecentContacts(currentUserId) : [];

    const handleUserChange = (userId: string) => {
        dispatch(clearChat());
        dispatch(setCurrentUser(userId));
    };

    const handleContactSwitch = (contactId: string) => {
        // If already connected to this contact, do nothing
        if (connectedToUser === contactId) return;

        // Switch to the contact
        dispatch(setConnectedUser(contactId));
    };

    const handleDisconnect = () => {
        dispatch(setConnectedUser(null));
    };

    const handleLogout = () => {
        dispatch(clearChat());
    };

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

            <div className={styles.menuSections}>
                <div className={styles.section}>
                    <h4 className={styles.sectionTitle}>Recent Contacts</h4>
                    <div className={styles.contactsList}>
                        {recentContacts.map(contact => (
                            <button
                                key={contact.userId}
                                onClick={() => handleContactSwitch(contact.userId)}
                                className={`${styles.contactButton} ${
                                    contact.userId === connectedToUser ? styles.activeContact : ''
                                }`}
                            >
                                {contact.userId}
                                {contact.userId === connectedToUser &&
                                    <span className={styles.currentIndicator}> (Current)</span>
                                }
                            </button>
                        ))}
                        {recentContacts.length === 0 && (
                            <span className={styles.noContacts}>No recent contacts</span>
                        )}
                    </div>
                </div>

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
                            >
                                {user.id}
                                {user.id === currentUserId &&
                                    <span className={styles.currentIndicator}> (Current)</span>
                                }
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};