import React, { useState } from 'react';
import Login from './components/Login';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Monitor from './components/Monitor';
import ProductCatalog from './components/ProductCatalog';
import Coupons from './components/Coupons';
import Templates from './components/Templates';
import Integrations from './components/Integrations';
import { ViewState } from './types';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentView('dashboard');
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

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

  return (
    <Layout 
      currentView={currentView} 
      onNavigate={setCurrentView} 
      onLogout={handleLogout}
    >
      {renderView()}
    </Layout>
  );
}

export default App;