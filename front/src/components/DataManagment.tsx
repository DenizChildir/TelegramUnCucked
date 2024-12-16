// DataManager.tsx
import React, { useState } from 'react';
import { useAppSelector, useAppDispatch } from '../hooks/redux';
import { clearChat } from '../store/messageSlice';
import { deleteUserData, deleteContactHistory, deleteAllUserData } from '../store/fileStorage';
import styles from './DataManager.module.css';

export const DataManager = () => {
    const dispatch = useAppDispatch();
    const currentUserId = useAppSelector(state => state.messages.currentUserId);
    const [showConfirm, setShowConfirm] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [activeOperation, setActiveOperation] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [operationSuccess, setOperationSuccess] = useState<string | null>(null);

    const handleDeleteCurrentUser = async () => {
        if (!window.confirm('Are you sure you want to delete your user data? This cannot be undone.')) {
            return;
        }

        if (currentUserId) {
            setIsLoading(true);
            setActiveOperation('user');
            setError(null);

            try {
                await deleteUserData(currentUserId);
                dispatch(clearChat());
                setOperationSuccess('User data deleted successfully');
            } catch (error) {
                console.error('Error deleting user data:', error);
                setError('Failed to delete user data. Please try again.');
            } finally {
                setIsLoading(false);
                setActiveOperation(null);
            }
        }
    };

    const handleDeleteContact = async (contactId: string) => {
        if (!window.confirm(`Are you sure you want to delete all messages with ${contactId}? This cannot be undone.`)) {
            return;
        }

        if (currentUserId) {
            setIsLoading(true);
            setActiveOperation(`contact-${contactId}`);
            setError(null);

            try {
                await deleteContactHistory(currentUserId, contactId);
                dispatch(clearChat());
                setOperationSuccess(`Chat history with ${contactId} deleted successfully`);
            } catch (error) {
                console.error('Error deleting contact history:', error);
                setError(`Failed to delete chat history with ${contactId}`);
            } finally {
                setIsLoading(false);
                setActiveOperation(null);
            }
        }
    };

    const handleDeleteAll = async () => {
        if (!window.confirm('Are you sure you want to delete ALL data? This will remove all messages and users and cannot be undone.')) {
            return;
        }

        setIsLoading(true);
        setActiveOperation('all');
        setError(null);

        try {
            await deleteAllUserData();
            dispatch(clearChat());
            setOperationSuccess('All data deleted successfully');
            setShowConfirm(false); // Hide the options after successful deletion
        } catch (error) {
            console.error('Error deleting all data:', error);
            setError('Failed to delete all data. Please try again.');
        } finally {
            setIsLoading(false);
            setActiveOperation(null);
        }
    };

    // Clear success message after 3 seconds
    const showSuccessMessage = (message: string) => {
        setOperationSuccess(message);
        setTimeout(() => setOperationSuccess(null), 3000);
    };
    const messages = useAppSelector(state => state.messages.messages);
    const uniqueContacts = currentUserId ?
        Array.from(new Set(
            messages
                .map(msg => msg.fromId === currentUserId ? msg.toId : msg.fromId)
                .filter(id => id !== currentUserId)
        )) : [];

    return (
        <div className={styles.container}>
            <h3 className={styles.title}>Data Management</h3>

            {error && (
                <div className={styles.errorMessage}>
                    {error}
                </div>
            )}

            {operationSuccess && (
                <div className={styles.successMessage}>
                    {operationSuccess}
                </div>
            )}

            {!showConfirm ? (
                <button
                    className={styles.manageButton}
                    onClick={() => setShowConfirm(true)}
                    disabled={isLoading}
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
                            disabled={isLoading}
                        >
                            {isLoading && activeOperation === 'user'
                                ? 'Deleting...'
                                : 'Delete My User Data'
                            }
                        </button>
                    </div>

                    <div className={styles.section}>
                        <h4 className={styles.sectionTitle}>Contact History</h4>
                        <div className={styles.contactsList}>
                            {uniqueContacts.length === 0 ? (
                                <div className={styles.noContacts}>
                                    No contact history available
                                </div>
                            ) : (
                                uniqueContacts.map(contactId => (
                                    <div key={contactId} className={styles.contactItem}>
                                        <span className={styles.contactId}>{contactId}</span>
                                        <button
                                            className={styles.deleteButton}
                                            onClick={() => handleDeleteContact(contactId)}
                                            disabled={isLoading}
                                        >
                                            {isLoading && activeOperation === `contact-${contactId}`
                                                ? 'Deleting...'
                                                : 'Delete History'
                                            }
                                        </button>
                                    </div>
                                ))
                            )}
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
                            disabled={isLoading}
                        >
                            {isLoading && activeOperation === 'all'
                                ? 'Deleting All Data...'
                                : 'Delete All Data'
                            }
                        </button>
                    </div>

                    <button
                        className={styles.cancelButton}
                        onClick={() => {
                            setShowConfirm(false);
                            setError(null);
                            setOperationSuccess(null);
                        }}
                        disabled={isLoading}
                    >
                        Cancel
                    </button>
                </div>
            )}
        </div>
    );
};