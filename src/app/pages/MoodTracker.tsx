import { useState, useRef } from 'react';
import { Smile, Mic, Type, Loader2, Play, MessageCircle } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { Toaster } from '../components/ui/sonner';

const MOODS = [
  { value: 'great', label: 'Great', emoji: '😄', color: 'from-green-400 to-green-600' },
  { value: 'good', label: 'Good', emoji: '🙂', color: 'from-blue-400 to-blue-600' },
  { value: 'okay', label: 'Okay', emoji: '😐', color: 'from-yellow-400 to-yellow-600' },
  { value: 'low', label: 'Low', emoji: '😟', color: 'from-orange-400 to-orange-600' },
  { value: 'tired', label: 'Tired', emoji: '😴', color: 'from-purple-400 to-purple-600' },
] as const;

// Mock AI mood analysis function
function analyzeMoodFromText(text: string): { mood: typeof MOODS[number]['value'], confidence: number } {
  const lowerText = text.toLowerCase();
  
  // Simple sentiment analysis
  const sadWords = ['sad', 'down', 'depressed', 'unhappy', 'miserable', 'awful', 'terrible', 'bad', 'upset', 'frustrated'];
  const tiredWords = ['tired', 'exhausted', 'sleepy', 'drained', 'fatigued', 'weary'];
  const happyWords = ['happy', 'great', 'amazing', 'wonderful', 'fantastic', 'awesome', 'good', 'joyful', 'excited'];
  const okayWords = ['okay', 'fine', 'alright', 'decent', 'normal', 'meh'];
  
  const sadScore = sadWords.filter(word => lowerText.includes(word)).length;
  const tiredScore = tiredWords.filter(word => lowerText.includes(word)).length;
  const happyScore = happyWords.filter(word => lowerText.includes(word)).length;
  const okayScore = okayWords.filter(word => lowerText.includes(word)).length;
  
  if (happyScore > 0) return { mood: 'great', confidence: 0.8 };
  if (sadScore > 0) return { mood: 'low', confidence: 0.85 };
  if (tiredScore > 0) return { mood: 'tired', confidence: 0.9 };
  if (okayScore > 0) return { mood: 'okay', confidence: 0.75 };
  
  return { mood: 'okay', confidence: 0.5 };
}

// Generate personalized messages and video recommendations
function generateResponse(mood: typeof MOODS[number]['value']) {
  const responses = {
    great: {
      message: "That's wonderful! Keep spreading those positive vibes! 🌟",
      video: "https://www.youtube.com/embed/ZbZSe6N_BXs", // Happy uplifting video
      suggestion: "You're doing amazing! Why not share your positivity with someone today?"
    },
    good: {
      message: "Great to hear you're feeling good! Keep up the momentum! 😊",
      video: "https://www.youtube.com/embed/jZOywwwo60k", // Motivational video
      suggestion: "This is a perfect time to tackle a challenging task or learn something new!"
    },
    okay: {
      message: "That's perfectly fine! Some days are just okay, and that's part of life. 🌈",
      video: "https://www.youtube.com/embed/R-VHJbEU05k", // Calming nature video
      suggestion: "How about taking a short walk or listening to your favorite music?"
    },
    low: {
      message: "I'm sorry you're feeling down. Remember, this too shall pass. You're stronger than you think! 💙",
      video: "https://www.youtube.com/embed/nLPBgRUprDE", // Funny animals compilation
      suggestion: "It might help to talk to someone you trust or try some relaxing activities."
    },
    tired: {
      message: "Rest is productive too! Your body and mind need this recovery time. 😴",
      video: "https://www.youtube.com/embed/1ZYbU82GVz4", // Peaceful relaxation
      suggestion: "Consider taking a power nap or doing some gentle stretching."
    },
  };
  
  return responses[mood];
}

