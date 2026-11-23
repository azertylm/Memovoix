import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Calendar,
  Camera,
  Check,
  ChevronRight,
  Clock,
  Download,
  Edit3,
  Feather,
  FileText,
  HelpCircle,
  MapPin,
  Mic,
  MicOff,
  Moon,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Star,
  Sun,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  CHAPTERS,
  DEFAULT_BOOK_PREFACE,
  EXAMPLE_MEMORIES,
  HERO_BOOK_IMAGE,
  MemoryEntry,
  embellishLocally,
  generateLocalPreface,
} from './data/memoVoixData';
import { useOnlineStatus, usePWAInstall } from './hooks/usePWAInstall';
import {
  loadMemoriesFromStorage,
  saveMemoriesToStorage,
} from './utils/memoVoixDB';

type ActiveTab = 'studio' | 'chapitres' | 'livre' | 'famille';
type BookSortOrder = 'chapitres' | 'chronologique';

interface CustomQuestionsMap {
  [chapterId: string]: string[];
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    AlphabetteShell?: {
      getApiConfig: () => { provider: string; mode: string };
      getTheme: () => string;
      setTheme: (theme: string) => void;
      getScale: () => number;
      setScale: (scale: number) => void;
    };
  }
}

const STORAGE_KEYS = {
  MEMORIES: 'memovoix_memories_v1',
  SHOW_EXAMPLES: 'memovoix_show_examples_v1',
  AUTHOR_NAME: 'memovoix_author_name_v1',
  BOOK_SUBTITLE: 'memovoix_book_subtitle_v1',
  BOOK_PREFACE: 'memovoix_book_preface_v1',
  CUSTOM_QUESTIONS: 'memovoix_custom_questions_v1',
  AUTO_SPEAK: 'memovoix_auto_speak_v1',
  PREFER_LOCAL_AI: 'memovoix_prefer_local_ai_v1',
};

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('studio');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('alphabette_memovoix_theme');
    return saved === 'light' ? 'light' : 'dark';
  });

  // État du conteur & du livre
  const [authorName, setAuthorName] = useState<string>(() => {
    return (
      localStorage.getItem(STORAGE_KEYS.AUTHOR_NAME) ||
      'Mamie Louise & Papi Jean'
    );
  });
  const [bookSubtitle, setBookSubtitle] = useState<string>(() => {
    return (
      localStorage.getItem(STORAGE_KEYS.BOOK_SUBTITLE) ||
      'Chroniques familiales transmises de vive voix à nos enfants et petits-enfants'
    );
  });
  const [bookPreface, setBookPreface] = useState<string>(() => {
    return (
      localStorage.getItem(STORAGE_KEYS.BOOK_PREFACE) || DEFAULT_BOOK_PREFACE
    );
  });
  const [isGeneratingPreface, setIsGeneratingPreface] =
    useState<boolean>(false);

  // Souvenirs & Exemples (Chargement initial + synchronisation IndexedDB souveraine)
  const [userMemories, setUserMemories] = useState<MemoryEntry[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.MEMORIES);
      return raw ? (JSON.parse(raw) as MemoryEntry[]) : [];
    } catch {
      return [];
    }
  });
  const [idbReady, setIdbReady] = useState<boolean>(false);
  const [showExamples, setShowExamples] = useState<boolean>(() => {
    const raw = localStorage.getItem(STORAGE_KEYS.SHOW_EXAMPLES);
    return raw === null ? true : raw === 'true';
  });

  // Pile de questions personnalisées ajoutées par un proche
  const [customQuestions, setCustomQuestions] = useState<CustomQuestionsMap>(
    () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_QUESTIONS);
        return raw ? (JSON.parse(raw) as CustomQuestionsMap) : {};
      } catch {
        return {};
      }
    }
  );

  // Préférences de session
  const [autoSpeak, setAutoSpeak] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEYS.AUTO_SPEAK) === 'true';
  });
  const [preferLocalAI, setPreferLocalAI] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEYS.PREFER_LOCAL_AI) === 'true';
  });

  // Navigation dans les chapitres & questions
  const [selectedChapterId, setSelectedChapterId] = useState<string>(
    CHAPTERS[0].id
  );
  const [questionIndex, setQuestionIndex] = useState<number>(0);
  const [activeFollowUp, setActiveFollowUp] = useState<string | null>(null);

  // Studio Vocal Zéro-Clavier
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isSpeakingQuestion, setIsSpeakingQuestion] = useState<boolean>(false);
  const [rawTranscript, setRawTranscript] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [photoBase64, setPhotoBase64] = useState<string | undefined>(undefined);
  const [photoCaption, setPhotoCaption] = useState<string>('');
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | undefined>(
    undefined
  );

  // Sublimation Éditoriale & Métadonnées d'époque
  const [isEmbellishing, setIsEmbellishing] = useState<boolean>(false);
  const [isGeneratingFollowUp, setIsGeneratingFollowUp] =
    useState<boolean>(false);
  const [draftTitle, setDraftTitle] = useState<string>('');
  const [draftEmbellished, setDraftEmbellished] = useState<string>('');
  const [draftPullQuote, setDraftPullQuote] = useState<string>('');
  const [draftEpochYear, setDraftEpochYear] = useState<string>('');
  const [draftLocation, setDraftLocation] = useState<string>('');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Filtres, Tri & Édition directe dans "Feuilleter mon Livre"
  const [bookChapterFilter, setBookChapterFilter] = useState<string>('all');
  const [bookSortOrder, setBookSortOrder] =
    useState<BookSortOrder>('chapitres');
  const [bookSearchQuery, setBookSearchQuery] = useState<string>('');
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [editMemoryDraft, setEditMemoryDraft] =
    useState<Partial<MemoryEntry> | null>(null);

  // Formulaire d'ajout de question par un proche
  const [newCustomQuestion, setNewCustomQuestion] = useState<string>('');
  const [newCustomChapterId, setNewCustomChapterId] = useState<string>(
    CHAPTERS[0].id
  );

  // Micro-modale Avis & Idées (.eu)
  const [feedbackOpen, setFeedbackOpen] = useState<boolean>(false);
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [feedbackComment, setFeedbackComment] = useState<string>('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<boolean>(false);
  const [isDictatingFeedback, setIsDictatingFeedback] =
    useState<boolean>(false);

  // Guide d'installation iOS PWA
  const [showIOSGuide, setShowIOSGuide] = useState<boolean>(false);
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const isOnline = useOnlineStatus();

  // Références Audio / Speech / Canvas
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const isRecordingRef = useRef<boolean>(false);

  // Chargement initial depuis IndexedDB
  useEffect(() => {
    let mounted = true;
    loadMemoriesFromStorage().then((stored) => {
      if (!mounted) return;
      if (stored.length > 0) {
        setUserMemories(stored);
      }
      setIdbReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Synchronisation avec le Web Component <alphabette-shell>
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ theme: string }>).detail;
      if (detail?.theme) {
        setTheme(detail.theme === 'light' ? 'light' : 'dark');
      }
    };
    window.addEventListener('alphabette-preferences-changed', handler);
    return () =>
      window.removeEventListener('alphabette-preferences-changed', handler);
  }, []);

  // Sauvegardes automatiques IndexedDB + localStorage
  useEffect(() => {
    if (!idbReady) return;
    saveMemoriesToStorage(userMemories);
  }, [userMemories, idbReady]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SHOW_EXAMPLES, String(showExamples));
  }, [showExamples]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.AUTHOR_NAME, authorName);
  }, [authorName]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.BOOK_SUBTITLE, bookSubtitle);
  }, [bookSubtitle]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.BOOK_PREFACE, bookPreface);
  }, [bookPreface]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.CUSTOM_QUESTIONS,
      JSON.stringify(customQuestions)
    );
  }, [customQuestions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.AUTO_SPEAK, String(autoSpeak));
  }, [autoSpeak]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PREFER_LOCAL_AI, String(preferLocalAI));
  }, [preferLocalAI]);

  const currentChapter =
    CHAPTERS.find((c) => c.id === selectedChapterId) || CHAPTERS[0];
  const chapterCustomList = customQuestions[currentChapter.id] || [];
  const allChapterQuestions = [
    ...currentChapter.questions,
    ...chapterCustomList,
  ];
  const safeQuestionIndex = questionIndex % allChapterQuestions.length;
  const displayedQuestion =
    activeFollowUp || allChapterQuestions[safeQuestionIndex];

  const allDisplayedMemories: MemoryEntry[] = useMemo(
    () => [...userMemories, ...(showExamples ? EXAMPLE_MEMORIES : [])],
    [userMemories, showExamples]
  );

  // Filtrage et tri des souvenirs dans le Livre de Vie
  const filteredAndSortedMemories = useMemo(() => {
    const query = bookSearchQuery.trim().toLowerCase();
    const filtered = allDisplayedMemories.filter((mem) => {
      if (bookChapterFilter !== 'all' && mem.chapterId !== bookChapterFilter) {
        return false;
      }
      if (!query) return true;
      return (
        mem.title.toLowerCase().includes(query) ||
        mem.embellishedText.toLowerCase().includes(query) ||
        (mem.location && mem.location.toLowerCase().includes(query)) ||
        (mem.epochYear && mem.epochYear.toLowerCase().includes(query))
      );
    });

    if (bookSortOrder === 'chronologique') {
      return [...filtered].sort((a, b) => {
        const yearA = parseInt(a.epochYear?.match(/\d{4}/)?.[0] || '9999', 10);
        const yearB = parseInt(b.epochYear?.match(/\d{4}/)?.[0] || '9999', 10);
        return yearA - yearB;
      });
    }

    return filtered;
  }, [allDisplayedMemories, bookChapterFilter, bookSortOrder, bookSearchQuery]);

  // Statistiques patrimoniales de l'archive familiale
  const archiveStats = useMemo(() => {
    const totalWords = allDisplayedMemories.reduce((sum, m) => {
      const words = m.embellishedText.trim().split(/\s+/).filter(Boolean).length;
      return sum + words;
    }, 0);
    const totalSeconds = allDisplayedMemories.reduce(
      (sum, m) => sum + (m.durationSeconds || 0),
      0
    );
    const coveredChapters = new Set(allDisplayedMemories.map((m) => m.chapterId))
      .size;
    return {
      totalWords,
      totalMinutes: Math.max(1, Math.round(totalSeconds / 60)),
      coveredChapters,
    };
  }, [allDisplayedMemories]);

  // Synthèse vocale douce en français (window.speechSynthesis)
  const speakQuestion = (textToRead: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setStatusBanner(
        'La lecture vocale n’est pas disponible sur ce navigateur.'
      );
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.lang = 'fr-FR';
    utterance.rate = 0.92;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const frenchVoice =
      voices.find(
        (v) =>
          v.lang.toLowerCase().startsWith('fr') &&
          (v.name.toLowerCase().includes('thomas') ||
            v.name.toLowerCase().includes('amelie') ||
            v.name.toLowerCase().includes('audrey') ||
            v.name.toLowerCase().includes('google') ||
            v.name.toLowerCase().includes('natural'))
      ) || voices.find((v) => v.lang.toLowerCase().startsWith('fr'));

    if (frenchVoice) {
      utterance.voice = frenchVoice;
    }

    utterance.onstart = () => setIsSpeakingQuestion(true);
    utterance.onend = () => setIsSpeakingQuestion(false);
    utterance.onerror = () => setIsSpeakingQuestion(false);

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeakingQuestion(false);
    }
  };

  useEffect(() => {
    if (autoSpeak && activeTab === 'studio') {
      speakQuestion(displayedQuestion);
    }
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [displayedQuestion, autoSpeak, activeTab]);

  // Animation Canvas des ondes sonores dorées
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;

    const renderWave = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      let volume = 0.08;
      if (isRecordingRef.current && analyserRef.current) {
        const dataArray = new Uint8Array(
          analyserRef.current.frequencyBinCount
        );
        analyserRef.current.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((acc, val) => acc + val, 0);
        volume = Math.max(0.15, Math.min(1, sum / (dataArray.length * 110)));
      } else if (isRecordingRef.current) {
        volume = 0.45 + Math.sin(phase * 2) * 0.2;
      }

      const barCount = 36;
      const barGap = 6;
      const totalBarWidth = width - barGap * (barCount - 1);
      const barWidth = Math.max(3, totalBarWidth / barCount);

      for (let i = 0; i < barCount; i++) {
        const centerDist = Math.abs(i - barCount / 2) / (barCount / 2);
        const envelope = Math.cos(centerDist * Math.PI * 0.48);
        const wave =
          Math.sin(phase + i * 0.35) * 0.5 +
          Math.cos(phase * 1.4 - i * 0.2) * 0.5;
        const activeFactor = isRecordingRef.current ? volume : 0.12;
        const barHeight = Math.max(
          6,
          height *
            0.78 *
            envelope *
            (0.25 + Math.abs(wave) * 0.75) *
            activeFactor
        );

        const x = i * (barWidth + barGap);
        const y = (height - barHeight) / 2;

        ctx.fillStyle = isRecordingRef.current
          ? 'rgba(245, 158, 11, 0.92)'
          : 'rgba(245, 158, 11, 0.28)';
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 4);
        ctx.fill();
      }

      phase += isRecordingRef.current ? 0.09 : 0.025;
      animFrameRef.current = requestAnimationFrame(renderWave);
    };

    renderWave();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isRecording]);

  // Démarrer / Arrêter le Studio Vocal Zéro-Clavier
  const startRecording = async () => {
    stopSpeaking();
    setStatusBanner(null);
    isRecordingRef.current = true;
    setIsRecording(true);

    timerRef.current = window.setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);

    const SpeechRec =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        const recognition = new SpeechRec();
        recognition.lang = 'fr-FR';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event: SpeechRecognitionEventLike) => {
          let finalChunk = '';
          let interimChunk = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const res = event.results[i];
            if (res.isFinal) {
              finalChunk += res[0].transcript + ' ';
            } else {
              interimChunk += res[0].transcript;
            }
          }
          if (finalChunk) {
            setRawTranscript((prev) =>
              prev ? prev.trim() + ' ' + finalChunk.trim() : finalChunk.trim()
            );
          }
          setInterimTranscript(interimChunk);
        };

        recognition.onerror = () => {};

        recognition.onend = () => {
          if (isRecordingRef.current) {
            try {
              recognition.start();
            } catch {
              // Ignore restart error if already active
            }
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch {
        setStatusBanner(
          'La dictée directe rencontre une restriction navigateur : vous pouvez parler ou compléter le texte ci-dessous.'
        );
      }
    } else {
      setStatusBanner(
        'Votre navigateur ne supporte pas la transcription automatique en direct, mais l’enregistrement audio et la saisie restent actifs.'
      );
    }

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        audioContextRef.current = audioCtx;
        analyserRef.current = analyser;

        const mediaRecorder = new MediaRecorder(stream);
        audioChunksRef.current = [];
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };
        mediaRecorder.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              setRecordedAudioUrl(reader.result);
            }
          };
          reader.readAsDataURL(blob);
          stream.getTracks().forEach((track) => track.stop());
        };
        mediaRecorder.start();
        mediaRecorderRef.current = mediaRecorder;
      } catch {
        // Le visualiseur affiche une onde dorée même si le micro est refusé
      }
    }
  };

  const stopRecording = () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    setInterimTranscript('');

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore
      }
      recognitionRef.current = null;
    }

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore
      }
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleNextQuestion = () => {
    stopSpeaking();
    setActiveFollowUp(null);
    setQuestionIndex((prev) => (prev + 1) % allChapterQuestions.length);
  };

  const handleDeepenMemory = async () => {
    stopSpeaking();
    setIsGeneratingFollowUp(true);
    setStatusBanner(null);

    const localTemplates = currentChapter.followUpTemplates;
    const fallbackQuestion =
      localTemplates[Math.floor(Math.random() * localTemplates.length)];

    if (preferLocalAI || !isOnline) {
      setActiveFollowUp(fallbackQuestion);
      setIsGeneratingFollowUp(false);
      return;
    }

    try {
      const response = await fetch('/api/relance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentQuestion: displayedQuestion,
          currentTranscript: rawTranscript,
          chapterTitle: currentChapter.title,
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as { followUpQuestion?: string };
        if (data.followUpQuestion) {
          setActiveFollowUp(data.followUpQuestion);
          setIsGeneratingFollowUp(false);
          return;
        }
      }
      setActiveFollowUp(fallbackQuestion);
    } catch {
      setActiveFollowUp(fallbackQuestion);
    } finally {
      setIsGeneratingFollowUp(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoBase64(reader.result);
        if (!photoCaption) {
          setPhotoCaption(`Photographie d’archive — ${currentChapter.title}`);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Sublimation Éditoriale par IA (Serveur Gemini 4 Hydrogen ou Mode Local 100% Hors-Ligne)
  const handleEmbellishStory = async () => {
    if (isRecording) {
      stopRecording();
    }
    const sourceText = (rawTranscript + ' ' + interimTranscript).trim();
    if (!sourceText) {
      setStatusBanner(
        'Racontez d’abord quelques phrases (ou utilisez le bouton de démonstration vocale) avant d’embellir le récit.'
      );
      return;
    }

    setIsEmbellishing(true);
    setStatusBanner(null);

    const applyLocalResult = (bannerMsg: string) => {
      const localResult = embellishLocally(
        sourceText,
        displayedQuestion,
        currentChapter.title
      );
      setDraftTitle(localResult.title);
      setDraftEmbellished(localResult.embellishedText);
      setDraftPullQuote(localResult.pullQuote);
      if (localResult.epochYear && !draftEpochYear) {
        setDraftEpochYear(localResult.epochYear);
      }
      setStatusBanner(bannerMsg);
    };

    if (preferLocalAI || !isOnline) {
      applyLocalResult(
        'Récit sublimé avec le moteur éditorial 100% local (Ponctuation, lettrine et paragraphes littéraires).'
      );
      setIsEmbellishing(false);
      return;
    }

    try {
      const response = await fetch('/api/embellir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: sourceText,
          question: displayedQuestion,
          chapterTitle: currentChapter.title,
          authorName,
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          title: string;
          embellishedText: string;
          pullQuote: string;
          epochYear?: string;
          location?: string;
        };
        setDraftTitle(data.title);
        setDraftEmbellished(data.embellishedText);
        setDraftPullQuote(data.pullQuote);
        if (data.epochYear && !draftEpochYear) {
          setDraftEpochYear(data.epochYear);
        }
        if (data.location && !draftLocation) {
          setDraftLocation(data.location);
        }
        setStatusBanner(
          'Votre récit a été sublimé par le biographe IA tout en préservant fidèlement vos mots et votre émotion.'
        );
      } else {
        applyLocalResult(
          'Récit mis en page avec le moteur éditorial local autonome.'
        );
      }
    } catch {
      applyLocalResult(
        'Récit mis en page avec le moteur éditorial local autonome.'
      );
    } finally {
      setIsEmbellishing(false);
    }
  };

  // Générer ou sublimer la Préface Familiale
  const handleGeneratePreface = async () => {
    setIsGeneratingPreface(true);
    const localPreface = generateLocalPreface(authorName, allDisplayedMemories);

    if (preferLocalAI || !isOnline) {
      setBookPreface(localPreface);
      setIsGeneratingPreface(false);
      setStatusBanner('Préface familiale rédigée avec le moteur local.');
      return;
    }

    try {
      const response = await fetch('/api/preface', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorName,
          memoryTitles: allDisplayedMemories.map((m) => m.title),
        }),
      });
      if (response.ok) {
        const data = (await response.json()) as { preface?: string };
        if (data.preface) {
          setBookPreface(data.preface);
          setStatusBanner(
            'Préface familiale personnalisée rédigée par le Biographe.'
          );
          setIsGeneratingPreface(false);
          return;
        }
      }
      setBookPreface(localPreface);
    } catch {
      setBookPreface(localPreface);
    } finally {
      setIsGeneratingPreface(false);
    }
  };

  // Inscrire le souvenir dans le Livre de Vie
  const handleSaveMemoryToBook = () => {
    if (isRecording) {
      stopRecording();
    }
    const raw = (rawTranscript + ' ' + interimTranscript).trim();
    if (!raw && !draftEmbellished) {
      setStatusBanner(
        'Racontez un souvenir avant de l’ajouter à votre Livre de Vie.'
      );
      return;
    }

    const fallbackLocal = embellishLocally(
      raw,
      displayedQuestion,
      currentChapter.title
    );

    const finalTitle = draftTitle.trim() || fallbackLocal.title;
    const finalProse = draftEmbellished.trim() || fallbackLocal.embellishedText;
    const finalQuote = draftPullQuote.trim() || fallbackLocal.pullQuote;
    const finalEpoch =
      draftEpochYear.trim() || fallbackLocal.epochYear || undefined;
    const finalLocation = draftLocation.trim() || undefined;

    const formattedDate = new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date());

    const newEntry: MemoryEntry = {
      id: `mem-${Date.now()}`,
      chapterId: currentChapter.id,
      chapterNumber: currentChapter.number,
      chapterTitle: currentChapter.title,
      question: displayedQuestion,
      title: finalTitle,
      rawText: raw || finalProse,
      embellishedText: finalProse,
      pullQuote: finalQuote,
      date: formattedDate,
      epochYear: finalEpoch,
      location: finalLocation,
      durationSeconds: Math.max(12, recordingSeconds),
      photoBase64,
      photoCaption: photoCaption.trim() || undefined,
      audioDataUrl: recordedAudioUrl,
      isExample: false,
      isEmbellished: true,
    };

    setUserMemories((prev) => [newEntry, ...prev]);

    setRawTranscript('');
    setInterimTranscript('');
    setDraftTitle('');
    setDraftEmbellished('');
    setDraftPullQuote('');
    setDraftEpochYear('');
    setDraftLocation('');
    setPhotoBase64(undefined);
    setPhotoCaption('');
    setRecordedAudioUrl(undefined);
    setRecordingSeconds(0);
    setActiveFollowUp(null);
    setActiveTab('livre');
  };

  // Édition directe d'un souvenir dans le Livre de Vie
  const startEditingMemory = (mem: MemoryEntry) => {
    setEditingMemoryId(mem.id);
    setEditMemoryDraft({
      title: mem.title,
      embellishedText: mem.embellishedText,
      pullQuote: mem.pullQuote || '',
      epochYear: mem.epochYear || '',
      location: mem.location || '',
      photoCaption: mem.photoCaption || '',
    });
  };

  const saveEditedMemory = (mem: MemoryEntry) => {
    if (!editMemoryDraft) return;
    const updated: MemoryEntry = {
      ...mem,
      title: editMemoryDraft.title?.trim() || mem.title,
      embellishedText:
        editMemoryDraft.embellishedText?.trim() || mem.embellishedText,
      pullQuote: editMemoryDraft.pullQuote?.trim() || undefined,
      epochYear: editMemoryDraft.epochYear?.trim() || undefined,
      location: editMemoryDraft.location?.trim() || undefined,
      photoCaption: editMemoryDraft.photoCaption?.trim() || undefined,
      isExample: false,
    };

    if (mem.isExample) {
      // Si l'utilisateur personnalise un souvenir d'exemple, on le copie dans ses souvenirs personnels
      setUserMemories((prev) => [
        { ...updated, id: `mem-${Date.now()}` },
        ...prev,
      ]);
    } else {
      setUserMemories((prev) =>
        prev.map((item) => (item.id === mem.id ? updated : item))
      );
    }

    setEditingMemoryId(null);
    setEditMemoryDraft(null);
    setStatusBanner('Modifications enregistrées dans le Livre de Vie.');
  };

  const handleFillSampleVoice = () => {
    const sampleVoiceByChapter: Record<
      string,
      { text: string; year: string; place: string }
    > = {
      enfance: {
        text: "Je me souviens du chemin de terre bordé de mûriers sauvages que nous prenions chaque matin en 1956 avec mon frère Paul. En automne nos sabots claquaient sur les pierres humides et nous remplissions nos poches de châtaignes chaudes que le boulanger du bourg nous donnait en passant devant son fournil.",
        year: '1956',
        place: 'Chemin de l’école & Fournil du bourg',
      },
      recettes: {
        text: "Chaque dimanche matin vers 1964 ma mère préparait sa brioche tressée à la fleur d'oranger. Elle laissait lever la pâte sous un grand torchon à carreaux rouges près de la cuisinière à bois. Quand elle ouvrait la porte du four toute la cuisine s'illuminait d'un parfum doré que je n'ai jamais oublié.",
        year: '1964',
        place: 'Cuisine de la maison familiale',
      },
      jeunesse: {
        text: "C'était au bal de la Saint-Jean en juin 1968 sous les lampions multicolores de la place du village. L'accordéoniste jouait une valse lente et je n'osais pas traverser la piste, mais un sourire a suffi pour que nous dansions jusqu'à minuit sous les tilleuls.",
        year: 'Juin 1968',
        place: 'Place des Tilleuls',
      },
      metiers: {
        text: "Avec ma toute première paie d'apprenti en 1970 j'étais allé acheter une montre à gousset pour mon père et un foulard de soie bleue pour ma mère. Je n'avais jamais ressenti une telle fierté en poussant la porte de la maison ce soir-là.",
        year: '1970',
        place: 'Premier atelier d’apprentissage',
      },
      sagesse: {
        text: "Mes chers petits-enfants, n'oubliez jamais que la vraie richesse d'une vie se mesure aux tablées partagées, à la parole donnée et à la tendresse que l'on sème autour de soi chaque jour.",
        year: '2026',
        place: 'Maison de famille',
      },
    };
    const sample =
      sampleVoiceByChapter[currentChapter.id] || sampleVoiceByChapter.enfance;
    setRawTranscript(sample.text);
    setDraftEpochYear(sample.year);
    setDraftLocation(sample.place);
    setRecordingSeconds(64);
    setStatusBanner(
      'Récit vocal transcrit dans le studio. Cliquez sur « Embellir le récit » pour voir la magie opérer.'
    );
  };

  const handleDeleteMemory = (id: string) => {
    if (id.startsWith('example-')) {
      setShowExamples(false);
      return;
    }
    setUserMemories((prev) => prev.filter((m) => m.id !== id));
  };

  const handleAddCustomQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newCustomQuestion.trim();
    if (!cleaned) return;
    setCustomQuestions((prev) => ({
      ...prev,
      [newCustomChapterId]: [...(prev[newCustomChapterId] || []), cleaned],
    }));
    setSelectedChapterId(newCustomChapterId);
    setActiveFollowUp(cleaned);
    setNewCustomQuestion('');
    setStatusBanner(
      'Question familiale ajoutée avec succès et sélectionnée dans le studio.'
    );
  };

  // Sauvegarde Souveraine (.json) — Export & Import
  const handleExportJSON = () => {
    const payload = {
      app: 'MémoVoix — Alphabette',
      version: '0.4.0',
      exportedAt: new Date().toISOString(),
      authorName,
      bookSubtitle,
      bookPreface,
      userMemories,
      customQuestions,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `memovoix-livre-de-vie-${authorName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export Manuscrit Littéraire (.md)
  const handleExportMarkdown = () => {
    const lines: string[] = [
      `# Les Souvenirs de ${authorName}`,
      `_${bookSubtitle}_`,
      '',
      '---',
      '',
      '## Préface Familiale',
      '',
      bookPreface,
      '',
      '---',
      '',
    ];

    allDisplayedMemories.forEach((mem, index) => {
      lines.push(`## ${index + 1}. ${mem.title}`);
      const metaParts = [
        `${mem.chapterNumber} (${mem.chapterTitle})`,
        mem.epochYear ? `Époque : ${mem.epochYear}` : null,
        mem.location ? `Lieu : ${mem.location}` : null,
        `Recueilli le ${mem.date}`,
      ].filter(Boolean);
      lines.push(`*${metaParts.join(' · ')}*`);
      lines.push('');
      lines.push(`> Question : « ${mem.question} »`);
      lines.push('');
      lines.push(mem.embellishedText);
      if (mem.pullQuote) {
        lines.push('');
        lines.push(`> ${mem.pullQuote}`);
      }
      lines.push('');
      lines.push('---');
      lines.push('');
    });

    const blob = new Blob([lines.join('\n')], {
      type: 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `manuscrit-souvenirs-${authorName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (Array.isArray(data.userMemories)) {
          setUserMemories(data.userMemories);
        }
        if (typeof data.authorName === 'string') {
          setAuthorName(data.authorName);
        }
        if (typeof data.bookSubtitle === 'string') {
          setBookSubtitle(data.bookSubtitle);
        }
        if (typeof data.bookPreface === 'string') {
          setBookPreface(data.bookPreface);
        }
        if (data.customQuestions && typeof data.customQuestions === 'object') {
          setCustomQuestions(data.customQuestions);
        }
        setStatusBanner(
          'Sauvegarde familiale restaurée avec succès dans IndexedDB.'
        );
      } catch {
        setStatusBanner(
          'Le fichier sélectionné n’est pas une sauvegarde MémoVoix valide.'
        );
      }
    };
    reader.readAsText(file);
  };

  const handleToggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (window.AlphabetteShell) {
      window.AlphabetteShell.setTheme(next);
    }
  };

  const handleDictateFeedback = () => {
    const SpeechRec =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      setFeedbackComment((prev) =>
        prev
          ? prev
          : 'Application très rassurante et lisible pour nos grands-parents.'
      );
      return;
    }
    if (isDictatingFeedback) {
      setIsDictatingFeedback(false);
      return;
    }
    try {
      const rec = new SpeechRec();
      rec.lang = 'fr-FR';
      rec.continuous = false;
      rec.interimResults = false;
      setIsDictatingFeedback(true);
      rec.onresult = (ev: SpeechRecognitionEventLike) => {
        const transcript = ev.results[0]?.[0]?.transcript || '';
        if (transcript) {
          setFeedbackComment((prev) =>
            prev ? `${prev} ${transcript}` : transcript
          );
        }
      };
      rec.onend = () => setIsDictatingFeedback(false);
      rec.onerror = () => setIsDictatingFeedback(false);
      rec.start();
    } catch {
      setIsDictatingFeedback(false);
    }
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="min-h-screen flex flex-col justify-between">
      {/* Indicateur Hors-Ligne PWA non-intrusif */}
      {!isOnline && (
        <div className="no-print bg-amber-500/15 border-b border-amber-500/30 px-6 py-2.5 text-center text-sm font-medium">
          Mode 100% Local Hors-Ligne actif — Vos récits, vos photos et la
          sublimation éditoriale fonctionnent sans connexion Internet.
        </div>
      )}

      {/* Navigation Principale — Respecte le Top Bar Contract à 3 zones (Brand, 4 liens, 1 action primaire) */}
      <header
        className="no-print sticky top-0 z-30 border-b backdrop-blur-md transition-colors"
        style={{
          backgroundColor:
            theme === 'dark'
              ? 'rgba(15, 17, 21, 0.90)'
              : 'rgba(250, 246, 240, 0.92)',
          borderColor: 'var(--alpha-border)',
        }}
      >
        <div className="max-w-[1360px] mx-auto px-6 py-3.5 flex items-center justify-between gap-8">
          {/* Zone 1 : Wordmark unique */}
          <a
            href="#studio"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('studio');
            }}
            className="font-serif-display text-2xl font-bold tracking-tight whitespace-nowrap shrink-0"
            style={{ color: 'var(--alpha-text)' }}
          >
            MémoVoix
          </a>

          {/* Zone 2 : 4 liens de navigation concis sur une seule ligne */}
          <nav
            aria-label="Navigation principale"
            className="flex items-center gap-6 md:gap-8 overflow-x-auto py-1"
          >
            <button
              type="button"
              onClick={() => setActiveTab('studio')}
              className={`min-h-[56px] px-3 text-base font-semibold transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
                activeTab === 'studio'
                  ? 'border-amber-500 text-amber-500'
                  : 'border-transparent opacity-80 hover:opacity-100'
              }`}
            >
              Studio Vocal
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('chapitres')}
              className={`min-h-[56px] px-3 text-base font-semibold transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
                activeTab === 'chapitres'
                  ? 'border-amber-500 text-amber-500'
                  : 'border-transparent opacity-80 hover:opacity-100'
              }`}
            >
              Chapitres ({CHAPTERS.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('livre')}
              className={`min-h-[56px] px-3 text-base font-semibold transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
                activeTab === 'livre'
                  ? 'border-amber-500 text-amber-500'
                  : 'border-transparent opacity-80 hover:opacity-100'
              }`}
            >
              Feuilleter mon Livre ({allDisplayedMemories.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('famille')}
              className={`min-h-[56px] px-3 text-base font-semibold transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
                activeTab === 'famille'
                  ? 'border-amber-500 text-amber-500'
                  : 'border-transparent opacity-80 hover:opacity-100'
              }`}
            >
              Espace Famille
            </button>
          </nav>

          {/* Zone 3 : 1 Action primaire (Imprimer / Exporter le Livret PDF) */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveTab('livre');
                setTimeout(() => window.print(), 180);
              }}
              className="min-h-[56px] px-5 py-3 rounded-xl font-semibold text-base bg-amber-500 text-stone-950 hover:bg-amber-400 transition-colors flex items-center gap-2.5 whitespace-nowrap shrink-0 shadow-sm cursor-pointer"
            >
              <Printer className="w-5 h-5" />
              <span>Exporter le Livret PDF</span>
            </button>
          </div>
        </div>
      </header>

      {/* Contenu Principal */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-6 py-8 md:py-10">
        {/* Bandeau d'accès rapide Thème Papier Ivoire / Onyx & Patrimoine */}
        <div
          className="no-print mb-8 pb-6 border-b flex flex-wrap items-center justify-between gap-4"
          style={{ borderColor: 'var(--alpha-border)' }}
        >
          <div
            className="flex flex-wrap items-center gap-3 text-sm"
            style={{ color: 'var(--alpha-muted)' }}
          >
            <span
              className="font-semibold"
              style={{ color: 'var(--alpha-text)' }}
            >
              Livre de {authorName}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              {allDisplayedMemories.length} récits ({archiveStats.totalWords}{' '}
              mots transmis)
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              {archiveStats.coveredChapters}/{CHAPTERS.length} chapitres explorés
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Bouton Bascule Onyx & Ambre / Papier Ivoire (Senior-First >= 56px) */}
            <button
              type="button"
              onClick={handleToggleTheme}
              className="min-h-[56px] px-4 py-2.5 rounded-xl border font-semibold text-sm flex items-center gap-2.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              style={{
                backgroundColor: 'var(--alpha-card)',
                borderColor: 'var(--alpha-border)',
                color: 'var(--alpha-text)',
              }}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-5 h-5 text-amber-400" />
                  <span>Mode Lecture Papier Ivoire</span>
                </>
              ) : (
                <>
                  <Moon className="w-5 h-5 text-amber-700" />
                  <span>Mode Studio Onyx &amp; Ambre</span>
                </>
              )}
            </button>

            {/* Bouton Installation PWA si installable ou iOS */}
            {!isInstalled && isInstallable && (
              <button
                type="button"
                onClick={install}
                className="min-h-[56px] px-4 py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 font-semibold text-sm flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-5 h-5 text-amber-500" />
                <span>Installer l’application</span>
              </button>
            )}
            {!isInstalled && !isInstallable && isIOS && (
              <button
                type="button"
                onClick={() => setShowIOSGuide(true)}
                className="min-h-[56px] px-4 py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 font-semibold text-sm flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-5 h-5 text-amber-500" />
                <span>Installer sur iPad / iPhone</span>
              </button>
            )}
          </div>
        </div>

        {/* Message de retour d'action */}
        {statusBanner && (
          <div
            className="no-print mb-8 p-4 rounded-xl border flex items-center justify-between gap-4"
            style={{
              backgroundColor: 'var(--alpha-card)',
              borderColor: 'var(--alpha-accent)',
            }}
          >
            <p className="text-base font-medium">{statusBanner}</p>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              aria-label="Fermer le message"
              className="min-w-[56px] min-h-[56px] flex items-center justify-center rounded-lg hover:bg-amber-500/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* ===================================================================
            ONGLET 1 : STUDIO VOCAL "ZÉRO-CLAVIER" & MULTI-QUESTIONS
           =================================================================== */}
        {activeTab === 'studio' && (
          <div className="no-print space-y-10">
            {/* Sélecteur de Chapitres Thématiques sous forme de cartes illustrées */}
            <section aria-label="Choix du chapitre thématique">
              <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
                <h2 className="text-lg font-semibold">
                  Choisissez un chapitre illustré pour votre souvenir :
                </h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('chapitres')}
                  className="min-h-[56px] px-4 py-2 rounded-xl text-sm font-semibold text-amber-500 hover:underline flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Voir les 25 questions détaillées</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {CHAPTERS.map((chap) => {
                  const isSelected = chap.id === currentChapter.id;
                  return (
                    <button
                      key={chap.id}
                      type="button"
                      onClick={() => {
                        stopSpeaking();
                        setSelectedChapterId(chap.id);
                        setQuestionIndex(0);
                        setActiveFollowUp(null);
                      }}
                      className={`group min-h-[140px] rounded-2xl border text-left overflow-hidden transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'ring-2 ring-amber-500 shadow-md'
                          : 'opacity-85 hover:opacity-100'
                      }`}
                      style={{
                        backgroundColor: isSelected
                          ? 'var(--alpha-card-alt)'
                          : 'var(--alpha-card)',
                        borderColor: isSelected
                          ? 'var(--alpha-accent)'
                          : 'var(--alpha-border)',
                      }}
                    >
                      <div className="relative h-24 w-full bg-stone-900 overflow-hidden">
                        <img
                          src={chap.coverImage}
                          alt={chap.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
                        <span className="absolute bottom-2 left-3 text-xs font-bold tracking-wider text-amber-400">
                          {chap.number}
                        </span>
                      </div>
                      <div className="p-3.5">
                        <span className="font-serif-display text-base font-bold leading-snug block">
                          {chap.title}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Grille principale 2 colonnes équilibrées : Question & Studio Vocal à gauche / Sublimation & Photo à droite */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              {/* Colonne Gauche (7 cols) : Carte de Question & Studio Vocal Majestueux */}
              <div
                className="lg:col-span-7 rounded-2xl border p-6 md:p-10 flex flex-col justify-between"
                style={{
                  backgroundColor: 'var(--alpha-card)',
                  borderColor: 'var(--alpha-border)',
                }}
              >
                <div>
                  {/* Métadonnées épurées (Zero-Pill discipline : texte séparé par ·) */}
                  <div
                    className="flex flex-wrap items-center justify-between gap-2 text-sm mb-4"
                    style={{ color: 'var(--alpha-muted)' }}
                  >
                    <div>
                      <span className="font-semibold text-amber-500">
                        {currentChapter.number} — {currentChapter.title}
                      </span>
                      <span aria-hidden="true"> · </span>
                      <span className="tabular-nums">
                        Question {safeQuestionIndex + 1} sur{' '}
                        {allChapterQuestions.length}
                      </span>
                      {activeFollowUp && (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span className="italic text-amber-400">
                            Relance bienveillante
                          </span>
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setAutoSpeak((v) => !v)}
                      className="min-h-[48px] px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      style={{ borderColor: 'var(--alpha-border)' }}
                    >
                      {autoSpeak ? (
                        <>
                          <Volume2 className="w-4 h-4 text-amber-500" />
                          <span>Lecture auto : Activée</span>
                        </>
                      ) : (
                        <>
                          <VolumeX className="w-4 h-4 opacity-60" />
                          <span>Lecture auto : Désactivée</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* La Question Posée (Minimum 24px-30px en Serif éditorial élégant, text-wrap: balance) */}
                  <h1
                    className="font-serif-display text-2xl md:text-3xl lg:text-[32px] font-medium leading-relaxed mb-8"
                    style={{ textWrap: 'balance', color: 'var(--alpha-text)' }}
                  >
                    « {displayedQuestion} »
                  </h1>

                  {/* Barre de navigation fluide entre les questions (Cibles >= 56x56px) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
                    <button
                      type="button"
                      onClick={() =>
                        isSpeakingQuestion
                          ? stopSpeaking()
                          : speakQuestion(displayedQuestion)
                      }
                      className="min-h-[58px] px-4 py-3 rounded-xl border font-semibold text-base flex items-center justify-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap"
                      style={{
                        backgroundColor: isSpeakingQuestion
                          ? 'rgba(245, 158, 11, 0.18)'
                          : 'var(--alpha-card-alt)',
                        borderColor: 'var(--alpha-border)',
                      }}
                    >
                      <Volume2 className="w-5 h-5 text-amber-500 shrink-0" />
                      <span>
                        {isSpeakingQuestion
                          ? 'Arrêter la voix'
                          : 'Écouter la question'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDeepenMemory}
                      disabled={isGeneratingFollowUp}
                      className="min-h-[58px] px-4 py-3 rounded-xl border font-semibold text-base flex items-center justify-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap"
                      style={{
                        backgroundColor: 'var(--alpha-card-alt)',
                        borderColor: 'var(--alpha-border)',
                      }}
                    >
                      <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
                      <span>
                        {isGeneratingFollowUp
                          ? 'Réflexion...'
                          : 'Approfondir ce souvenir'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleNextQuestion}
                      className="min-h-[58px] px-4 py-3 rounded-xl border font-semibold text-base flex items-center justify-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap"
                      style={{
                        backgroundColor: 'var(--alpha-card-alt)',
                        borderColor: 'var(--alpha-border)',
                      }}
                    >
                      <RefreshCw className="w-5 h-5 text-amber-500 shrink-0" />
                      <span>Une autre question</span>
                    </button>
                  </div>
                </div>

                {/* Zone centrale : Bouton Majestueux "Appuyer pour raconter" + Visualiseur d'ondes dorées */}
                <div
                  className="rounded-2xl p-6 md:p-8 border text-center my-2"
                  style={{
                    backgroundColor: 'var(--alpha-bg)',
                    borderColor: isRecording
                      ? 'var(--alpha-accent)'
                      : 'var(--alpha-border)',
                  }}
                >
                  <div className="flex flex-col items-center justify-center">
                    <button
                      type="button"
                      onClick={toggleRecording}
                      aria-pressed={isRecording}
                      className={`min-w-[260px] min-h-[84px] px-8 py-5 rounded-2xl font-bold text-xl flex items-center justify-center gap-4 transition-transform active:scale-95 cursor-pointer shadow-lg ${
                        isRecording
                          ? 'bg-red-600 text-white hover:bg-red-500'
                          : 'bg-amber-500 text-stone-950 hover:bg-amber-400'
                      }`}
                    >
                      {isRecording ? (
                        <>
                          <MicOff className="w-8 h-8 shrink-0" />
                          <span>Terminer ma prise de parole</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-8 h-8 shrink-0" />
                          <span>Appuyer pour raconter</span>
                        </>
                      )}
                    </button>

                    <p
                      className="mt-3 text-base font-medium"
                      style={{ color: 'var(--alpha-muted)' }}
                    >
                      {isRecording ? (
                        <span className="text-amber-400 font-semibold tabular-nums">
                          Écoute attentive en cours (
                          {formatDuration(recordingSeconds)}) — Parlez
                          naturellement, vos mots s’écrivent ci-dessous
                        </span>
                      ) : (
                        'Aucune limite de temps · Parlez à votre rythme, sans toucher au clavier'
                      )}
                    </p>

                    {/* Visualiseur d'ondes audio dorées (Canvas) */}
                    <div className="w-full max-w-md mt-5">
                      <canvas
                        ref={canvasRef}
                        width={420}
                        height={58}
                        className="w-full h-[58px] mx-auto"
                        aria-label="Visualiseur d’ondes sonores dorées"
                      />
                    </div>
                  </div>

                  {/* Zone de Transcription Temps Réel */}
                  <div className="mt-6 text-left">
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                      <label
                        htmlFor="live-transcript-box"
                        className="text-sm font-semibold"
                        style={{ color: 'var(--alpha-muted)' }}
                      >
                        Vos paroles transcrites en direct :
                      </label>
                      <button
                        type="button"
                        onClick={handleFillSampleVoice}
                        className="min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-500 hover:bg-amber-500/10 transition-colors cursor-pointer"
                      >
                        Simuler un récit vocal d’exemple
                      </button>
                    </div>

                    <textarea
                      id="live-transcript-box"
                      rows={5}
                      value={
                        rawTranscript +
                        (interimTranscript ? ` ${interimTranscript}` : '')
                      }
                      onChange={(e) => {
                        setRawTranscript(e.target.value);
                        setInterimTranscript('');
                      }}
                      placeholder="Vos mots apparaîtront ici en temps réel dès que vous parlerez..."
                      className="w-full rounded-xl p-4 font-serif-book text-lg md:text-xl leading-relaxed border focus:outline-none focus:ring-2 focus:ring-amber-500"
                      style={{
                        backgroundColor: 'var(--alpha-card)',
                        borderColor: 'var(--alpha-border)',
                        color: 'var(--alpha-text)',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Colonne Droite (5 cols) : Sublimation Éditoriale, Époque/Lieu, Photo-Souvenir & Ajout au Livre */}
              <div
                className="lg:col-span-5 rounded-2xl border p-6 md:p-8 flex flex-col justify-between space-y-6"
                style={{
                  backgroundColor: 'var(--alpha-card)',
                  borderColor: 'var(--alpha-border)',
                }}
              >
                <div className="space-y-5">
                  <div>
                    <span className="text-xs font-semibold tracking-wider text-amber-500 uppercase">
                      Atelier du Biographe
                    </span>
                    <h2 className="font-serif-display text-2xl font-bold mt-1">
                      Sublimation Littéraire &amp; Photo d’Époque
                    </h2>
                    <p
                      className="text-sm mt-1 leading-relaxed"
                      style={{ color: 'var(--alpha-muted)' }}
                    >
                      Transformez la parole spontanée en un récit fluide à la
                      première personne, fidèle à votre voix, avec un titre
                      poétique.
                    </p>
                  </div>

                  {/* Bouton Embellir le récit (>= 56px) */}
                  <button
                    type="button"
                    onClick={handleEmbellishStory}
                    disabled={isEmbellishing}
                    className="w-full min-h-[60px] px-6 py-4 rounded-xl font-bold text-lg border-2 border-amber-500 text-amber-400 hover:bg-amber-500 hover:text-stone-950 transition-colors flex items-center justify-center gap-3 cursor-pointer"
                  >
                    <Feather className="w-6 h-6 shrink-0" />
                    <span>
                      {isEmbellishing
                        ? 'Plume du biographe en action...'
                        : 'Embellir le récit'}
                    </span>
                  </button>

                  {/* Aperçu / Édition du titre poétique, époque/lieu et du récit sublimé */}
                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="draft-title-input"
                        className="block text-sm font-semibold mb-1.5"
                      >
                        Titre poétique du souvenir :
                      </label>
                      <input
                        id="draft-title-input"
                        type="text"
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        placeholder="Généré automatiquement par « Embellir le récit »..."
                        className="w-full min-h-[56px] px-4 rounded-xl border font-serif-display text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                        style={{
                          backgroundColor: 'var(--alpha-bg)',
                          borderColor: 'var(--alpha-border)',
                          color: 'var(--alpha-text)',
                        }}
                      />
                    </div>

                    {/* Champs Année/Époque et Lieu du souvenir pour la Frise Chronologique */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="draft-epoch-input"
                          className="block text-xs font-semibold mb-1"
                          style={{ color: 'var(--alpha-muted)' }}
                        >
                          Année ou Époque (ex: 1954) :
                        </label>
                        <input
                          id="draft-epoch-input"
                          type="text"
                          value={draftEpochYear}
                          onChange={(e) => setDraftEpochYear(e.target.value)}
                          placeholder="Ex: Automne 1954"
                          className="w-full min-h-[52px] px-3.5 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                          style={{
                            backgroundColor: 'var(--alpha-bg)',
                            borderColor: 'var(--alpha-border)',
                            color: 'var(--alpha-text)',
                          }}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="draft-location-input"
                          className="block text-xs font-semibold mb-1"
                          style={{ color: 'var(--alpha-muted)' }}
                        >
                          Lieu du souvenir :
                        </label>
                        <input
                          id="draft-location-input"
                          type="text"
                          value={draftLocation}
                          onChange={(e) => setDraftLocation(e.target.value)}
                          placeholder="Ex: École de Saint-Malo"
                          className="w-full min-h-[52px] px-3.5 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                          style={{
                            backgroundColor: 'var(--alpha-bg)',
                            borderColor: 'var(--alpha-border)',
                            color: 'var(--alpha-text)',
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="draft-prose-input"
                        className="block text-sm font-semibold mb-1.5"
                      >
                        Texte littéraire pour le Livre de Vie :
                      </label>
                      <textarea
                        id="draft-prose-input"
                        rows={5}
                        value={draftEmbellished}
                        onChange={(e) => setDraftEmbellished(e.target.value)}
                        placeholder="Cliquez sur « Embellir le récit » pour mettre en forme votre témoignage oral..."
                        className="w-full p-4 rounded-xl border font-serif-book text-base md:text-lg leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-500"
                        style={{
                          backgroundColor: 'var(--alpha-bg)',
                          borderColor: 'var(--alpha-border)',
                          color: 'var(--alpha-text)',
                        }}
                      />
                    </div>
                  </div>

                  {/* Photo-Souvenir optionnelle (Base64 local) */}
                  <div
                    className="p-4 rounded-xl border"
                    style={{
                      backgroundColor: 'var(--alpha-bg)',
                      borderColor: 'var(--alpha-border)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h3 className="text-base font-semibold">
                          Photo-Souvenir d’époque (optionnel)
                        </h3>
                        <p
                          className="text-xs mt-0.5"
                          style={{ color: 'var(--alpha-muted)' }}
                        >
                          Archivée dans le coffre-fort local IndexedDB
                        </p>
                      </div>

                      <label className="min-h-[56px] px-4 py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 font-semibold text-sm flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0">
                        <Camera className="w-5 h-5 text-amber-500" />
                        <span>Choisir une photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {photoBase64 && (
                      <div className="mt-4 space-y-3">
                        <div className="polaroid-frame max-w-[240px] mx-auto">
                          <img
                            src={photoBase64}
                            alt={photoCaption || 'Photographie souvenir'}
                            referrerPolicy="no-referrer"
                            className="w-full h-36 object-cover rounded-xs"
                          />
                          <input
                            type="text"
                            value={photoCaption}
                            onChange={(e) => setPhotoCaption(e.target.value)}
                            placeholder="Légende de la photo..."
                            className="w-full mt-2 text-xs font-serif-book italic text-center bg-transparent border-b border-stone-300 focus:outline-none text-stone-800"
                          />
                        </div>
                        <div className="text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setPhotoBase64(undefined);
                              setPhotoCaption('');
                            }}
                            className="min-h-[44px] px-3 py-1 text-xs font-semibold text-red-400 hover:underline cursor-pointer"
                          >
                            Retirer la photo
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bouton Final : Inscrire ce souvenir dans mon Livre de Vie */}
                <button
                  type="button"
                  onClick={handleSaveMemoryToBook}
                  className="w-full min-h-[64px] px-6 py-4 rounded-xl font-bold text-lg bg-amber-500 text-stone-950 hover:bg-amber-400 transition-colors flex items-center justify-center gap-3 shadow-md cursor-pointer"
                >
                  <BookOpen className="w-6 h-6 shrink-0" />
                  <span>Inscrire ce souvenir dans mon Livre</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            ONGLET 2 : SÉLECTEUR DE CHAPITRES THÉMATIQUES ILLUSTRÉS (25 QUESTIONS)
           =================================================================== */}
        {activeTab === 'chapitres' && (
          <div className="no-print space-y-10">
            <div className="max-w-3xl">
              <span className="text-xs font-semibold tracking-widest uppercase text-amber-500">
                5 Chapitres Thématiques Illustrés · 25 Questions Patrimoniales
              </span>
              <h1 className="font-serif-display text-3xl md:text-4xl font-bold mt-2">
                Les Grands Chapitres d’une Vie
              </h1>
              <p
                className="text-lg mt-2 leading-relaxed"
                style={{ color: 'var(--alpha-muted)' }}
              >
                Explorez librement chaque époque ou cliquez directement sur une
                question qui éveille un souvenir pour l’ouvrir dans le Studio
                Vocal.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {CHAPTERS.map((chap) => {
                const customList = customQuestions[chap.id] || [];
                const combinedQuestions = [...chap.questions, ...customList];
                const chapterMemoryCount = allDisplayedMemories.filter(
                  (m) => m.chapterId === chap.id
                ).length;

                return (
                  <article
                    key={chap.id}
                    className="rounded-2xl border overflow-hidden flex flex-col justify-between"
                    style={{
                      backgroundColor: 'var(--alpha-card)',
                      borderColor: 'var(--alpha-border)',
                    }}
                  >
                    <div>
                      {/* Bandeau photographique d'archive avec scrim contrasté */}
                      <div className="relative h-48 w-full bg-stone-900 overflow-hidden">
                        <img
                          src={chap.coverImage}
                          alt={chap.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
                        <div className="absolute bottom-4 left-6 right-6 flex items-baseline justify-between gap-2 text-amber-100">
                          <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
                            {chap.number}
                          </span>
                          <span className="text-xs tabular-nums opacity-90">
                            {combinedQuestions.length} questions ·{' '}
                            {chapterMemoryCount} souvenir(s)
                          </span>
                        </div>
                      </div>

                      <div className="p-6 md:p-8">
                        <h2 className="font-serif-display text-2xl font-bold">
                          {chap.title}
                        </h2>
                        <p className="font-serif-book italic text-base text-amber-500/90 mt-1">
                          {chap.subtitle}
                        </p>
                        <p
                          className="text-sm mt-3 leading-relaxed"
                          style={{ color: 'var(--alpha-muted)' }}
                        >
                          {chap.description}
                        </p>

                        {/* Liste cliquable des questions du chapitre (Senior-First >= 56px par question) */}
                        <ul className="mt-6 space-y-2.5">
                          {combinedQuestions.map((q, idx) => (
                            <li key={idx}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedChapterId(chap.id);
                                  setQuestionIndex(idx);
                                  setActiveFollowUp(null);
                                  setActiveTab('studio');
                                }}
                                className="w-full min-h-[58px] p-3.5 rounded-xl border text-left transition-colors hover:border-amber-500 flex items-center justify-between gap-4 cursor-pointer"
                                style={{
                                  backgroundColor: 'var(--alpha-bg)',
                                  borderColor: 'var(--alpha-border)',
                                }}
                              >
                                <span className="font-serif-book text-base md:text-lg leading-snug">
                                  <strong className="text-amber-500 font-sans-ui mr-2 tabular-nums">
                                    0{idx + 1}.
                                  </strong>
                                  {q}
                                </span>
                                <ChevronRight className="w-5 h-5 text-amber-500 shrink-0" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* ===================================================================
            ONGLET 3 : FEUILLETER MON LIVRE DE VIE & EXPORT LIVRET PDF A4/A5
           =================================================================== */}
        {activeTab === 'livre' && (
          <div className="space-y-12">
            {/* Barre d'outils éditoriale (Masquée à l'impression PDF) */}
            <div
              className="no-print rounded-2xl border p-6 space-y-6"
              style={{
                backgroundColor: 'var(--alpha-card)',
                borderColor: 'var(--alpha-border)',
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-6">
                <div className="space-y-1">
                  <span className="text-xs font-semibold tracking-widest uppercase text-amber-500">
                    Édition Reliée &amp; Imprimable (Format Livret A4 / A5)
                  </span>
                  <h1 className="font-serif-display text-2xl md:text-3xl font-bold">
                    Les Souvenirs de {authorName}
                  </h1>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Bouton pour activer/désactiver les 2 souvenirs d'exemple en un clic */}
                  <button
                    type="button"
                    onClick={() => setShowExamples((prev) => !prev)}
                    className="min-h-[56px] px-4 py-2.5 rounded-xl border font-semibold text-sm flex items-center gap-2 transition-colors cursor-pointer"
                    style={{
                      backgroundColor: 'var(--alpha-bg)',
                      borderColor: 'var(--alpha-border)',
                    }}
                  >
                    <Check
                      className={`w-4 h-4 ${
                        showExamples ? 'text-amber-500' : 'opacity-30'
                      }`}
                    />
                    <span>
                      {showExamples
                        ? 'Masquer les 2 souvenirs d’exemple'
                        : 'Afficher les 2 souvenirs d’exemple'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportMarkdown}
                    className="min-h-[56px] px-4 py-2.5 rounded-xl border font-semibold text-sm flex items-center gap-2 hover:border-amber-500 transition-colors cursor-pointer"
                    style={{ borderColor: 'var(--alpha-border)' }}
                  >
                    <FileText className="w-5 h-5 text-amber-500" />
                    <span>Exporter le Manuscrit (.md)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="min-h-[56px] px-6 py-3 rounded-xl font-bold text-base bg-amber-500 text-stone-950 hover:bg-amber-400 transition-colors flex items-center gap-2.5 cursor-pointer shadow-md"
                  >
                    <Printer className="w-5 h-5" />
                    <span>Imprimer / Exporter le Livret PDF</span>
                  </button>
                </div>
              </div>

              {/* Barre de filtrage par Chapitre, Tri Chronologique et Recherche */}
              <div
                className="pt-5 border-t flex flex-wrap items-center justify-between gap-4"
                style={{ borderColor: 'var(--alpha-border)' }}
              >
                {/* Filtres par chapitre (Contrôles interactifs) */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBookChapterFilter('all')}
                    className={`min-h-[48px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      bookChapterFilter === 'all'
                        ? 'bg-amber-500 text-stone-950'
                        : 'border opacity-80 hover:opacity-100'
                    }`}
                    style={
                      bookChapterFilter === 'all'
                        ? undefined
                        : { borderColor: 'var(--alpha-border)' }
                    }
                  >
                    Tous les chapitres ({allDisplayedMemories.length})
                  </button>
                  {CHAPTERS.map((chap) => (
                    <button
                      key={chap.id}
                      type="button"
                      onClick={() => setBookChapterFilter(chap.id)}
                      className={`min-h-[48px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                        bookChapterFilter === chap.id
                          ? 'bg-amber-500 text-stone-950'
                          : 'border opacity-80 hover:opacity-100'
                      }`}
                      style={
                        bookChapterFilter === chap.id
                          ? undefined
                          : { borderColor: 'var(--alpha-border)' }
                      }
                    >
                      {chap.number}
                    </button>
                  ))}
                </div>

                {/* Tri (Ordre des Chapitres vs Frise Chronologique) & Recherche */}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setBookSortOrder((prev) =>
                        prev === 'chapitres' ? 'chronologique' : 'chapitres'
                      )
                    }
                    className="min-h-[48px] px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 cursor-pointer"
                    style={{
                      backgroundColor: 'var(--alpha-bg)',
                      borderColor: 'var(--alpha-border)',
                    }}
                  >
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span>
                      Tri :{' '}
                      {bookSortOrder === 'chronologique'
                        ? 'Frise Chronologique (Années)'
                        : 'Ordre du Recueil'}
                    </span>
                  </button>

                  <div className="relative">
                    <Search className="w-4 h-4 text-amber-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="search"
                      value={bookSearchQuery}
                      onChange={(e) => setBookSearchQuery(e.target.value)}
                      placeholder="Rechercher un lieu, une année..."
                      className="min-h-[48px] pl-10 pr-4 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      style={{
                        backgroundColor: 'var(--alpha-bg)',
                        borderColor: 'var(--alpha-border)',
                        color: 'var(--alpha-text)',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* PAGE DE GARDE DU LIVRE DE VIE (Imprimée en 1ère page A4/A5) */}
            <section
              className="print-book-surface rounded-2xl border p-8 md:p-14 text-center max-w-4xl mx-auto"
              style={{
                backgroundColor: 'var(--alpha-card)',
                borderColor: 'var(--alpha-border)',
              }}
            >
              <div className="max-w-2xl mx-auto space-y-6">
                <p className="text-xs tracking-[0.25em] uppercase text-amber-500 font-semibold">
                  Collection Patrimoine Familial · Éditions MémoVoix
                </p>

                <h2
                  className="font-serif-display text-4xl md:text-5xl font-bold leading-tight"
                  style={{ textWrap: 'balance' }}
                >
                  Les Souvenirs de {authorName}
                </h2>

                <p
                  className="font-serif-book italic text-lg md:text-xl leading-relaxed"
                  style={{ color: 'var(--alpha-muted)' }}
                >
                  {bookSubtitle}
                </p>

                {/* Illustration éditoriale du Livre de Famille avec fallback résilient */}
                <div className="my-8 rounded-xl overflow-hidden border border-amber-500/25 bg-stone-900 max-w-xl mx-auto">
                  <img
                    src={HERO_BOOK_IMAGE}
                    alt="Livre de famille ouvert auprès d’un microphone ancien"
                    referrerPolicy="no-referrer"
                    className="w-full h-56 md:h-64 object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>

                {/* Personnalisation rapide du Prénom sur la page de garde (Masquée à l'impression) */}
                <div className="no-print pt-4 max-w-md mx-auto text-left">
                  <label
                    htmlFor="cover-author-input"
                    className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                    style={{ color: 'var(--alpha-muted)' }}
                  >
                    Personnaliser le nom sur la couverture du livre :
                  </label>
                  <input
                    id="cover-author-input"
                    type="text"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    className="w-full min-h-[56px] px-4 rounded-xl border font-serif-display text-lg font-semibold text-center focus:outline-none focus:ring-2 focus:ring-amber-500"
                    style={{
                      backgroundColor: 'var(--alpha-bg)',
                      borderColor: 'var(--alpha-border)',
                      color: 'var(--alpha-text)',
                    }}
                  />
                </div>
              </div>
            </section>

            {/* PRÉFACE FAMILIALE & DÉDICACE (Imprimée entre la Couverture et la Table des Matières) */}
            <section
              className="print-page-break print-book-surface rounded-2xl border p-8 md:p-12 max-w-4xl mx-auto"
              style={{
                backgroundColor: 'var(--alpha-card)',
                borderColor: 'var(--alpha-border)',
              }}
            >
              <div className="max-w-2xl mx-auto space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4" style={{ borderColor: 'var(--alpha-border)' }}>
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-widest text-amber-500">
                      Avant-Propos &amp; Transmission
                    </span>
                    <h3 className="font-serif-display text-2xl md:text-3xl font-bold mt-1">
                      Préface Familiale
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={handleGeneratePreface}
                    disabled={isGeneratingPreface}
                    className="no-print min-h-[48px] px-4 py-2 rounded-xl border border-amber-500/40 text-xs font-semibold text-amber-500 hover:bg-amber-500/10 flex items-center gap-2 cursor-pointer"
                  >
                    <Feather className="w-4 h-4" />
                    <span>
                      {isGeneratingPreface
                        ? 'Rédaction en cours...'
                        : 'Sublimer la préface avec le Biographe'}
                    </span>
                  </button>
                </div>

                {/* Version imprimée de la préface */}
                <div className="font-serif-book italic text-lg md:text-xl leading-relaxed space-y-4">
                  {bookPreface
                    .split(/\n\s*\n/)
                    .filter(Boolean)
                    .map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                </div>

                <p className="font-serif-display text-right text-lg font-bold text-amber-500 pt-2">
                  — {authorName}
                </p>

                {/* Éditeur rapide de la préface (Masqué à l'impression) */}
                <div className="no-print pt-4 border-t" style={{ borderColor: 'var(--alpha-border)' }}>
                  <label
                    htmlFor="preface-editor"
                    className="block text-xs font-semibold mb-1.5"
                    style={{ color: 'var(--alpha-muted)' }}
                  >
                    Personnaliser librement les mots de votre préface :
                  </label>
                  <textarea
                    id="preface-editor"
                    rows={3}
                    value={bookPreface}
                    onChange={(e) => setBookPreface(e.target.value)}
                    className="w-full p-3.5 rounded-xl border font-serif-book text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-500"
                    style={{
                      backgroundColor: 'var(--alpha-bg)',
                      borderColor: 'var(--alpha-border)',
                      color: 'var(--alpha-text)',
                    }}
                  />
                </div>
              </div>
            </section>

            {/* TABLE DES MATIÈRES DU LIVRE DE VIE */}
            <section
              className="print-page-break print-book-surface rounded-2xl border p-8 md:p-12 max-w-4xl mx-auto"
              style={{
                backgroundColor: 'var(--alpha-card)',
                borderColor: 'var(--alpha-border)',
              }}
            >
              <div
                className="border-b pb-4 mb-6 flex items-baseline justify-between"
                style={{ borderColor: 'var(--alpha-border)' }}
              >
                <h3 className="font-serif-display text-2xl md:text-3xl font-bold">
                  Table des Matières
                </h3>
                <span
                  className="text-sm font-serif-book italic"
                  style={{ color: 'var(--alpha-muted)' }}
                >
                  {filteredAndSortedMemories.length} récit(s) réunis
                </span>
              </div>

              {filteredAndSortedMemories.length === 0 ? (
                <div className="text-center py-12 space-y-4">
                  <p className="font-serif-book text-xl">
                    Aucun souvenir ne correspond à ce filtre.
                  </p>
                  <div className="flex justify-center gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setBookChapterFilter('all');
                        setBookSearchQuery('');
                        setShowExamples(true);
                      }}
                      className="min-h-[56px] px-5 py-2.5 rounded-xl border font-semibold text-sm cursor-pointer"
                      style={{ borderColor: 'var(--alpha-border)' }}
                    >
                      Afficher tous les souvenirs
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('studio')}
                      className="min-h-[56px] px-5 py-2.5 rounded-xl bg-amber-500 text-stone-950 font-bold text-sm cursor-pointer"
                    >
                      Aller au Studio Vocal
                    </button>
                  </div>
                </div>
              ) : (
                <ol className="space-y-4">
                  {filteredAndSortedMemories.map((mem, index) => (
                    <li
                      key={mem.id}
                      className="flex items-baseline justify-between gap-4 border-b border-dashed pb-3"
                      style={{ borderColor: 'var(--alpha-border)' }}
                    >
                      <div className="flex items-baseline gap-3">
                        <span className="font-mono text-sm text-amber-500 tabular-nums">
                          0{index + 1}.
                        </span>
                        <div>
                          <a
                            href={`#${mem.id}`}
                            className="font-serif-display text-lg md:text-xl font-bold hover:text-amber-500 transition-colors"
                          >
                            {mem.title}
                          </a>
                          <p
                            className="text-xs mt-0.5"
                            style={{ color: 'var(--alpha-muted)' }}
                          >
                            {mem.chapterNumber} — {mem.chapterTitle}
                            {mem.epochYear ? ` · Époque : ${mem.epochYear}` : ''}
                            {mem.location ? ` · ${mem.location}` : ''}
                            {` · ${mem.date}`}
                          </p>
                        </div>
                      </div>
                      <span
                        className="font-serif-book text-sm tabular-nums shrink-0"
                        style={{ color: 'var(--alpha-muted)' }}
                      >
                        Page {index + 1}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {/* PAGES OUVERTES DES SOUVENIRS (Lettrine dorée, Polaroïd ancien, Exergue & Édition directe) */}
            <div className="space-y-12 max-w-5xl mx-auto">
              {filteredAndSortedMemories.map((mem, idx) => {
                const isEditing = editingMemoryId === mem.id;
                const paragraphs = mem.embellishedText
                  .split(/\n\s*\n/)
                  .filter(Boolean);

                return (
                  <article
                    id={mem.id}
                    key={mem.id}
                    className="print-page-break print-avoid-break print-book-surface rounded-2xl border p-8 md:p-14 transition-colors"
                    style={{
                      backgroundColor: 'var(--alpha-card)',
                      borderColor: 'var(--alpha-border)',
                    }}
                  >
                    {/* En-tête éditorial du chapitre (Zero-Pill : texte séparé par ·) */}
                    <div
                      className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-8 border-b text-xs uppercase tracking-widest"
                      style={{
                        borderColor: 'var(--alpha-border)',
                        color: 'var(--alpha-muted)',
                      }}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-amber-500 font-bold">
                          {mem.chapterNumber}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{mem.chapterTitle}</span>
                        {mem.epochYear && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 text-amber-400 font-semibold">
                              <Calendar className="w-3.5 h-3.5" />
                              {mem.epochYear}
                            </span>
                          </>
                        )}
                        {mem.location && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-amber-500" />
                              {mem.location}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="tabular-nums">
                        <span>Recueilli le {mem.date}</span>
                        <span aria-hidden="true"> · </span>
                        <span>Récit N° {idx + 1}</span>
                        {mem.isExample && (
                          <>
                            <span aria-hidden="true"> · </span>
                            <span className="text-amber-500">
                              Souvenir d’Exemple
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Mode Édition Directe dans le Livre */}
                    {isEditing && editMemoryDraft ? (
                      <div className="no-print space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="md:col-span-1">
                            <label className="block text-xs font-semibold mb-1">
                              Titre poétique :
                            </label>
                            <input
                              type="text"
                              value={editMemoryDraft.title || ''}
                              onChange={(e) =>
                                setEditMemoryDraft({
                                  ...editMemoryDraft,
                                  title: e.target.value,
                                })
                              }
                              className="w-full min-h-[52px] px-3.5 rounded-xl border font-serif-display text-lg font-bold"
                              style={{
                                backgroundColor: 'var(--alpha-bg)',
                                borderColor: 'var(--alpha-border)',
                                color: 'var(--alpha-text)',
                              }}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold mb-1">
                              Année / Époque :
                            </label>
                            <input
                              type="text"
                              value={editMemoryDraft.epochYear || ''}
                              onChange={(e) =>
                                setEditMemoryDraft({
                                  ...editMemoryDraft,
                                  epochYear: e.target.value,
                                })
                              }
                              className="w-full min-h-[52px] px-3.5 rounded-xl border text-sm"
                              style={{
                                backgroundColor: 'var(--alpha-bg)',
                                borderColor: 'var(--alpha-border)',
                                color: 'var(--alpha-text)',
                              }}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold mb-1">
                              Lieu du souvenir :
                            </label>
                            <input
                              type="text"
                              value={editMemoryDraft.location || ''}
                              onChange={(e) =>
                                setEditMemoryDraft({
                                  ...editMemoryDraft,
                                  location: e.target.value,
                                })
                              }
                              className="w-full min-h-[52px] px-3.5 rounded-xl border text-sm"
                              style={{
                                backgroundColor: 'var(--alpha-bg)',
                                borderColor: 'var(--alpha-border)',
                                color: 'var(--alpha-text)',
                              }}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold mb-1">
                            Récit littéraire (séparez les paragraphes par une
                            ligne vide) :
                          </label>
                          <textarea
                            rows={7}
                            value={editMemoryDraft.embellishedText || ''}
                            onChange={(e) =>
                              setEditMemoryDraft({
                                ...editMemoryDraft,
                                embellishedText: e.target.value,
                              })
                            }
                            className="w-full p-4 rounded-xl border font-serif-book text-lg leading-relaxed"
                            style={{
                              backgroundColor: 'var(--alpha-bg)',
                              borderColor: 'var(--alpha-border)',
                              color: 'var(--alpha-text)',
                            }}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold mb-1">
                              Phrase mise en exergue :
                            </label>
                            <input
                              type="text"
                              value={editMemoryDraft.pullQuote || ''}
                              onChange={(e) =>
                                setEditMemoryDraft({
                                  ...editMemoryDraft,
                                  pullQuote: e.target.value,
                                })
                              }
                              className="w-full min-h-[52px] px-3.5 rounded-xl border font-serif-book italic text-sm"
                              style={{
                                backgroundColor: 'var(--alpha-bg)',
                                borderColor: 'var(--alpha-border)',
                                color: 'var(--alpha-text)',
                              }}
                            />
                          </div>
                          {mem.photoBase64 && (
                            <div>
                              <label className="block text-xs font-semibold mb-1">
                                Légende de la photographie :
                              </label>
                              <input
                                type="text"
                                value={editMemoryDraft.photoCaption || ''}
                                onChange={(e) =>
                                  setEditMemoryDraft({
                                    ...editMemoryDraft,
                                    photoCaption: e.target.value,
                                  })
                                }
                                className="w-full min-h-[52px] px-3.5 rounded-xl border font-serif-book italic text-sm"
                                style={{
                                  backgroundColor: 'var(--alpha-bg)',
                                  borderColor: 'var(--alpha-border)',
                                  color: 'var(--alpha-text)',
                                }}
                              />
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMemoryId(null);
                              setEditMemoryDraft(null);
                            }}
                            className="min-h-[52px] px-5 py-2.5 rounded-xl border font-semibold text-sm cursor-pointer"
                            style={{ borderColor: 'var(--alpha-border)' }}
                          >
                            Annuler
                          </button>
                          <button
                            type="button"
                            onClick={() => saveEditedMemory(mem)}
                            className="min-h-[52px] px-6 py-2.5 rounded-xl bg-amber-500 text-stone-950 font-bold text-sm cursor-pointer"
                          >
                            Enregistrer les modifications
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Mise en page Livre Ouvert (2 colonnes sur grand écran si photo présente) */
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                        <div
                          className={
                            mem.photoBase64
                              ? 'lg:col-span-7'
                              : 'lg:col-span-12 max-w-3xl mx-auto'
                          }
                        >
                          <h3
                            className="font-serif-display text-3xl md:text-4xl font-bold leading-tight mb-3"
                            style={{ textWrap: 'balance' }}
                          >
                            {mem.title}
                          </h3>

                          <p
                            className="font-serif-book italic text-sm md:text-base mb-8"
                            style={{ color: 'var(--alpha-muted)' }}
                          >
                            En réponse à : « {mem.question} »
                          </p>

                          {/* Paragraphes littéraires avec Lettrine Dorée sur le premier paragraphe */}
                          <div className="space-y-5 font-serif-book text-lg md:text-[20px] leading-[1.85]">
                            {paragraphs.map((para, pIdx) => (
                              <p
                                key={pIdx}
                                className={
                                  pIdx === 0 ? 'editorial-dropcap' : undefined
                                }
                              >
                                {para}
                              </p>
                            ))}
                          </div>

                          {/* Citation en exergue (Pull Quote) avec filets fins haut/bas */}
                          {mem.pullQuote && (
                            <blockquote
                              className="my-8 py-5 border-t border-b font-serif-display italic text-xl md:text-2xl text-center leading-relaxed"
                              style={{
                                borderColor: 'var(--alpha-border)',
                                color: 'var(--alpha-accent)',
                              }}
                            >
                              {mem.pullQuote}
                            </blockquote>
                          )}

                          {/* Lecteur audio s'il y a un extrait vocal enregistré + Actions (Masqués à l'impression) */}
                          <div
                            className="no-print mt-8 pt-4 border-t flex flex-wrap items-center justify-between gap-4"
                            style={{ borderColor: 'var(--alpha-border)' }}
                          >
                            <div className="flex flex-wrap items-center gap-3">
                              <button
                                type="button"
                                onClick={() =>
                                  speakQuestion(mem.embellishedText)
                                }
                                className="min-h-[52px] px-4 py-2 rounded-xl border font-semibold text-sm flex items-center gap-2 cursor-pointer"
                                style={{
                                  backgroundColor: 'var(--alpha-bg)',
                                  borderColor: 'var(--alpha-border)',
                                }}
                              >
                                <Volume2 className="w-4 h-4 text-amber-500" />
                                <span>Écouter ce récit à voix haute</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => startEditingMemory(mem)}
                                className="min-h-[52px] px-4 py-2 rounded-xl border font-semibold text-sm flex items-center gap-2 hover:border-amber-500 cursor-pointer"
                                style={{
                                  backgroundColor: 'var(--alpha-bg)',
                                  borderColor: 'var(--alpha-border)',
                                }}
                              >
                                <Edit3 className="w-4 h-4 text-amber-500" />
                                <span>Modifier ce récit</span>
                              </button>

                              {mem.audioDataUrl && (
                                <audio
                                  controls
                                  src={mem.audioDataUrl}
                                  className="h-11 max-w-[220px]"
                                />
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteMemory(mem.id)}
                              className="min-h-[52px] px-4 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 flex items-center gap-1.5 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>
                                {mem.isExample
                                  ? 'Masquer les exemples'
                                  : 'Retirer ce récit'}
                              </span>
                            </button>
                          </div>
                        </div>

                        {/* Photo encadrée façon Polaroïd ancien */}
                        {mem.photoBase64 && (
                          <div className="lg:col-span-5 flex flex-col items-center">
                            <figure className="polaroid-frame w-full max-w-sm transition-transform hover:rotate-0 rotate-1">
                              <div className="w-full h-64 bg-stone-200 overflow-hidden rounded-xs flex items-center justify-center">
                                <img
                                  src={mem.photoBase64}
                                  alt={mem.photoCaption || mem.title}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              </div>
                              <figcaption className="mt-3 text-center font-serif-book italic text-sm text-stone-700">
                                Fig. {idx + 1} —{' '}
                                {mem.photoCaption || 'Archives familiales'}
                              </figcaption>
                            </figure>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* ===================================================================
            ONGLET 4 : ESPACE FAMILLE, QUESTIONS DES PROCHES & SAUVEGARDE JSON
           =================================================================== */}
        {activeTab === 'famille' && (
          <div className="no-print space-y-10 max-w-5xl mx-auto">
            <div>
              <span className="text-xs font-semibold tracking-widest uppercase text-amber-500">
                Transmission Intergénérationnelle &amp; Souveraineté des Données
              </span>
              <h1 className="font-serif-display text-3xl md:text-4xl font-bold mt-2">
                Espace Famille &amp; Réglages du Livre
              </h1>
              <p
                className="text-base mt-2 leading-relaxed"
                style={{ color: 'var(--alpha-muted)' }}
              >
                Préparez des questions personnalisées pour vos parents ou
                grands-parents, configurez la couverture du livret et gérez
                votre coffre-fort local IndexedDB.
              </p>
            </div>

            {/* Bandeau Bilan Patrimonial du Livre de Vie */}
            <section
              className="rounded-2xl border p-6 grid grid-cols-1 sm:grid-cols-3 gap-6"
              style={{
                backgroundColor: 'var(--alpha-card)',
                borderColor: 'var(--alpha-border)',
              }}
            >
              <div>
                <span
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--alpha-muted)' }}
                >
                  Patrimoine Littéraire
                </span>
                <p className="font-serif-display text-3xl font-bold text-amber-500 mt-1 tabular-nums">
                  {archiveStats.totalWords} mots
                </p>
                <p
                  className="text-xs mt-1"
                  style={{ color: 'var(--alpha-muted)' }}
                >
                  Répartis dans {allDisplayedMemories.length} récits mis en page
                </p>
              </div>

              <div>
                <span
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--alpha-muted)' }}
                >
                  Mémoire Orale Cumulée
                </span>
                <p className="font-serif-display text-3xl font-bold text-amber-500 mt-1 tabular-nums">
                  ~{archiveStats.totalMinutes} min
                </p>
                <p
                  className="text-xs mt-1"
                  style={{ color: 'var(--alpha-muted)' }}
                >
                  De témoignages vocaux transmis à la famille
                </p>
              </div>

              <div>
                <span
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--alpha-muted)' }}
                >
                  Coffre-fort Souverain
                </span>
                <p className="font-serif-display text-2xl font-bold mt-1">
                  IndexedDB + LocalStorage
                </p>
                <p
                  className="text-xs mt-1"
                  style={{ color: 'var(--alpha-muted)' }}
                >
                  100% Zero-Knowledge · Aucune donnée stockée sur le cloud
                </p>
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Carte 1 : Ajouter une question personnalisée dans la pile */}
              <section
                className="rounded-2xl border p-6 md:p-8 space-y-5"
                style={{
                  backgroundColor: 'var(--alpha-card)',
                  borderColor: 'var(--alpha-border)',
                }}
              >
                <div className="flex items-center gap-3">
                  <Plus className="w-6 h-6 text-amber-500 shrink-0" />
                  <h2 className="font-serif-display text-2xl font-bold">
                    Poser une question personnalisée
                  </h2>
                </div>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: 'var(--alpha-muted)' }}
                >
                  En tant qu’enfant ou petit-enfant, ajoutez une question sur un
                  lieu, un prénom ou une anecdote précise que vous aimeriez
                  entendre raconter.
                </p>

                <form onSubmit={handleAddCustomQuestion} className="space-y-4">
                  <div>
                    <label
                      htmlFor="custom-chapter-select"
                      className="block text-sm font-semibold mb-1.5"
                    >
                      Chapitre associé :
                    </label>
                    <select
                      id="custom-chapter-select"
                      value={newCustomChapterId}
                      onChange={(e) => setNewCustomChapterId(e.target.value)}
                      className="w-full min-h-[56px] px-4 rounded-xl border text-base font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                      style={{
                        backgroundColor: 'var(--alpha-bg)',
                        borderColor: 'var(--alpha-border)',
                        color: 'var(--alpha-text)',
                      }}
                    >
                      {CHAPTERS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.number} — {c.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="custom-question-input"
                      className="block text-sm font-semibold mb-1.5"
                    >
                      Votre question pour le conteur :
                    </label>
                    <textarea
                      id="custom-question-input"
                      rows={3}
                      value={newCustomQuestion}
                      onChange={(e) => setNewCustomQuestion(e.target.value)}
                      placeholder="Ex: Peux-tu nous raconter comment vous aviez construit la cabane au fond du jardin de Saint-Malo en 1968 ?"
                      className="w-full p-4 rounded-xl border font-serif-book text-base focus:outline-none focus:ring-2 focus:ring-amber-500"
                      style={{
                        backgroundColor: 'var(--alpha-bg)',
                        borderColor: 'var(--alpha-border)',
                        color: 'var(--alpha-text)',
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full min-h-[58px] px-6 py-3 rounded-xl bg-amber-500 text-stone-950 font-bold text-base hover:bg-amber-400 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Ajouter cette question dans la pile</span>
                  </button>
                </form>
              </section>

              {/* Carte 2 : Couverture du Livre & Mode de Sublimation Éditoriale */}
              <section
                className="rounded-2xl border p-6 md:p-8 space-y-6"
                style={{
                  backgroundColor: 'var(--alpha-card)',
                  borderColor: 'var(--alpha-border)',
                }}
              >
                <div className="flex items-center gap-3">
                  <Settings className="w-6 h-6 text-amber-500 shrink-0" />
                  <h2 className="font-serif-display text-2xl font-bold">
                    Édition &amp; Moteur de Biographie
                  </h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="family-author-name"
                      className="block text-sm font-semibold mb-1.5"
                    >
                      Titre de la page de garde (« Les Souvenirs de... ») :
                    </label>
                    <input
                      id="family-author-name"
                      type="text"
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                      className="w-full min-h-[56px] px-4 rounded-xl border text-base font-semibold"
                      style={{
                        backgroundColor: 'var(--alpha-bg)',
                        borderColor: 'var(--alpha-border)',
                        color: 'var(--alpha-text)',
                      }}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="family-book-subtitle"
                      className="block text-sm font-semibold mb-1.5"
                    >
                      Dédicace / Sous-titre du Livre de Vie :
                    </label>
                    <input
                      id="family-book-subtitle"
                      type="text"
                      value={bookSubtitle}
                      onChange={(e) => setBookSubtitle(e.target.value)}
                      className="w-full min-h-[56px] px-4 rounded-xl border text-base"
                      style={{
                        backgroundColor: 'var(--alpha-bg)',
                        borderColor: 'var(--alpha-border)',
                        color: 'var(--alpha-text)',
                      }}
                    />
                  </div>

                  {/* Choix entre Biographe IA Gemini (Serveur) et Mode 100% Local Hors-Ligne */}
                  <div
                    className="p-4 rounded-xl border space-y-3"
                    style={{
                      backgroundColor: 'var(--alpha-bg)',
                      borderColor: 'var(--alpha-border)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-base">
                          Mode de Sublimation Littéraire
                        </h3>
                        <p
                          className="text-xs mt-0.5"
                          style={{ color: 'var(--alpha-muted)' }}
                        >
                          {preferLocalAI
                            ? 'Mode 100% Local autonome actif (Ponctuation et paragraphes hors-ligne)'
                            : 'Biographe IA Gemini actif avec bascule locale automatique hors-ligne'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setPreferLocalAI((prev) => !prev)}
                        className="min-h-[52px] px-4 py-2 rounded-xl border border-amber-500/40 font-semibold text-xs whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {preferLocalAI
                          ? 'Activer Biographe IA Gemini'
                          : 'Forcer Mode 100% Local'}
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Carte 3 : Sauvegarde Souveraine (.json & .md) Export / Import */}
            <section
              className="rounded-2xl border p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
              style={{
                backgroundColor: 'var(--alpha-card)',
                borderColor: 'var(--alpha-border)',
              }}
            >
              <div className="space-y-1 max-w-xl">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-5 h-5 text-amber-500" />
                  <h2 className="font-serif-display text-2xl font-bold">
                    Sauvegarde Souveraine (.json &amp; .md)
                  </h2>
                </div>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: 'var(--alpha-muted)' }}
                >
                  Tous les récits, photographies et enregistrements vocaux sont
                  archivés dans IndexedDB sur votre appareil. Exportez une
                  sauvegarde complète pour la conserver sur clé USB ou la
                  transmettre à vos proches.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="min-h-[58px] px-5 py-3 rounded-xl bg-amber-500 text-stone-950 font-bold text-base hover:bg-amber-400 transition-colors flex items-center gap-2.5 cursor-pointer"
                >
                  <Download className="w-5 h-5" />
                  <span>Exporter la sauvegarde (.json)</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportMarkdown}
                  className="min-h-[58px] px-5 py-3 rounded-xl border font-semibold text-base hover:border-amber-500 transition-colors flex items-center gap-2.5 cursor-pointer"
                  style={{ borderColor: 'var(--alpha-border)' }}
                >
                  <FileText className="w-5 h-5 text-amber-500" />
                  <span>Manuscrit (.md)</span>
                </button>

                <label
                  className="min-h-[58px] px-5 py-3 rounded-xl border font-semibold text-base hover:border-amber-500 transition-colors flex items-center gap-2.5 cursor-pointer"
                  style={{ borderColor: 'var(--alpha-border)' }}
                >
                  <Upload className="w-5 h-5 text-amber-500" />
                  <span>Importer une sauvegarde</span>
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={handleImportJSON}
                    className="hidden"
                  />
                </label>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* ===================================================================
          PIED DE PAGE ÉCOSYSTÈME ALPHABETTE (.EU) & BOUTON FLOTTANT AVIS
         =================================================================== */}
      <footer
        className="no-print border-t mt-16 py-8 px-6"
        style={{
          backgroundColor: 'var(--alpha-card)',
          borderColor: 'var(--alpha-border)',
          color: 'var(--alpha-muted)',
        }}
      >
        <div className="max-w-[1360px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="font-serif-display font-bold"
              style={{ color: 'var(--alpha-text)' }}
            >
              MémoVoix
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Écosystème Alphabette — Architecture Zero-Knowledge &amp; 100%
              Locale
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                setFeedbackSubmitted(false);
                setFeedbackOpen(true);
              }}
              className="min-h-[48px] px-4 py-2 rounded-xl border font-semibold text-xs flex items-center gap-2 hover:border-amber-500 transition-colors cursor-pointer"
              style={{
                borderColor: 'var(--alpha-border)',
                color: 'var(--alpha-text)',
              }}
            >
              <HelpCircle className="w-4 h-4 text-amber-500" />
              <span>Avis &amp; Idées (.eu)</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Bouton Flottant Discret "Avis & Idées (.eu)" */}
      <div className="no-print fixed bottom-5 right-5 z-40">
        <button
          type="button"
          onClick={() => {
            setFeedbackSubmitted(false);
            setFeedbackOpen(true);
          }}
          className="min-h-[56px] px-4 py-3 rounded-2xl border shadow-lg font-semibold text-sm flex items-center gap-2.5 transition-transform hover:scale-105 cursor-pointer"
          style={{
            backgroundColor: 'var(--alpha-card)',
            borderColor: 'var(--alpha-accent)',
            color: 'var(--alpha-text)',
          }}
        >
          <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
          <span>Avis &amp; Idées (.eu)</span>
        </button>
      </div>

      {/* Micro-Modale "Avis & Idées (.eu)" avec notation 1 à 5 étoiles & dictée vocale */}
      {feedbackOpen && (
        <div
          className="no-print fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-modal-title"
        >
          <div
            className="w-full max-w-md rounded-2xl border p-6 md:p-8 space-y-6 shadow-2xl"
            style={{
              backgroundColor: 'var(--alpha-card)',
              borderColor: 'var(--alpha-border)',
              color: 'var(--alpha-text)',
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-widest text-amber-500">
                  Écosystème Alphabette (.eu)
                </span>
                <h2
                  id="feedback-modal-title"
                  className="font-serif-display text-2xl font-bold mt-1"
                >
                  Votre avis sur MémoVoix
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setFeedbackOpen(false)}
                aria-label="Fermer la fenêtre"
                className="min-w-[48px] min-h-[48px] rounded-xl flex items-center justify-center hover:bg-amber-500/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {feedbackSubmitted ? (
              <div className="py-6 text-center space-y-4">
                <p className="font-serif-display text-xl font-bold text-amber-500">
                  Merci infiniment pour votre témoignage !
                </p>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: 'var(--alpha-muted)' }}
                >
                  Votre note ({feedbackRating}/5 étoiles) et votre suggestion
                  ont été enregistrées localement dans le journal d’amélioration
                  Alphabette (.eu).
                </p>
                <button
                  type="button"
                  onClick={() => setFeedbackOpen(false)}
                  className="w-full min-h-[56px] rounded-xl bg-amber-500 text-stone-950 font-bold text-base cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Notation de 1 à 5 étoiles (Cibles >= 56x56px) */}
                <div>
                  <p className="text-sm font-semibold mb-2">
                    Notez votre expérience (1 à 5 étoiles) :
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFeedbackRating(star)}
                        aria-label={`${star} étoile(s)`}
                        className="min-w-[56px] min-h-[56px] rounded-xl border flex items-center justify-center transition-colors cursor-pointer"
                        style={{
                          backgroundColor:
                            star <= feedbackRating
                              ? 'rgba(245, 158, 11, 0.16)'
                              : 'var(--alpha-bg)',
                          borderColor:
                            star <= feedbackRating
                              ? 'var(--alpha-accent)'
                              : 'var(--alpha-border)',
                        }}
                      >
                        <Star
                          className={`w-7 h-7 ${
                            star <= feedbackRating
                              ? 'text-amber-500 fill-amber-500'
                              : 'opacity-40'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dictée ou écriture d'une suggestion */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label
                      htmlFor="feedback-textarea"
                      className="text-sm font-semibold"
                    >
                      Votre idée ou suggestion :
                    </label>
                    <button
                      type="button"
                      onClick={handleDictateFeedback}
                      className="min-h-[44px] px-3 py-1.5 rounded-lg border border-amber-500/40 text-xs font-semibold text-amber-500 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Mic className="w-4 h-4" />
                      <span>
                        {isDictatingFeedback
                          ? 'Écoute en cours...'
                          : 'Dicter à la voix'}
                      </span>
                    </button>
                  </div>
                  <textarea
                    id="feedback-textarea"
                    rows={3}
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    placeholder="Partagez une idée de chapitre ou d’amélioration..."
                    className="w-full p-3.5 rounded-xl border text-base focus:outline-none focus:ring-2 focus:ring-amber-500"
                    style={{
                      backgroundColor: 'var(--alpha-bg)',
                      borderColor: 'var(--alpha-border)',
                      color: 'var(--alpha-text)',
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const existing = JSON.parse(
                      localStorage.getItem('alphabette_eu_feedback') || '[]'
                    );
                    existing.push({
                      rating: feedbackRating,
                      comment: feedbackComment,
                      date: new Date().toISOString(),
                    });
                    localStorage.setItem(
                      'alphabette_eu_feedback',
                      JSON.stringify(existing)
                    );
                    setFeedbackSubmitted(true);
                  }}
                  className="w-full min-h-[56px] rounded-xl bg-amber-500 text-stone-950 font-bold text-base hover:bg-amber-400 transition-colors cursor-pointer"
                >
                  Envoyer mon avis
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modale d'aide à l'installation sur iOS Safari */}
      {showIOSGuide && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div
            className="w-full max-w-sm rounded-2xl border p-6 space-y-4"
            style={{
              backgroundColor: 'var(--alpha-card)',
              borderColor: 'var(--alpha-border)',
            }}
          >
            <h3 className="font-serif-display text-xl font-bold">
              Installer MémoVoix sur iPad / iPhone
            </h3>
            <p
              className="text-sm leading-relaxed"
              style={{ color: 'var(--alpha-muted)' }}
            >
              1. Touchez le bouton <strong>Partager</strong> dans la barre de
              Safari.
              <br />
              2. Faites défiler et choisissez{' '}
              <strong>Sur l’écran d’accueil</strong>.
            </p>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full min-h-[56px] rounded-xl bg-amber-500 text-stone-950 font-bold text-base cursor-pointer"
            >
              Compris
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
