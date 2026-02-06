import React, { useEffect, useState } from 'react';
import { apiGet } from '../api';

interface PrivateRouteProps {
    children: React.ReactNode;
    onLogout: () => void;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, onLogout }) => {
    const [loading, setLoading] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);

    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                setAuthenticated(false);
                setLoading(false);
                return;
            }

            try {
                // Optional: Verify compatibility with backend (validate token)
                // For now, we trust the token existence and rely on API errors (401) to header user out
                // But a verification call is good practice:
                await apiGet('/auth/me'); // Will throw if token invalid
                setAuthenticated(true);
            } catch (err) {
                localStorage.removeItem('token');
                setAuthenticated(false);
                onLogout();
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, [onLogout]);

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
    }

    if (!authenticated) {
        // Force logout/login screen
        onLogout();
        return null;
    }

    return <>{children}</>;
};

export default PrivateRoute;