export default function MoodTracker() {
  const { moodEntries, addMoodEntry } = useData();
  const navigate = useNavigate();
  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text');
  const [description, setDescription] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResponse, setAiResponse] = useState<{ mood: string, message: string, video: string, suggestion: string } | null>(null);
  const recognitionRef = useRef<any>(null);

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setIsAnalyzing(true);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const analysis = analyzeMoodFromText(description);
    const moodData = MOODS.find(m => m.value === analysis.mood)!;
    const response = generateResponse(analysis.mood);
    
    // Save mood entry
    addMoodEntry({
      date: new Date().toISOString(),
      mood: analysis.mood,
      energy: 5,
      notes: description,
    });
    
    setAiResponse({
      mood: moodData.emoji,
      message: response.message,
      video: response.video,
      suggestion: response.suggestion,
    });
    
    setIsAnalyzing(false);
    
    // Auto-redirect to games if mood is low or tired
    if (analysis.mood === 'low' || analysis.mood === 'tired') {
      setTimeout(() => {
        toast.info('Redirecting you to games to help boost your mood! 🎮');
        setTimeout(() => navigate('/games'), 2000);
      }, 5000);
    }
  };

  const startVoiceRecording = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('Voice recognition is not supported in your browser');
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsRecording(true);
      toast.info('Listening... speak now');
    };

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      setDescription(transcript);
      setIsRecording(false);
      
      // Automatically analyze after voice input
      setIsAnalyzing(true);
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const analysis = analyzeMoodFromText(transcript);
      const moodData = MOODS.find(m => m.value === analysis.mood)!;
      const response = generateResponse(analysis.mood);
      
      addMoodEntry({
        date: new Date().toISOString(),
        mood: analysis.mood,
        energy: 5,
        notes: transcript,
      });
      
      setAiResponse({
        mood: moodData.emoji,
        message: response.message,
        video: response.video,
        suggestion: response.suggestion,
      });
      
      setIsAnalyzing(false);
      
      if (analysis.mood === 'low' || analysis.mood === 'tired') {
        setTimeout(() => {
          toast.info('Redirecting you to games to help boost your mood! 🎮');
          setTimeout(() => navigate('/games'), 2000);
        }, 5000);
      }
    };

    recognition.onerror = () => {
      setIsRecording(false);
      toast.error('Error recording voice. Please try again.');
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const recentEntries = [...moodEntries].reverse().slice(0, 5);

  return (
    <div className="p-8">
      <Toaster />
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Mood Tracker
          </h1>
          <p className="text-muted-foreground">
            How are you feeling today? Share your thoughts with us.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-8 bg-card rounded-2xl shadow-lg border border-border"
        >
          {/* Input Mode Toggle */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setInputMode('text')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-all ${
                inputMode === 'text'
                  ? 'bg-gradient-to-r from-[#800020] to-[#DCAE96] text-white shadow-md'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <Type className="w-5 h-5" />
              Type Description
            </button>
            <button
              onClick={() => setInputMode('voice')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-all ${
                inputMode === 'voice'
                  ? 'bg-gradient-to-r from-[#800020] to-[#DCAE96] text-white shadow-md'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <Mic className="w-5 h-5" />
              Voice Input
            </button>
          </div>

          {inputMode === 'text' ? (
            <form onSubmit={handleTextSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  How are you feeling? Describe your mood...
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., I'm feeling a bit down today because..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-input-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={!description.trim() || isAnalyzing}
                className="w-full py-3 bg-gradient-to-r from-[#800020] to-[#DCAE96] text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing your mood...
                  </>
                ) : (
                  <>
                    <MessageCircle className="w-5 h-5" />
                    Analyze My Mood
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <button
                  onClick={startVoiceRecording}
                  disabled={isRecording || isAnalyzing}
                  className={`w-32 h-32 rounded-full mx-auto flex items-center justify-center transition-all ${
                    isRecording
                      ? 'bg-red-500 animate-pulse'
                      : 'bg-gradient-to-br from-[#800020] to-[#DCAE96] hover:shadow-2xl'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isRecording ? (
                    <Loader2 className="w-12 h-12 text-white animate-spin" />
                  ) : (
                    <Mic className="w-12 h-12 text-white" />
                  )}
                </button>
                <p className="mt-4 text-muted-foreground">
                  {isRecording ? 'Listening...' : 'Tap to start recording'}
                </p>
              </div>
              {description && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Transcription:</p>
                  <p className="text-foreground">{description}</p>
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* AI Response */}
        <AnimatePresence>
          {aiResponse && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mb-8 p-8 bg-gradient-to-br from-primary/10 to-secondary/10 border-2 border-primary/20 rounded-2xl shadow-xl"
            >
              <div className="text-center mb-6">
                <div className="text-6xl mb-4">{aiResponse.mood}</div>
                <h3 className="text-2xl font-bold text-foreground mb-2">Your Personalized Message</h3>
                <p className="text-lg text-foreground/90 leading-relaxed">{aiResponse.message}</p>
              </div>

              {/* Video Embed */}
              <div className="mb-6 rounded-xl overflow-hidden shadow-lg aspect-video">
                <iframe
                  width="100%"
                  height="100%"
                  src={aiResponse.video}
                  title="Mood boost video"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>

              <div className="bg-card/50 rounded-xl p-4 mb-6">
                <p className="text-sm font-medium text-muted-foreground mb-1">💡 Suggestion:</p>
                <p className="text-foreground">{aiResponse.suggestion}</p>
              </div>

              <button
                onClick={() => {
                  setAiResponse(null);
                  setDescription('');
                }}
                className="w-full py-3 bg-gradient-to-r from-[#800020] to-[#DCAE96] text-white font-semibold rounded-lg hover:shadow-lg transition-all"
              >
                Log Another Mood
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recent Entries */}
        {recentEntries.length > 0 && !aiResponse && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">
              Recent Entries
            </h2>
            <div className="space-y-3">
              {recentEntries.map((entry, idx) => {
                const mood = MOODS.find(m => m.value === entry.mood);
                const date = new Date(entry.date);
                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-5 bg-card rounded-xl shadow-md border border-border"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <div className={`text-3xl bg-gradient-to-br ${mood?.color} w-14 h-14 rounded-xl flex items-center justify-center`}>
                          {mood?.emoji}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-semibold text-foreground">
                              Feeling {mood?.label}
                            </span>
                          </div>
                          {entry.notes && (
                            <p className="text-muted-foreground text-sm">
                              {entry.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <div>{date.toLocaleDateString()}</div>
                        <div>{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {moodEntries.length === 0 && !aiResponse && (
          <div className="text-center py-16 bg-card rounded-2xl border border-border">
            <p className="text-muted-foreground">
              No mood entries yet. Share how you're feeling above!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
