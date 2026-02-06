import React, { useState } from 'react';
import Login from './components/Login';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Monitor from './components/Monitor';
import ProductCatalog from './components/ProductCatalog';
import Coupons from './components/Coupons';
import Templates from './components/Templates';
import Integrations from './components/Integrations';
import { ViewState } from './types';

function App() {
  // Initial auth state check
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('token');
  });
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setCurrentView('dashboard');
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'monitor':
        return <Monitor />;
      case 'products':
        return <ProductCatalog />;
      case 'coupons':
        return <Coupons />;
      case 'templates':
        return <Templates />;
      case 'integrations':
        return <Integrations />;
      default:
        return <Dashboard />;
    }
  };

  // If not authenticated, verify if should show login.
  // Although PrivateRoute handles protection, we might want to show Login explicitly if we know we are out.
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <PrivateRoute onLogout={handleLogout}>
      <Layout
        currentView={currentView}
        onNavigate={setCurrentView}
        onLogout={handleLogout}
      >
        {renderView()}
      </Layout>
    </PrivateRoute>
  );
}

export default App;