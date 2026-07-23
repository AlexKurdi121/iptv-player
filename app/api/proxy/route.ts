// app/api/proxy/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  // The target domain to replace in the URL
  const targetDomain = request.nextUrl.searchParams.get('target_domain') || '217.60.15.177:8080';
  
  if (!url) {
    return NextResponse.json(
      { error: 'Missing URL parameter' },
      { status: 400 }
    );
  }

  const decodedUrl = decodeURIComponent(url);
  console.log('🔄 Proxying URL:', decodedUrl);

  try {
    new URL(decodedUrl);

    const response = await fetch(decodedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Referer': new URL(decodedUrl).origin,
        'Origin': new URL(decodedUrl).origin,
        'Connection': 'keep-alive',
      },
      cache: 'no-store',
      redirect: 'follow',
    });

    if (!response.ok) {
      console.error('❌ Proxy error:', response.status, response.statusText);
      return NextResponse.json(
        { error: `Failed to fetch stream: ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || '';
    let text = await response.text();

    // If it's a playlist (m3u8), rewrite it
    if (decodedUrl.endsWith('.m3u8') || contentType.includes('mpegurl') || contentType.includes('x-mpegurl')) {
      console.log('📝 Rewriting playlist...');
      
      const baseUrl = new URL(decodedUrl);
      const basePath = baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/') + 1);
      const originalHost = baseUrl.host;
      
      const lines = text.split('\n');
      const rewrittenLines = lines.map(line => {
        if (!line.trim() || line.startsWith('#')) {
          return line;
        }
        
        // Build absolute URL
        let absoluteUrl: string;
        if (line.startsWith('http://') || line.startsWith('https://')) {
          absoluteUrl = line;
        } else if (line.startsWith('/')) {
          absoluteUrl = `${baseUrl.protocol}//${baseUrl.host}${line}`;
        } else {
          absoluteUrl = `${baseUrl.protocol}//${baseUrl.host}${basePath}${line}`;
        }
        
        // Replace the domain with the target domain
        try {
          const parsedUrl = new URL(absoluteUrl);
          const newUrl = `http://${targetDomain}${parsedUrl.pathname}${parsedUrl.search || ''}`;
          
          // Create proxy URL with the transformed URL as the parameter
          const encodedUrl = encodeURIComponent(newUrl);
          const proxyUrl = `https://iptv-player-m1m.vercel.app/api/proxy?url=${encodedUrl}`;
          return proxyUrl;
        } catch (e) {
          console.warn('Failed to parse URL:', absoluteUrl);
          return absoluteUrl;
        }
      });
      
      text = rewrittenLines.join('\n');
      console.log('✅ Playlist rewritten with target domain:', targetDomain);
    }

    const headers = new Headers({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range, Accept, Origin, Referer, User-Agent, Accept-Encoding, Accept-Language, Cache-Control',
      'Access-Control-Expose-Headers': 'Content-Type, Content-Length, Content-Range, Accept-Ranges',
      'Access-Control-Max-Age': '86400',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });

    if (decodedUrl.endsWith('.m3u8') || contentType.includes('mpegurl') || contentType.includes('x-mpegurl')) {
      headers.set('Content-Type', 'application/vnd.apple.mpegurl');
    } else if (decodedUrl.endsWith('.ts') || contentType.includes('video/MP2T') || contentType.includes('mp2t')) {
      headers.set('Content-Type', 'video/mp2t');
    } else if (contentType) {
      headers.set('Content-Type', contentType);
    } else {
      headers.set('Content-Type', 'application/octet-stream');
    }

    return new NextResponse(text, {
      status: 200,
      headers,
    });

  } catch (error: any) {
    console.error('❌ Proxy error:', error);
    return NextResponse.json(
      { 
        error: 'Proxy error: ' + error.message,
        url: decodedUrl
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range, Accept, Origin, Referer, User-Agent, Accept-Encoding, Accept-Language, Cache-Control',
      'Access-Control-Max-Age': '86400',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}