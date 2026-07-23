// app/api/extract/route.ts - Specialized version
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  const format = request.nextUrl.searchParams.get('format') || 'json';
  const targetDomain = request.nextUrl.searchParams.get('domain') || '217.60.15.177:8080';

  if (!url) {
    return NextResponse.json(
      { error: 'Missing URL parameter' },
      { status: 400 }
    );
  }

  try {
    const decodedUrl = decodeURIComponent(url);
    console.log('📥 Extracting from:', decodedUrl);

    // Fetch the original m3u8
    const response = await fetch(decodedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Referer': new URL(decodedUrl).origin,
        'Origin': new URL(decodedUrl).origin,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch: ${response.status}` },
        { status: response.status }
      );
    }

    let text = await response.text();
    const baseUrl = new URL(decodedUrl);
    const basePath = baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/') + 1);
    
    // Parse the playlist and extract URLs
    const lines = text.split('\n');
    const extractedUrls: string[] = [];
    let currentExtinf = '';
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('#EXTINF')) {
        currentExtinf = trimmedLine;
        continue;
      }
      
      if (trimmedLine.startsWith('#') || !trimmedLine) {
        continue;
      }
      
      // Build absolute URL
      let absoluteUrl: string;
      if (trimmedLine.startsWith('http://') || trimmedLine.startsWith('https://')) {
        absoluteUrl = trimmedLine;
      } else if (trimmedLine.startsWith('/')) {
        absoluteUrl = `${baseUrl.protocol}//${baseUrl.host}${trimmedLine}`;
      } else {
        absoluteUrl = `${baseUrl.protocol}//${baseUrl.host}${basePath}${trimmedLine}`;
      }
      
      extractedUrls.push(absoluteUrl);
    }

    // Transform URLs by replacing the domain
    const transformedUrls = extractedUrls.map(url => {
      try {
        const parsed = new URL(url);
        // Replace the domain with the target domain
        const newUrl = `http://${targetDomain}${parsed.pathname}${parsed.search || ''}`;
        return newUrl;
      } catch (e) {
        return url;
      }
    });

    // Get the first segment to extract the path pattern
    const firstSegment = extractedUrls.length > 0 ? new URL(extractedUrls[0]) : null;
    const pathPattern = firstSegment ? firstSegment.pathname : '';

    // Extract the transformed m3u8 URL
    const transformedM3u8 = `http://${targetDomain}${basePath}${baseUrl.pathname.split('/').pop()}`;

    // Return results
    return NextResponse.json({
      success: true,
      originalUrl: decodedUrl,
      originalDomain: baseUrl.host,
      targetDomain: targetDomain,
      transformedM3u8Url: transformedM3u8,
      pathPattern: pathPattern,
      totalSegments: extractedUrls.length,
      originalSegments: extractedUrls,
      transformedSegments: transformedUrls,
      // The format you want
      extractedLink: `http://${targetDomain}${basePath}${baseUrl.pathname.split('/').pop()}`
    });

  } catch (error: any) {
    console.error('❌ Extraction error:', error);
    return NextResponse.json(
      { error: 'Extraction failed: ' + error.message },
      { status: 500 }
    );
  }
}