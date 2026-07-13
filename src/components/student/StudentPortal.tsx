import React, { useState, useEffect } from 'react';
import { 
  Award, Clock, Calendar, CheckCircle2, AlertCircle, Play, 
  ChevronRight, BookOpen, User, LogOut, ChevronLeft, Volume2, 
  FileText, Mic, Send, Hourglass, HelpCircle, Flame, Star, Quote, Bell, Trash2, Edit2,
  Home, Sun, Moon
} from 'lucide-react';
import { User as UserType, Class, Exam, Assignment, CenterSettings, AppNotification } from '../../types';
import { Language, translations } from '../../data/translations';
import ThemeLanguageSelector from '../ThemeLanguageSelector';
import VocabularyLibrary from './VocabularyLibrary';
import ExamSectionPractice from './ExamSectionPractice';
import FullTestRunner from './FullTestRunner';
import Footer from '../common/Footer';
import { 
  getVocabulariesCloud, 
  saveVocabularyCloud, 
  deleteVocabularyCloud, 
  getHighlightsCloud, 
  saveHighlightCloud, 
  deleteHighlightCloud 
} from '../../data/firebaseSync';

interface StudentPortalProps {
  currentUser: UserType;
  classes: Class[];
  exams: Exam[];
  assignments: Assignment[];
  centerSettings: CenterSettings;
  onLogout: () => void;
  onUpdateAssignments: (updatedAssignments: Assignment[]) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  language: Language;
  setLanguage: (language: Language) => void;
  notifications: any[];
  onMarkAllRead: () => void;
  onClearNotifications: () => void;
  onMarkRead: (id: string) => void;
  onAddNotification: (textVi: string, textEn: string, role?: 'owner' | 'admin' | 'student', userId?: string) => void;
  onUpdateCurrentUser?: (updatedUser: UserType) => void;
  allUsers: UserType[];
}

