import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Users, Play, Loader2, Copy, Check, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getSession } from '../lib/store';

const Lobby = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const session = getSession();
  
  const [players, setPlayers] = useState<any[]>([]);
  const [room, setRoom] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!session || session.roomCode !== roomCode) {
      navigate('/');
      return;
    }

    const fetchInitialData = async () => {
      // Get Room
      const { data: roomData } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', session.roomId)
        .single();
        
      if (roomData) {
        setRoom(roomData);
        if (roomData.status === 'active') {
          navigate(`/room/${roomCode}/game`);
        }
      }

      // Get Players
      const { data: playersData } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', session.roomId)
        .order('joined_at', { ascending: true });
        
      if (playersData) setPlayers(playersData);
    };

    fetchInitialData();

    // Subscribe to Players
    const playersSub = supabase
      .channel('public:players')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'players',
        filter: `room_id=eq.${session.roomId}` 
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setPlayers(prev => [...prev, payload.new]);
        }
        // Handle deletions or updates if needed
      })
      .subscribe();

    // Subscribe to Room Status
    const roomSub = supabase
      .channel('public:rooms')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'rooms',
        filter: `id=eq.${session.roomId}` 
      }, (payload) => {
        if (payload.new.status === 'active') {
          navigate(`/room/${roomCode}/game`);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(playersSub);
      supabase.removeChannel(roomSub);
    };
  }, [roomCode, session, navigate]);

  const handleCopyCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStartGame = async () => {
    if (!session?.isHost) return;
    setLoading(true);

    try {
      // Call Edge Function to start game
      const { data, error } = await supabase.functions.invoke('start-game', {
        body: { room_id: session.roomId }
      });

      if (error) throw error;
      
      // The Realtime subscription will handle the navigation when room status updates
    } catch (err) {
      console.error("Failed to start game:", err);
      setLoading(false);
      alert('Failed to start game. Do you have the edge functions deployed?');
    }
  };

  if (!session) return null;

  return (
    <div className="w-full max-w-full overflow-hidden mx-auto px-4 py-8 animate-in fade-in duration-500">
      
      <div className="text-center mb-8 md:mb-12">
        <h2 className="text-sm md:text-xl text-slate-400 mb-2 uppercase tracking-widest font-bold">Room Code</h2>
        <div className="flex items-center justify-center w-full max-w-md mx-auto">
          <div className="flex items-center justify-between w-full bg-slate-800/80 border-2 border-brand-accent/50 p-3 md:p-4 rounded-2xl shadow-[0_0_30px_rgba(139,92,246,0.15)] backdrop-blur-sm overflow-hidden">
            <span className="text-4xl md:text-6xl font-black text-white tracking-widest truncate">{roomCode}</span>
            <button 
              onClick={handleCopyCode}
              className="bg-slate-700 p-2 md:p-3 rounded-xl hover:bg-slate-600 transition-colors border border-slate-600 flex-shrink-0 ml-4"
              title="Copy Code"
            >
              {copied ? <Check className="text-green-400" size={24} /> : <Copy className="text-slate-300" size={24} />}
            </button>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 bg-slate-800/50 backdrop-blur-md rounded-2xl p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl md:text-2xl font-bold flex items-center text-white">
              <Users className="mr-3 text-brand-secondary" /> 
              Players ({players.length})
            </h3>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {players.map((p) => (
              <div 
                key={p.id} 
                className={`px-4 py-3 rounded-xl border ${p.id === session.playerId ? 'bg-brand-accent/20 border-brand-accent/50' : 'bg-slate-900 border-slate-700'} flex items-center justify-between animate-in zoom-in-95 duration-300`}
              >
                <span className="font-semibold text-slate-200 truncate">{p.username}</span>
                {p.is_host && <span className="text-xs bg-brand-accent px-2 py-1 rounded text-white font-bold ml-2">HOST</span>}
              </div>
            ))}
            
            {players.length === 0 && (
              <div className="col-span-full py-8 text-center text-slate-500">
                <Loader2 className="animate-spin mx-auto mb-2" />
                Waiting for players to join...
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-1 bg-slate-800/50 backdrop-blur-md rounded-2xl p-6 border border-slate-700 flex flex-col items-center justify-center text-center">
          {session.isHost ? (
            <>
              <div className="bg-brand-accent/20 w-20 h-20 rounded-full flex items-center justify-center mb-4 border border-brand-accent/30 shadow-[0_0_20px_rgba(139,92,246,0.3)]">
                <Zap className="text-brand-accent w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">You are the Host</h3>
              <p className="text-slate-400 mb-8 text-sm">Wait for everyone to join before starting the game.</p>
              
              <button
                onClick={handleStartGame}
                disabled={players.length < 1 || loading}
                className="w-full bg-brand-accent hover:bg-brand-accent/90 text-white font-bold py-4 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(139,92,246,0.4)]"
              >
                {loading ? <Loader2 className="animate-spin" /> : <><Play fill="currentColor" className="mr-2" size={20} /> START GAME</>}
              </button>
            </>
          ) : (
            <>
               <div className="bg-brand-secondary/20 w-20 h-20 rounded-full flex items-center justify-center mb-4 border border-brand-secondary/30">
                <Loader2 className="text-brand-secondary w-10 h-10 animate-spin" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Waiting for Host</h3>
              <p className="text-slate-400 text-sm">The game will begin shortly. Get ready!</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Lobby;
