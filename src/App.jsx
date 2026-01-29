import { useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Music, Sparkles, Loader2, AlertCircle, Play, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';
import './PlayButton.css';

function App() {
  const [mood, setMood] = useState('');
  const [songs, setSongs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_GEMINI_API_KEY || '');
  const [currentVideo, setCurrentVideo] = useState(null);
  const [playing, setPlaying] = useState(false);

  const youtubeKey = import.meta.env.VITE_YOUTUBE_API_KEY;

  const playSong = async (song) => {
    if (!youtubeKey || youtubeKey.includes('your_youtube_api_key')) {
      alert("Please add VITE_YOUTUBE_API_KEY to your .env file to play music!");
      return;
    }

    setPlaying(true);
    // Optimistic UI or loading state could go here if needed

    try {
      const query = `${song.title} ${song.artist} official audio`;
      const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(query)}&type=video&key=${youtubeKey}`);
      const data = await response.json();

      if (data.items && data.items.length > 0) {
        setCurrentVideo(data.items[0].id.videoId);
      } else {
        alert("Song not found on YouTube.");
        setPlaying(false);
      }
    } catch (err) {
      console.error("YouTube Search Error:", err);
      alert("Failed to load song from YouTube.");
      setPlaying(false);
    }
  };

  const closePlayer = () => {
    setPlaying(false);
    setCurrentVideo(null);
  };

  const getRecommendations = async () => {
    if (!mood.trim()) return;
    if (!apiKey) {
      setError('Please provide a Gemini API Key to get recommendations.');
      return;
    }

    setLoading(true);
    setError('');
    setSongs(null);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

      const prompt = `Recommend 5 malayalamsongs for someone who is feeling "${mood}". 
      Return the response as a JSON array where each object has "title", "artist", and a brief "reason" for the recommendation. 
      Do not include markdown or code blocks, just the raw JSON string. e.g. [{"title": "...", "artist": "...", "reason": "..."}]`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text();

      // Clean up markdown code blocks if present (Gemini sometimes adds ```json ... ```)
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();

      try {
        const data = JSON.parse(text);
        setSongs(data);
      } catch (e) {
        console.error("Failed to parse JSON", e);
        // Fallback or retry logic could go here, for now just show error
        setError("Received a malformed response from Gemini. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setError(`Failed: ${err.message || "Check API key"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo">
          <Music className="logo-icon" />
          <h1>MoodMelody</h1>
        </div>
        <p className="subtitle">Discover the perfect soundtrack for your feelings</p>
      </header>

      <main className="main-content">
        <div className="input-section">
          {!import.meta.env.VITE_GEMINI_API_KEY && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="api-key-container"
            >
              <input
                type="password"
                id="api-key-input"
                placeholder="Enter Gemini API Key (or set in .env)"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="glass-input small"
              />
            </motion.div>
          )}

          <div className="mood-input-wrapper">
            <input
              type="text"
              id="mood-input"
              placeholder="How are you feeling right now?"
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && getRecommendations()}
              className="glass-input mood-input"
            />
            <button
              id="generate-btn"
              onClick={getRecommendations}
              disabled={loading || !mood.trim()}
              className="generate-btn"
            >
              {loading ? <Loader2 className="spin" /> : <Sparkles />}
              <span>Get Songs</span>
            </button>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="error-message"
            >
              <AlertCircle size={18} />
              {error}
            </motion.div>
          )}
        </div>

        <section className="results-section">
          <AnimatePresence>
            {songs && songs.map((song, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="song-card"
              >
                <div className="song-header">
                  <div className="song-info">
                    <h3>{song.title}</h3>
                    <p className="artist">{song.artist}</p>
                  </div>
                  <button
                    className="play-btn"
                    onClick={() => playSong(song)}
                    title="Play Song"
                  >
                    <Play size={20} fill="currentColor" />
                  </button>
                </div>
                <p className="reason">{song.reason}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </section>
      </main>

      <AnimatePresence>
        {playing && currentVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="player-overlay"
            onClick={closePlayer}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="player-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <button className="close-btn" onClick={closePlayer}>
                <X size={24} />
              </button>
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${currentVideo}?autoplay=1`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              ></iframe>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="footer">
        <p>Powered by Google Gemini</p>
      </footer>
    </div>
  );
}

export default App;
