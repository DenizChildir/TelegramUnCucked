// DataManager.tsx
import React, { useState } from 'react';
import { useAppSelector, useAppDispatch } from '../hooks/redux';
import { clearChat } from '../store/messageSlice';
import { deleteUserData, deleteContactHistory, deleteAllUserData, getStorageManager } from '../store/storage';
import styles from './DataManager.module.css';

export const DataManager = () => {
    const dispatch = useAppDispatch();
    const currentUserId = useAppSelector(state => state.messages.currentUserId);
    const [showConfirm, setShowConfirm] = useState(false);

    const getContacts = () => {
        const storage = getStorageManager();
        const contacts = new Set<string>();

        Object.keys(storage.messages).forEach(key => {
            const [fromId, toId] = key.split(':');
            if (fromId === currentUserId) contacts.add(toId);
            if (toId === currentUserId) contacts.add(fromId);
        });

        return Array.from(contacts);
    };

    const handleDeleteCurrentUser = () => {
        if (window.confirm('Are you sure you want to delete your user data? This cannot be undone.')) {
            if (currentUserId) {
                deleteUserData(currentUserId);
                dispatch(clearChat());
            }
        }
    };

    const handleDeleteContact = (contactId: string) => {
        if (window.confirm(`Are you sure you want to delete all messages with ${contactId}? This cannot be undone.`)) {
            if (currentUserId) {
                deleteContactHistory(currentUserId, contactId);
                dispatch(clearChat());
            }
        }
    };

    const handleDeleteAll = () => {
        if (window.confirm('Are you sure you want to delete ALL data? This will remove all messages and users and cannot be undone.')) {
            deleteAllUserData();
            dispatch(clearChat());
        }
    };

    return (
        <div className={styles.container}>
            <h3 className={styles.title}>Data Management</h3>

            {!showConfirm ? (
                <button
                    className={styles.manageButton}
                    onClick={() => setShowConfirm(true)}
                >
                    Manage Data
                </button>
            ) : (
                <div className={styles.optionsContainer}>
                    <div className={styles.section}>
                        <h4 className={styles.sectionTitle}>Delete Options</h4>
                        <button
                            className={styles.deleteButton}
                            onClick={handleDeleteCurrentUser}
                        >
                            Delete My User Data
                        </button>
                    </div>

                    <div className={styles.section}>
                        <h4 className={styles.sectionTitle}>Contact History</h4>
                        <div className={styles.contactsList}>
                            {getContacts().map(contactId => (
                                <div key={contactId} className={styles.contactItem}>
                                    <span className={styles.contactId}>{contactId}</span>
                                    <button
                                        className={styles.deleteButton}
                                        onClick={() => handleDeleteContact(contactId)}
                                    >
                                        Delete History
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className={styles.section}>
                        <div className={styles.warning}>
                            Warning: Deleting all data will remove all messages and user information.
                            This action cannot be undone.
                        </div>
                        <button
                            className={styles.deleteAllButton}
                            onClick={handleDeleteAll}
                        >
                            Delete All Data
                        </button>
                    </div>

                    <button
                        className={styles.cancelButton}
                        onClick={() => setShowConfirm(false)}
                    >
                        Cancel
                    </button>
                </div>
            )}
        </div>
    );
};