// app/admin/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

interface Channel {
  id: number;
  name: string;
  streamUrl: string;
  category: string;
  icon: string;
  isActive: boolean;
}

export default function AdminPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    streamUrl: '',
    category: '',
    icon: '',
    isActive: true,
    useProxy: false
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth error:', error);
          window.location.href = '/login';
          return;
        }
        
        if (!session) {
          console.log('No session found, redirecting to login');
          window.location.href = '/login';
          return;
        }
        
        console.log('Session found for user:', session.user.email);
        setSession(session);
      } catch (error) {
        console.error('Error checking auth:', error);
        window.location.href = '/login';
      } finally {
        setCheckingAuth(false);
      }
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event);
      if (event === 'SIGNED_OUT') {
        window.location.href = '/login';
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Fetch channels
  useEffect(() => {
    if (session) {
      fetchChannels();
    }
  }, [session]);

  const fetchChannels = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      
      const mappedData = (data || []).map((item: any) => ({
        id: item.id,
        name: item.name || 'Unknown Channel',
        streamUrl: item.stream_url || item.streamUrl || '',
        category: item.category || 'General',
        icon: item.icon || 'https://via.placeholder.com/200x200/e5e7eb/6b7280?text=📺',
        isActive: item.is_active !== undefined ? item.is_active : true
      }));
      
      setChannels(mappedData);
    } catch (error) {
      console.error('Error fetching channels:', error);
      setError('Failed to fetch channels');
    } finally {
      setLoading(false);
    }
  };

  // Get unique categories
  const categories = ['All', ...new Set(channels.map(ch => ch.category))];
  
  // Filter channels based on search and category
  const filteredChannels = channels.filter(channel => {
    const matchesSearch = channel.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || channel.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get filtered channel IDs for bulk actions
  const filteredChannelIds = filteredChannels.map(ch => ch.id);

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  // Open modal for adding new channel
  const handleAddNew = () => {
    setEditingChannel(null);
    setFormData({
      name: '',
      streamUrl: '',
      category: '',
      icon: '',
      isActive: true,
      useProxy: false
    });
    setShowModal(true);
    setError(null);
    setSuccess(null);
  };

  // Open modal for editing channel
  const handleEdit = (channel: Channel) => {
    setEditingChannel(channel);
    // Check if the URL already has the proxy prefix
    const hasProxy = channel.streamUrl.includes('api/proxy?url=');
    setFormData({
      name: channel.name || '',
      streamUrl: channel.streamUrl || '',
      category: channel.category || '',
      icon: channel.icon || '',
      isActive: channel.isActive ?? true,
      useProxy: hasProxy
    });
    setShowModal(true);
    setError(null);
    setSuccess(null);
  };

  // Save channel (create or update)
  const handleSave = async () => {
    try {
      if (!formData.name.trim() || !formData.streamUrl.trim() || !formData.category.trim()) {
        setError('Please fill in all required fields');
        return;
      }

      // Process URL with proxy if enabled
      let finalStreamUrl = formData.streamUrl.trim();
      if (formData.useProxy && finalStreamUrl) {
        // Check if URL already has proxy prefix
        if (!finalStreamUrl.includes('api/proxy?url=')) {
          finalStreamUrl = `https://iptv-player-m1m.vercel.app/api/proxy?url=${encodeURIComponent(finalStreamUrl)}`;
        }
      }

      if (editingChannel) {
        const { error } = await supabase
          .from('channels')
          .update({
            name: formData.name,
            stream_url: finalStreamUrl,
            category: formData.category,
            icon: formData.icon || 'https://via.placeholder.com/200x200/e5e7eb/6b7280?text=📺',
            is_active: formData.isActive,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingChannel.id);

        if (error) throw error;
        setSuccess('Channel updated successfully!');
      } else {
        const { error } = await supabase
          .from('channels')
          .insert([{
            name: formData.name,
            stream_url: finalStreamUrl,
            category: formData.category,
            icon: formData.icon || 'https://via.placeholder.com/200x200/e5e7eb/6b7280?text=📺',
            is_active: formData.isActive
          }]);

        if (error) throw error;
        setSuccess('Channel added successfully!');
      }

      setTimeout(() => {
        fetchChannels();
        setShowModal(false);
        setSuccess(null);
      }, 1500);

    } catch (error) {
      console.error('Error saving channel:', error);
      setError('Failed to save channel');
    }
  };

  // Delete channel
  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this channel?')) return;

    try {
      const { error } = await supabase
        .from('channels')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setSuccess('Channel deleted successfully!');
      
      setTimeout(() => {
        fetchChannels();
        setSuccess(null);
      }, 1000);

    } catch (error) {
      console.error('Error deleting channel:', error);
      setError('Failed to delete channel');
    }
  };

  // Toggle channel active status
  const handleToggleActive = async (channel: Channel) => {
    try {
      const { error } = await supabase
        .from('channels')
        .update({ 
          is_active: !channel.isActive,
          updated_at: new Date().toISOString()
        })
        .eq('id', channel.id);

      if (error) throw error;
      fetchChannels();
    } catch (error) {
      console.error('Error toggling channel status:', error);
      setError('Failed to update channel status');
    }
  };

  // Bulk action: Activate all filtered channels
  const handleActivateAll = async () => {
    if (filteredChannelIds.length === 0) {
      setError('No channels to activate in the current filter');
      return;
    }

    if (!confirm(`Activate all ${filteredChannelIds.length} channel(s) in "${selectedCategory}" category?`)) return;

    try {
      setBulkActionLoading(true);
      
      const { error } = await supabase
        .from('channels')
        .update({ 
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .in('id', filteredChannelIds);

      if (error) throw error;
      
      setSuccess(`✅ Activated ${filteredChannelIds.length} channel(s) successfully!`);
      setTimeout(() => {
        fetchChannels();
        setSuccess(null);
      }, 1500);
      
    } catch (error) {
      console.error('Error activating channels:', error);
      setError('Failed to activate channels');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Bulk action: Deactivate all filtered channels
  const handleDeactivateAll = async () => {
    if (filteredChannelIds.length === 0) {
      setError('No channels to deactivate in the current filter');
      return;
    }

    if (!confirm(`Deactivate all ${filteredChannelIds.length} channel(s) in "${selectedCategory}" category?`)) return;

    try {
      setBulkActionLoading(true);
      
      const { error } = await supabase
        .from('channels')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .in('id', filteredChannelIds);

      if (error) throw error;
      
      setSuccess(`✅ Deactivated ${filteredChannelIds.length} channel(s) successfully!`);
      setTimeout(() => {
        fetchChannels();
        setSuccess(null);
      }, 1500);
      
    } catch (error) {
      console.error('Error deactivating channels:', error);
      setError('Failed to deactivate channels');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      setError('Failed to logout');
    }
  };

  const truncateText = (text: string, maxLength: number) => {
    if (!text) return 'No URL';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  // Check if a URL has proxy
  const hasProxy = (url: string) => {
    return url.includes('api/proxy?url=');
  };

  // Show loading while checking auth
  if (checkingAuth) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDarkMode ? 'bg-gray-900' : 'bg-white'
      }`}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent"></div>
          <p className={`mt-4 ${isDarkMode ? 'text-white' : 'text-gray-700'}`}>
            Checking authentication...
          </p>
        </div>
      </div>
    );
  }

  // If no session, don't render the page
  if (!session) {
    return null;
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isDarkMode 
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
        : 'bg-gradient-to-br from-blue-50 via-white to-purple-50'
    }`}>
      {/* Header */}
      <header className={`sticky top-0 z-50 transition-colors duration-300 ${
        isDarkMode 
          ? 'bg-gray-900/95 backdrop-blur-lg border-gray-700' 
          : 'bg-white/80 backdrop-blur-lg border-gray-200'
      } border-b shadow-sm`}>
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/25">
                <span className="text-2xl">⚙️</span>
              </div>
              <div>
                <h1 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                  Admin Dashboard
                </h1>
                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Manage your channels
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleDarkMode}
                className={`p-2 rounded-lg transition-all duration-300 ${
                  isDarkMode 
                    ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {isDarkMode ? '🌞' : '🌙'}
              </button>
              <button
                onClick={handleLogout}
                className={`px-4 py-2 rounded-lg transition-all duration-300 ${
                  isDarkMode 
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
              >
                🚪 Logout
              </button>
              <button
                onClick={handleAddNew}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all duration-300 flex items-center gap-2"
              >
                <span className="text-lg">+</span>
                Add Channel
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Success/Error Messages */}
        {success && (
          <div className="mb-4 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm animate-in fade-in slide-in-from-top-2 duration-200">
            {success}
          </div>
        )}
        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm animate-in fade-in slide-in-from-top-2 duration-200">
            ❌ {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className={`p-4 rounded-xl border ${
            isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Channels</p>
            <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{channels.length}</p>
          </div>
          <div className={`p-4 rounded-xl border ${
            isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Active</p>
            <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
              {channels.filter(c => c.isActive).length}
            </p>
          </div>
          <div className={`p-4 rounded-xl border ${
            isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Categories</p>
            <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
              {new Set(channels.map(c => c.category)).size}
            </p>
          </div>
          <div className={`p-4 rounded-xl border ${
            isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Inactive</p>
            <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
              {channels.filter(c => !c.isActive).length}
            </p>
          </div>
        </div>

        {/* Search, Filter, and Bulk Actions */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search channels..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full rounded-xl px-4 py-3 transition-colors ${
                    isDarkMode 
                      ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400 focus:ring-blue-500' 
                      : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-blue-500'
                  } border focus:outline-none`}
                />
                <svg className="absolute right-3 top-3.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`
                    px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all
                    ${selectedCategory === category 
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25' 
                      : isDarkMode
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }
                  `}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Bulk Actions */}
          <div className={`flex items-center gap-3 p-3 rounded-xl border ${
            isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Bulk Actions ({filteredChannels.length} channels):
            </span>
            <button
              onClick={handleActivateAll}
              disabled={bulkActionLoading || filteredChannels.length === 0}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                isDarkMode
                  ? 'bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600 text-white disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              {bulkActionLoading ? '⏳ Processing...' : '✅ Activate All'}
            </button>
            <button
              onClick={handleDeactivateAll}
              disabled={bulkActionLoading || filteredChannels.length === 0}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                isDarkMode
                  ? 'bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed'
                  : 'bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              {bulkActionLoading ? '⏳ Processing...' : '⛔ Deactivate All'}
            </button>
            <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              (Only affects channels in "{selectedCategory}" category)
            </span>
          </div>
        </div>

        {/* Channels Table */}
        <div className={`rounded-xl overflow-hidden border ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}>
                <tr>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>ID</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>Channel</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>Category</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>Proxy</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>Status</th>
                  <th className={`px-4 py-3 text-right text-xs font-medium uppercase tracking-wider ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
                    </td>
                  </tr>
                ) : filteredChannels.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={`px-4 py-8 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      No channels found
                    </td>
                  </tr>
                ) : (
                  filteredChannels.map((channel) => (
                    <tr key={channel.id} className={`transition-colors ${
                      isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
                    }`}>
                      <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        #{channel.id}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                            <img 
                              src={channel.icon} 
                              alt={channel.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = 'https://via.placeholder.com/40x40/e5e7eb/6b7280?text=📺';
                              }}
                            />
                          </div>
                          <div>
                            <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                              {channel.name}
                            </p>
                            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              {truncateText(channel.streamUrl, 30)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          isDarkMode 
                            ? 'bg-blue-500/20 text-blue-300' 
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {channel.category}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          hasProxy(channel.streamUrl)
                            ? isDarkMode
                              ? 'bg-purple-500/20 text-purple-300'
                              : 'bg-purple-100 text-purple-700'
                            : isDarkMode
                              ? 'bg-gray-600 text-gray-400'
                              : 'bg-gray-100 text-gray-500'
                        }`}>
                          {hasProxy(channel.streamUrl) ? '🔒 Proxy' : 'Direct'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleActive(channel)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            channel.isActive
                              ? isDarkMode
                                ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                              : isDarkMode
                                ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                                : 'bg-red-100 text-red-700 hover:bg-red-200'
                          }`}
                        >
                          {channel.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(channel)}
                            className={`p-2 rounded-lg transition-colors ${
                              isDarkMode 
                                ? 'hover:bg-blue-500/20 text-blue-400' 
                                : 'hover:bg-blue-50 text-blue-500'
                            }`}
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDelete(channel.id)}
                            className={`p-2 rounded-lg transition-colors ${
                              isDarkMode 
                                ? 'hover:bg-red-500/20 text-red-400' 
                                : 'hover:bg-red-50 text-red-500'
                            }`}
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className={`mt-10 pt-6 border-t text-center transition-colors duration-300 ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            © {new Date().getFullYear()} IPTV Player Admin Dashboard
          </p>
          <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            {channels.length} channels • Manage your channel list
          </p>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          ></div>
          
          <div className={`relative rounded-2xl w-full max-w-lg border shadow-2xl animate-in fade-in zoom-in duration-200 overflow-hidden ${
            isDarkMode 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-200'
          }`}>
            <div className={`px-6 py-4 border-b flex items-center justify-between ${
              isDarkMode ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                {editingChannel ? 'Edit Channel' : 'Add New Channel'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  isDarkMode 
                    ? 'hover:bg-gray-700 text-gray-400 hover:text-white' 
                    : 'hover:bg-gray-100 text-gray-600 hover:text-gray-800'
                }`}
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Channel Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name || ''}
                  onChange={handleInputChange}
                  placeholder="Enter channel name"
                  className={`w-full rounded-lg px-4 py-2.5 transition-colors ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-500' 
                      : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-blue-500'
                  } border focus:outline-none`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Stream URL *
                </label>
                <input
                  type="text"
                  name="streamUrl"
                  value={formData.streamUrl || ''}
                  onChange={handleInputChange}
                  placeholder="Enter stream URL (e.g., http://jjdjddjd.com)"
                  className={`w-full rounded-lg px-4 py-2.5 transition-colors ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-500' 
                      : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-blue-500'
                  } border focus:outline-none`}
                />
                {formData.useProxy && formData.streamUrl && (
                  <div className="mt-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-xs text-blue-400">
                      🔗 Will be saved as: <span className="font-mono break-all">
                        https://iptv-player-m1m.vercel.app/api/proxy?url={encodeURIComponent(formData.streamUrl)}
                      </span>
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Category *
                </label>
                <input
                  type="text"
                  name="category"
                  value={formData.category || ''}
                  onChange={handleInputChange}
                  placeholder="Enter category (e.g., News, Sports)"
                  className={`w-full rounded-lg px-4 py-2.5 transition-colors ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-500' 
                      : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-blue-500'
                  } border focus:outline-none`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Icon URL
                </label>
                <input
                  type="text"
                  name="icon"
                  value={formData.icon || ''}
                  onChange={handleInputChange}
                  placeholder="Enter icon URL (optional)"
                  className={`w-full rounded-lg px-4 py-2.5 transition-colors ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-500' 
                      : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-blue-500'
                  } border focus:outline-none`}
                />
              </div>

              {/* Proxy Toggle */}
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-gradient-to-r from-purple-500/5 to-blue-500/5 border-purple-500/20">
                <input
                  type="checkbox"
                  name="useProxy"
                  checked={formData.useProxy}
                  onChange={handleInputChange}
                  className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 transition-colors"
                />
                <div className="flex-1">
                  <label className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                    Use Proxy
                  </label>
                  <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    When enabled, the channel URL will be proxied through the API
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  formData.useProxy
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {formData.useProxy ? '🔒 On' : '🔓 Off'}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive ?? true}
                  onChange={handleInputChange}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Active
                </label>
              </div>
            </div>

            <div className={`px-6 py-4 border-t flex items-center justify-end gap-3 ${
              isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
            }`}>
              <button
                onClick={() => setShowModal(false)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isDarkMode 
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:shadow-lg transition-all duration-300"
              >
                {editingChannel ? 'Update Channel' : 'Add Channel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}