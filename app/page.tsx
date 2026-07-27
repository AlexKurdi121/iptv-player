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
    
    // Log for debugging
    console.log('Device detected:', isSmartTV ? 'Smart TV' : 'Regular device');
    console.log('User Agent:', userAgent);
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

  // Fallback channels
  const fallbackChannels: Channel[] = [
    {
      id: 1,
      name: 'AWA HD',
      streamUrl: 'https://hlspackager.akamaized.net/live/DB/KURDSAT_HD/HLS/KURDSAT_HD-avc1_2500000=10002,mp4a_128000=20000.m3u8',
      category: 'News',
      icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSGsmT-3AqLglhj9wzw7-RTjnDV_0fFYXE_6pKu6hc8Qw&s',
      isActive: true
    },
    {
      id: 2,
      name: 'Rudaw HD',
      streamUrl: 'http://aou.magiclive.xyz:2052/live/a79KGwP5/uW5HjCq/323743.m3u8',
      category: 'News',
      icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTXjsvt4iSFm8dhrsa0RKn_gES-wg05EWBY0Xqkp7JyAygcD7Vqm-0uMWg&s=10',
      isActive: true
    },
    {
      id: 3,
      name: 'Channel 8',
      streamUrl: 'http://spacetvee.com:8080/live/0505661080/43754754880/22186.m3u8',
      category: 'General',
      icon: 'https://mir-s3-cdn-cf.behance.net/project_modules/1400/3b23e687121229.5dfb5ee081eba.jpg',
      isActive: true
    },
    {
      id: 4,
      name: 'Al-Hadath',
      streamUrl: 'http://spacetvee.com:8080/live/0505661080/43754754880/22186.m3u8',
      category: 'News',
      icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSGsmT-3AqLglhj9wzw7-RTjnDV_0fFYXE_6pKu6hc8Qw&s',
      isActive: true
    },
    {
      id: 5,
      name: 'Al-Arabiya',
      streamUrl: 'http://spacetvee.com:8080/live/0505661080/43754754880/22186.m3u8',
      category: 'News',
      icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTXjsvt4iSFm8dhrsa0RKn_gES-wg05EWBY0Xqkp7JyAygcD7Vqm-0uMWg&s=10',
      isActive: true
    },
    {
      id: 6,
      name: 'Kurdistan TV',
      streamUrl: 'http://spacetvee.com:8080/live/0505661080/43754754880/22186.m3u8',
      category: 'General',
      icon: 'https://mir-s3-cdn-cf.behance.net/project_modules/1400/3b23e687121229.5dfb5ee081eba.jpg',
      isActive: true
    },
    {
      id: 7,
      name: 'KurdMax Sorani HD',
      streamUrl: 'http://spacetvee.com:8080/live/0505661080/43754754880/22186.m3u8',
      category: 'General',
      icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSGsmT-3AqLglhj9wzw7-RTjnDV_0fFYXE_6pKu6hc8Qw&s',
      isActive: true
    },
    {
      id: 8,
      name: 'NRT HD',
      streamUrl: 'http://spacetvee.com:8080/live/0505661080/43754754880/22186.m3u8',
      category: 'News',
      icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTXjsvt4iSFm8dhrsa0RKn_gES-wg05EWBY0Xqkp7JyAygcD7Vqm-0uMWg&s=10',
      isActive: true
    },
    {
      id: 9,
      name: 'NRT Sports',
      streamUrl: 'http://spacetvee.com:8080/live/0505661080/43754754880/22186.m3u8',
      category: 'Sports',
      icon: 'https://mir-s3-cdn-cf.behance.net/project_modules/1400/3b23e687121229.5dfb5ee081eba.jpg',
      isActive: true
    },
    {
      id: 10,
      name: 'Avar HD',
      streamUrl: 'http://spacetvee.com:8080/live/0505661080/43754754880/22186.m3u8',
      category: 'General',
      icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSGsmT-3AqLglhj9wzw7-RTjnDV_0fFYXE_6pKu6hc8Qw&s',
      isActive: true
    },
    {
      id: 11,
      name: 'War HD',
      streamUrl: 'http://spacetvee.com:8080/live/0505661080/43754754880/22186.m3u8',
      category: 'General',
      icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTXjsvt4iSFm8dhrsa0RKn_gES-wg05EWBY0Xqkp7JyAygcD7Vqm-0uMWg&s=10',
      isActive: true
    },
    {
      id: 12,
      name: 'MBC 1',
      streamUrl: 'http://spacetvee.com:8080/live/0505661080/43754754880/22186.m3u8',
      category: 'Entertainment',
      icon: 'https://mir-s3-cdn-cf.behance.net/project_modules/1400/3b23e687121229.5dfb5ee081eba.jpg',
      isActive: true
    },
    {
      id: 13,
      name: 'MBC 2',
      streamUrl: 'http://spacetvee.com:8080/live/0505661080/43754754880/22186.m3u8',
      category: 'Entertainment',
      icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSGsmT-3AqLglhj9wzw7-RTjnDV_0fFYXE_6pKu6hc8Qw&s',
      isActive: true
    },
    {
      id: 14,
      name: 'MBC 3',
      streamUrl: 'http://spacetvee.com:8080/live/0505661080/43754754880/22186.m3u8',
      category: 'Kids',
      icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTXjsvt4iSFm8dhrsa0RKn_gES-wg05EWBY0Xqkp7JyAygcD7Vqm-0uMWg&s=10',
      isActive: true
    },
    {
      id: 15,
      name: 'BBC News',
      streamUrl: 'http://spacetvee.com:8080/live/0505661080/43754754880/22186.m3u8',
      category: 'News',
      icon: 'https://mir-s3-cdn-cf.behance.net/project_modules/1400/3b23e687121229.5dfb5ee081eba.jpg',
      isActive: true
    },
    {
      id: 16,
      name: 'BBC Drama',
      streamUrl: 'http://spacetvee.com:8080/live/0505661080/43754754880/22186.m3u8',
      category: 'Entertainment',
      icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSGsmT-3AqLglhj9wzw7-RTjnDV_0fFYXE_6pKu6hc8Qw&s',
      isActive: true
    },
    {
      id: 17,
      name: 'Shams HD',
      streamUrl: 'http://spacetvee.com:8080/live/0505661080/43754754880/22186.m3u8',
      category: 'General',
      icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTXjsvt4iSFm8dhrsa0RKn_gES-wg05EWBY0Xqkp7JyAygcD7Vqm-0uMWg&s=10',
      isActive: true
    }
  ];

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

  // Improved stream loading for Smart TVs
  const loadStream = (streamUrl: string, retryCount = 0) => {
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

    console.log('Loading stream:', streamUrl);
    console.log('Retry count:', retryCount);

    setIsLoading(true);
    setError(null);

    // Clear any existing retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // Destroy existing HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    try {
      // First, try native HLS playback (works on many Smart TVs)
      if (video.canPlayType('application/vnd.apple.mpegurl') || 
          video.canPlayType('audio/mpegurl')) {
        console.log('Using native HLS playback');
        video.src = streamUrl;
        
        video.onloadedmetadata = () => {
          console.log('Native HLS: metadata loaded');
          setIsLoading(false);
          video.play().catch((err) => {
            console.log('Autoplay prevented:', err);
            // Try again with HLS.js if native fails
            if (retryCount < 2) {
              console.log('Native playback failed, trying HLS.js...');
              setTimeout(() => loadStream(streamUrl, retryCount + 1), 1000);
            }
          });
        };

        video.onerror = (e) => {
          console.error('Native HLS error:', e);
          if (retryCount < 2) {
            console.log('Retrying with HLS.js...');
            setTimeout(() => loadStream(streamUrl, retryCount + 1), 1000);
          } else {
            setIsLoading(false);
            setError('Failed to load stream. Please try again later.');
          }
        };

        return;
      }

      // If native HLS not supported, use HLS.js
      if (Hls.isSupported()) {
        console.log('Using HLS.js');
        
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          liveDurationInfinity: true,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          // Better settings for Smart TVs
          fragLoadingTimeOut: 20000,
          manifestLoadingTimeOut: 20000,
          levelLoadingTimeOut: 20000,
          // Disable CORS restrictions for Smart TVs
          xhrSetup: function(xhr, url) {
            xhr.withCredentials = false;
            // Try to set custom headers for better compatibility
            try {
              xhr.setRequestHeader('User-Agent', 'Mozilla/5.0 (SmartTV)');
            } catch (e) {
              // Ignore header errors
            }
          }
        });
        
        hlsRef.current = hls;
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        
        // Event listeners - using only events that actually exist
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('HLS: Manifest parsed');
          setIsLoading(false);
          video.play().catch((err) => {
            console.log('Autoplay prevented:', err);
          });
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
          console.log('HLS: Level switched', data);
        });

        hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
          console.log('HLS: Fragment loaded');
          setIsLoading(false);
        });

        // Handle fragment loading events
        hls.on(Hls.Events.FRAG_LOADING, (event, data) => {
          console.log('HLS: Fragment loading', data);
        });

        // General error handler - this is the main error handler
        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS Error:', data);
          
          if (data.fatal) {
            console.log('Fatal HLS error, attempting recovery...');
            
            // Attempt recovery based on error type
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              setError('Network error. Retrying...');
              // Retry with different approach
              if (retryCount < 3) {
                setTimeout(() => {
                  loadStream(streamUrl, retryCount + 1);
                }, 2000 * (retryCount + 1));
              } else {
                setIsLoading(false);
                setError('Network error. Please check your connection.');
              }
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              setError('Media error. Retrying...');
              if (hlsRef.current) {
                try {
                  hlsRef.current.recoverMediaError();
                } catch (e) {
                  console.error('Recovery failed:', e);
                }
              }
            } else {
              setIsLoading(false);
              setError('Stream error. Please try again.');
            }
          } else {
            // Non-fatal error, just log it
            console.log('Non-fatal HLS error:', data);
          }
        });

        // Handle buffer events that exist
        hls.on(Hls.Events.BUFFER_APPENDING, (event, data) => {
          console.log('HLS: Buffer appending');
        });

        hls.on(Hls.Events.BUFFER_APPENDED, (event, data) => {
          console.log('HLS: Buffer appended');
        });

        // Handle when playback stalls
        video.addEventListener('stalled', () => {
          console.warn('Video stalled, attempting recovery...');
          if (hlsRef.current) {
            try {
              // Try to recover by seeking slightly
              if (video.buffered.length > 0) {
                const currentTime = video.currentTime;
                video.currentTime = currentTime + 0.1;
                setTimeout(() => {
                  if (video) video.currentTime = currentTime;
                }, 100);
              }
            } catch (e) {
              console.error('Stall recovery failed:', e);
            }
          }
        });

        // Handle waiting events
        video.addEventListener('waiting', () => {
          console.log('Video waiting for data...');
          if (!isLoading) {
            setIsLoading(true);
          }
        });

        video.addEventListener('canplay', () => {
          console.log('Video can play');
          setIsLoading(false);
        });

      } else {
        // Fallback: Use a simple video element
        console.log('Using fallback video playback');
        video.src = streamUrl;
        video.load();
        
        video.oncanplay = () => {
          console.log('Fallback: Video can play');
          setIsLoading(false);
          video.play().catch((err) => {
            console.log('Autoplay prevented:', err);
          });
        };

        video.onerror = (e) => {
          console.error('Fallback error:', e);
          setIsLoading(false);
          setError('Your browser does not support this stream format.');
        };
      }
    } catch (err) {
      console.error('Error loading stream:', err);
      setIsLoading(false);
      setError('Failed to load stream: ' + (err as Error).message);
      
      // Last resort retry
      if (retryCount < 2) {
        setTimeout(() => {
          loadStream(streamUrl, retryCount + 1);
        }, 2000);
      }
    }
  };

  // Clean up function
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
    
    // Small delay to ensure modal is rendered before loading stream
    setTimeout(() => {
      loadStream(channel.streamUrl);
    }, 500);
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
                  {isTV && <span className="text-xs ml-2 text-blue-400">(TV Mode)</span>}
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
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Error Message with retry option */}
        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-red-400 text-sm">⚠️ {error}</span>
              <button
                onClick={() => {
                  if (selectedChannel) {
                    setError(null);
                    setIsLoading(true);
                    loadStream(selectedChannel.streamUrl);
                  }
                }}
                className="px-3 py-1 bg-red-500/20 text-red-400 rounded-lg text-xs hover:bg-red-500/30 transition-colors"
              >
                Retry
              </button>
            </div>
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
      </div>

      {/* Video Player Modal */}
      {showModal && selectedChannel && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div 
            className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            onClick={handleCloseModal}
          ></div>
          
          <div className={`relative rounded-2xl w-full max-w-4xl border shadow-2xl animate-in fade-in zoom-in duration-200 overflow-hidden ${
            isDarkMode 
              ? 'bg-gray-900 border-gray-700' 
              : 'bg-white border-gray-200'
          }`}>
            <button
              onClick={handleCloseModal}
              className={`absolute top-3 right-3 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-colors text-lg ${
                isDarkMode 
                  ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white' 
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
                style={{ minHeight: '300px' }}
              />
              
              {isLoading && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
                    <p className="text-white mt-3 text-sm font-medium">Loading stream...</p>
                    <p className="text-gray-400 mt-1 text-xs">This may take a moment</p>
                  </div>
                </div>
              )}

              {!isLoading && currentChannel && !error && (
                <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-lg flex items-center gap-2 border border-green-500/20">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  <span className="text-green-400 text-xs font-medium">LIVE</span>
                  <span className="text-white text-xs ml-1">{selectedChannel.name}</span>
                </div>
              )}
            </div>

            <div className={`px-6 py-4 flex items-center justify-between border-t ${
              isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Now Playing
                </span>
                <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                  {selectedChannel.name}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (selectedChannel) {
                      cleanupPlayer();
                      setTimeout(() => {
                        loadStream(selectedChannel.streamUrl);
                      }, 300);
                    }
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isDarkMode 
                      ? 'bg-blue-600 text-white hover:bg-blue-700' 
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  Reload
                </button>
                <button
                  onClick={handleCloseModal}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isDarkMode 
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
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