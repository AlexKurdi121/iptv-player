// app/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { supabase } from './lib/supabase';

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
  const [isTV, setIsTV] = useState(false);
  const hlsRef = useRef<Hls | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Detect if on Smart TV
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isSmartTV = 
      userAgent.includes('smarttv') ||
      userAgent.includes('tizen') ||
      userAgent.includes('webos') ||
      userAgent.includes('android') && userAgent.includes('tv') ||
      userAgent.includes('vizio') ||
      userAgent.includes('sony') ||
      userAgent.includes('samsung');
    
    setIsTV(isSmartTV);
    console.log('Device detected:', isSmartTV ? 'Smart TV' : 'Regular device');
  }, []);

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

  const fallbackChannels: Channel[] = [];

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
            streamUrl: item.stream_url || item.streamUrl || '',
            category: item.category || 'General',
            icon: item.icon || 'https://via.placeholder.com/200x200/e5e7eb/6b7280?text=📺',
            isActive: item.is_active !== undefined ? item.is_active : true
          }));
          setChannels(mappedData);
        } else {
          setChannels(fallbackChannels);
        }
      } catch (err) {
        console.error('Error:', err);
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
        () => { fetchChannels(); }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const categories = ['All', ...new Set(channels.map(ch => ch.category))];

  const filteredChannels = channels.filter(channel => {
    const matchesSearch = channel.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || channel.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Fixed stream loading with robust HLS.js prioritization for webOS/Smart TVs
  const loadStream = (streamUrl: string, retryCount = 0) => {
    const video = videoRef.current;
    if (!video) return;

    if (!streamUrl || streamUrl.trim() === '') {
      setError('Invalid stream URL');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    try {
      // Prioritize HLS.js over broken WebOS/Smart TV native players
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: false, // Disabling worker prevents threading permission blocks on TVs
          lowLatencyMode: true,
          liveDurationInfinity: true,
          fragLoadingTimeOut: 30000,
          manifestLoadingTimeOut: 30000,
        });
        
        hlsRef.current = hls;
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
          video.play().catch((err) => {
            console.log('Autoplay prevented:', err);
          });
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            console.error('Fatal HLS error:', data);
            setIsLoading(false);
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              setError('Network error or mixed-content blocked (HTTP stream over HTTPS).');
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls.recoverMediaError();
            } else {
              setError(`Stream error: ${data.details}`);
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native fallback strictly for Safari / iOS
        video.src = streamUrl;
        video.onloadedmetadata = () => {
          setIsLoading(false);
          video.play().catch(e => console.log(e));
        };
        video.onerror = () => {
          setIsLoading(false);
          setError('Failed to load stream natively.');
        };
      } else {
        setIsLoading(false);
        setError('HLS playback is not supported on this device/browser.');
      }
    } catch (err) {
      setIsLoading(false);
      setError('Failed to load stream: ' + (err as Error).message);
    }
  };

  const cleanupPlayer = () => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = '';
      videoRef.current.load();
    }
  };

  const handleChannelClick = (channel: Channel) => {
    cleanupPlayer();
    
    if (!channel.streamUrl || channel.streamUrl.trim() === '') {
      setError(`Channel "${channel.name}" has no stream URL`);
      return;
    }
    
    setSelectedChannel(channel);
    setCurrentChannel(channel);
    setShowModal(true);
    setError(null);
    
    setTimeout(() => {
      loadStream(channel.streamUrl);
    }, 400);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    cleanupPlayer();
    setCurrentChannel(null);
    setIsLoading(false);
    setSelectedChannel(null);
    setError(null);
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  useEffect(() => {
    return cleanupPlayer;
  }, []);

  if (loadingChannels) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent"></div>
          <p className={`mt-4 ${isDarkMode ? 'text-white' : 'text-gray-700'}`}>Loading channels...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isDarkMode ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' : 'bg-gradient-to-br from-blue-50 via-white to-purple-50'
    }`}>
      {/* Header */}
      <header className={`sticky top-0 z-50 ${isDarkMode ? 'bg-gray-900/95 border-gray-700' : 'bg-white/80 border-gray-200'} border-b backdrop-blur-lg shadow-sm`}>
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/25">
                <span className="text-2xl">📺</span>
              </div>
              <div>
                <h1 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                  IPTV Player {isTV && <span className="text-xs ml-2 text-blue-400">(TV Mode)</span>}
                </h1>
                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{channels.length} Channels</p>
              </div>
            </div>
            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-lg transition-all duration-300 ${
                isDarkMode ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {isDarkMode ? '🌞' : '🌙'}
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-between">
            <span className="text-red-400 text-sm">⚠️ {error}</span>
            <button
              onClick={() => {
                if (selectedChannel) {
                  setError(null);
                  loadStream(selectedChannel.streamUrl);
                }
              }}
              className="px-3 py-1 bg-red-500/20 text-red-400 rounded-lg text-xs hover:bg-red-500/30 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Search & Categories */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search channels..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full rounded-xl px-4 py-3 border focus:outline-none ${
                isDarkMode ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400'
              }`}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === category 
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25' 
                    : isDarkMode ? 'bg-gray-800 text-gray-300 border border-gray-700' : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Channels Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredChannels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => handleChannelClick(channel)}
              className={`group relative rounded-2xl overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl border ${
                isDarkMode ? 'bg-gray-800 border-gray-700 hover:border-blue-400' : 'bg-white border-gray-200 hover:border-blue-400'
              }`}
            >
              <div className="relative aspect-square w-full bg-gradient-to-br from-gray-100 to-gray-200">
                <img 
                  src={channel.icon} 
                  alt={channel.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/200x200/e5e7eb/6b7280?text=📺'; }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent"></div>
                <div className={`absolute top-2 right-2 px-2.5 py-1 rounded-lg text-[10px] font-medium border backdrop-blur-sm ${
                  isDarkMode ? 'bg-gray-800/90 text-gray-300 border-gray-600' : 'bg-white/90 text-gray-700 border-gray-200'
                }`}>
                  {channel.category}
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                <h3 className="text-white font-semibold text-sm truncate text-center">{channel.name}</h3>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Video Player Modal */}
      {showModal && selectedChannel && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={handleCloseModal}></div>
          <div className={`relative rounded-2xl w-full max-w-4xl border shadow-2xl overflow-hidden ${
            isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            <button
              onClick={handleCloseModal}
              className={`absolute top-3 right-3 z-10 w-10 h-10 rounded-full flex items-center justify-center ${
                isDarkMode ? 'bg-gray-800 text-gray-300 hover:text-white' : 'bg-gray-100 text-gray-600 hover:text-gray-800'
              }`}
            >
              ✕
            </button>

            <div className={`px-6 py-4 border-b flex items-center gap-3 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-white shadow-md flex-shrink-0">
                <img src={selectedChannel.icon} alt={selectedChannel.name} className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{selectedChannel.name}</h3>
                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{selectedChannel.category}</p>
              </div>
            </div>

            <div className="relative bg-black">
              <video
                ref={videoRef}
                className="w-full aspect-video"
                controls
                playsInline
                autoPlay
                style={{ minHeight: '300px' }}
              />
              
              {isLoading && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
                    <p className="text-white mt-3 text-sm font-medium">Loading stream...</p>
                  </div>
                </div>
              )}
            </div>

            <div className={`px-6 py-4 flex items-center justify-between border-t ${
              isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'
            }`}>
              <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Now Playing: {selectedChannel.name}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => loadStream(selectedChannel.streamUrl)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
                >
                  Reload
                </button>
                <button
                  onClick={handleCloseModal}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}