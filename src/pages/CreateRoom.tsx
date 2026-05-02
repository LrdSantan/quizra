import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { saveSession } from '../lib/store';

const CreateRoom = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [username, setUsername] = useState('');
  const [category, setCategory] = useState('mixed');
  const [questionCount, setQuestionCount] = useState(10);
  const [timePerQuestion, setTimePerQuestion] = useState(15);

  const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const roomCode = generateRoomCode();

      // 1. Create Room
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .insert({
          room_code: roomCode,
          host_name: username,
          category,
          question_count: questionCount,
          time_per_question: timePerQuestion,
          status: 'waiting',
          mode: 'classic'
        })
        .select()
        .single();

      if (roomError) throw roomError;

      // 2. Create Host Player
      const { data: player, error: playerError } = await supabase
        .from('players')
        .insert({
          room_id: room.id,
          username,
          is_host: true,
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
        isHost: true
      });

      navigate(`/room/${room.room_code}/lobby`);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to create room');
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
        <h2 className="text-3xl font-bold mb-6 text-white">Create Room</h2>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Your Nickname</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent transition-colors"
              placeholder="Enter your name..."
              maxLength={15}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent transition-colors appearance-none"
            >
              <option value="mixed">Mixed Categories</option>
              <option value="general">General Knowledge</option>
              <option value="science">Science & Nature</option>
              <option value="history">History</option>
              <option value="sports">Sports</option>
              <option value="geography">Geography</option>
              <option value="flags">🚩 Flag Quiz</option>
              <option value="football_clubs">⚽ Football Clubs</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Questions</label>
              <select
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent transition-colors appearance-none"
              >
                <option value={5}>5 Questions</option>
                <option value={10}>10 Questions</option>
                <option value={15}>15 Questions</option>
                <option value={20}>20 Questions</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Time (sec)</label>
              <select
                value={timePerQuestion}
                onChange={(e) => setTimePerQuestion(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent transition-colors appearance-none"
              >
                <option value={10}>10s</option>
                <option value={15}>15s</option>
                <option value={20}>20s</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-8 bg-brand-accent hover:bg-brand-accent/90 text-white font-bold py-4 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'CREATE & JOIN'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateRoom;