import React, { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc,
  deleteDoc,
  getDocs,
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { UserProfile, Scenario, Session, Scores, Evaluation } from './types';
import { evaluateResponse, generateScenarios } from './lib/ai';
import { 
  Layout, 
  Mail, 
  User as UserIcon, 
  BarChart3, 
  BookOpen, 
  ChevronRight, 
  Send, 
  CheckCircle2, 
  AlertCircle,
  LogOut,
  ShieldCheck,
  Award,
  Clock,
  ArrowLeft,
  Loader2,
  TrendingUp,
  BrainCircuit,
  MessageSquare,
  Search,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';

// --- Components ---

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, icon: Icon }: any) => {
  const variants = {
    primary: 'bg-[#00529B] text-white hover:bg-[#003D74]',
    secondary: 'bg-white text-[#00529B] border border-[#00529B] hover:bg-gray-50',
    ghost: 'text-gray-600 hover:bg-gray-100',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100'
  };
  
  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant as keyof typeof variants]} ${className}`}
    >
      {Icon && <Icon size={18} />}
      {children}
    </button>
  );
};

const Card = ({ children, className = '', id }: any) => (
  <div id={id} className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${className}`}>
    {children}
  </div>
);

const Badge = ({ children, variant = 'neutral' }: any) => {
  const variants = {
    neutral: 'bg-gray-100 text-gray-600',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-amber-100 text-amber-700',
    info: 'bg-blue-100 text-blue-700',
    error: 'bg-red-100 text-red-700'
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${variants[variant as keyof typeof variants]}`}>
      {children}
    </span>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'simulator' | 'admin' | 'session-result'>('dashboard');
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [userSessions, setUserSessions] = useState<Session[]>([]);
  const [response, setResponse] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [allSessions, setAllSessions] = useState<Session[]>([]); // For Admin
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]); // For Admin
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [fbStatus, setFbStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    // Basic check for Firebase config
    const config = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    };
    
    if (!config.apiKey || !config.projectId) {
      setFbStatus('error');
    } else {
      setFbStatus('connected');
    }
  }, []);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification(null);
    setTimeout(() => {
      setNotification({ message, type });
    }, 10);
    setTimeout(() => setNotification(null), 5000);
  };

  useEffect(() => {
    setNotification(null);
  }, [view]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const docRef = doc(db, 'users', u.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const existingProfile = docSnap.data() as UserProfile;
          const isAdminEmail = u.email === '3303451ai@gmail.com';
          
          // Force upgrade to admin if email matches but role is not admin
          if (isAdminEmail && existingProfile.role !== 'admin') {
            const updatedProfile = { ...existingProfile, role: 'admin' as const };
            await updateDoc(docRef, { role: 'admin' });
            setProfile(updatedProfile);
          } else {
            setProfile(existingProfile);
          }
        } else {
          const isAdminEmail = u.email === '3303451ai@gmail.com';
          const newProfile: UserProfile = {
            uid: u.uid,
            email: u.email || '',
            role: isAdminEmail ? 'admin' : 'cso',
            displayName: u.displayName || 'Officer',
            createdAt: new Date().toISOString()
          };
          await setDoc(docRef, newProfile);
          setProfile(newProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    // Fetch scenarios
    const qScenarios = query(collection(db, 'scenarios'), orderBy('difficulty', 'asc'));
    const unsubScenarios = onSnapshot(qScenarios, (snap) => {
      if (snap.empty) {
        if (!isRefreshing) {
          generateInitialScenarios();
        }
      } else {
        const newScenarios = snap.docs.map(d => d.data() as Scenario);
        setScenarios(newScenarios);
        
        // Update selectedScenario if it's already set to ensure it has the latest content
        setSelectedScenario(prev => {
          if (!prev) return null;
          const updated = newScenarios.find(s => s.id === prev.id);
          return updated || prev;
        });
      }
    });

    // Fetch user sessions
    const qSessions = query(
      collection(db, 'sessions'), 
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubSessions = onSnapshot(qSessions, (snap) => {
      setUserSessions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Session)));
    });

    // Fetch all sessions and profiles for admin
    let unsubAll = () => {};
    let unsubProfiles = () => {};
    if (profile?.role === 'admin') {
      const qAll = query(collection(db, 'sessions'), orderBy('createdAt', 'desc'));
      unsubAll = onSnapshot(qAll, (snap) => {
        setAllSessions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Session)));
      });

      const qProfiles = query(collection(db, 'users'));
      unsubProfiles = onSnapshot(qProfiles, (snap) => {
        setAllProfiles(snap.docs.map(d => d.data() as UserProfile));
      });
    }

    return () => {
      unsubScenarios();
      unsubSessions();
      unsubAll();
      unsubProfiles();
    };
  }, [user, profile]);

  const generateInitialScenarios = async () => {
    setIsRefreshing(true);
    try {
      const generated = await generateScenarios();
      for (const s of generated) {
        await setDoc(doc(db, 'scenarios', s.id), s);
      }
    } catch (err) {
      console.error('Initial generation failed', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const refreshScenariosData = async () => {
    if (profile?.role !== 'admin') return;
    setIsRefreshing(true);
    try {
      console.log('Starting scenario regeneration...');
      
      // 1. Generate new ones BEFORE deleting old ones to be safe
      const generated = await generateScenarios();
      
      if (generated.length === 0) {
        showNotification('AI failed to generate scenarios. Please try again in a few moments.', 'error');
        return;
      }

      // 2. Delete all existing scenarios
      const q = query(collection(db, 'scenarios'));
      const snap = await getDocs(q);
      const deletePromises = snap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);

      // 3. Save new ones
      for (const s of generated) {
        await setDoc(doc(db, 'scenarios', s.id), s);
      }
      
      console.log(`Successfully regenerated ${generated.length} scenarios.`);
      showNotification(`Scenarios refreshed successfully! ${generated.length} new scenarios are now available.`);
    } catch (err) {
      console.error('Refresh failed', err);
      showNotification('Failed to refresh scenarios. Please check your internet connection and try again.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (selectedScenario) {
      console.log('Selected Scenario Updated:', selectedScenario);
    }
  }, [selectedScenario]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error('Login failed', err);
    }
  };

  const handleLogout = () => signOut(auth);

  const startScenario = async (scenario: Scenario) => {
    if (!user) return;
    console.log('Starting scenario:', scenario);
    setSelectedScenario(scenario);
    setResponse('');
    setView('simulator');
    
    try {
      const sessionData = {
        userId: user.uid,
        scenarioId: scenario.id,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      const docRef = await addDoc(collection(db, 'sessions'), sessionData);
      setCurrentSession({ id: docRef.id, ...sessionData } as Session);
    } catch (err) {
      console.error('Failed to create session:', err);
      showNotification('Failed to start practice session. Please try again.', 'error');
    }
  };

  const handleSubmitResponse = async () => {
    if (!selectedScenario || !currentSession || !response.trim()) return;
    
    setEvaluating(true);
    try {
      const { evaluation, scores } = await evaluateResponse(selectedScenario, response);
      
      const updatedSession = {
        ...currentSession,
        response,
        evaluation,
        scores,
        status: 'completed' as const
      };
      
      await updateDoc(doc(db, 'sessions', currentSession.id), updatedSession);
      setCurrentSession(updatedSession);
      setView('session-result');
    } catch (err) {
      console.error('Evaluation failed', err);
    } finally {
      setEvaluating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-[#00529B]" size={48} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-gray-100 text-center"
        >
          <div className="w-20 h-20 bg-[#00529B]/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="text-[#00529B]" size={40} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">CSC Training Simulator</h1>
          <p className="text-gray-500 mb-8">
            Practice customer service excellence in a safe, AI-powered environment. 
            Login with your CSC credentials to begin.
          </p>
          <Button onClick={handleLogin} className="w-full py-3 text-lg" icon={UserIcon}>
            Sign in with Google
          </Button>
          
          <div className="mt-6 flex items-center justify-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              fbStatus === 'connected' ? 'bg-green-500' : 
              fbStatus === 'error' ? 'bg-red-500' : 'bg-gray-300 animate-pulse'
            }`} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Firebase: {fbStatus === 'connected' ? 'Configured' : fbStatus === 'error' ? 'Missing Config' : 'Checking...'}
            </span>
          </div>

          <p className="mt-4 text-xs text-gray-400">
            For Civil Service College Singapore Staff & Officers
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex">
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg border transition-all duration-500 transform translate-y-0 opacity-100 ${
          notification.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span className="font-medium">{notification.message}</span>
          </div>
        </div>
      )}
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 bg-[#00529B] rounded flex items-center justify-center text-white font-bold text-xs">CSC</div>
            <span className="font-bold text-gray-900">Simulator</span>
          </div>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">Public Service Excellence</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <Button 
            variant={view === 'dashboard' ? 'primary' : 'ghost'} 
            className="w-full justify-start" 
            icon={BarChart3}
            onClick={() => setView('dashboard')}
          >
            Dashboard
          </Button>
          <Button 
            variant={view === 'simulator' ? 'primary' : 'ghost'} 
            className="w-full justify-start" 
            icon={Mail}
            onClick={() => {
              if (selectedScenario) setView('simulator');
              else setView('dashboard');
            }}
          >
            Practice
          </Button>
          {profile?.role === 'admin' && (
            <Button 
              variant={view === 'admin' ? 'primary' : 'ghost'} 
              className="w-full justify-start" 
              icon={ShieldCheck}
              onClick={() => setView('admin')}
            >
              CX Dashboard
            </Button>
          )}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 p-2 mb-4">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
              {user.photoURL ? <img src={user.photoURL} alt="" /> : <UserIcon size={20} className="text-gray-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{profile?.displayName}</p>
              <div className="flex items-center gap-1">
                <p className="text-xs text-gray-500 truncate capitalize">{profile?.role}</p>
                {profile?.role === 'admin' && <ShieldCheck size={10} className="text-[#00529B]" />}
              </div>
            </div>
          </div>
          <Button variant="danger" className="w-full justify-start" icon={LogOut} onClick={handleLogout}>
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        <AnimatePresence mode="wait">
          {view === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-6xl mx-auto"
            >
              <header className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back, {profile?.displayName}</h1>
                <p className="text-gray-500">Track your progress and sharpen your customer service skills.</p>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Award size={24} /></div>
                    <Badge variant="info">Overall Score</Badge>
                  </div>
                  <p className="text-3xl font-bold text-gray-900">
                    {userSessions.length > 0 
                      ? Math.round(userSessions.reduce((acc, s) => acc + (s.scores?.overall || 0), 0) / userSessions.filter(s => s.status === 'completed').length || 0)
                      : 0}%
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Average across {userSessions.filter(s => s.status === 'completed').length} sessions</p>
                </Card>
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-green-50 rounded-lg text-green-600"><CheckCircle2 size={24} /></div>
                    <Badge variant="success">Completed</Badge>
                  </div>
                  <p className="text-3xl font-bold text-gray-900">{userSessions.filter(s => s.status === 'completed').length}</p>
                  <p className="text-sm text-gray-500 mt-1">Scenarios mastered</p>
                </Card>
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-amber-50 rounded-lg text-amber-600"><Clock size={24} /></div>
                    <Badge variant="warning">Last Active</Badge>
                  </div>
                  <p className="text-lg font-bold text-gray-900">
                    {userSessions[0] ? format(new Date(userSessions[0].createdAt), 'MMM d, h:mm a') : 'No sessions yet'}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Keep practicing to build skills</p>
                </Card>
              </div>

              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Available Scenarios</h2>
                  <div className="flex gap-2">
                    <Badge>All Categories</Badge>
                    <Badge>Difficulty: All</Badge>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {scenarios.map((s) => (
                    <Card key={s.id} className="hover:border-[#00529B] transition-colors group">
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <Badge variant={s.difficulty > 2 ? 'warning' : 'info'}>
                            Lvl {s.difficulty} • {s.category}
                          </Badge>
                          {userSessions.some(sess => sess.scenarioId === s.id && sess.status === 'completed') && (
                            <CheckCircle2 className="text-green-500" size={18} />
                          )}
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-[#00529B]">{s.title}</h3>
                        <p className="text-sm text-gray-500 line-clamp-2 mb-6">{s.description}</p>
                        <Button 
                          className="w-full" 
                          variant="secondary" 
                          icon={ChevronRight}
                          onClick={() => startScenario(s)}
                        >
                          Start Practice
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            </motion.div>
          )}

          {view === 'simulator' && selectedScenario && (
            <motion.div 
              key="simulator"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-6xl mx-auto h-[calc(100vh-120px)] flex flex-col"
            >
              <header className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <Button variant="ghost" icon={ArrowLeft} onClick={() => setView('dashboard')}>Back</Button>
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">{selectedScenario.title}</h1>
                    <p className="text-sm text-gray-500">Difficulty Level {selectedScenario.difficulty}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button 
                    variant="secondary" 
                    icon={BookOpen}
                    onClick={() => {
                      if (selectedScenario) {
                        showNotification(`Policy Context: ${selectedScenario.policyContext.substring(0, 100)}...`);
                        console.log('Policy Context:', selectedScenario.policyContext);
                      }
                    }}
                  >
                    View Policies
                  </Button>
                  {profile?.role === 'admin' && (
                    <Button 
                      variant="secondary" 
                      icon={BookOpen}
                      onClick={() => {
                        console.log('Current Scenario Data:', selectedScenario);
                        showNotification('Check console for raw scenario data.');
                      }}
                    >
                      Debug Data
                    </Button>
                  )}
                  <Button 
                    variant="primary" 
                    icon={evaluating ? Loader2 : Send} 
                    disabled={evaluating || !response.trim()}
                    onClick={handleSubmitResponse}
                  >
                    {evaluating ? 'Evaluating...' : 'Submit Response'}
                  </Button>
                </div>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Inquiry & Context */}
                <div className="flex flex-col gap-6">
                  <Card className="p-6 border-l-4 border-l-[#00529B]">
                    <div className="flex items-center gap-2 mb-4 text-gray-400">
                      <Mail size={16} />
                      <span className="text-xs font-bold uppercase tracking-wider">Customer Inquiry</span>
                    </div>
                    <div className="bg-gray-50 p-6 rounded-lg border border-gray-100 italic text-gray-700 whitespace-pre-wrap min-h-[200px] max-h-[500px] overflow-y-auto shadow-inner">
                      <div className="pb-8">
                        {selectedScenario.content || "Warning: This scenario is missing inquiry content. Please use the 'Regenerate Scenarios' button in the CX Dashboard to fix this."}
                      </div>
                    </div>
                    {/* Debug info - hidden by default */}
                    <div className="hidden">
                      Debug: {JSON.stringify(selectedScenario)}
                    </div>
                  </Card>

                  <Card className="p-6 bg-amber-50 border-amber-100">
                    <div className="flex items-center gap-2 mb-4 text-amber-700">
                      <ShieldCheck size={16} />
                      <span className="text-xs font-bold uppercase tracking-wider">Internal Policy Context</span>
                    </div>
                    <div className="text-sm text-amber-900 leading-relaxed max-h-[350px] overflow-y-auto pr-4">
                      <div className="pb-8">
                        {selectedScenario.policyContext || "Warning: This scenario is missing policy context. Please use the 'Regenerate Scenarios' button in the CX Dashboard to fix this."}
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Right: Editor */}
                <div className="flex flex-col h-full">
                  <Card className="flex-1 flex flex-col p-6">
                    <div className="flex items-center gap-2 mb-4 text-gray-400">
                      <MessageSquare size={16} />
                      <span className="text-xs font-bold uppercase tracking-wider">Your Response</span>
                    </div>
                    <textarea 
                      className="flex-1 w-full p-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#00529B] focus:border-transparent outline-none resize-none text-gray-800 font-sans leading-relaxed"
                      placeholder="Draft your professional email response here..."
                      value={response}
                      onChange={(e) => setResponse(e.target.value)}
                      disabled={evaluating}
                    />
                    <div className="mt-4 flex justify-between items-center text-xs text-gray-400">
                      <span>Word count: {response.split(/\s+/).filter(Boolean).length}</span>
                      <span>Press Submit when ready for AI evaluation</span>
                    </div>
                  </Card>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'session-result' && currentSession && currentSession.evaluation && (
            <motion.div 
              key="result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-5xl mx-auto pb-12"
            >
              <header className="text-center mb-12">
                <div className="inline-flex items-center justify-center p-3 bg-green-50 text-green-600 rounded-full mb-4">
                  <CheckCircle2 size={32} />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Practice Session Complete</h1>
                <p className="text-gray-500">Here is your AI-powered competency evaluation.</p>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                {/* Score Summary */}
                <Card className="lg:col-span-1 p-8 flex flex-col items-center justify-center text-center">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">Overall Score</h3>
                  <div className="relative w-48 h-48 flex items-center justify-center mb-6">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle 
                        cx="96" cy="96" r="88" 
                        fill="none" stroke="#F3F4F6" strokeWidth="12" 
                      />
                      <circle 
                        cx="96" cy="96" r="88" 
                        fill="none" stroke="#00529B" strokeWidth="12" 
                        strokeDasharray={552.92}
                        strokeDashoffset={552.92 - (552.92 * (currentSession.scores?.overall || 0)) / 100}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-5xl font-bold text-gray-900">{currentSession.scores?.overall}%</span>
                      <span className="text-xs text-gray-400 font-medium uppercase">Excellence</span>
                    </div>
                  </div>
                  <Button variant="primary" className="w-full" onClick={() => setView('dashboard')}>Return to Dashboard</Button>
                </Card>

                {/* Competency Radar */}
                <Card className="lg:col-span-2 p-8">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">Competency Breakdown</h3>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={[
                        { subject: 'Policy', A: currentSession.scores?.policyTranslation, fullMark: 100 },
                        { subject: 'Empathy', A: currentSession.scores?.empathy, fullMark: 100 },
                        { subject: 'WOG', A: currentSession.scores?.wogPerspective, fullMark: 100 },
                        { subject: 'Integrity', A: currentSession.scores?.integrity, fullMark: 100 },
                        { subject: 'Ownership', A: currentSession.scores?.problemOwnership, fullMark: 100 },
                      ]}>
                        <PolarGrid stroke="#E5E7EB" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#6B7280', fontSize: 12 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar 
                          name="Score" 
                          dataKey="A" 
                          stroke="#00529B" 
                          fill="#00529B" 
                          fillOpacity={0.2} 
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                <Card className="p-8 border-t-4 border-t-green-500">
                  <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900 mb-4">
                    <TrendingUp className="text-green-500" size={20} />
                    Key Strengths
                  </h3>
                  <ul className="space-y-3">
                    {currentSession.evaluation.strengths.map((s, i) => (
                      <li key={i} className="flex gap-3 text-sm text-gray-600">
                        <CheckCircle2 className="text-green-500 shrink-0" size={18} />
                        {s}
                      </li>
                    ))}
                  </ul>
                </Card>
                <Card className="p-8 border-t-4 border-t-amber-500">
                  <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900 mb-4">
                    <BrainCircuit className="text-amber-500" size={20} />
                    Areas for Growth
                  </h3>
                  <ul className="space-y-3">
                    {currentSession.evaluation.improvements.map((s, i) => (
                      <li key={i} className="flex gap-3 text-sm text-gray-600">
                        <AlertCircle className="text-amber-500 shrink-0" size={18} />
                        {s}
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>

              <Card className="p-8">
                <h3 className="text-lg font-bold text-gray-900 mb-6">Detailed Analysis</h3>
                <div className="space-y-8">
                  {Object.entries(currentSession.evaluation.competencyAnalysis).map(([key, data]: any) => (
                    <div key={key} className="border-b border-gray-100 pb-6 last:border-0 last:pb-0">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-bold text-gray-800 capitalize">{key.replace(/([A-Z])/g, ' $1')}</h4>
                        <span className={`text-sm font-bold ${data.score > 70 ? 'text-green-600' : 'text-amber-600'}`}>
                          {data.score}/100
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 h-1.5 rounded-full mb-3">
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ${data.score > 70 ? 'bg-green-500' : 'bg-amber-500'}`}
                          style={{ width: `${data.score}%` }}
                        />
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed">{data.comment}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}

          {view === 'admin' && profile?.role === 'admin' && (
            <motion.div 
              key="admin"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-6xl mx-auto"
            >
              <header className="mb-8 flex justify-between items-end">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">CX Team Dashboard</h1>
                  <p className="text-gray-500">Analyze organization-wide performance and identify training needs.</p>
                </div>
                <div className="flex gap-3">
                  <Button 
                    variant="danger" 
                    icon={Trash2} 
                    onClick={async () => {
                      if (confirm('Are you sure you want to clear ALL practice history? This will reset all dashboard metrics and cannot be undone.')) {
                        const q = query(collection(db, 'sessions'));
                        const snap = await getDocs(q);
                        await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
                        showNotification('All practice history cleared.');
                      }
                    }}
                  >
                    Clear All
                  </Button>
                  <Button 
                    variant="secondary" 
                    icon={isRefreshing ? Loader2 : BrainCircuit} 
                    disabled={isRefreshing}
                    onClick={refreshScenariosData}
                  >
                    {isRefreshing ? 'Refreshing...' : 'Regenerate Scenarios'}
                  </Button>
                </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                <Card className="p-6">
                  <p className="text-xs font-bold text-gray-400 uppercase mb-2">Total Sessions</p>
                  <p className="text-3xl font-bold text-gray-900">{allSessions.length}</p>
                </Card>
                <Card className="p-6">
                  <p className="text-xs font-bold text-gray-400 uppercase mb-2">Avg. Org Score</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {allSessions.length > 0 
                      ? Math.round(allSessions.reduce((acc, s) => acc + (s.scores?.overall || 0), 0) / allSessions.filter(s => s.status === 'completed').length || 0)
                      : 0}%
                  </p>
                </Card>
                <Card className="p-6">
                  <p className="text-xs font-bold text-gray-400 uppercase mb-2">Active CSOs</p>
                  <p className="text-3xl font-bold text-gray-900">{new Set(allSessions.map(s => s.userId)).size}</p>
                </Card>
                <Card className="p-6">
                  <p className="text-xs font-bold text-gray-400 uppercase mb-2">Completion Rate</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {allSessions.length > 0 ? Math.round((allSessions.filter(s => s.status === 'completed').length / allSessions.length) * 100) : 0}%
                  </p>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
                <Card className="p-8">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">Competency Gaps</h3>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { name: 'Policy', score: Math.round(allSessions.reduce((acc, s) => acc + (s.scores?.policyTranslation || 0), 0) / allSessions.filter(s => s.status === 'completed').length || 0) },
                        { name: 'Empathy', score: Math.round(allSessions.reduce((acc, s) => acc + (s.scores?.empathy || 0), 0) / allSessions.filter(s => s.status === 'completed').length || 0) },
                        { name: 'WOG', score: Math.round(allSessions.reduce((acc, s) => acc + (s.scores?.wogPerspective || 0), 0) / allSessions.filter(s => s.status === 'completed').length || 0) },
                        { name: 'Integrity', score: Math.round(allSessions.reduce((acc, s) => acc + (s.scores?.integrity || 0), 0) / allSessions.filter(s => s.status === 'completed').length || 0) },
                        { name: 'Ownership', score: Math.round(allSessions.reduce((acc, s) => acc + (s.scores?.problemOwnership || 0), 0) / allSessions.filter(s => s.status === 'completed').length || 0) },
                      ]}>
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Bar dataKey="score" fill="#00529B" radius={[4, 4, 0, 0]}>
                          {allSessions.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={index === 2 ? '#F59E0B' : '#00529B'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-100 flex gap-3">
                    <AlertCircle className="text-amber-600 shrink-0" size={20} />
                    <p className="text-sm text-amber-800">
                      <strong>Insight:</strong> WOG Perspective is consistently the lowest scoring competency. Recommend a dedicated workshop on inter-agency coordination.
                    </p>
                  </div>
                </Card>

                <Card className="p-8">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">Recent Activity</h3>
                  <div className="space-y-4">
                    {allSessions.slice(0, 5).map((s) => (
                      <div key={s.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-100">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                            <Mail size={16} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">Session #{s.id.slice(-4)}</p>
                            <p className="text-xs text-gray-500">{format(new Date(s.createdAt), 'MMM d, h:mm a')}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900">{s.scores?.overall || 0}%</p>
                          <Badge variant={s.status === 'completed' ? 'success' : 'neutral'}>{s.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button variant="ghost" className="w-full mt-6" icon={Search}>View All Records</Button>
                </Card>
              </div>

              <Card className="p-8 mb-12">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">CSO Performance Metrics</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="pb-4 text-xs font-bold text-gray-400 uppercase">CSO Name</th>
                        <th className="pb-4 text-xs font-bold text-gray-400 uppercase text-center">Sessions</th>
                        <th className="pb-4 text-xs font-bold text-gray-400 uppercase text-center">Completion</th>
                        <th className="pb-4 text-xs font-bold text-gray-400 uppercase text-right">Avg. Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {allProfiles.filter(p => p.role === 'cso').map(p => {
                        const userSessions = allSessions.filter(s => s.userId === p.uid);
                        const completedSessions = userSessions.filter(s => s.status === 'completed');
                        const avgScore = completedSessions.length > 0 
                          ? Math.round(completedSessions.reduce((acc, s) => acc + (s.scores?.overall || 0), 0) / completedSessions.length)
                          : 0;
                        const completionRate = userSessions.length > 0
                          ? Math.round((completedSessions.length / userSessions.length) * 100)
                          : 0;

                        return (
                          <tr key={p.uid} className="hover:bg-gray-50 transition-colors">
                            <td className="py-4">
                              <p className="text-sm font-medium text-gray-900">{p.displayName || p.email.split('@')[0]}</p>
                              <p className="text-xs text-gray-500">{p.email}</p>
                            </td>
                            <td className="py-4 text-center text-sm text-gray-600">{userSessions.length}</td>
                            <td className="py-4 text-center">
                              <Badge variant={completionRate > 80 ? 'success' : completionRate > 50 ? 'warning' : 'neutral'}>
                                {completionRate}%
                              </Badge>
                            </td>
                            <td className="py-4 text-right font-bold text-gray-900">{avgScore}%</td>
                          </tr>
                        );
                      })}
                      {allProfiles.filter(p => p.role === 'cso').length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-gray-500 text-sm italic">
                            No CSOs registered yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
