export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-center text-slate-100">
      <div className="space-y-4">
        <h1 className="text-7xl font-extrabold tracking-widest text-indigo-500 drop-shadow-md">
          404
        </h1>
        <div className="h-1 w-16 mx-auto rounded-full bg-indigo-500/50"></div>
        <p className="text-xl font-medium tracking-wide text-slate-300">
          not found !
        </p>
        <p className="text-sm text-slate-500 max-w-xs mx-auto pt-2">
          The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
        </p>
      </div>
    </div>
  );
}