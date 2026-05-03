import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getSession } from '../lib/store';
import { Timer, Users, Award, Loader2 } from 'lucide-react';

const Game = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const sessionRef = useRef(getSession());
  const session = sessionRef.current;

  const [room, setRoom] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [questionSequence, setQuestionSequence] = useState<any[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  
  const [timeLeft, setTimeLeft] = useState(15);
  const [isRevealing, setIsRevealing] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answersCount, setAnswersCount] = useState(0);
  
  const playerCountRef = useRef<number>(0);
  const startTimestampRef = useRef<number>(0);
  const roomRef = useRef<any>(null);
  const questionSequenceRef = useRef<any[]>([]);
  const shuffledOptionsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!session || session.roomCode !== roomCode) {
      navigate('/');
      return;
    }

    const initGame = async () => {
      // Fetch Room
      const { data: roomData } = await supabase.from('rooms').select('*').eq('id', session.roomId).single();
      if (!roomData || roomData.status === 'finished') {
        navigate(`/room/${roomCode}/results`);
        return;
      }
      roomRef.current = roomData;
      setRoom(roomData);
      setTimeLeft(roomData.time_per_question);

      // Fetch Players
      const { data: playersData } = await supabase.from('players').select('*').eq('room_id', session.roomId);
      if (playersData) {
        setPlayers(playersData);
        playerCountRef.current = playersData.length;
      }

      // Fetch Room Questions order
      const { data: rqData } = await supabase
        .from('room_questions')
        .select(`
          question_id, 
          question_order, 
          questions (
            id,
            question,
            correct_answer,
            wrong_answers,
            image_url
          )
        `)
        .eq('room_id', session.roomId)
        .order('question_order', { ascending: true });
        
      if (rqData) {
        questionSequenceRef.current = rqData;
        setQuestionSequence(rqData);
        loadQuestion(rqData, roomData.current_question_index, roomData.time_per_question);
      }
    };

    initGame();

    // Subscriptions
    const roomSub = supabase.channel('game:rooms').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${session.roomId}` }, 
      (payload) => {
        const oldIndex = roomRef.current?.current_question_index;
        const newIndex = payload.new.current_question_index;
        
        roomRef.current = payload.new;
        setRoom(payload.new);

        if (payload.new.status === 'finished') {
          navigate(`/room/${roomCode}/results`);
        } else if (newIndex !== oldIndex) {
          loadQuestion(questionSequenceRef.current, newIndex, payload.new.time_per_question);
        }
      }
    ).subscribe();

    const answersSub = supabase.channel('game:answers').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'answers', filter: `room_id=eq.${session.roomId}` }, 
      (payload) => {
        // Increment answer count
        setQuestionSequence(prev => {
           // We can't easily check the current question id inside this closure without a ref,
           // but we just increment the count for now.
           setAnswersCount(c => c + 1);
           return prev;
        });
      }
    ).subscribe();

    const playersSub = supabase.channel('game:players').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players', filter: `room_id=eq.${session.roomId}` }, 
      (payload) => {
        setPlayers(prev => prev.map(p => p.id === payload.new.id ? payload.new : p));
      }
    ).subscribe();

    return () => {
      supabase.removeChannel(roomSub);
      supabase.removeChannel(answersSub);
      supabase.removeChannel(playersSub);
    };
  }, [roomCode]);


  // Countdown Timer Effect
  useEffect(() => {
    if (isRevealing || !currentQuestion || !room) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRevealing, currentQuestion, room]);

  // Effect to handle timer reaching 0
  useEffect(() => {
    if (isRevealing || !currentQuestion || !room) return;
    if (timeLeft <= 0) {
      handleReveal();
    }
  }, [timeLeft, isRevealing, currentQuestion, room]);


  const loadQuestion = (sequence: any[], index: number, timeLimits: number) => {
    if (index >= sequence.length) return;
    
    const questionData = sequence[index].questions;
    // Handle case where Supabase might return an array for the join
    const q = Array.isArray(questionData) ? questionData[0] : questionData;
    
    if (q) {
      setCurrentQuestion(q);
      // Compute shuffle ONCE and store in ref
      const allOptions = [...(q.wrong_answers || []), q.correct_answer];
      for (let i = allOptions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]];
      }
      shuffledOptionsRef.current = allOptions;
    }

    setTimeLeft(timeLimits);
    setIsRevealing(false);
    setSelectedAnswer(null);
    setAnswersCount(0);
    startTimestampRef.current = Date.now();

  };

  const handleReveal = () => {
    setIsRevealing(true);

    // Host advances after a delay if no one answered or timer ran out
    if (session?.isHost) {
      setTimeout(async () => {
        const currentRoom = roomRef.current;
        if (!currentRoom) return;

        const nextIndex = currentRoom.current_question_index + 1;
        if (nextIndex >= currentRoom.question_count) {
          await supabase.from('rooms').update({ status: 'finished' }).eq('id', session.roomId);
        } else {
          // Double check status before updating to avoid double-advancing if someone already answered
          const { data: latestRoom } = await supabase.from('rooms').select('current_question_index').eq('id', session.roomId).single();
          if (latestRoom && latestRoom.current_question_index === currentRoom.current_question_index) {
            await supabase.from('rooms').update({ current_question_index: nextIndex }).eq('id', session.roomId);
          }
        }
      }, 3000);
    }
  };

  const submitAnswer = async (option: string) => {
    if (isRevealing || selectedAnswer || !currentQuestion || !session) return;
    
    setSelectedAnswer(option);
    const timeTakenMs = Date.now() - startTimestampRef.current;

    try {
      await supabase.functions.invoke('submit-answer', {
        body: {
          room_id: session.roomId,
          player_id: session.playerId,
          question_id: currentQuestion.id,
          answer_given: option,
          time_taken_ms: timeTakenMs
        }
      });

      // Show feedback for a moment.
      // We don't advance the room here. The host's useEffect will trigger handleReveal 
      // when all players have answered or the timer runs out.
      setIsRevealing(true);

    } catch (error) {
      console.error("Failed to submit answer:", error);
    }
  };

  if (!room || !currentQuestion) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="animate-spin w-12 h-12 text-brand-accent mb-4" />
        <p className="text-slate-400">Loading Game...</p>
      </div>
    );
  }

  const options = ['A', 'B', 'C', 'D'];

  return (
    <div className="w-full max-w-5xl mx-auto px-2 py-3 md:px-4 md:py-6 flex flex-col min-h-screen justify-between">
      
      {/* Top Bar */}
      <div className="flex items-center justify-between bg-slate-800/80 backdrop-blur-md p-2 md:p-4 rounded-xl md:rounded-2xl border border-slate-700 shadow-lg mb-4">
        <div className="flex items-center space-x-1 md:space-x-2 bg-slate-900 px-2 md:px-4 py-1 md:py-2 rounded-lg md:rounded-xl">
          <span className="text-slate-400 font-bold uppercase text-[10px] md:text-sm tracking-wider">Q</span>
          <span className="text-lg md:text-2xl font-black text-white">{room.current_question_index + 1}<span className="text-slate-500 text-sm md:text-lg">/{room.question_count}</span></span>
        </div>
        
        <div className="flex items-center gap-3 md:gap-6">
          <div className="flex items-center text-slate-300 text-xs md:text-base">
            <Users className="w-3 h-3 md:w-5 md:h-5 mr-1 md:mr-2 text-brand-secondary" />
            <span className="font-bold whitespace-nowrap">{answersCount}/{playerCountRef.current}</span>
          </div>
          
          <div className="relative flex items-center justify-center w-10 h-10 md:w-16 md:h-16">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-slate-700 md:hidden" />
              <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-700 hidden md:block" />
              <circle 
                cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="3" fill="transparent" 
                className={`${timeLeft <= 5 ? 'text-red-500' : 'text-brand-accent'} transition-all duration-1000 ease-linear md:hidden`}
                strokeDasharray="113"
                strokeDashoffset={113 - (113 * timeLeft) / room.time_per_question}
              />
              <circle 
                cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" 
                className={`${timeLeft <= 5 ? 'text-red-500' : 'text-brand-accent'} transition-all duration-1000 ease-linear hidden md:block`}
                strokeDasharray="175"
                strokeDashoffset={175 - (175 * timeLeft) / room.time_per_question}
              />
            </svg>
            <div className={`absolute font-black text-sm md:text-2xl ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
              {timeLeft}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col gap-2 md:gap-8">
        
        {/* Right: Question & Options */}
        <div className="flex-1 flex flex-col gap-2 md:gap-4">
          
          <div className="bg-slate-800 p-4 md:p-8 rounded-2xl md:rounded-3xl border border-slate-700 shadow-xl relative overflow-hidden min-h-[80px] md:min-h-[200px] flex flex-col items-center justify-center text-center">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-accent to-brand-secondary"></div>
             {currentQuestion.image_url && (room.category === 'flags' || room.category === 'football_clubs') && (
               <img 
                 src={currentQuestion.image_url} 
                 alt="Question" 
                 className="w-32 h-auto mx-auto mb-4 rounded shadow-md"
               />
             )}
             <h2 className="text-lg md:text-3xl lg:text-4xl font-bold text-white leading-tight">
               {currentQuestion.question}
             </h2>
          </div>

          <div className="grid grid-cols-2 gap-2 md:gap-4">
            {shuffledOptionsRef.current.map((optionText, i) => {
              const optLabel = String.fromCharCode(65 + i); // A, B, C, D...
              const isSelected = selectedAnswer === optionText;
              
              let stateClass = "bg-slate-800/80 hover:bg-slate-700 border-slate-600 text-slate-200";
              
              if (isRevealing) {
                const isCorrect = optionText === currentQuestion.correct_answer;
                if (isCorrect) {
                  stateClass = "bg-green-500/20 border-green-500 text-green-400 shadow-[0_0_20px_rgba(34,197,94,0.3)] ring-2 ring-green-500";
                } else if (isSelected) {
                  stateClass = "bg-red-500/20 border-red-500 text-red-400 opacity-50";
                } else {
                  stateClass = "bg-slate-900 border-slate-800 text-slate-600 opacity-30";
                }
              } else if (isSelected) {
                stateClass = "bg-brand-accent/20 border-brand-accent text-white shadow-[0_0_15px_rgba(139,92,246,0.3)] ring-2 ring-brand-accent";
              }

              return (
                <button
                  key={optionText}
                  disabled={isRevealing || selectedAnswer !== null}
                  onClick={() => submitAnswer(optionText)}
                  className={`relative h-16 md:h-auto p-2 md:p-6 rounded-xl md:rounded-2xl border-2 text-left text-sm md:text-xl font-bold transition-all duration-300 transform ${isRevealing ? '' : 'hover:scale-[1.02] active:scale-[0.98]'} ${stateClass}`}
                >
                  <span className="absolute top-2 left-2 md:top-4 md:left-4 text-[10px] md:text-sm font-black opacity-40">{optLabel}</span>
                  <div className="flex items-center justify-center text-center w-full h-full">
                    {optionText}
                  </div>
                </button>
              );
            })}
          </div>

        </div>

      </div>

    </div>
  );
};

export default Game;
