import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { saveSession } from '../lib/store';

const JoinRoom = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState('');

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !roomCode.trim()) {
      setError('Username and Room Code are required');
      return;
    }

    const code = roomCode.toUpperCase();
    setLoading(true);
    setError('');

    try {
      // 1. Check if room exists and is waiting
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('room_code', code)
        .single();

      if (roomError || !room) {
        throw new Error('Room not found or invalid code');
      }

      if (room.status !== 'waiting') {
        throw new Error('Game has already started or finished');
      }

      // 2. Create Guest Player
      const { data: player, error: playerError } = await supabase
        .from('players')
        .insert({
          room_id: room.id,
          username,
          is_host: false,
          score: 0
        })
        .select()
        .single();

      if (playerError) throw playerError;

      // 3. Save Session & Redirect
      saveSession({
        roomId: room.id,
        roomCode: room.room_code,
        playerId: player.id,
        username,
        isHost: false
      });

      navigate(`/room/${room.room_code}/lobby`);
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to join room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md animate-in slide-in-from-bottom-4 fade-in duration-500">
      <button 
        onClick={() => navigate('/')}
        className="mb-6 flex items-center text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft size={20} className="mr-2" /> Back
      </button>

      <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl p-8 border border-slate-700 shadow-xl">
        <h2 className="text-3xl font-bold mb-6 text-white text-center">Join Room</h2>
        
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleJoin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Room Code</label>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white text-center text-2xl font-black tracking-widest focus:outline-none focus:border-brand-secondary focus:ring-1 focus:ring-brand-secondary transition-colors uppercase placeholder:text-slate-700 placeholder:font-normal placeholder:text-base placeholder:tracking-normal"
              placeholder="e.g. A1B2C3"
              maxLength={6}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Your Nickname</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-secondary focus:ring-1 focus:ring-brand-secondary transition-colors"
              placeholder="Enter your name..."
              maxLength={15}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-8 bg-brand-secondary hover:bg-brand-secondary/90 text-white font-bold py-4 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(59,130,246,0.3)]"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'JOIN GAME'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default JoinRoom;
