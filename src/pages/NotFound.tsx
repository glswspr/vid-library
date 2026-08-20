import type { FC } from 'react';
import { Link } from 'react-router-dom';
import { Home, Search } from 'lucide-react';

export const NotFound: FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 py-24 text-center">
      <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-slate-800/80 border border-slate-700 mb-6">
        <span className="text-5xl font-black text-slate-500">404</span>
      </div>
      <h1 className="text-3xl font-extrabold text-white mb-2">Page Not Found</h1>
      <p className="text-slate-400 text-base max-w-md mx-auto mb-8">
        The page you're looking for doesn't exist.
      </p>
      <div className="flex items-center justify-center gap-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-500 text-slate-950 font-bold text-base rounded-xl hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/20"
        >
          <Home className="w-5 h-5" />
          Home
        </Link>
        <Link
          to="/?focus=search"
          className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 border-2 border-slate-700 text-slate-300 font-bold text-base rounded-xl hover:bg-slate-700 transition-colors"
        >
          <Search className="w-5 h-5" />
          Search
        </Link>
      </div>
    </div>
  );
};
