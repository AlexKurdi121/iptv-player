import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return new Response("Missing 'url' parameter", { status: 400 });
  }

  try {
    const upstreamResponse = await fetch(targetUrl, {
      headers: {
        "User-Agent": request.headers.get("user-agent") || "VLC/3.0.16 LibVLC/3.0.16",
        ...(request.headers.get("referer") ? { Referer: request.headers.get("referer")! } : {}),
      },
      cache: "no-store",
      redirect: "follow",
    });

    if (!upstreamResponse.ok) {
      return new Response(`Upstream fetch failed: ${upstreamResponse.statusText}`, {
        status: upstreamResponse.status,
      });
    }

    const finalUpstreamUrl = upstreamResponse.url || targetUrl;
    const contentType = upstreamResponse.headers.get("content-type") || "";
    const isM3u8 =
      targetUrl.includes(".m3u8") ||
      finalUpstreamUrl.includes(".m3u8") ||
      contentType.includes("application/vnd.apple.mpegurl") ||
      contentType.includes("audio/mpegurl");

    if (isM3u8) {
      const text = await upstreamResponse.text();
      const lines = text.split("\n");
      const resolvedBaseUrl = new URL(finalUpstreamUrl);

      const host = request.headers.get("host") || "localhost:3000";
      const protocol = request.headers.get("x-forwarded-proto") || "http";
      const domainProxyPrefix = `${protocol}://${host}/proxy.php`;

      const rewrittenLines = lines.map((line) => {
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith("#")) {
          if (trimmed.includes('URI="')) {
            return trimmed.replace(/URI="([^"]+)"/, (match, uri) => {
              const absoluteUri = new URL(uri, resolvedBaseUrl).toString();
              return `URI="${domainProxyPrefix}?url=${encodeURIComponent(absoluteUri)}"`;
            });
          }
          return line;
        }

        let absoluteSegmentUrl: string;
        try {
          absoluteSegmentUrl = new URL(trimmed, resolvedBaseUrl).toString();
        } catch {
          return line;
        }

        const urlObj = new URL(absoluteSegmentUrl);
        const pathSegments = urlObj.pathname.split("/");
        const fileName = pathSegments[pathSegments.length - 1] || "segment.ts";

        return `${domainProxyPrefix}?url=${encodeURIComponent(absoluteSegmentUrl)}&file=${encodeURIComponent(fileName)}`;
      });

      return new Response(rewrittenLines.join("\n"), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } else {
      const headers = new Headers();
      if (contentType) headers.set("Content-Type", contentType);
      const contentLength = upstreamResponse.headers.get("content-length");
      if (contentLength) headers.set("Content-Length", contentLength);
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("Access-Control-Allow-Methods", "GET");

      // Pass the body stream and init options inside a single object parameter to prevent signature mismatches
      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        headers,
      });
    }
  } catch (error: any) {
    return new Response(`Proxy Error: ${error.message || "Internal Error"}`, {
      status: 500,
    });
  }
}