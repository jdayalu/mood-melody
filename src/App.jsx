import { useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Music, Sparkles, Loader2, AlertCircle, Play, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';
import './PlayButton.css';

function App() {
  const [mood, setMood] = useState('Nostalgic');
  const [language, setLanguage] = useState('Malayalam');
  const [era, setEra] = useState('Old');
  const [songs, setSongs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Always read fresh from env
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const youtubeKey = import.meta.env.VITE_YOUTUBE_API_KEY;

  const [currentVideo, setCurrentVideo] = useState(null);
  const [playing, setPlaying] = useState(false);



  const playSong = async (song) => {
    // If no API key configured, fallback immediately
    if (!youtubeKey || youtubeKey.includes('your_youtube_api_key')) {
      window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(`${song.title} ${song.artist}`)}`, '_blank');
      return;
    }

    setPlaying(true);

    try {
      const query = `${song.title} ${song.artist} official audio`;
      const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(query)}&type=video&key=${youtubeKey}`);
      const data = await response.json();

      if (data.error) {
        console.warn("YouTube API Error (likely quota). Falling back to external link.", data.error);
        setPlaying(false);
        // Fallback: Open in new tab
        window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(`${song.title} ${song.artist}`)}`, '_blank');
        return;
      }

      if (data.items && data.items.length > 0) {
        setCurrentVideo(data.items[0].id.videoId);
      } else {
        // Fallback if empty results
        console.warn("No video found, opening fallback.");
        setPlaying(false);
        window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(`${song.title} ${song.artist}`)}`, '_blank');
      }
    } catch (err) {
      // Fallback on network/other error
      console.error("YouTube Search Error:", err);
      setPlaying(false);
      window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(`${song.title} ${song.artist}`)}`, '_blank');
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
      // Switching to 'lite' version to attempt to bypass quota/availability issues
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

      const prompt = `
      You are an expert musicologist and cultural historian specializing in ${language} music.
      Your task is to curate a highly specific playlist of 10 songs for a listener who is feeling "${mood}".
      The selection must strictly adhere to the era/age description: "${era}".

      ### Selection Criteria:
      1. **Mood Matching:** Analyze the lyrics, tempo, key, and instrumentation. Ensure the emotional resonance matches "${mood}" precisely (e.g., if sad, choose minor keys/slower tempos; if energetic, choose upbeat/major keys).
      2. **Era Accuracy:** Strictly filter for songs released or popular during the "${era}" period.
      3. **Language:** All songs must be sung in ${language}.

      ### Output Requirements:
      - Return ONLY a raw JSON array.
      - STRICTLY NO markdown formatting (no \`\`\`json blocks), no conversational text, and no whitespace padding.
      - Ensure all strings are properly escaped to prevent JSON parsing errors.

      ### JSON Structure:
      Return an array of objects. Each object must follow this schema:
      [
        {
          "title": "Song Title",
          "artist": "Artist Name",
          "reason": "A brief, 1-sentence explanation of why this song fits the '${mood}' mood.",
          "history": "A 1-2 sentence interesting historical fact or cultural context about the song, written strictly in ${language}."
        }
      ]
      `;

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
          <h1>SariGama</h1>
        </div>
        <p className="creation-credit">A Dayalu Creation</p>
        <p className="subtitle">Discover the perfect soundtrack for your feelings</p>
      </header>

      <main className="main-content">
        <div className="input-section">
          <div className="mood-select-container">
            {['Malayalam', 'Tamil', 'Hindi', 'Telgu', 'Spanish', 'English'].map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`mood-chip ${language === lang ? 'selected' : ''}`}
                style={{ borderRadius: '0.5rem', flex: 1, textAlign: 'center', justifyContent: 'center' }}
              >
                {lang}
              </button>
            ))}
          </div>

          <div className="mood-select-container">
            {['Oldest', 'Older', 'Old', 'New', 'Newer', 'Newest'].map((item) => (
              <button
                key={item}
                onClick={() => setEra(item)}
                className={`mood-chip ${era === item ? 'selected' : ''}`}
                style={{ borderRadius: '0.5rem', flex: 1, textAlign: 'center', justifyContent: 'center', fontSize: '0.8rem', padding: '0.4rem' }}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="mood-select-container">
            {[
              { label: 'Cheerful', mood: 'Cheerful' },
              { label: 'Energy', mood: 'Energetic' },
              { label: 'Calm', mood: 'Calm' },
              { label: 'Melancholic', mood: 'Melancholic' },
              { label: 'Nostalgic', mood: 'Nostalgic' },
              { label: 'Love', mood: 'Romantic and Lovely' },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  setMood(item.mood);
                  // Optional: auto-search when clicked
                  // getRecommendations(); 
                }}
                className={`mood-chip ${mood === item.mood ? 'selected' : ''}`}
              >
                {item.label}
              </button>
            ))}
          </div>

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
                {song.history && (
                  <p className="history-text">
                    <span className="history-label">ചിന്താവിഷയം:</span> {song.history}
                  </p>
                )}
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
    </div >
  );
}

export default App;
