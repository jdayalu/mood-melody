import { useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Music, Sparkles, Loader2, AlertCircle, Play, X, Youtube } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGoogleLogin } from '@react-oauth/google';
import './App.css';
import './PlayButton.css';

function App() {
  const [mood, setMood] = useState('Nostalgic');
  const [language, setLanguage] = useState('Malayalam');

  const [songs, setSongs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentSongIndex, setCurrentSongIndex] = useState(-1);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [audioOnly, setAudioOnly] = useState(false);

  // Always read fresh from env
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const youtubeKey = import.meta.env.VITE_YOUTUBE_API_KEY;

  const [currentVideo, setCurrentVideo] = useState(null);
  const [playing, setPlaying] = useState(false);



  const [playlistIds, setPlaylistIds] = useState([]);

  // Load YouTube IFrame API
  useState(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
  }, []);

  const playSong = async (song, index = -1) => {
    if (!youtubeKey || youtubeKey.includes('your_youtube_api_key')) {
      window.open(`https://music.youtube.com/search?q=${encodeURIComponent(`${song.title} ${song.artist}`)}`, '_blank');
      return;
    }

    setPlaying(true);
    setPlaylistIds([]); // Clear playlist mode
    if (index !== -1) setCurrentSongIndex(index);

    try {
      const query = `${song.title} ${song.artist} official audio`;
      const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&key=${youtubeKey}`);
      const data = await response.json();

      if (data.error) {
        console.warn("YouTube API Error (likely quota).", data.error);
        setPlaying(false);
        window.open(`https://music.youtube.com/search?q=${encodeURIComponent(`${song.title} ${song.artist}`)}`, '_blank');
        return;
      }

      if (data.items && data.items.length > 0) {
        setCurrentVideo(data.items[0].id.videoId);
      } else {
        console.warn("No video found, opening fallback.");
        setPlaying(false);
        window.open(`https://music.youtube.com/search?q=${encodeURIComponent(`${song.title} ${song.artist}`)}`, '_blank');
      }
    } catch (err) {
      console.error("YouTube Search Error:", err);
      setPlaying(false);
      window.open(`https://music.youtube.com/search?q=${encodeURIComponent(`${song.title} ${song.artist}`)}`, '_blank');
    }
  };

  const closePlayer = () => {
    setPlaying(false);
    setCurrentVideo(null);
    setPlaylistIds([]);
    setIsAutoPlaying(false);
    setCurrentSongIndex(-1);
  };

  const handlePlayerStateChange = (event) => {
    // 0 = ENDED
    if (event.data === 0 && isAutoPlaying && songs && currentSongIndex >= 0 && currentSongIndex < songs.length - 1 && playlistIds.length === 0) {
      const nextIndex = currentSongIndex + 1;
      playSong(songs[nextIndex], nextIndex);
    }
  };

  const startAutoPlay = async () => {
    if (!songs || songs.length === 0) return;
    setLoading(true);
    try {
      if (!youtubeKey || youtubeKey.includes('your_youtube_api_key')) {
         window.open(`https://music.youtube.com/search?q=${encodeURIComponent(`${songs[0].title} ${songs[0].artist}`)}`, '_blank');
         return;
      }
      
      const promises = songs.map(async (song) => {
         const query = `${song.title} ${song.artist} official audio`;
         const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&key=${youtubeKey}`);
         const data = await response.json();
         if (data.items && data.items.length > 0) {
            return data.items[0].id.videoId;
         }
         return null;
      });
      
      const vIds = (await Promise.all(promises)).filter(id => id !== null);

      if (vIds.length > 0) {
         setPlaylistIds(vIds);
         setCurrentVideo(vIds[0]);
         setIsAutoPlaying(true);
         setPlaying(true);
         setCurrentSongIndex(-2); // Flag for multi-track playlist mode
      } else {
         setError("No music tracks found.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to generate complete playlist.");
    } finally {
      setLoading(false);
    }
  };

  const onPlayerReady = (event) => {
    event.target.playVideo();
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
      Your task is to curate a highly specific and DIVERSE playlist of 10 songs for a listener who is feeling "${mood}".
      
      IMPORTANT: This request ID is ${Math.random()}. Ensure this playlist is unique and random compared to previous requests. Do not just pick the most famous songs; include some hidden gems or less obvious choices that fit the criteria perfectly.

      ### Selection Criteria:
      1. **Mood Matching:** Analyze the lyrics, tempo, key, and instrumentation. Ensure the emotional resonance matches "${mood}" precisely.
      2. **Language:** All songs must be sung in ${language}.
      3. **Randomness:** Shuffle your internal database selection to provide a varied mix every time this prompt is run.

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
          "history": "A 1-2 sentence interesting historical fact or cultural context about the song, written strictly in ${language}.",
          "lyricsSnippet": "A famous 2-4 line excerpt or chorus from the song lyrics (in original language)."
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
        // Double check: Shuffle on client side to guarantee randomness
        for (let i = data.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [data[i], data[j]] = [data[j], data[i]];
        }
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

  const [savingPlaylist, setSavingPlaylist] = useState(false);

  const saveToYouTubePlaylist = async (accessToken) => {
    setSavingPlaylist(true);
    setError('');
    try {
      // 1. Create a playlist
      const createRes = await fetch('https://www.googleapis.com/youtube/v3/playlists?part=snippet,status', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          snippet: {
            title: `[${mood}] Music Vibes by SariGama`,
            description: `A curated ${language} playlist designed for the '${mood}' mood. Generated by Dayalu SariGama.`
          },
          status: {
            privacyStatus: 'private'
          }
        })
      });
      const createData = await createRes.json();
      if (createData.error) throw new Error(createData.error.message);
      const playlistId = createData.id;

      let vIds = playlistIds; 
      if (vIds.length === 0) {
          const promises = songs.map(async (song) => {
             const query = `${song.title} ${song.artist} official audio`;
             const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&key=${youtubeKey}`);
             const data = await response.json();
             if (data.items && data.items.length > 0) return data.items[0].id.videoId;
             return null;
          });
          vIds = (await Promise.all(promises)).filter(id => id !== null);
      }

      // 3. Add to playlist
      const addPromises = vIds.map(videoId => {
        return fetch('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            snippet: {
              playlistId: playlistId,
              resourceId: {
                kind: 'youtube#video',
                videoId: videoId
              }
            }
          })
        });
      });
      await Promise.all(addPromises);
      alert('Playlist successfully saved to YouTube Music!');
    } catch (err) {
      console.error(err);
      setError('Failed to save playlist: ' + err.message);
    } finally {
      setSavingPlaylist(false);
    }
  };

  const loginAndSave = useGoogleLogin({
    onSuccess: (tokenResponse) => saveToYouTubePlaylist(tokenResponse.access_token),
    scope: 'https://www.googleapis.com/auth/youtube.force-ssl',
  });

  return (
    <div className={`app-container ${playing && !audioOnly ? 'video-active' : ''} ${audioOnly ? 'audio-active' : ''}`}>
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
          {songs && songs.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="action-bar"
              style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}
            >
              <button
                onClick={startAutoPlay}
                className="generate-btn"
                style={{ background: 'var(--accent-secondary)', width: 'auto' }}
              >
                <Play size={16} fill="white" />
                Play All
              </button>

              <button
                onClick={() => loginAndSave()}
                disabled={savingPlaylist}
                className="generate-btn"
                style={{ background: '#FF0000', width: 'auto' }}
              >
                {savingPlaylist ? <Loader2 className="spin" size={16} /> : <Youtube size={16} />}
                {savingPlaylist ? 'Saving...' : 'Save Playlist'}
              </button>

              <button
                onClick={() => setAudioOnly(!audioOnly)}
                className={`generate-btn ${audioOnly ? 'active' : ''}`}
                style={{
                  background: audioOnly ? 'var(--accent-primary)' : 'rgba(30, 41, 59, 0.7)',
                  width: 'auto',
                  border: audioOnly ? 'none' : '1px solid rgba(148, 163, 184, 0.3)'
                }}
              >
                <span>{audioOnly ? '🎵 Audio Mode' : '📺 Video Mode'}</span>
              </button>
            </motion.div>
          )}

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
                    onClick={() => {
                      setIsAutoPlaying(false);
                      playSong(song, index);
                    }}
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

                {song.lyricsSnippet && (
                  <div className="lyrics-container" style={{ marginTop: '0.5rem', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '0.5rem' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                      <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold', marginRight: '5px' }}>🎵 Lyrics:</span>
                      "{song.lyricsSnippet}"
                    </p>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </section>
      </main >

      <AnimatePresence>
        {playing && currentVideo && (
          <>
            {/* Audio Only Mode Bar */}
            {audioOnly ? (
              <motion.div
                initial={{ y: 100 }}
                animate={{ y: 0 }}
                exit={{ y: 100 }}
                className="audio-only-bar"
              >
                <div className="now-playing-info">
                  <span className="now-playing-title">
                    {songs && currentSongIndex !== -1 ? songs[currentSongIndex].title : 'Playing...'}
                  </span>
                  <span className="now-playing-artist">
                    {songs && currentSongIndex !== -1 ? songs[currentSongIndex].artist : ''}
                  </span>
                </div>

                {/* Lyrics Preview in Audio Bar */}
                <div className="lyrics-preview-bar">
                  {songs && currentSongIndex !== -1 && songs[currentSongIndex].lyricsSnippet ?
                    `"${songs[currentSongIndex].lyricsSnippet}"` : '🎵 Audio Mode Active'}
                </div>

                <div className="audio-controls">
                  <button className="close-audio-btn" onClick={closePlayer}>
                    <X size={24} />
                  </button>
                </div>
                {/* Invisible YouTube Player */}
                <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}>
                  <div id="youtube-player-audio">
                    <iframe
                      id="audio-iframe-player"
                      width="100%"
                      height="100%"
                      src={`https://www.youtube.com/embed/${currentVideo}?enablejsapi=1&autoplay=1&playsinline=1${playlistIds.length > 0 ? `&playlist=${playlistIds.slice(1).join(',')}` : ''}&origin=${window.location.origin}`}
                      title="YouTube audio player"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      onLoad={(e) => {
                        if (window.YT && window.YT.Player) {
                          new window.YT.Player(e.target, {
                            events: {
                              'onReady': (event) => event.target.playVideo(),
                              'onStateChange': handlePlayerStateChange
                            }
                          });
                        }
                      }}
                    ></iframe>
                  </div>
                </div>
              </motion.div>
            ) : (
              /* Regular Video Modal */
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
                  <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'white' }}>
                      {songs && currentSongIndex !== -1 ? songs[currentSongIndex].title : 'Now Playing'}
                    </h3>
                    <button className="close-btn" onClick={closePlayer} style={{ position: 'static' }}>
                      <X size={24} />
                    </button>
                  </div>

                  <div id="youtube-player" style={{ width: '100%', aspectRatio: '16/9', borderRadius: '12px', overflow: 'hidden' }}>
                    <iframe
                      id="existing-iframe-player"
                      width="100%"
                      height="100%"
                      src={`https://www.youtube.com/embed/${currentVideo}?enablejsapi=1&autoplay=1&playsinline=1${playlistIds.length > 0 ? `&playlist=${playlistIds.slice(1).join(',')}` : ''}&origin=${window.location.origin}`}
                      title="YouTube video player"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      onLoad={(e) => {
                        if (window.YT && window.YT.Player) {
                          new window.YT.Player(e.target, {
                            events: {
                              'onReady': (event) => event.target.playVideo(),
                              'onStateChange': handlePlayerStateChange
                            }
                          });
                        }
                      }}
                    ></iframe>
                  </div>

                  {/* Lyrics Display in Modal */}
                  {songs && currentSongIndex !== -1 && songs[currentSongIndex].lyricsSnippet && (
                    <div className="modal-lyrics" style={{ marginTop: '1.5rem', textAlign: 'center', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                      <p style={{ color: 'var(--accent-secondary)', fontWeight: 'bold', marginBottom: '0.5rem', textTransform: 'uppercase', fontSize: '0.8rem' }}>Lyrics Snippet</p>
                      <p style={{ fontStyle: 'italic', fontSize: '1.1rem', lineHeight: '1.6' }}>
                        "{songs[currentSongIndex].lyricsSnippet}"
                      </p>
                    </div>
                  )}

                </motion.div>
              </motion.div>
            )}
          </>
        )}
      </AnimatePresence>

      <footer className="footer">
        <p>Powered by Google Gemini</p>
      </footer>
    </div >
  );
}

export default App;
