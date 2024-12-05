import React, { useState } from 'react';
import { useAppDispatch } from '../hooks/redux';
import { setCurrentUser } from '../store/messageSlice';
import { generateShortId, saveUser, getRecentUsers, StoredUser } from '../store/storage.ts';
import styles from './UserSetup.module.css';

export const UserSetup = () => {
    const [userId, setUserId] = useState('');
    const [selectedId, setSelectedId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const dispatch = useAppDispatch();
    const recentUsers = getRecentUsers();

    const generateNewId = () => {
        const newId = generateShortId();
        setUserId(newId);
        setSelectedId(newId);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (userId.trim()) {
            saveUser(userId);
            dispatch(setCurrentUser(userId));
        }
    };

    const selectUser = (user: StoredUser) => {
        setUserId(user.id);
        setSelectedId(user.id);
    };

    return (
        <div className={styles.container}>
            <h2 className={styles.title}>Setup User ID</h2>

            {selectedId && (
                <div className={styles.selectedIdContainer}>
                    <span className={styles.selectedIdLabel}>Selected ID: </span>
                    <span className={styles.selectedId}>{selectedId}</span>
                </div>
            )}

            {recentUsers.length > 0 && (
                <div className={styles.recentUsersSection}>
                    <h3 className={styles.recentUsersTitle}>Recent Users</h3>
                    <div className={styles.recentUsersList}>
                        {recentUsers.map(user => (
                            <button
                                key={user.id}
                                onClick={() => selectUser(user)}
                                className={`${styles.userButton} ${
                                    user.id === selectedId ? styles.userButtonSelected : styles.userButtonUnselected
                                }`}
                            >
                                {user.id}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className={styles.form}>
                <input
                    type="text"
                    value={userId}
                    onChange={(e) => {
                        setUserId(e.target.value);
                        setSelectedId(e.target.value);
                    }}
                    placeholder="Enter user ID"
                    className={styles.input}
                />
                <div className={styles.buttonGroup}>
                    <button
                        type="button"
                        onClick={generateNewId}
                        disabled={isLoading}
                        className={styles.generateButton}
                    >
                        Generate ID
                    </button>
                    <button
                        type="submit"
                        disabled={!userId.trim()}
                        className={styles.submitButton}
                    >
                        Connect
                    </button>
                </div>
            </form>
        </div>
    );
};