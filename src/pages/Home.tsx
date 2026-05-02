import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Users } from 'lucide-react';

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
      <div className="text-center mb-12">
        <h1 className="text-6xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-brand-accent to-brand-secondary drop-shadow-[0_0_15px_rgba(139,92,246,0.5)]">
          QUIZRA
        </h1>
        <p className="text-slate-400 text-lg">The ultimate real-time trivia showdown</p>
      </div>

      <div className="space-y-4">
        <button
          onClick={() => navigate('/create')}
          className="w-full group relative overflow-hidden rounded-xl bg-brand-accent p-[2px] transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <span className="absolute inset-[-1000%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#c4b5fd_0%,#8b5cf6_50%,#c4b5fd_100%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative flex items-center justify-center gap-3 rounded-[10px] bg-slate-900 px-8 py-5 transition-colors group-hover:bg-slate-900/90">
            <Zap className="text-brand-accent" size={24} />
            <span className="text-xl font-bold tracking-wide">CREATE ROOM</span>
          </div>
        </button>

        <button
          onClick={() => navigate('/join')}
          className="w-full group relative overflow-hidden rounded-xl bg-brand-secondary p-[2px] transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <div className="relative flex items-center justify-center gap-3 rounded-[10px] bg-brand-secondary px-8 py-5 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)] group-hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] transition-shadow">
            <Users size={24} />
            <span className="text-xl font-bold tracking-wide">JOIN ROOM</span>
          </div>
        </button>
      </div>
    </div>
  );
};

export default Home;
