// components/UserSetup.tsx
import React, { useState } from 'react';
import { useAppDispatch } from '../hooks/redux';
import { setCurrentUser } from '../store/messageSlice';

export const UserSetup = () => {
    const [userId, setUserId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const dispatch = useAppDispatch();

    const generateNewId = async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await fetch('http://localhost:3000/generate-id');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            setUserId(data.id.toString()); // Convert to string since we're using it as an input value
        } catch (error) {
            console.error('Error generating ID:', error);
            setError('Failed to generate ID. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (userId.trim()) {
            dispatch(setCurrentUser(userId));
        }
    };

    return (
        <div>
            <h2>Setup User ID</h2>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <form onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
                <div>
                    <input
                        type="text"
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                        placeholder="Enter your user ID"
                        style={{
                            padding: '8px',
                            marginRight: '10px',
                            width: '200px'
                        }}
                    />
                    <button
                        type="button"
                        onClick={generateNewId}
                        disabled={isLoading}
                        style={{
                            padding: '8px 16px',
                            marginRight: '10px'
                        }}
                    >
                        {isLoading ? 'Generating...' : 'Generate New ID'}
                    </button>
                    <button
                        type="submit"
                        disabled={!userId.trim()}
                        style={{
                            padding: '8px 16px'
                        }}
                    >
                        Connect
                    </button>
                </div>
            </form>
        </div>
    );
};