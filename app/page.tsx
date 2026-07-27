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
  const [isTV, setIsTV] = useState(false);
  const hlsRef = useRef<Hls | null>(null);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isSmartTV = 
      userAgent.includes('smarttv') ||
      userAgent.includes('tizen') ||
      userAgent.includes('webos') ||
      (userAgent.includes('android') && userAgent.includes('tv')) ||
      userAgent.includes('vizio') ||
      userAgent.includes('sony') ||
      userAgent.includes('samsung');
    
    setIsTV(isSmartTV);
  }, []);

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
          setError(`Database error: ${error.message}`);
          setChannels([]);
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
          setChannels([]);
        }
      } catch (err) {
        setChannels([]);
      } finally {
        setLoadingChannels(false);
      }
    };

    fetchChannels();
  }, []);

  const categories = ['All', ...new Set(channels.map(ch => ch.category))];

  const filteredChannels = channels.filter(channel => {
    const matchesSearch = channel.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || channel.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const loadStream = (streamUrl: string) => {
    const video = videoRef.current;
    if (!video) return;

    if (!streamUrl || streamUrl.trim() === '') {
      setError('Invalid stream URL');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }

    // Force-dismiss loading state after 3 seconds on TVs to prevent freezing
    safetyTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
    }, 3000);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Bypass HLS.js entirely on TV and point video src directly to proxy route
    const proxiedUrl = `/api/stream?url=${encodeURIComponent(streamUrl)}`;

    try {
      if (isTV || !Hls.isSupported() || video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = proxiedUrl;
        video.onloadeddata = () => {
          setIsLoading(false);
          if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
        };
        video.onplaying = () => {
          setIsLoading(false);
          if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
        };
        video.onerror = () => {
          setIsLoading(false);
          if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
          setError('Failed to load stream natively on TV.');
        };
        video.play().catch((err) => {
          setIsLoading(false);
          if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
          console.log('Autoplay blocked:', err);
        });
      } else {
        const hls = new Hls({
          enableWorker: false,
          lowLatencyMode: true,
          liveDurationInfinity: true,
        });
        
        hlsRef.current = hls;
        hls.loadSource(proxiedUrl);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
          if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
          video.play().catch((err) => {
            console.log('Autoplay blocked:', err);
          });
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            setIsLoading(false);
            if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
            setError(`Stream error: ${data.details}`);
          }
        });
      }
    } catch (err) {
      setIsLoading(false);
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
      setError('Failed to load stream.');
    }
  };

  const cleanupPlayer = () => {
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
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
    setSelectedChannel(channel);
    setCurrentChannel(channel);
    setShowModal(true);
    setError(null);
    
    setTimeout(() => {
      loadStream(channel.streamUrl);
    }, 200);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    cleanupPlayer();
    setCurrentChannel(null);
    setIsLoading(false);
    setSelectedChannel(null);
    setError(null);
  };

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
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <header className={`p-4 border-b ${isDarkMode ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white'}`}>
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">IPTV Player {isTV && '(TV Mode)'}</h1>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-lg">
            {isDarkMode ? '🌞' : '🌙'}
          </button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {error && <div className="mb-4 p-3 bg-red-500/10 text-red-500 rounded-lg">⚠️ {error}</div>}

        <input
          type="text"
          placeholder="Search channels..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`w-full mb-6 px-4 py-3 rounded-xl border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredChannels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => handleChannelClick(channel)}
              className={`p-3 rounded-2xl border text-center transition-all hover:scale-105 ${
                isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              }`}
            >
              <img src={channel.icon} alt={channel.name} className="w-full aspect-square object-cover rounded-xl mb-2" onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/200x200/e5e7eb/6b7280?text=📺'; }} />
              <h3 className="font-semibold text-sm truncate">{channel.name}</h3>
            </button>
          ))}
        </div>
      </div>

      {showModal && selectedChannel && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90">
          <div className="relative w-full max-w-4xl bg-black rounded-2xl overflow-hidden">
            <button onClick={handleCloseModal} className="absolute top-3 right-3 z-30 w-10 h-10 bg-white/20 text-white rounded-full flex items-center justify-center">✕</button>

            <div className="relative w-full aspect-video flex items-center justify-center bg-black">
              <video ref={videoRef} className="w-full h-full object-contain" controls playsInline autoPlay />
              
              {isLoading && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
                    <p className="text-white mt-3 text-sm font-medium">Loading Channel</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}