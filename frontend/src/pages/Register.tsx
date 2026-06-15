import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Sparkles, ArrowRight, ShieldAlert } from 'lucide-react';
import { api, getAuthToken } from '../services/api';

export default function Register() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getAuthToken()) {
      navigate('/');
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !email || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await api.auth.register({ username, email, password });
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Registration failed. Username might be taken.');
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
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Create an Account</h2>
          <p className="text-sm text-gray-400 mt-1 text-center font-medium">Join ExpenseLens and share expenses intelligently</p>
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
              placeholder="Pick a username"
              className="w-full bg-gray-50/50 border border-gray-100 focus:border-brand-primary focus:bg-white focus:ring-1 focus:ring-brand-primary/20 rounded-xl px-4 py-3 text-sm transition-all outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
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

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-gray-50/50 border border-gray-100 focus:border-brand-primary focus:bg-white focus:ring-1 focus:ring-brand-primary/20 rounded-xl px-4 py-3 text-sm transition-all outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-primary hover:bg-indigo-600 text-white rounded-xl py-3.5 text-sm font-semibold transition-all duration-150 shadow-md shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? 'Registering...' : 'Sign Up'}
            <ArrowRight size={16} />
          </button>
        </form>

        {/* Login Link */}
        <div className="mt-6 text-center text-xs font-medium text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-primary hover:underline font-bold">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
