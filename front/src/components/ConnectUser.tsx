import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { setConnectedUser } from '../store/messageSlice';
import { getRecentContacts, saveRecentContact, RecentContact } from '../store/fileStorage';
import styles from './ConnectUser.module.css';

export const ConnectUser = () => {
    const [targetUserId, setTargetUserId] = useState('');
    const [recentContacts, setRecentContacts] = useState<RecentContact[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingContacts, setIsLoadingContacts] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const currentUserId = useAppSelector(state => state.messages.currentUserId);
    const dispatch = useAppDispatch();

    // Load recent contacts when component mounts
    useEffect(() => {
        const loadContacts = async () => {
            if (!currentUserId) return;

            try {
                const contacts = await getRecentContacts(currentUserId);
                setRecentContacts(contacts);
            } catch (error) {
                console.error('Error loading recent contacts:', error);
                setError('Failed to load recent contacts');
            } finally {
                setIsLoadingContacts(false);
            }
        };

        loadContacts();
    }, [currentUserId]);

    const handleConnect = async (userId: string) => {
        if (!userId.trim() || !currentUserId || userId === currentUserId) return;

        setIsLoading(true);
        setError(null);

        try {
            // Check if user exists/is available
            const response = await fetch(`http://localhost:3000/status/${userId}`);
            const data = await response.json();

            // Save to recent contacts
            if (currentUserId) {
                await saveRecentContact(currentUserId, userId);

                // Update local recent contacts list
                const newContact: RecentContact = {
                    userId: userId,
                    lastInteraction: new Date().toISOString()
                };

                setRecentContacts(prev =>
                    [newContact, ...prev.filter(c => c.userId !== userId)].slice(0, 5)
                );
            }

            dispatch(setConnectedUser(userId));
        } catch (error) {
            console.error('Error connecting to user:', error);
            setError('Failed to connect to user. Please check the ID and try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleConnect(targetUserId);
    };

    return (
        <div className={styles.container}>
            <h2 className={styles.title}>Connect to User</h2>

            {error && (
                <div className={styles.errorMessage}>
                    {error}
                </div>
            )}

            <div className={styles.userInfo}>
                Your ID: <span className={styles.userId}>{currentUserId}</span>
            </div>

            {!isLoadingContacts && recentContacts.length > 0 && (
                <div className={styles.recentContactsSection}>
                    <h3 className={styles.recentContactsTitle}>Recent Contacts</h3>
                    <div className={styles.contactsList}>
                        {recentContacts.map(contact => (
                            <button
                                key={contact.userId}
                                onClick={() => handleConnect(contact.userId)}
                                className={styles.contactButton}
                                disabled={isLoading}
                            >
                                {contact.userId}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.inputGroup}>
                    <input
                        type="text"
                        value={targetUserId}
                        onChange={(e) => setTargetUserId(e.target.value)}
                        placeholder="Enter recipient's user ID"
                        className={styles.input}
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={
                            isLoading ||
                            !targetUserId.trim() ||
                            targetUserId === currentUserId
                        }
                        className={`${styles.connectButton} ${isLoading ? styles.loading : ''}`}
                    >
                        {isLoading ? 'Connecting...' : 'Connect'}
                    </button>
                </div>
            </form>
        </div>
    );
};