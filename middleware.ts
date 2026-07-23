// middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const value = req.cookies.get(name)?.value;
          console.log(`🍪 Getting cookie ${name}:`, value ? 'Exists' : 'None');
          return value;
        },
        set(name: string, value: string, options: any) {
          console.log(`🍪 Setting cookie ${name}:`, value ? 'Set' : 'Removed');
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: any) {
          console.log(`🍪 Removing cookie ${name}`);
          response.cookies.set({
            name,
            value: '',
            ...options,
            maxAge: 0,
          });
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  console.log('🔐 Middleware - Session:', session ? `Exists (${session.user.email})` : 'None');
  console.log('🔐 Middleware - Path:', req.nextUrl.pathname);
  
  // Log all cookies for debugging
  console.log('🍪 All cookies:', req.cookies.getAll().map(c => c.name));

  // If accessing admin page without session, redirect to login
  if (req.nextUrl.pathname.startsWith('/admin') && !session) {
    console.log('🔐 Redirecting to login - No session for admin');
    const redirectUrl = new URL('/login', req.url);
    return NextResponse.redirect(redirectUrl);
  }

  // If accessing login page with session, redirect to admin
  if (req.nextUrl.pathname === '/login' && session) {
    console.log('🔐 Redirecting to admin - Session exists');
    const redirectUrl = new URL('/admin', req.url);
    return NextResponse.redirect(redirectUrl);
  }

  // If accessing signup page with session, redirect to admin
  if (req.nextUrl.pathname === '/signup' && session) {
    console.log('🔐 Redirecting to admin - Session exists');
    const redirectUrl = new URL('/admin', req.url);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/login', '/signup'],
};