export default function StudentPortal({ 
  currentUser, classes, exams, assignments, centerSettings, onLogout, onUpdateAssignments,
  theme, setTheme, language, setLanguage, notifications, onMarkAllRead, onClearNotifications, onMarkRead,
  onAddNotification, onUpdateCurrentUser, allUsers
}: StudentPortalProps) {
  // Navigation states
  const [activeTab, setActiveTab] = useState<'trang-chu' | 'listening' | 'reading' | 'writing' | 'speaking' | 'full-test' | 'my-vocabulary' | 'my-class'>('trang-chu');
  const [classSubTab, setClassSubTab] = useState<'members' | 'homework'>('homework');
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  // Active examination state
  const [takingExam, setTakingExam] = useState<Exam | null>(null);
  const [takingAssignment, setTakingAssignment] = useState<Assignment | null>(null);
  const [isFullTestFlow, setIsFullTestFlow] = useState(false);

  // Firestore Sync States
  const [vocabList, setVocabList] = useState<any[]>([]);
  const [highlightList, setHighlightList] = useState<any[]>([]);
  const [loadingSync, setLoadingSync] = useState(true);

  // Filter state for listening
  const [selectedListeningSection, setSelectedListeningSection] = useState<number | undefined>(undefined);

  const t = translations[language];

  // Fetch Firestore Data for current logged-in student
  useEffect(() => {
    let active = true;
    if (currentUser?.id) {
      setLoadingSync(true);
      Promise.all([
        getVocabulariesCloud(currentUser.id),
        getHighlightsCloud(currentUser.id)
      ]).then(([vocabs, highlights]) => {
        if (active) {
          setVocabList(vocabs);
          setHighlightList(highlights);
          setLoadingSync(false);
        }
      }).catch(err => {
        console.error("Error loading cloud student profile details:", err);
        if (active) setLoadingSync(false);
      });
    }
    return () => {
      active = false;
    };
  }, [currentUser?.id]);

  // Sync wrappers to update both state and Firestore
  const handleAddVocab = async (vocab: any) => {
    const newItem = {
      ...vocab,
      id: 'vocab-' + Date.now(),
      userId: currentUser.id,
      dateAdded: new Date().toISOString()
    };
    setVocabList(prev => [newItem, ...prev]);
    await saveVocabularyCloud(newItem);

    onAddNotification(
      `📝 Bạn vừa lưu từ vựng mới "${newItem.word}" vào sổ tay.`,
      `📝 You saved new vocabulary word "${newItem.word}" to your notebook.`,
      'student',
      currentUser.id
    );
  };

  const handleDeleteVocab = async (id: string) => {
    setVocabList(prev => prev.filter(v => v.id !== id));
    await deleteVocabularyCloud(id);
  };

  const handleToggleFavoriteVocab = async (item: any) => {
    const updated = { ...item, favorite: !item.favorite };
    setVocabList(prev => prev.map(v => v.id === item.id ? updated : v));
    await saveVocabularyCloud(updated);
  };

  const handleAddHighlight = async (hl: any) => {
    const newItem = {
      ...hl,
      id: 'hl-' + Date.now(),
      userId: currentUser.id,
      createdAt: new Date().toISOString()
    };
    setHighlightList(prev => [newItem, ...prev]);
    await saveHighlightCloud(newItem);
  };

  const handleDeleteHighlight = async (id: string) => {
    setHighlightList(prev => prev.filter(h => h.id !== id));
    await deleteHighlightCloud(id);
  };

  // Find class the student is in
  const studentClasses = classes.filter(c => c.studentIds.includes(currentUser.id));
  const belongsToClass = studentClasses.length > 0;

  // Find assignments assigned to these classes
  const classIds = studentClasses.map(c => c.id);
  const studentAssignments = assignments.filter(a => classIds.includes(a.classId));

  const pendingAssignments = studentAssignments.filter(a => 
    !a.submissions?.some(s => s.studentId === currentUser.id && s.status === 'done') && a.status === 'active'
  );

  const completedAssignments = studentAssignments.filter(a => 
    a.submissions?.some(s => s.studentId === currentUser.id && s.status === 'done')
  );

  const completedSubmissions = studentAssignments
    .flatMap(a => a.submissions || [])
    .filter(s => s.studentId === currentUser.id && s.status === 'done');

  const averageBand = completedSubmissions.length > 0
    ? (completedSubmissions.reduce((acc, curr) => acc + (curr.score || 0), 0) / completedSubmissions.length).toFixed(1)
    : 'N/A';

  const [inProgressExam, setInProgressExam] = useState<any>(null);

  // Load in-progress exam from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('ielts_in_progress_exam_' + currentUser.id);
    if (saved) {
      try {
        setInProgressExam(JSON.parse(saved));
      } catch (e) {
        console.error('Error parsing inProgressExam:', e);
      }
    } else {
      setInProgressExam(null);
    }
  }, [activeTab, takingExam, currentUser.id]);

  // Open Exam Practice Runner
  const handleStartPractice = (exam: Exam, assignment?: Assignment) => {
    setTakingExam(exam);
    setTakingAssignment(assignment || null);
    setIsFullTestFlow(false);

    // Save in-progress state to localStorage
    const inProgress = {
      examId: exam.id,
      assignmentId: assignment?.id,
      title: exam.title,
      type: exam.type,
      section: exam.type === 'listening' ? 'Section 1' : exam.type === 'reading' ? 'Passage 1' : 'Part 1',
      progressPercent: 30,
      isFullTest: false,
      startedAt: new Date().toISOString()
    };
    localStorage.setItem('ielts_in_progress_exam_' + currentUser.id, JSON.stringify(inProgress));
    setInProgressExam(inProgress);
  };

  // Open Full Test Runner
  const handleStartFullTest = (exam: Exam) => {
    setTakingExam(exam);
    setTakingAssignment(null);
    setIsFullTestFlow(true);

    // Save in-progress state to localStorage
    const inProgress = {
      examId: exam.id,
      title: exam.title,
      type: exam.type,
      section: 'Section 1 (Listening)',
      progressPercent: 10,
      isFullTest: true,
      startedAt: new Date().toISOString()
    };
    localStorage.setItem('ielts_in_progress_exam_' + currentUser.id, JSON.stringify(inProgress));
    setInProgressExam(inProgress);
  };

  // Submit and update states (including dynamic submissions back to Parent state which syncs with Firebase)
  const handleExamFinished = (answers: Record<string, string>, score: number, correctCount: number) => {
    if (!takingExam) return;

    if (takingAssignment) {
      const updatedAssignments = assignments.map(assign => {
        if (assign.id === takingAssignment.id) {
          const updatedSubmissions = assign.submissions.map(sub => {
            if (sub.studentId === currentUser.id) {
              return {
                ...sub,
                status: 'done' as const,
                submittedAt: new Date().toISOString(),
                score: score,
                duration: 15
              };
            }
            return sub;
          });
          return { ...assign, submissions: updatedSubmissions };
        }
        return assign;
      });
      
      onUpdateAssignments(updatedAssignments);

      onAddNotification(
        `✅ Bạn đã hoàn thành bài tập "${takingAssignment.title}" (Band ${score}).`,
        `✅ You completed assignment "${takingAssignment.title}" (Band ${score}).`,
        'student',
        currentUser.id
      );
      onAddNotification(
        `✅ Học sinh ${currentUser.name} đã hoàn thành bài tập "${takingAssignment.title}".`,
        `✅ Student ${currentUser.name} completed assignment "${takingAssignment.title}".`,
        'admin'
      );
      onAddNotification(
        `✅ Học sinh ${currentUser.name} đã hoàn thành bài tập "${takingAssignment.title}".`,
        `✅ Student ${currentUser.name} completed assignment "${takingAssignment.title}".`,
        'owner'
      );
    } else {
      onAddNotification(
        `🎉 Bạn đã hoàn thành tự luyện tập đề "${takingExam.title}" (Band ${score}).`,
        `🎉 You completed self-practice exam "${takingExam.title}" (Band ${score}).`,
        'student',
        currentUser.id
      );
    }

    // Clear in-progress exam
    localStorage.removeItem('ielts_in_progress_exam_' + currentUser.id);
    setInProgressExam(null);
  };

  // Filter exams based on tab type
  const publishedExams = exams.filter(e => e.status === 'published');
  const listeningExams = publishedExams.filter(e => e.type === 'listening');
  const readingExams = publishedExams.filter(e => e.type === 'reading');
  const writingExams = publishedExams.filter(e => e.type === 'writing');
  const speakingExams = publishedExams.filter(e => e.type === 'speaking');
  const fullExams = publishedExams.filter(e => e.type === 'full');

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans transition-colors duration-200`}>
      
      {/* ================= HEADER ================= */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xl bg-blue-50 dark:bg-slate-800 p-2 rounded-xl text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-slate-700">
            {centerSettings.logo}
          </span>
          <div className="hidden sm:block">
            <h1 className="font-extrabold text-slate-800 dark:text-slate-200 text-sm leading-tight">{centerSettings.name}</h1>
            <p className="text-[10px] text-blue-500 dark:text-blue-400 font-extrabold uppercase tracking-wider">
              Student Portal
            </p>
          </div>
        </div>

        {/* Top Navigation Menu tabs with 2 levels as requested */}
        <nav className="flex flex-col items-center gap-2 flex-1 lg:flex-initial max-w-full">
          {/* Top level: TRANG CHỦ / HOME */}
          <div className="flex justify-center">
            <button 
              onClick={() => { setActiveTab('trang-chu'); setTakingExam(null); }}
              className={`flex items-center gap-2 px-5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 border cursor-pointer shrink-0 ${
                activeTab === 'trang-chu' 
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20 scale-[1.02]' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Home size={14} />
              <span>{language === 'vi' ? 'Trang chủ' : 'Home'}</span>
            </button>
          </div>

          {/* Bottom level: SKILL CATEGORIES & FULL TEST */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 p-1 rounded-xl border border-slate-100 dark:border-slate-800/60 overflow-x-auto scrollbar-none max-w-full whitespace-nowrap scroll-smooth">
            {/* NGHE / LISTENING */}
            <button 
              onClick={() => { setActiveTab('listening'); setTakingExam(null); }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 border cursor-pointer shrink-0 ${
                activeTab === 'listening' 
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/10' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 border-transparent hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Volume2 size={13} />
              <span>{language === 'vi' ? 'Nghe' : 'Listening'}</span>
            </button>

            {/* ĐỌC / READING */}
            <button 
              onClick={() => { setActiveTab('reading'); setTakingExam(null); }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 border cursor-pointer shrink-0 ${
                activeTab === 'reading' 
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/10' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 border-transparent hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <FileText size={13} />
              <span>{language === 'vi' ? 'Đọc' : 'Reading'}</span>
            </button>

            {/* VIẾT / WRITING */}
            <button 
              onClick={() => { setActiveTab('writing'); setTakingExam(null); }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 border cursor-pointer shrink-0 ${
                activeTab === 'writing' 
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/10' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 border-transparent hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Edit2 size={13} />
              <span>{language === 'vi' ? 'Viết' : 'Writing'}</span>
            </button>

            {/* NÓI / SPEAKING */}
            <button 
              onClick={() => { setActiveTab('speaking'); setTakingExam(null); }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 border cursor-pointer shrink-0 ${
                activeTab === 'speaking' 
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/10' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 border-transparent hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Mic size={13} />
              <span>{language === 'vi' ? 'Nói' : 'Speaking'}</span>
            </button>

            {/* LÀM ĐỀ FULL TEST / FULL TEST */}
            <button 
              onClick={() => { setActiveTab('full-test'); setTakingExam(null); }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 border cursor-pointer shrink-0 ${
                activeTab === 'full-test' 
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/10' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 border-transparent hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Award size={13} />
              <span>{language === 'vi' ? 'Full Test' : 'Full Test'}</span>
            </button>
          </div>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowNotifDropdown(!showNotifDropdown)}
              className={`relative p-2 rounded-full transition-colors ${
                showNotifDropdown 
                  ? 'bg-indigo-50 dark:bg-slate-800 text-indigo-600' 
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-extrabold rounded-full flex items-center justify-center animate-bounce">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifDropdown && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowNotifDropdown(false)} />
                <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 z-40 overflow-hidden">
                  <div className="p-4 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
                    <span className="font-extrabold text-slate-800 dark:text-slate-200 text-[10px] uppercase tracking-wider flex items-center gap-1">
                      🔔 Notifications
                    </span>
                    <div className="flex gap-2 text-[10px]">
                      {unreadCount > 0 && (
                        <button onClick={() => { onMarkAllRead(); }} className="text-indigo-600 font-bold hover:underline">
                          Mark all
                        </button>
                      )}
                      <button onClick={() => { onClearNotifications(); }} className="text-rose-500 font-bold hover:underline">
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400">
                        No notifications
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id} className={`p-3 text-[11px] flex gap-2 text-left ${n.isRead ? 'bg-white dark:bg-slate-900' : 'bg-blue-50/30 dark:bg-blue-950/15'}`}>
                          <div className="flex-1 space-y-0.5">
                            <p className={`text-slate-700 dark:text-slate-300 ${!n.isRead ? 'font-semibold' : ''}`}>
                              {language === 'vi' ? n.textVi : n.textEn}
                            </p>
                            <div className="flex items-center justify-between text-[9px] text-slate-400">
                              <span>{language === 'vi' ? n.timeVi : n.timeEn}</span>
                              {!n.isRead && (
                                <button onClick={() => onMarkRead(n.id)} className="text-indigo-600 hover:underline">
                                  Read
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Language Selector at the very top-rightmost position */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5 border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
            <button
              onClick={() => setLanguage('vi')}
              title="Tiếng Việt"
              className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                language === 'vi'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900'
              }`}
            >
              <span>🇻🇳</span>
              <span className="hidden sm:inline font-extrabold">VI</span>
            </button>
            <button
              onClick={() => setLanguage('en')}
              title="English"
              className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                language === 'en'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900'
              }`}
            >
              <span>🇬🇧</span>
              <span className="hidden sm:inline font-extrabold">EN</span>
            </button>
          </div>
        </div>
      </header>

      {/* ================= MAIN CONTAINER WRAPPER ================= */}
      {takingExam ? (
        /* active exam screen */
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 animate-fade-in">
          {isFullTestFlow ? (
            <FullTestRunner
              exam={takingExam}
              currentUser={currentUser}
              onBack={() => setTakingExam(null)}
              onAddVocab={handleAddVocab}
              onAddHighlight={handleAddHighlight}
              onDeleteHighlight={handleDeleteHighlight}
              highlightList={highlightList}
              vocabList={vocabList}
              language={language}
            />
          ) : (
            <ExamSectionPractice
              exam={takingExam}
              currentUser={currentUser}
              onBack={() => setTakingExam(null)}
              onAddVocab={handleAddVocab}
              onAddHighlight={handleAddHighlight}
              onDeleteHighlight={handleDeleteHighlight}
              highlightList={highlightList}
              vocabList={vocabList}
              language={language}
              selectedSection={selectedListeningSection}
              onFullTestSectionComplete={(answers, score, count) => {
                handleExamFinished(answers, score, count);
              }}
            />
          )}
        </main>
      ) : (
        /* standard portal panel layouts */
        <div className="flex-1 flex max-w-7xl w-full mx-auto">
          
          {/* ================= LEFT SIDEBAR ================= */}
          <aside className="w-64 border-r border-slate-100 dark:border-slate-800 p-5 space-y-5 hidden md:block shrink-0 text-left bg-white dark:bg-slate-900/50">
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2">Cá nhân</span>
              <button
                onClick={() => { setActiveTab('my-vocabulary'); setTakingExam(null); }}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'my-vocabulary' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Star size={14} />
                <span>{language === 'vi' ? 'Sổ tay từ vựng' : 'Vocabulary'}</span>
              </button>
            </div>

            {belongsToClass && (
              <div className="space-y-2">
                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Lớp Học Của Tôi</span>
                
                <button
                  onClick={() => { 
                    setActiveTab('my-class'); 
                    setTakingExam(null); 
                  }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                    activeTab === 'my-class' 
                      ? 'bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border border-blue-100/50 dark:border-blue-900/40' 
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <BookOpen size={14} />
                    <span>{language === 'vi' ? 'Lớp học của tôi' : 'My Class'}</span>
                  </div>
                </button>

                {/* Sub-menu items for My Class */}
                <div className="pl-4 space-y-1 border-l border-slate-100 dark:border-slate-800 ml-3">
                  <button
                    onClick={() => { 
                      setActiveTab('my-class'); 
                      setClassSubTab('members'); 
                      setTakingExam(null); 
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                      activeTab === 'my-class' && classSubTab === 'members'
                        ? 'text-blue-600 dark:text-blue-400 font-bold bg-blue-50/50 dark:bg-blue-950/20'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                    <span>{language === 'vi' ? 'Thành viên lớp' : 'Class Members'}</span>
                  </button>

                  <button
                    onClick={() => { 
                      setActiveTab('my-class'); 
                      setClassSubTab('homework'); 
                      setTakingExam(null); 
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                      activeTab === 'my-class' && classSubTab === 'homework'
                        ? 'text-blue-600 dark:text-blue-400 font-bold bg-blue-50/50 dark:bg-blue-950/20'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                    <span>{language === 'vi' ? 'Bài tập được giao' : 'Assignments'}</span>
                  </button>
                </div>
              </div>
            )}

            <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-950/30 rounded-xl space-y-1.5 text-[11px]">
              <span className="font-extrabold text-blue-700 dark:text-blue-400 uppercase block">Trợ giúp học viên</span>
              <p className="text-slate-600 dark:text-slate-400 leading-normal">
                Vui lòng liên hệ hotline khi cần hỗ trợ nộp bài: <strong className="text-blue-800 dark:text-blue-300">{centerSettings.phone}</strong>
              </p>
            </div>
          </aside>

          {/* ================= MAIN CONTENT SHEET ================= */}
          <main className="flex-1 p-6 md:p-8 overflow-y-auto space-y-6">

            {/* ================= TRANG CHỦ (Home) ================= */}
            {activeTab === 'trang-chu' && (() => {
              const completedItems: any[] = [];
              
              // 1. Add completed assignments
              assignments.forEach(a => {
                const sub = a.submissions?.find(s => s.studentId === currentUser.id && s.status === 'done');
                if (sub) {
                  completedItems.push({
                    examId: a.examId,
                    type: a.type,
                    score: sub.score || 0,
                    date: sub.submittedAt
                  });
                }
              });

              // 2. Add completed self-practices from notifications
              notifications.forEach(n => {
                if (n.userId === currentUser.id) {
                  const viMatch = n.textVi?.match(/hoàn thành tự luyện tập đề "([^"]+)"/);
                  const enMatch = n.textEn?.match(/completed self-practice exam "([^"]+)"/);
                  const title = viMatch?.[1] || enMatch?.[1];
                  if (title) {
                    const matchingExam = exams.find(e => e.title === title);
                    if (matchingExam) {
                      const scoreMatch = n.textVi?.match(/Band\s+([0-9.]+)/);
                      const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0;
                      completedItems.push({
                        examId: matchingExam.id,
                        type: matchingExam.type,
                        score: score,
                        date: n.createdAt
                      });
                    }
                  }
                }
              });

              const listeningCount = completedItems.filter(item => item.type === 'listening').length;
              const readingCount = completedItems.filter(item => item.type === 'reading').length;
              const writingCount = completedItems.filter(item => item.type === 'writing').length;
              const speakingCount = completedItems.filter(item => item.type === 'speaking').length;
              const fullTestCount = completedItems.filter(item => item.type === 'full' || item.type === 'full-test').length;

              return (
                <div className="space-y-6 text-left animate-fade-in">
                  
                  {/* ================= 1. BANNER CHÀO MỪNG ================= */}
                  <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-8 shadow-md">
                    {centerSettings.bannerUrl && (
                      <div className="absolute inset-0 opacity-10 mix-blend-overlay">
                        <img src={centerSettings.bannerUrl} alt="banner" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                    )}
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="space-y-2 max-w-xl text-left">
                        <span className="bg-white/20 text-white text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full inline-block">
                          Welcome Back
                        </span>
                        <h2 className="text-2xl font-black">{language === 'vi' ? 'Xin chào' : 'Hello'}, {currentUser.name}!</h2>
                        <p className="text-xs text-blue-100 leading-normal font-medium">
                          {language === 'vi' ? 'Tiếp tục hành trình chinh phục IELTS.' : 'Continue your journey to conquer IELTS.'}
                        </p>
                      </div>
                      <div className="flex gap-3 shrink-0 self-start md:self-auto">
                        <button
                          onClick={() => {
                            const saved = localStorage.getItem('ielts_in_progress_exam_' + currentUser.id);
                            if (saved) {
                              try {
                                const data = JSON.parse(saved);
                                const matchingExam = exams.find(e => e.id === data.examId);
                                if (matchingExam) {
                                  const matchingAssignment = assignments.find(a => a.id === data.assignmentId);
                                  handleStartPractice(matchingExam, matchingAssignment);
                                  return;
                                }
                              } catch (err) {
                                console.error(err);
                              }
                            }
                            if (belongsToClass) {
                              setActiveTab('my-class');
                            } else {
                              setActiveTab('listening');
                            }
                          }}
                          className="px-5 py-2.5 bg-white text-blue-700 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all shadow-sm"
                        >
                          {language === 'vi' ? 'Tiếp tục học' : 'Continue learning'}
                        </button>
                        <button
                          onClick={() => setActiveTab('listening')}
                          className="px-5 py-2.5 bg-blue-600/50 hover:bg-blue-600/70 border border-white/20 text-white rounded-xl text-xs font-bold transition-all"
                        >
                          {language === 'vi' ? 'Luyện tập ngay' : 'Practice now'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ================= 2. LUYỆN TẬP NHANH ================= */}
                  <div className="space-y-3">
                    <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                      {language === 'vi' ? 'Luyện tập nhanh' : 'Quick Practice'}
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                      {/* Listening Card */}
                      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl text-left hover:border-blue-200 dark:hover:border-blue-900/60 transition-all flex flex-col justify-between h-40 group hover:shadow-md">
                        <div className="flex items-center justify-between">
                          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/30 rounded-xl">
                            <Volume2 className="text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform" size={18} />
                          </div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Listening</span>
                        </div>
                        <div className="mt-4">
                          <span className="text-sm font-black text-slate-800 dark:text-slate-200 block">
                            {listeningExams.length > 0 ? `${listeningExams.length} đề` : (language === 'vi' ? 'Chưa có đề.' : 'No exams.')}
                          </span>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{language === 'vi' ? 'Kỹ năng nghe' : 'Listening skills'}</p>
                        </div>
                        <button 
                          onClick={() => setActiveTab('listening')}
                          className="mt-3 w-full py-1.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-600 hover:text-white text-blue-600 dark:text-blue-400 rounded-lg text-[10px] font-bold transition-all text-center"
                        >
                          {language === 'vi' ? 'Luyện ngay' : 'Practice Now'}
                        </button>
                      </div>

                      {/* Reading Card */}
                      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl text-left hover:border-emerald-200 dark:hover:border-emerald-900/60 transition-all flex flex-col justify-between h-40 group hover:shadow-md">
                        <div className="flex items-center justify-between">
                          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl">
                            <FileText className="text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform" size={18} />
                          </div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Reading</span>
                        </div>
                        <div className="mt-4">
                          <span className="text-sm font-black text-slate-800 dark:text-slate-200 block">
                            {readingExams.length > 0 ? `${readingExams.length} đề` : (language === 'vi' ? 'Chưa có đề.' : 'No exams.')}
                          </span>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{language === 'vi' ? 'Kỹ năng đọc' : 'Reading skills'}</p>
                        </div>
                        <button 
                          onClick={() => setActiveTab('reading')}
                          className="mt-3 w-full py-1.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-600 hover:text-white text-emerald-600 dark:text-emerald-400 rounded-lg text-[10px] font-bold transition-all text-center"
                        >
                          {language === 'vi' ? 'Luyện ngay' : 'Practice Now'}
                        </button>
                      </div>

                      {/* Writing Card */}
                      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl text-left hover:border-amber-200 dark:hover:border-amber-900/60 transition-all flex flex-col justify-between h-40 group hover:shadow-md">
                        <div className="flex items-center justify-between">
                          <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-xl">
                            <Edit2 className="text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform" size={18} />
                          </div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Writing</span>
                        </div>
                        <div className="mt-4">
                          <span className="text-sm font-black text-slate-800 dark:text-slate-200 block">
                            {writingExams.length > 0 ? `${writingExams.length} đề` : (language === 'vi' ? 'Chưa có đề.' : 'No exams.')}
                          </span>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{language === 'vi' ? 'Kỹ năng viết' : 'Writing skills'}</p>
                        </div>
                        <button 
                          onClick={() => setActiveTab('writing')}
                          className="mt-3 w-full py-1.5 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-600 hover:text-white text-amber-600 dark:text-amber-400 rounded-lg text-[10px] font-bold transition-all text-center"
                        >
                          {language === 'vi' ? 'Luyện ngay' : 'Practice Now'}
                        </button>
                      </div>

                      {/* Speaking Card */}
                      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl text-left hover:border-purple-200 dark:hover:border-purple-900/60 transition-all flex flex-col justify-between h-40 group hover:shadow-md">
                        <div className="flex items-center justify-between">
                          <div className="p-2.5 bg-purple-50 dark:bg-purple-950/30 rounded-xl">
                            <Mic className="text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform" size={18} />
                          </div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Speaking</span>
                        </div>
                        <div className="mt-4">
                          <span className="text-sm font-black text-slate-800 dark:text-slate-200 block">
                            {speakingExams.length > 0 ? `${speakingExams.length} chủ đề` : (language === 'vi' ? 'Chưa có đề.' : 'No exams.')}
                          </span>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{language === 'vi' ? 'Kỹ năng nói' : 'Speaking skills'}</p>
                        </div>
                        <button 
                          onClick={() => setActiveTab('speaking')}
                          className="mt-3 w-full py-1.5 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-600 hover:text-white text-purple-600 dark:text-purple-400 rounded-lg text-[10px] font-bold transition-all text-center"
                        >
                          {language === 'vi' ? 'Luyện ngay' : 'Practice Now'}
                        </button>
                      </div>

                      {/* Full Test Card */}
                      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl text-left hover:border-red-200 dark:hover:border-red-900/60 transition-all flex flex-col justify-between h-40 group hover:shadow-md">
                        <div className="flex items-center justify-between">
                          <div className="p-2.5 bg-red-50 dark:bg-red-950/30 rounded-xl">
                            <Award className="text-red-600 dark:text-red-400 group-hover:scale-105 transition-transform" size={18} />
                          </div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Full Test</span>
                        </div>
                        <div className="mt-4">
                          <span className="text-sm font-black text-slate-800 dark:text-slate-200 block">
                            {fullExams.length > 0 ? `${fullExams.length} đề` : (language === 'vi' ? 'Chưa có đề.' : 'No exams.')}
                          </span>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{language === 'vi' ? 'Đề thi đầy đủ' : 'Full tests'}</p>
                        </div>
                        <button 
                          onClick={() => setActiveTab('full-test')}
                          className="mt-3 w-full py-1.5 bg-red-50 dark:bg-red-950/40 hover:bg-red-600 hover:text-white text-red-600 dark:text-red-400 rounded-lg text-[10px] font-bold transition-all text-center"
                        >
                          {language === 'vi' ? 'Luyện ngay' : 'Practice Now'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ================= 3 & 6. TIẾN ĐỘ & THỐNG KÊ HỌC TẬP ================= */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* 3. Tiến độ học tập */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-2xl space-y-4">
                      <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                        {language === 'vi' ? 'Tiến độ học tập' : 'Learning Progress'}
                      </h4>

                      {completedItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400 dark:text-slate-500">
                          <AlertCircle className="text-slate-300 dark:text-slate-700 mb-2 animate-pulse" size={24} />
                          <p className="text-xs">{language === 'vi' ? 'Bạn chưa bắt đầu luyện tập.' : 'You have not started practicing yet.'}</p>
                        </div>
                      ) : (
                        <div className="space-y-4 text-xs">
                          {/* Listening Progress */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between font-bold">
                              <span className="text-slate-600 dark:text-slate-400">Listening</span>
                              <span className="text-slate-800 dark:text-slate-200">{listeningCount} {language === 'vi' ? 'đề đã làm' : 'exams completed'}</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                              <div className="bg-blue-600 h-full rounded-full" style={{ width: `${Math.min(100, listeningCount * 10)}%` }}></div>
                            </div>
                          </div>

                          {/* Reading Progress */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between font-bold">
                              <span className="text-slate-600 dark:text-slate-400">Reading</span>
                              <span className="text-slate-800 dark:text-slate-200">{readingCount} {language === 'vi' ? 'đề đã làm' : 'exams completed'}</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                              <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${Math.min(100, readingCount * 10)}%` }}></div>
                            </div>
                          </div>

                          {/* Writing Progress */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between font-bold">
                              <span className="text-slate-600 dark:text-slate-400">Writing</span>
                              <span className="text-slate-800 dark:text-slate-200">{writingCount} {language === 'vi' ? 'bài đã làm' : 'essays completed'}</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                              <div className="bg-amber-600 h-full rounded-full" style={{ width: `${Math.min(100, writingCount * 10)}%` }}></div>
                            </div>
                          </div>

                          {/* Speaking Progress */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between font-bold">
                              <span className="text-slate-600 dark:text-slate-400">Speaking</span>
                              <span className="text-slate-800 dark:text-slate-200">{speakingCount} {language === 'vi' ? 'topic đã luyện' : 'topics practiced'}</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                              <div className="bg-purple-600 h-full rounded-full" style={{ width: `${Math.min(100, speakingCount * 10)}%` }}></div>
                            </div>
                          </div>

                          {/* Full Test Progress */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between font-bold">
                              <span className="text-slate-600 dark:text-slate-400">Full Test</span>
                              <span className="text-slate-800 dark:text-slate-200">{fullTestCount} {language === 'vi' ? 'Full Test hoàn thành' : 'Full Tests completed'}</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                              <div className="bg-red-600 h-full rounded-full" style={{ width: `${Math.min(100, fullTestCount * 10)}%` }}></div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 6. Thống kê học tập */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-2xl space-y-4">
                      <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                        {language === 'vi' ? 'Thống kê học tập' : 'Learning Statistics'}
                      </h4>

                      {completedItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400 dark:text-slate-500">
                          <AlertCircle className="text-slate-300 dark:text-slate-700 mb-2" size={24} />
                          <p className="text-xs">{language === 'vi' ? 'Chưa có thống kê.' : 'No statistics yet.'}</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">{language === 'vi' ? 'Tổng đề đã làm' : 'Total Exams Done'}</span>
                            <span className="text-xl font-black text-slate-800 dark:text-slate-100 block mt-1">{completedItems.length}</span>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">{language === 'vi' ? 'Tổng thời gian học' : 'Total Study Time'}</span>
                            <span className="text-xl font-black text-slate-800 dark:text-slate-100 block mt-1">
                              {completedItems.length * 15} <small className="text-[10px] text-slate-400">mins</small>
                            </span>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">{language === 'vi' ? 'ĐTB Listening' : 'Avg Listening Band'}</span>
                            <span className="text-xl font-black text-slate-800 dark:text-slate-100 block mt-1">
                              {(() => {
                                const list = completedItems.filter(item => item.type === 'listening' && item.score > 0);
                                return list.length > 0 
                                  ? (list.reduce((acc, curr) => acc + curr.score, 0) / list.length).toFixed(1)
                                  : 'N/A';
                              })()}
                            </span>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">{language === 'vi' ? 'ĐTB Reading' : 'Avg Reading Band'}</span>
                            <span className="text-xl font-black text-slate-800 dark:text-slate-100 block mt-1">
                              {(() => {
                                const list = completedItems.filter(item => item.type === 'reading' && item.score > 0);
                                return list.length > 0 
                                  ? (list.reduce((acc, curr) => acc + curr.score, 0) / list.length).toFixed(1)
                                  : 'N/A';
                              })()}
                            </span>
                          </div>
                          <div className="col-span-2 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-amber-950/10 dark:to-orange-950/10 border border-orange-100 dark:border-orange-950/30 p-3 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Flame className="text-orange-500 fill-orange-500 animate-pulse" size={18} />
                              <div>
                                <span className="text-[9px] text-orange-600 dark:text-orange-400 font-extrabold uppercase tracking-wider block">Study Streak</span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{language === 'vi' ? 'Số ngày học liên tiếp' : 'Consecutive study days'}</span>
                              </div>
                            </div>
                            <span className="text-xl font-black text-orange-600 dark:text-orange-400">{currentUser.streak || 0} {language === 'vi' ? 'ngày' : 'days'}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ================= 4. TIẾP TỤC HỌC (IN PROGRESS) ================= */}
                  <div className="space-y-3">
                    <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                      {language === 'vi' ? 'Tiếp tục học' : 'Continue learning'}
                    </h4>

                    {inProgressExam ? (
                      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm hover:border-blue-200 dark:hover:border-blue-900/40 transition-all text-left">
                        <div className="flex items-start gap-3">
                          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/30 rounded-xl mt-1 shrink-0">
                            {inProgressExam.type === 'listening' ? <Volume2 className="text-blue-600" size={18} /> :
                             inProgressExam.type === 'reading' ? <FileText className="text-emerald-600" size={18} /> :
                             inProgressExam.type === 'writing' ? <Edit2 className="text-amber-600" size={18} /> :
                             inProgressExam.type === 'speaking' ? <Mic className="text-purple-600" size={18} /> :
                             <Award className="text-red-600" size={18} />}
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">{inProgressExam.type}</span>
                            <h5 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm mt-0.5">{inProgressExam.title}</h5>
                            <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-500">
                              <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-bold">{language === 'vi' ? `Phần: ${inProgressExam.section || 'Phần 1'}` : `Section: ${inProgressExam.section || 'Section 1'}`}</span>
                              <span>•</span>
                              <span>{language === 'vi' ? `Tiến độ: ${inProgressExam.progressPercent}%` : `Progress: ${inProgressExam.progressPercent}%`}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                          <button
                            onClick={() => {
                              const matchingExam = exams.find(e => e.id === inProgressExam.examId);
                              if (matchingExam) {
                                const matchingAssignment = assignments.find(a => a.id === inProgressExam.assignmentId);
                                handleStartPractice(matchingExam, matchingAssignment);
                              }
                            }}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                          >
                            {language === 'vi' ? 'Tiếp tục' : 'Resume'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-50/50 dark:bg-slate-900/10 border border-dashed border-slate-200 dark:border-slate-800 p-6 rounded-2xl text-center text-slate-400 dark:text-slate-500 text-xs">
                        {language === 'vi' ? 'Bạn không có bài đang làm.' : 'You have no active exams in progress.'}
                      </div>
                    )}
                  </div>

                  {/* ================= 5. MY VOCABULARY ================= */}
                  <div className="space-y-3">
                    <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                      {language === 'vi' ? 'My Vocabulary' : 'My Vocabulary'}
                    </h4>

                    {vocabList.length === 0 ? (
                      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-2xl text-center text-slate-400 dark:text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
                        <Star className="text-slate-300 dark:text-slate-700 mb-1" size={20} />
                        <p>{language === 'vi' ? 'Bạn chưa lưu từ vựng.' : 'You have not saved any vocabulary words yet.'}</p>
                      </div>
                    ) : (
                      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
                        <div className="grid grid-cols-3 gap-6 text-xs flex-1">
                          <div className="text-left border-r border-slate-100 dark:border-slate-800 pr-2">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">{language === 'vi' ? 'Tổng số từ đã lưu' : 'Total Saved Words'}</span>
                            <span className="text-xl font-black text-slate-800 dark:text-slate-100 mt-1 block">{vocabList.length}</span>
                          </div>
                          <div className="text-left border-r border-slate-100 dark:border-slate-800 pr-2">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">{language === 'vi' ? 'Từ mới hôm nay' : 'New Words Today'}</span>
                            <span className="text-xl font-black text-slate-800 dark:text-slate-100 mt-1 block">
                              {vocabList.filter(v => v.dateAdded?.startsWith(new Date().toISOString().split('T')[0])).length}
                            </span>
                          </div>
                          <div className="text-left">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">{language === 'vi' ? 'Số từ cần ôn tập' : 'Words to Review'}</span>
                            <span className="text-xl font-black text-slate-800 dark:text-slate-100 mt-1 block">
                              {vocabList.filter(v => !v.dateAdded?.startsWith(new Date().toISOString().split('T')[0])).length}
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0 self-start md:self-auto">
                          <button
                            onClick={() => setActiveTab('my-vocabulary')}
                            className="px-4 py-2.5 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-600 hover:text-white text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold transition-all border border-blue-100 dark:border-blue-900/30"
                          >
                            {language === 'vi' ? 'Xem sổ tay từ vựng' : 'View Vocabulary Notebook'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ================= 7. THÔNG BÁO ================= */}
                  <div className="space-y-3">
                    <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                      {language === 'vi' ? 'Thông báo' : 'Notifications'}
                    </h4>

                    {notifications.length === 0 ? (
                      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-2xl text-center text-slate-400 dark:text-slate-500 text-xs">
                        {language === 'vi' ? 'Không có thông báo.' : 'No notifications available.'}
                      </div>
                    ) : (
                      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
                        {notifications.slice(0, 5).map(n => (
                          <div key={n.id} className="p-4 flex items-start gap-3 hover:bg-slate-50/40 dark:hover:bg-slate-800/10 text-left">
                            <div className={`p-2 rounded-xl mt-0.5 shrink-0 ${n.isRead ? 'bg-slate-100 dark:bg-slate-800 text-slate-400' : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600'}`}>
                              <Bell size={12} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs text-slate-700 dark:text-slate-300 leading-normal ${!n.isRead ? 'font-bold' : 'font-medium'}`}>
                                {language === 'vi' ? n.textVi : n.textEn}
                              </p>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-1">
                                {language === 'vi' ? n.timeVi : n.timeEn}
                              </span>
                            </div>
                            {!n.isRead && (
                              <button 
                                onClick={() => onMarkRead(n.id)}
                                className="text-[10px] text-blue-600 dark:text-blue-400 font-extrabold hover:underline whitespace-nowrap shrink-0"
                              >
                                {language === 'vi' ? 'Đã đọc' : 'Mark read'}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ================= 8. LỚP HỌC (CHỈ HIỂN THỊ KHI CÓ THÀNH VIÊN) ================= */}
                  {belongsToClass && (
                    <div className="space-y-3 animate-fade-in">
                      <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                        {language === 'vi' ? 'Lớp học của tôi' : 'My Class'}
                      </h4>

                      <div className="bg-gradient-to-br from-indigo-500 to-blue-600 text-white p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm text-left">
                        <div>
                          <span className="bg-white/20 text-white text-[9px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full inline-block">
                            {language === 'vi' ? 'Đang tham gia' : 'Active Class'}
                          </span>
                          <h4 className="text-lg font-black mt-1.5">{studentClasses[0]?.name}</h4>
                          <p className="text-xs text-indigo-100 mt-1">
                            {language === 'vi' ? 'Giáo viên phụ trách: Giảng viên Aegis' : 'Assigned Teacher: Aegis Faculty'}
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => {
                              setActiveTab('my-class');
                              setClassSubTab('homework');
                            }}
                            className="px-4 py-2 bg-white text-blue-700 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all shadow-sm"
                          >
                            {language === 'vi' ? 'Vào lớp học' : 'Enter Class'}
                          </button>
                        </div>
                      </div>

                      {/* Homework assigned */}
                      <div className="space-y-2">
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold block">{language === 'vi' ? 'Bài tập được giao' : 'Assigned Homework'}</span>

                        {studentAssignments.length === 0 ? (
                          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-2xl text-center text-slate-400 dark:text-slate-500 text-xs">
                            {language === 'vi' ? 'Không có bài tập.' : 'No homework assigned.'}
                          </div>
                        ) : (
                          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                                  <th className="px-5 py-3.5">{language === 'vi' ? 'Tên bài' : 'Assignment Name'}</th>
                                  <th className="px-5 py-3.5">{language === 'vi' ? 'Hạn nộp' : 'Deadline'}</th>
                                  <th className="px-5 py-3.5">{language === 'vi' ? 'Trạng thái' : 'Status'}</th>
                                  <th className="px-5 py-3.5 text-right"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50 text-xs text-slate-700 dark:text-slate-300 font-medium">
                                {studentAssignments.map(assign => {
                                  const matchingExam = exams.find(e => e.id === assign.examId);
                                  const submission = assign.submissions?.find(s => s.studentId === currentUser.id);
                                  const isDone = submission?.status === 'done';

                                  return (
                                    <tr key={assign.id} className="hover:bg-slate-50/20">
                                      <td className="px-5 py-3.5 text-left">
                                        <span className="font-bold text-slate-800 dark:text-slate-100 block">{assign.title}</span>
                                        <span className="text-[10px] text-slate-400 block mt-0.5 uppercase font-semibold">{assign.type}</span>
                                      </td>
                                      <td className="px-5 py-3.5 text-slate-500 text-left font-bold">{assign.deadline}</td>
                                      <td className="px-5 py-3.5 text-left">
                                        {isDone ? (
                                          <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                            Band {submission.score}
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 text-amber-700 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                            Chưa làm
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-5 py-3.5 text-right">
                                        {!isDone && matchingExam && (
                                          <button 
                                            onClick={() => handleStartPractice(matchingExam, assign)}
                                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold shadow-sm shadow-blue-500/10"
                                          >
                                            {language === 'vi' ? 'Làm bài' : 'Start'}
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              );
            })()}

            {/* ================= LISTENING EXAMS LIST ================= */}
            {activeTab === 'listening' && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Listening Library</h3>
                    <p className="text-xs text-slate-500">Học sinh luyện tập nâng cao kỹ năng nghe qua các dạng bài IELTS thực tế.</p>
                  </div>

                  {/* Filter tabs: Section 1-4 */}
                  <div className="flex gap-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-1 rounded-xl shadow-sm self-start shrink-0">
                    <button 
                      onClick={() => setSelectedListeningSection(undefined)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${selectedListeningSection === undefined ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                      All Sections
                    </button>
                    {([1, 2, 3, 4] as const).map(sec => (
                      <button 
                        key={sec}
                        onClick={() => setSelectedListeningSection(sec)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${selectedListeningSection === sec ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                      >
                        Section {sec}
                      </button>
                    ))}
                  </div>
                </div>

                {listeningExams.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-12 rounded-3xl text-center text-slate-400 dark:text-slate-500">
                    <AlertCircle className="mx-auto text-slate-300 mb-2" size={32} />
                    <p className="text-xs">Hiện chưa có đề.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {listeningExams.map(exam => (
                      <div key={exam.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl flex flex-col justify-between hover:border-slate-200 transition-all shadow-sm">
                        <div className="space-y-3">
                          <span className="inline-block px-2 py-0.5 bg-slate-50 dark:bg-slate-800 text-slate-500 border border-slate-100 dark:border-slate-700 rounded text-[9px] font-extrabold uppercase tracking-wide">
                            Listening
                          </span>
                          <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-sm leading-snug line-clamp-2 h-10">{exam.title}</h4>
                          <div className="flex items-center gap-4 text-[11px] text-slate-400">
                            <span className="flex items-center gap-1"><Clock size={12} /> {exam.duration} mins</span>
                            <span className="flex items-center gap-1"><CheckCircle2 size={12} /> {exam.questionsCount} questions</span>
                          </div>
                        </div>
                        <div className="border-t border-slate-50 dark:border-slate-800 pt-3.5 mt-4 flex items-center justify-between">
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase">{exam.difficulty || 'medium'}</span>
                          <button 
                            onClick={() => handleStartPractice(exam)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm"
                          >
                            Start
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ================= READING EXAMS LIST ================= */}
            {activeTab === 'reading' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Reading Library</h3>
                  <p className="text-xs text-slate-500">Luyện tập khả năng tìm kiếm từ khóa, tư duy đọc hiểu học thuật IELTS.</p>
                </div>

                {readingExams.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-12 rounded-3xl text-center text-slate-400 dark:text-slate-500">
                    <AlertCircle className="mx-auto text-slate-300 mb-2" size={32} />
                    <p className="text-xs">Hiện chưa có đề.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {readingExams.map(exam => (
                      <div key={exam.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl flex flex-col justify-between hover:border-slate-200 transition-all shadow-sm">
                        <div className="space-y-3">
                          <span className="inline-block px-2 py-0.5 bg-slate-50 dark:bg-slate-800 text-slate-500 border border-slate-100 dark:border-slate-700 rounded text-[9px] font-extrabold uppercase tracking-wide">
                            Reading
                          </span>
                          <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-sm leading-snug line-clamp-2 h-10">{exam.title}</h4>
                          <div className="flex items-center gap-4 text-[11px] text-slate-400">
                            <span className="flex items-center gap-1"><Clock size={12} /> {exam.duration} mins</span>
                            <span className="flex items-center gap-1"><CheckCircle2 size={12} /> {exam.questionsCount} questions</span>
                          </div>
                        </div>
                        <div className="border-t border-slate-50 dark:border-slate-800 pt-3.5 mt-4 flex items-center justify-between">
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase">{exam.difficulty || 'medium'}</span>
                          <button 
                            onClick={() => handleStartPractice(exam)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm"
                          >
                            Start
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ================= WRITING EXAMS LIST ================= */}
            {activeTab === 'writing' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Writing Tasks</h3>
                  <p className="text-xs text-slate-500">Thực hiện làm bài viết luận Task 1 & Task 2 theo thời gian thực tế.</p>
                </div>

                {writingExams.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-12 rounded-3xl text-center text-slate-400 dark:text-slate-500">
                    <AlertCircle className="mx-auto text-slate-300 mb-2" size={32} />
                    <p className="text-xs">Hiện chưa có đề.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {writingExams.map(exam => (
                      <div key={exam.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl flex flex-col justify-between hover:border-slate-200 transition-all shadow-sm">
                        <div className="space-y-3">
                          <span className="inline-block px-2 py-0.5 bg-slate-50 dark:bg-slate-800 text-slate-500 border border-slate-100 dark:border-slate-700 rounded text-[9px] font-extrabold uppercase tracking-wide">
                            Writing
                          </span>
                          <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-sm leading-snug line-clamp-2 h-10">{exam.title}</h4>
                          <div className="flex items-center gap-4 text-[11px] text-slate-400">
                            <span className="flex items-center gap-1"><Clock size={12} /> {exam.duration} mins</span>
                          </div>
                        </div>
                        <div className="border-t border-slate-50 dark:border-slate-800 pt-3.5 mt-4 flex items-center justify-between">
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase">{exam.difficulty || 'medium'}</span>
                          <button 
                            onClick={() => handleStartPractice(exam)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm"
                          >
                            Start
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ================= SPEAKING TOPICS LIST ================= */}
            {activeTab === 'speaking' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Speaking Practice</h3>
                  <p className="text-xs text-slate-500">Chủ đề thảo luận Part 1, 2, 3 giúp phản xạ nói tiếng Anh tự nhiên trôi chảy.</p>
                </div>

                {speakingExams.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-12 rounded-3xl text-center text-slate-400 dark:text-slate-500">
                    <AlertCircle className="mx-auto text-slate-300 mb-2" size={32} />
                    <p className="text-xs">Hiện chưa có đề.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {speakingExams.map(exam => (
                      <div key={exam.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl flex flex-col justify-between hover:border-slate-200 transition-all shadow-sm">
                        <div className="space-y-3">
                          <span className="inline-block px-2 py-0.5 bg-slate-50 dark:bg-slate-800 text-slate-500 border border-slate-100 dark:border-slate-700 rounded text-[9px] font-extrabold uppercase tracking-wide">
                            Speaking
                          </span>
                          <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-sm leading-snug line-clamp-2 h-10">{exam.title}</h4>
                          <div className="flex items-center gap-4 text-[11px] text-slate-400">
                            <span className="flex items-center gap-1"><Clock size={12} /> {exam.duration} mins</span>
                          </div>
                        </div>
                        <div className="border-t border-slate-50 dark:border-slate-800 pt-3.5 mt-4 flex items-center justify-between">
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase">{exam.difficulty || 'medium'}</span>
                          <button 
                            onClick={() => handleStartPractice(exam)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm"
                          >
                            Start
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ================= FULL TEST EXAMS LIST ================= */}
            {activeTab === 'full-test' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Full Mock Exams</h3>
                  <p className="text-xs text-slate-500">Mô phỏng 100% quy trình thi thật IELTS Listening, Reading, Writing.</p>
                </div>

                {fullExams.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-12 rounded-3xl text-center text-slate-400 dark:text-slate-500">
                    <AlertCircle className="mx-auto text-slate-300 mb-2" size={32} />
                    <p className="text-xs">Hiện chưa có đề.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {fullExams.map(exam => (
                      <div key={exam.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-2xl hover:border-slate-200 transition-all shadow-sm flex flex-col justify-between">
                        <div className="space-y-3 text-left">
                          <span className="px-2.5 py-0.5 bg-red-50 dark:bg-red-950 text-red-600 rounded text-[9px] font-extrabold uppercase tracking-wider inline-block">
                            Mock Real Test
                          </span>
                          <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-base leading-snug">{exam.title}</h4>
                          <p className="text-xs text-slate-400 leading-normal">
                            Đề thi bao gồm 3 phần thi liên tiếp kéo dài khoảng 2 giờ 40 phút. Hãy chuẩn bị không gian yên tĩnh trước khi bắt đầu.
                          </p>
                          <div className="flex items-center gap-4 text-xs text-slate-400">
                            <span className="flex items-center gap-1 font-mono font-bold text-blue-600"><Clock size={13} /> {exam.duration} mins</span>
                            <span>•</span>
                            <span>{language === 'vi' ? 'Độ khó:' : 'Difficulty:'} <strong className="uppercase text-slate-700 dark:text-slate-300">{exam.difficulty || 'medium'}</strong></span>
                          </div>
                        </div>

                        <div className="border-t border-slate-50 dark:border-slate-800 pt-4 mt-6 flex justify-end">
                          <button
                            onClick={() => handleStartFullTest(exam)}
                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/10"
                          >
                            Start Full Test
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ================= MY VOCABULARY LIBRARY ================= */}
            {activeTab === 'my-vocabulary' && (
              <div className="animate-fade-in">
                <VocabularyLibrary
                  vocabList={vocabList}
                  onAddVocab={handleAddVocab}
                  onDeleteVocab={handleDeleteVocab}
                  onToggleFavorite={handleToggleFavoriteVocab}
                  language={language}
                />
              </div>
            )}

            {/* ================= MY CLASS EXAM ASSIGNMENTS ================= */}
            {activeTab === 'my-class' && belongsToClass && (
              <div className="space-y-6 animate-fade-in text-left">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div>
                    <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">
                      Lớp Học Của Tôi: <span className="text-blue-600 dark:text-blue-400">{studentClasses[0].name}</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Danh sách thành viên lớp học và các bài tập được giảng viên giao trực tiếp.</p>
                  </div>

                  {/* Dual Tab navigation */}
                  <div className="flex bg-slate-100/80 dark:bg-slate-900 p-1 rounded-xl border border-slate-200/50 dark:border-slate-800 shrink-0">
                    <button
                      onClick={() => setClassSubTab('members')}
                      className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                        classSubTab === 'members'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                    >
                      <span>👥 {language === 'vi' ? 'Thành viên lớp' : 'Class Members'}</span>
                    </button>
                    <button
                      onClick={() => setClassSubTab('homework')}
                      className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                        classSubTab === 'homework'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                    >
                      <span>📚 {language === 'vi' ? 'Bài tập được giao' : 'Assignments'}</span>
                    </button>
                  </div>
                </div>

                {classSubTab === 'members' ? (
                  /* SUB-TAB 1: CLASS MEMBERS LIST */
                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                          <th className="px-5 py-3.5">{language === 'vi' ? 'Họ và tên' : 'Full Name'}</th>
                          <th className="px-5 py-3.5">{language === 'vi' ? 'Email' : 'Email'}</th>
                          <th className="px-5 py-3.5">{language === 'vi' ? 'Số điện thoại' : 'Phone'}</th>
                          <th className="px-5 py-3.5">{language === 'vi' ? 'Vai trò' : 'Role'}</th>
                          <th className="px-5 py-3.5 text-right">{language === 'vi' ? 'Trạng thái' : 'Status'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50 text-xs text-slate-700 dark:text-slate-300 font-medium">
                        {allUsers.filter(u => u.role === 'student' && studentClasses[0].studentIds.includes(u.id)).map((member) => (
                          <tr key={member.id} className="hover:bg-slate-50/20">
                            <td className="px-5 py-3.5 flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center text-[11px]">
                                {member.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-bold text-slate-800 dark:text-slate-100">
                                {member.name} {member.id === currentUser.id && (
                                  <span className="text-[10px] font-medium text-blue-500 bg-blue-50 dark:bg-blue-950/30 px-1.5 py-0.2 rounded-md ml-1">
                                    {language === 'vi' ? 'Bạn' : 'You'}
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-slate-500 font-mono">{member.email}</td>
                            <td className="px-5 py-3.5 text-slate-500 font-mono">{member.phone}</td>
                            <td className="px-5 py-3.5">
                              <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                                {language === 'vi' ? 'Học viên' : 'Student'}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                {language === 'vi' ? 'Đang học' : 'Active'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* SUB-TAB 2: ASSIGNED HOMEWORK TABLE */
                  studentAssignments.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-12 rounded-2xl text-center text-slate-400 dark:text-slate-500 text-xs">
                      Chưa có bài tập nào được giao cho bạn.
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                            <th className="px-5 py-3.5">Tên bài tập</th>
                            <th className="px-5 py-3.5">Phần thi</th>
                            <th className="px-5 py-3.5">Ngày giao</th>
                            <th className="px-5 py-3.5">Hạn nộp</th>
                            <th className="px-5 py-3.5">Trạng thái</th>
                            <th className="px-5 py-3.5 text-right">Hành động</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50 text-xs text-slate-700 dark:text-slate-300 font-medium">
                          {studentAssignments.map(assign => {
                            const matchingExam = exams.find(e => e.id === assign.examId);
                            const submission = assign.submissions?.find(s => s.studentId === currentUser.id);
                            const isDone = submission?.status === 'done';

                            return (
                              <tr key={assign.id} className="hover:bg-slate-50/20">
                                <td className="px-5 py-3.5">
                                  <span className="font-bold text-slate-800 dark:text-slate-100 block">{assign.title}</span>
                                </td>
                                <td className="px-5 py-3.5 uppercase text-[10px] text-slate-400 font-bold">{assign.type}</td>
                                <td className="px-5 py-3.5 text-slate-500">{assign.createdAt}</td>
                                <td className="px-5 py-3.5 text-slate-500 font-bold">{assign.deadline}</td>
                                <td className="px-5 py-3.5">
                                  {isDone ? (
                                    <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                                      Band {submission.score}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 text-amber-700 dark:text-amber-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                                      Chưa làm
                                    </span>
                                  )}
                                </td>
                                <td className="px-5 py-3.5 text-right">
                                  {isDone ? (
                                    <span className="text-slate-400 font-semibold text-[11px] block">{language === 'vi' ? 'Đã nộp bài' : 'Submitted'}</span>
                                  ) : (
                                    matchingExam && (
                                      <button 
                                        onClick={() => handleStartPractice(matchingExam, assign)}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm shadow-blue-500/10 cursor-pointer"
                                      >
                                        Làm bài
                                      </button>
                                    )
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                )}
              </div>
            )}

            <Footer language={language} />
          </main>
        </div>
      )}

      {/* Floating Theme Toggler (Bottom Right Corner) */}
      {!takingExam && (
        <div className="fixed bottom-4 right-4 z-40 flex items-center bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-1.5 shadow-xl hover:scale-105 transition-all duration-200">
          <button
            onClick={() => setTheme('light')}
            title={language === 'vi' ? 'Chế độ Sáng' : 'Light Mode'}
            className={`p-2 rounded-xl transition-all cursor-pointer ${
              theme === 'light'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Sun size={14} className="font-extrabold" />
          </button>
          <button
            onClick={() => setTheme('dark')}
            title={language === 'vi' ? 'Chế độ Tối' : 'Dark Mode'}
            className={`p-2 rounded-xl transition-all cursor-pointer ${
              theme === 'dark'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Moon size={14} className="font-extrabold" />
          </button>
        </div>
      )}

      {/* Account Details Card (Bottom Left Corner) */}
      {!takingExam && (
        <div className="fixed bottom-4 left-4 z-40 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 p-3 rounded-2xl shadow-xl flex items-center justify-between gap-3 min-w-[220px] sm:min-w-[240px] max-w-[280px] hover:shadow-2xl transition-all duration-200">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-extrabold flex items-center justify-center text-xs shadow-sm shrink-0">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div className="text-left overflow-hidden">
              <div className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">{currentUser.name}</div>
              <div className="text-[10px] text-slate-400 font-semibold truncate leading-tight mt-0.5">{currentUser.email}</div>
            </div>
          </div>
          <button
            onClick={onLogout}
            title={language === 'vi' ? 'Đăng xuất' : 'Logout'}
            className="p-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-600 rounded-xl transition-all shrink-0 cursor-pointer"
          >
            <LogOut size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
