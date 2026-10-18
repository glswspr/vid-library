import type { FC } from 'react';
import { Link } from 'react-router-dom';
import { RotateCcw, SkipForward, ArrowLeft } from 'lucide-react';

interface EndOfContentOverlayProps {
  mediaType: 'movie' | 'tv';
  /** True when the show has another episode after the one just finished. */
  canGoNext: boolean;
  onReplay: () => void;
  onNext?: () => void;
}

const EndOfContentOverlay: FC<EndOfContentOverlayProps> = ({
  mediaType, canGoNext, onReplay, onNext,
}) => {
  const showNext = mediaType === 'tv' && canGoNext && !!onNext;

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-slate-950/90 backdrop-blur-sm p-6">
      <div className="text-center">
        <h3 className="text-xl font-bold text-white">You've finished watching</h3>
        <p className="text-sm text-slate-400 mt-1">What would you like to do next?</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onReplay}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm rounded-xl transition-colors cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" /> Replay
        </button>

        {showNext && (
          <button
            type="button"
            onClick={onNext}
            className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm rounded-xl transition-colors cursor-pointer"
          >
            <SkipForward className="w-4 h-4" /> Next Episode
          </button>
        )}

        <Link
          to="/"
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm rounded-xl transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Browse
        </Link>
      </div>
    </div>
  );
};

export default EndOfContentOverlay;
