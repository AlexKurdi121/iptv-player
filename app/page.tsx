// app/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Hls from 'hls.js';
import { supabase } from './lib/supabase';

// Define the Channel type
interface Channel {
  id: number;
  name: string;
  streamUrl: string;
  category: string;
  icon: string;
  isActive: boolean;
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Check session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fallback channels with HTTPS URLs where possible
  const fallbackChannels: Channel[] = [
    {
      id: 1,
      name: 'AWA HD',
      streamUrl: 'https://hlspackager.akamaized.net/live/DB/KURDSAT_HD/HLS/KURDSAT_HD-avc1_2500000=10002,mp4a_128000=20000.m3u8',
      category: 'News',
      icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSGsmT-3AqLglhj9wzw7-RTjnDV_0fFYXE_6pKu6hc8Qw&s',
      isActive: true
    },
    // ... rest of your channels with HTTPS URLs
  ];

  // Convert HTTP to HTTPS for stream URLs (if needed)
  const normalizeStreamUrl = (url: string): string => {
    if (!url) return '';
    // If on Vercel (HTTPS), convert HTTP streams to HTTPS
    if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
      return url.replace('http://', 'https://');
    }
    return url;
  };

  // Fetch channels from Supabase
  useEffect(() => {
    const fetchChannels = async () => {
      try {
        setLoadingChannels(true);
        setError(null);
        
        const { data, error } = await supabase
          .from('channels')
          .select('*')
          .eq('is_active', true)
          .order('name', { ascending: true });

        if (error) {
          console.error('Error fetching channels:', error);
          setError(`Database error: ${error.message}`);
          setChannels(fallbackChannels);
        } else if (data && data.length > 0) {
          const mappedData = data.map((item: any) => ({
            id: item.id,
            name: item.name || 'Unknown Channel',
            streamUrl: normalizeStreamUrl(item.stream_url || item.streamUrl || ''),
            category: item.category || 'General',
            icon: item.icon || 'https://via.placeholder.com/200x200/e5e7eb/6b7280?text=📺',
            isActive: item.is_active !== undefined ? item.is_active : true
          }));
          setChannels(mappedData);
        } else {
          setChannels(fallbackChannels);
        }
      } catch (error) {
        console.error('Error:', error);
        setChannels(fallbackChannels);
      } finally {
        setLoadingChannels(false);
      }
    };

    fetchChannels();

    const subscription = supabase
      .channel('channel_updates')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'channels' },
        () => {
          fetchChannels();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Get unique categories
  const categories = ['All', ...new Set(channels.map(ch => ch.category))];

  // Filter channels
  const filteredChannels = channels.filter(channel => {
    const matchesSearch = channel.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || channel.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Function to load stream with better error handling and CORS support
  const loadStream = (streamUrl: string) => {
    const video = videoRef.current;
    if (!video) {
      console.error('Video element not found');
      return;
    }

    if (!streamUrl || streamUrl.trim() === '') {
      setError('Invalid stream URL');
      setIsLoading(false);
      return;
    }

    // Normalize URL for HTTPS
    const normalizedUrl = normalizeStreamUrl(streamUrl);
    console.log('Loading stream:', normalizedUrl);

    setIsLoading(true);
    setError(null);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    try {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          // Add CORS configuration
          xhrSetup: function(xhr, url) {
            // Allow cross-origin requests
            xhr.withCredentials = false;
            // Set headers for the stream
            xhr.setRequestHeader('Referer', 'http://aou.magiclive.xyz:2052/');
            xhr.setRequestHeader('Origin', 'http://aou.magiclive.xyz:2052');
            
            // Handle CORS for Vercel
            try {
              const urlObj = new URL(url);
              // Allow specific origins
              if (urlObj.hostname.includes('magiclive.xyz') || urlObj.hostname.includes('spacetvee.com')) {
                // For these domains, we need to allow cross-origin
                xhr.withCredentials = false;
              }
            } catch (e) {
              console.warn('Invalid URL:', url);
            }
          }
        });
        
        hlsRef.current = hls;
        hls.loadSource(normalizedUrl);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
          video.play().catch((err) => {
            console.log('Autoplay prevented:', err);
            // Still show the video, user can click play
          });
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS Error:', data);
          setIsLoading(false);
          
          // Handle specific error types
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            setError('Network error loading stream. Please check your connection.');
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            setError('Media error. The stream may be unavailable.');
          } else if (data.fatal) {
            setError('Fatal error loading stream. Please try again.');
            // Attempt recovery
            if (hlsRef.current) {
              hlsRef.current.recoverMediaError();
            }
          } else {
            setError('Stream error: ' + (data.details || 'Unknown error'));
          }
        });

      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // For Safari
        video.src = normalizedUrl;
        video.addEventListener('loadedmetadata', () => {
          setIsLoading(false);
          video.play().catch((err) => {
            console.log('Autoplay prevented:', err);
          });
        });
        video.addEventListener('error', (e) => {
          console.error('Video error:', e);
          setIsLoading(false);
          setError('Error loading stream in Safari');
        });
      } else {
        setError('HLS not supported in this browser');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Error loading stream:', err);
      setIsLoading(false);
      setError('Failed to load stream: ' + (err as Error).message);
    }
  };

  const handleChannelClick = (channel: Channel) => {
    if (!channel.streamUrl || channel.streamUrl.trim() === '') {
      setError(`Channel "${channel.name}" has no stream URL`);
      return;
    }
    
    setSelectedChannel(channel);
    setCurrentChannel(channel);
    setShowModal(true);
    // Small delay to ensure modal is rendered before loading stream
    setTimeout(() => {
      loadStream(channel.streamUrl);
    }, 300);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = '';
      videoRef.current.load();
    }
    setCurrentChannel(null);
    setIsLoading(false);
    setSelectedChannel(null);
    setError(null);
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  // Loading state
  if (loadingChannels) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDarkMode ? 'bg-gray-900' : 'bg-white'
      }`}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent"></div>
          <p className={`mt-4 ${isDarkMode ? 'text-white' : 'text-gray-700'}`}>
            Loading channels...
          </p>
        </div>
      </div>
    );
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
                <span className="text-2xl">📺</span>
              </div>
              <div>
                <h1 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                  IPTV Player
                </h1>
                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {channels.length} Channels
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

              {session ? (
                <Link href="/admin">
                  <button className="px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-sm">
                    ⚙️ Admin
                  </button>
                </Link>
              ) : (
                <Link href="/login">
                  <button className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm">
                    🔐 Login
                  </button>
                </Link>
              )}

              {currentChannel && (
                <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border ${
                  isDarkMode 
                    ? 'bg-green-900/30 border-green-700' 
                    : 'bg-green-100 border-green-200'
                }`}>
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  <span className={`text-xs font-medium ${isDarkMode ? 'text-green-400' : 'text-green-700'}`}>
                    LIVE
                  </span>
                  <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {currentChannel.name}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* Search and Category Filter */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
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

        {/* Channel Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredChannels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => handleChannelClick(channel)}
              className={`group relative rounded-2xl overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl ${
                isDarkMode 
                  ? 'bg-gray-800 border-gray-700 hover:border-blue-400' 
                  : 'bg-white border-gray-200 hover:border-blue-400'
              } border`}
            >
              <div className="relative aspect-square w-full bg-gradient-to-br from-gray-100 to-gray-200">
                <img 
                  src={channel.icon} 
                  alt={channel.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  onError={(e) => {
                    e.currentTarget.src = 'https://via.placeholder.com/200x200/e5e7eb/6b7280?text=📺';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent"></div>
                
                <div className={`absolute top-2 right-2 px-2.5 py-1 rounded-lg text-[10px] font-medium border ${
                  isDarkMode 
                    ? 'bg-gray-800/90 text-gray-300 border-gray-600' 
                    : 'bg-white/90 text-gray-700 border-gray-200'
                } backdrop-blur-sm`}>
                  {channel.category}
                </div>
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                <h3 className="text-white font-semibold text-sm truncate text-center">
                  {channel.name}
                </h3>
              </div>

              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="w-14 h-14 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-2xl transform group-hover:scale-110 transition-transform">
                  <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </div>
              </div>
            </button>
          ))}
        </div>

        {filteredChannels.length === 0 && (
          <div className={`text-center py-12 rounded-2xl ${
            isDarkMode ? 'bg-gray-800' : 'bg-gray-50'
          }`}>
            <p className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
              No channels found
            </p>
          </div>
        )}

        {/* Footer */}
        <div className={`mt-10 pt-6 border-t text-center transition-colors duration-300 ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            © {new Date().getFullYear()} IPTV Player. All rights reserved.
          </p>
          <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            {channels.length} channels • Click any channel to watch
          </p>
        </div>
      </div>

      {/* Video Player Modal */}
      {showModal && selectedChannel && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleCloseModal}
          ></div>
          
          <div className={`relative rounded-2xl w-full max-w-2xl border shadow-2xl animate-in fade-in zoom-in duration-200 overflow-hidden ${
            isDarkMode 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-200'
          }`}>
            <button
              onClick={handleCloseModal}
              className={`absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                isDarkMode 
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800'
              }`}
            >
              ✕
            </button>

            <div className={`px-6 py-4 border-b flex items-center gap-3 ${
              isDarkMode ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-white shadow-md flex-shrink-0">
                <img 
                  src={selectedChannel.icon} 
                  alt={selectedChannel.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = 'https://via.placeholder.com/48x48/e5e7eb/6b7280?text=📺';
                  }}
                />
              </div>
              <div>
                <h3 className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                  {selectedChannel.name}
                </h3>
                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {selectedChannel.category}
                </p>
              </div>
            </div>

            <div className="relative bg-black">
              <video
                ref={videoRef}
                className="w-full aspect-video"
                controls
                playsInline
                autoPlay
              />
              
              {isLoading && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
                    <p className="text-white mt-3 text-sm font-medium">Loading stream...</p>
                  </div>
                </div>
              )}

              {!isLoading && currentChannel && (
                <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-lg flex items-center gap-2 border border-green-500/20">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  <span className="text-green-400 text-xs font-medium">LIVE</span>
                </div>
              )}
            </div>

            <div className={`px-6 py-4 flex items-center justify-between border-t ${
              isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Now Playing
                </span>
                <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                  {selectedChannel.name}
                </span>
              </div>
              <button
                onClick={handleCloseModal}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isDarkMode 
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Close Player
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}