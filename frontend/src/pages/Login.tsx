import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Sparkles, ArrowRight, ShieldAlert } from 'lucide-react';
import { api, getAuthToken } from '../services/api';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If already logged in, redirect to dashboard
    if (getAuthToken()) {
      navigate('/');
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await api.auth.login({ username, password });
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (role: 'admin' | 'aisha' | 'rohan') => {
    setUsername(role);
    setPassword('password123');
    setError('');
    setLoading(true);
    try {
      await api.auth.login({ username: role, password: 'password123' });
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Quick login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[60%] rounded-full bg-indigo-200/20 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[60%] rounded-full bg-violet-200/20 blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-white border border-gray-100 rounded-2xl shadow-xl shadow-gray-200/50 p-8 relative z-10">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-brand-primary p-3 rounded-2xl text-white shadow-lg shadow-indigo-150 mb-3">
            <Sparkles size={28} />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Welcome to ExpenseLens</h2>
          <p className="text-sm text-gray-400 mt-1 text-center font-medium">Shared Expense Platform with Audit & Decision Trails</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-100 text-brand-danger rounded-xl p-3.5 text-xs font-semibold flex items-start gap-2.5">
            <ShieldAlert size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              className="w-full bg-gray-50/50 border border-gray-100 focus:border-brand-primary focus:bg-white focus:ring-1 focus:ring-brand-primary/20 rounded-xl px-4 py-3 text-sm transition-all outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-gray-50/50 border border-gray-100 focus:border-brand-primary focus:bg-white focus:ring-1 focus:ring-brand-primary/20 rounded-xl px-4 py-3 text-sm transition-all outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-primary hover:bg-indigo-600 text-white rounded-xl py-3.5 text-sm font-semibold transition-all duration-150 shadow-md shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
            <ArrowRight size={16} />
          </button>
        </form>

        {/* Sign Up Link */}
        <div className="mt-6 text-center text-xs font-medium text-gray-500">
          New to the platform?{' '}
          <Link to="/register" className="text-brand-primary hover:underline font-bold">
            Create an Account
          </Link>
        </div>

        {/* Quick Login Shortcuts */}
        <div className="mt-8 pt-6 border-t border-gray-50">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center mb-3">Quick Internship Demo Sign-in</p>
          <div className="grid grid-cols-3 gap-2">
            {['admin', 'aisha', 'rohan'].map((role) => (
              <button
                key={role}
                onClick={() => handleQuickLogin(role as any)}
                className="bg-gray-50 hover:bg-indigo-50 hover:text-brand-primary border border-gray-100 rounded-lg py-2 text-xs font-semibold text-gray-500 transition-all capitalize"
              >
                {role}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
