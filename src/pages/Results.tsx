import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getSession } from '../lib/store';
import { Trophy, Medal, RotateCcw, Home } from 'lucide-react';

const Results = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const session = getSession();

  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (!session || session.roomCode !== roomCode) {
      navigate('/');
      return;
    }

    const fetchResults = async () => {
      const { data } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', session.roomId)
        .order('score', { ascending: false });

      if (data) {
        setPlayers(data);
      }
      setLoading(false);
    };

    fetchResults();

    // Listen for room reset to go back to lobby
    const roomSub = supabase.channel('results:rooms').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${session.roomId}` }, 
      (payload) => {
        if (payload.new.status === 'waiting') {
          navigate(`/room/${roomCode}/lobby`);
        }
      }
    ).subscribe();

    return () => {
      supabase.removeChannel(roomSub);
    };
  }, [roomCode, session, navigate]);

  const handlePlayAgain = async () => {
    if (!session?.isHost) return;
    setIsResetting(true);

    try {
      // 1. Delete answers and room_questions (cascades or manual)
      // Actually, just delete answers for this room and room_questions, or let them sit if we don't care, 
      // but usually we want to start fresh. The easiest way without a new room is:
      await supabase.from('answers').delete().eq('room_id', session.roomId);
      await supabase.from('room_questions').delete().eq('room_id', session.roomId);
      
      // Reset player scores
      await supabase.from('players').update({ score: 0 }).eq('room_id', session.roomId);

      // 2. Reset room status
      await supabase.from('rooms').update({ status: 'waiting', current_question_index: 0 }).eq('id', session.roomId);
      
      // Navigation is handled by realtime subscription
    } catch (err) {
      console.error(err);
      setIsResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen text-brand-accent">
        <Trophy className="w-12 h-12 animate-pulse" />
      </div>
    );
  }

  const winner = players[0];

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8 animate-in slide-in-from-bottom-8 fade-in duration-700">
      
      <div className="text-center mb-12">
        <div className="inline-block p-4 rounded-full bg-brand-accent/20 border border-brand-accent/50 mb-6 shadow-[0_0_30px_rgba(139,92,246,0.3)]">
          <Trophy className="w-16 h-16 text-brand-accent" />
        </div>
        <h1 className="text-5xl font-black text-white mb-2">Game Over!</h1>
        <p className="text-xl text-slate-400">
          Winner: <span className="text-brand-secondary font-bold">{winner?.username || 'No one'}</span>
        </p>
      </div>

      <div className="bg-slate-800/50 backdrop-blur-md rounded-3xl border border-slate-700 p-6 md:p-8 shadow-2xl mb-8">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
          <Medal className="w-6 h-6 mr-3 text-brand-secondary" /> Final Leaderboard
        </h2>
        
        <div className="space-y-4">
          {players.map((p, i) => (
            <div 
              key={p.id} 
              className={`flex items-center justify-between p-4 rounded-2xl border ${
                i === 0 
                  ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.1)]' 
                  : i === 1 
                    ? 'bg-slate-300/10 border-slate-300/50 text-slate-300'
                    : i === 2 
                      ? 'bg-amber-700/10 border-amber-700/50 text-amber-500'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
              } transition-all duration-300`}
            >
              <div className="flex items-center">
                <span className="w-8 text-xl font-black opacity-50 mr-4 text-center">#{i + 1}</span>
                <span className={`text-xl font-bold ${p.id === session?.playerId ? 'underline decoration-2 underline-offset-4' : ''}`}>
                  {p.username} {p.id === session?.playerId && '(You)'}
                </span>
              </div>
              <div className="text-2xl font-black tracking-wider">
                {p.score} <span className="text-sm opacity-50 font-normal">pts</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        {session?.isHost && (
          <button
            onClick={handlePlayAgain}
            disabled={isResetting}
            className="flex-1 bg-brand-accent hover:bg-brand-accent/90 text-white font-bold py-4 px-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-50"
          >
            <RotateCcw className={`mr-2 ${isResetting ? 'animate-spin' : ''}`} />
            {isResetting ? 'Resetting...' : 'Play Again'}
          </button>
        )}
        
        <button
          onClick={() => navigate('/')}
          className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 px-8 rounded-xl flex items-center justify-center transition-all border border-slate-700"
        >
          <Home className="mr-2" />
          Home
        </button>
      </div>

    </div>
  );
};

export default Results;
