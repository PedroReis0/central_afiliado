
import React, { useState } from 'react';
import { LayoutGrid, Package, Activity, Ticket, FileText, Smartphone, Menu, X, LogOut } from 'lucide-react';
import { ViewState } from '../types';

interface LayoutProps {
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ currentView, onNavigate, onLogout, children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const NavItem = ({ view, icon: Icon, label }: { view: ViewState; icon: any; label: string }) => (
    <button
      onClick={() => {
        onNavigate(view);
        setIsSidebarOpen(false);
      }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${
        currentView === view
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      <Icon size={20} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex text-gray-900 transition-colors duration-200">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-white border-r border-gray-200 z-50 transform transition-transform duration-300 lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl text-gray-900">
            <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center text-white">C</div>
            Central
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-gray-500">
            <X size={24} />
          </button>
        </div>

        <nav className="p-4 space-y-2">
          <NavItem view="dashboard" icon={LayoutGrid} label="Dashboard" />
          <NavItem view="monitor" icon={Activity} label="Monitor" />
          
          <div className="pt-4 pb-2 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Gestão</div>
          <NavItem view="products" icon={Package} label="Produtos" />
          <NavItem view="coupons" icon={Ticket} label="Cupons" />
          <NavItem view="templates" icon={FileText} label="Templates" />

          <div className="pt-4 pb-2 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Sistema</div>
          <NavItem view="integrations" icon={Smartphone} label="Automação" />
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-gray-100">
            <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors font-medium">
                <LogOut size={20} /> Sair
            </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50 transition-colors duration-200">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30 px-4 sm:px-8 py-4 flex items-center justify-between transition-colors duration-200">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-gray-500 p-2">
                <Menu size={24} />
            </button>
            
            <div className="flex items-center gap-4 ml-auto">
                <div className="hidden sm:flex flex-col items-end">
                    <span className="text-sm font-bold text-gray-900">Admin User</span>
                    <span className="text-xs text-gray-500">admin@central.com</span>
                </div>
                <div className="h-10 w-10 bg-gray-200 border border-gray-300 rounded-full flex items-center justify-center text-gray-500 font-bold">AU</div>
            </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 overflow-y-auto">
            {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
