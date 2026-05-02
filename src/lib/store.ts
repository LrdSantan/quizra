export interface GameSession {
  roomId: string;
  roomCode: string;
  playerId: string;
  isHost: boolean;
  username: string;
}

export const getSession = (): GameSession | null => {
  const data = localStorage.getItem('quizra_session');
  return data ? JSON.parse(data) : null;
};

export const saveSession = (session: GameSession) => {
  localStorage.setItem('quizra_session', JSON.stringify(session));
};

export const clearSession = () => {
  localStorage.removeItem('quizra_session');
};
