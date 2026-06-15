import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Receipt, 
  ArrowLeftRight, 
  AlertTriangle, 
  FileUp, 
  History, 
  LogOut, 
  Menu, 
  X,
  Sparkles,
  Search
} from 'lucide-react';
import { api, getStoredUser } from '../services/api';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [backendDisconnected, setBackendDisconnected] = useState(false);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) {
      navigate('/login');
      return;
    }
    setUser(stored);

    // Dynamic connection check on layout mount
    async function testConnection() {
      try {
        await api.groups.list();
        setBackendDisconnected(false);
      } catch (err: any) {
        if (err.message === 'BACKEND_DISCONNECTED') {
          setBackendDisconnected(true);
        }
      }
    }
    testConnection();
  }, [navigate]);

  const handleLogout = () => {
    api.auth.logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'CSV Import', path: '/import', icon: FileUp, badge: 'Intelligence' },
    { name: 'Audit Center', path: '/audit', icon: AlertTriangle, badge: 'Anomalies' },
    { name: 'Expenses', path: '/expenses', icon: Receipt },
    { name: 'Explain My Balance', path: '/explain-balance', icon: Sparkles },
    { name: 'Groups', path: '/groups', icon: Users },
    { name: 'Decision Trail', path: '/decisions', icon: History },
  ];

  const currentPath = location.pathname;

  if (backendDisconnected) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6 text-center">
        <div className="w-full max-w-md bg-white border border-gray-150 rounded-2xl shadow-xl p-8 space-y-6">
          <div className="bg-red-50 text-brand-danger p-4 rounded-full w-max mx-auto animate-pulse">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-xl font-extrabold text-gray-950">Backend Not Connected</h2>
          <p className="text-xs text-gray-400 font-medium leading-relaxed">
            We are unable to establish a connection with the ExpenseLens Django REST API server.
            Please ensure your backend server is active and running on <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">http://localhost:8000</code>.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-brand-primary hover:bg-indigo-600 text-white rounded-xl py-3.5 text-xs font-bold transition-all duration-150 shadow-md shadow-indigo-100"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-brand-bg text-gray-800 font-sans overflow-hidden">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex md:flex-shrink-0 md:w-64 bg-white border-r border-gray-100 flex-col h-full">
        {/* Brand Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-50">
          <div className="bg-brand-primary p-2 rounded-xl text-white shadow-md shadow-indigo-100">
            <Sparkles size={20} />
          </div>
          <div>
            <h1 className="font-extrabold text-lg tracking-tight text-gray-900 leading-none">ExpenseLens</h1>
            <span className="text-[10px] text-gray-400 font-semibold tracking-wider uppercase">Shared Intelligence</span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive 
                    ? 'bg-indigo-50/70 text-brand-primary font-semibold' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className={isActive ? 'text-brand-primary' : 'text-gray-400'} />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    isActive 
                      ? 'bg-brand-primary/10 text-brand-primary' 
                      : 'bg-gray-100 text-gray-400'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-gray-50 bg-gray-50/50">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-primary to-brand-secondary text-white font-bold text-xs flex items-center justify-center">
                {user?.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="truncate w-32">
                <p className="text-sm font-semibold text-gray-900 truncate">{user?.username || 'User'}</p>
                <p className="text-[11px] text-gray-400 truncate">{user?.email || 'user@expenselens.com'}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout} 
              className="text-gray-400 hover:text-brand-danger transition-colors p-1.5 hover:bg-red-50 rounded-lg"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="bg-white border-b border-gray-100 h-16 flex items-center justify-between px-6 z-10">
          <div className="flex items-center gap-4">
            {/* Mobile Menu Toggle */}
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden text-gray-500 hover:text-gray-900 hover:bg-gray-100 p-2 rounded-lg"
            >
              <Menu size={20} />
            </button>
            
            {/* Page Title / Search Bar */}
            <div className="hidden sm:flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5 w-64 md:w-80">
              <Search size={16} className="text-gray-400" />
              <input 
                type="text" 
                placeholder="Search audit trail, split details..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-xs w-full text-gray-600 placeholder-gray-400"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Default INR Badge */}
            <div className="bg-teal-50 border border-teal-100 text-brand-accent px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse"></span>
              ₹ INR Base
            </div>

            {/* User Profile initials */}
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-primary to-brand-secondary text-white font-bold text-xs flex items-center justify-center border-2 border-white shadow">
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </div>
          </div>
        </header>

        {/* Content View */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 md:hidden flex justify-start">
          <div className="w-64 bg-white h-full flex flex-col shadow-2xl animate-slide-in">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <Sparkles size={20} className="text-brand-primary" />
                <span className="font-extrabold text-lg text-gray-900">ExpenseLens</span>
              </div>
              <button 
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-400 hover:text-gray-900 p-1 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPath === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150 ${
                      isActive 
                        ? 'bg-indigo-50/70 text-brand-primary font-semibold' 
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={18} className={isActive ? 'text-brand-primary' : 'text-gray-400'} />
                      <span>{item.name}</span>
                    </div>
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-gray-50 bg-gray-50/50">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-primary to-brand-secondary text-white font-bold text-xs flex items-center justify-center">
                    {user?.username?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-900">{user?.username || 'User'}</p>
                    <p className="text-[10px] text-gray-400 truncate w-32">{user?.email || 'user@expenselens.com'}</p>
                  </div>
                </div>
                <button 
                  onClick={handleLogout} 
                  className="text-gray-400 hover:text-brand-danger transition-colors p-1.5 hover:bg-red-50 rounded-lg"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
