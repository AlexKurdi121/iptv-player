// app/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTV, setIsTV] = useState(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Detect if on Smart TV
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isSmartTV = 
      userAgent.indexOf('smarttv') !== -1 ||
      userAgent.indexOf('tizen') !== -1 ||
      userAgent.indexOf('webos') !== -1 ||
      (userAgent.indexOf('android') !== -1 && userAgent.indexOf('tv') !== -1) ||
      userAgent.indexOf('vizio') !== -1 ||
      userAgent.indexOf('sony') !== -1 ||
      userAgent.indexOf('samsung') !== -1;
    
    setIsTV(isSmartTV);
    console.log('Device detected:', isSmartTV ? 'Smart TV' : 'Regular device');
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
        function() {
          fetchChannels();
        }
      )
      .subscribe();

    return function() {
      subscription.unsubscribe();
    };
  }, []);

  // Get unique categories
  const categories = ['All'];
  channels.forEach(function(ch) {
    if (categories.indexOf(ch.category) === -1) {
      categories.push(ch.category);
    }
  });

  // Filter channels
  const filteredChannels = [];
  for (var i = 0; i < channels.length; i++) {
    var channel = channels[i];
    var matchesSearch = channel.name.toLowerCase().indexOf(searchTerm.toLowerCase()) !== -1;
    var matchesCategory = selectedCategory === 'All' || channel.category === selectedCategory;
    if (matchesSearch && matchesCategory) {
      filteredChannels.push(channel);
    }
  }

  // ✅ FIXED: WebOS optimized stream loader with null checks
  const loadStream = function(streamUrl: string, retryCount: number) {
    if (retryCount === undefined) retryCount = 0;
    
    const video = videoRef.current;
    
    // ✅ Check if video element exists
    if (!video) {
      console.error('Video element not found');
      setError('Video player not ready');
      return;
    }

    if (!streamUrl || streamUrl.trim() === '') {
      setError('Invalid stream URL');
      return;
    }

    console.log('Loading stream on WebOS:', streamUrl);
    setError(null);

    // Clear any existing retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // Stop any current playback
    try {
      video.pause();
      video.removeAttribute('src');
      video.load();
    } catch (e) {
      console.warn('Error stopping playback:', e);
    }

    // For WebOS, we only use native HLS playback
    try {
      // Set the source directly
      video.src = streamUrl;
      video.load();
      
      // Try to play immediately
      const playPromise = video.play();
      if (playPromise) {
        playPromise.catch(function(err) {
          console.log('Autoplay prevented:', err);
          // Retry after a short delay
          if (retryCount < 3) {
            retryTimeoutRef.current = setTimeout(function() {
              loadStream(streamUrl, retryCount + 1);
            }, 1000);
          }
        });
      }

      // Simple error handler
      video.onerror = function(e) {
        console.error('Video error:', e);
        const errorCode = video.error ? video.error.code : 'unknown';
        console.log('Error code:', errorCode);
        
        if (retryCount < 3) {
          console.log('Retrying...', retryCount + 1);
          retryTimeoutRef.current = setTimeout(function() {
            loadStream(streamUrl, retryCount + 1);
          }, 2000);
        } else {
          setError('Failed to load stream. Please try again.');
        }
      };

      // Success handler
      video.oncanplay = function() {
        console.log('Video can play');
        // Try to play again if not already playing
        if (video.paused) {
          video.play().catch(function(err) {
            console.log('Play failed:', err);
          });
        }
      };

      // When metadata loads
      video.onloadedmetadata = function() {
        console.log('Metadata loaded');
        if (video.paused) {
          video.play().catch(function(err) {
            console.log('Play failed:', err);
          });
        }
      };

    } catch (err) {
      console.error('Error loading stream:', err);
      setError('Failed to load stream.');
    }
  };

  // ✅ FIXED: Clean up function with null checks
  const cleanupPlayer = function() {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    
    const video = videoRef.current;
    if (video) {
      try {
        video.pause();
        video.removeAttribute('src');
        video.load();
        video.onerror = null;
        video.oncanplay = null;
        video.onloadedmetadata = null;
      } catch (e) {
        console.warn('Error cleaning up player:', e);
      }
    }
  };

  const handleChannelClick = function(channel: Channel) {
    cleanupPlayer();
    
    if (!channel.streamUrl || channel.streamUrl.trim() === '') {
      setError('Channel "' + channel.name + '" has no stream URL');
      return;
    }
    
    setSelectedChannel(channel);
    setCurrentChannel(channel);
    setShowModal(true);
    setError(null);
    
    // Load the stream immediately
    setTimeout(function() {
      loadStream(channel.streamUrl, 0);
    }, 300);
  };

  const handleCloseModal = function() {
    setShowModal(false);
    cleanupPlayer();
    setCurrentChannel(null);
    setSelectedChannel(null);
    setError(null);
  };

  const toggleDarkMode = function() {
    setIsDarkMode(!isDarkMode);
  };

  useEffect(function() {
    return function() {
      cleanupPlayer();
    };
  }, []);

  // Loading state for channels
  if (loadingChannels) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent"></div>
          <p className="mt-4 text-white">Loading channels...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen transition-colors duration-300 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur-lg border-gray-700 border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/25">
                <span className="text-2xl">📺</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">
                  IPTV Player
                  {isTV && <span className="text-xs ml-2 text-blue-400">(TV Mode)</span>}
                </h1>
                <p className="text-xs text-gray-400">
                  {channels.length} Channels
                </p>
              </div>
            </div>
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg bg-gray-800 text-yellow-400 hover:bg-gray-700 transition-all duration-300"
            >
              {isDarkMode ? '🌞' : '🌙'}
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-red-400 text-sm">⚠️ {error}</span>
              <button
                onClick={function() {
                  if (selectedChannel) {
                    setError(null);
                    loadStream(selectedChannel.streamUrl, 0);
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
                onChange={function(e) { setSearchTerm(e.target.value); }}
                className="w-full rounded-xl px-4 py-3 bg-gray-800 border-gray-700 text-white placeholder-gray-400 focus:ring-blue-500 border focus:outline-none"
              />
              <svg className="absolute right-3 top-3.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
            {categories.map(function(category) {
              var isSelected = selectedCategory === category;
              return (
                <button
                  key={category}
                  onClick={function() { setSelectedCategory(category); }}
                  className={'px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ' + 
                    (isSelected 
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25' 
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                    )}
                >
                  {category}
                </button>
              );
            })}
          </div>
        </div>

        {/* Channel Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredChannels.map(function(channel) {
            return (
              <button
                key={channel.id}
                onClick={function() { handleChannelClick(channel); }}
                className="group relative rounded-2xl overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl bg-gray-800 border-gray-700 hover:border-blue-400 border"
              >
                <div className="relative aspect-square w-full bg-gradient-to-br from-gray-100 to-gray-200">
                  <img 
                    src={channel.icon} 
                    alt={channel.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    onError={function(e) {
                      e.currentTarget.src = 'https://via.placeholder.com/200x200/e5e7eb/6b7280?text=📺';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent"></div>
                  
                  <div className="absolute top-2 right-2 px-2.5 py-1 rounded-lg text-[10px] font-medium border bg-gray-800/90 text-gray-300 border-gray-600 backdrop-blur-sm">
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
            );
          })}
        </div>

        {filteredChannels.length === 0 && (
          <div className="text-center py-12 rounded-2xl bg-gray-800">
            <p className="text-gray-400">No channels found</p>
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
          
          <div className="relative rounded-2xl w-full max-w-4xl border shadow-2xl bg-gray-900 border-gray-700 overflow-hidden">
            <button
              onClick={handleCloseModal}
              className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-colors text-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white"
            >
              ✕
            </button>

            <div className="px-6 py-4 border-b border-gray-700 flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-white shadow-md flex-shrink-0">
                <img 
                  src={selectedChannel.icon} 
                  alt={selectedChannel.name}
                  className="w-full h-full object-cover"
                  onError={function(e) {
                    e.currentTarget.src = 'https://via.placeholder.com/48x48/e5e7eb/6b7280?text=📺';
                  }}
                />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">
                  {selectedChannel.name}
                </h3>
                <p className="text-xs text-gray-400">
                  {selectedChannel.category}
                </p>
              </div>
            </div>

            <div className="relative bg-black">
              {/* ✅ Video element with proper ref */}
              <video
                ref={videoRef}
                className="w-full aspect-video"
                controls
                playsInline
                autoPlay
                style={{ minHeight: '300px' }}
              />
              
              {/* LIVE Badge */}
              {currentChannel && !error && (
                <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-lg flex items-center gap-2 border border-green-500/20">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  <span className="text-green-400 text-xs font-medium">LIVE</span>
                  <span className="text-white text-xs ml-1">{selectedChannel.name}</span>
                </div>
              )}
            </div>

            <div className="px-6 py-4 flex items-center justify-between border-t border-gray-700 bg-gray-900">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Now Playing</span>
                <span className="text-sm font-medium text-white">
                  {selectedChannel.name}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={function() {
                    if (selectedChannel) {
                      cleanupPlayer();
                      setTimeout(function() {
                        loadStream(selectedChannel.streamUrl, 0);
                      }, 300);
                    }
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700"
                >
                  Reload
                </button>
                <button
                  onClick={handleCloseModal}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-gray-700 text-gray-300 hover:bg-gray-600"
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