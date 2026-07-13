import React, { useState } from 'react';
import { BookOpen, Star, Trash2, Plus, Search, ChevronDown, ChevronUp, AlertCircle, Volume2 } from 'lucide-react';
import { VocabularyItem } from '../../types';

interface VocabularyLibraryProps {
  vocabList: VocabularyItem[];
  onAddVocab: (vocab: Omit<VocabularyItem, 'id' | 'userId' | 'dateAdded'>) => Promise<void>;
  onDeleteVocab: (id: string) => Promise<void>;
  onToggleFavorite: (item: VocabularyItem) => Promise<void>;
  language: 'vi' | 'en';
}

export default function VocabularyLibrary({
  vocabList,
  onAddVocab,
  onDeleteVocab,
  onToggleFavorite,
  language
}: VocabularyLibraryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [favoriteOnly, setFavoriteOnly] = useState(false);

  // Form states
  const [word, setWord] = useState('');
  const [ipa, setIpa] = useState('');
  const [pronunciation, setPronunciation] = useState('');
  const [meaning, setMeaning] = useState('');
  const [vietnameseMeaning, setVietnameseMeaning] = useState('');
  const [example, setExample] = useState('');
  const [collocation, setCollocation] = useState('');
  const [synonym, setSynonym] = useState('');
  const [source, setSource] = useState('');

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim()) return;

    await onAddVocab({
      word: word.trim(),
      ipa: ipa.trim() || undefined,
      pronunciation: pronunciation.trim() || undefined,
      meaning: meaning.trim() || undefined,
      vietnameseMeaning: vietnameseMeaning.trim() || undefined,
      example: example.trim() || undefined,
      collocation: collocation.trim() || undefined,
      synonym: synonym.trim() || undefined,
      source: source.trim() || undefined,
      favorite: false
    });

    // Reset
    setWord('');
    setIpa('');
    setPronunciation('');
    setMeaning('');
    setVietnameseMeaning('');
    setExample('');
    setCollocation('');
    setSynonym('');
    setSource('');
    setShowAddForm(false);
  };

  const filteredList = vocabList.filter(item => {
    const matchesSearch = item.word.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.vietnameseMeaning && item.vietnameseMeaning.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFavorite = !favoriteOnly || item.favorite;
    return matchesSearch && matchesFavorite;
  });

  const speak = (txt: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(txt);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <BookOpen className="text-blue-600" />
            <span>{language === 'vi' ? 'Sổ từ vựng của tôi' : 'My Vocabulary Notebook'}</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'vi'
              ? 'Lưu trữ và tra cứu từ vựng bạn đã tích lũy trong quá trình làm bài đọc và bài nghe.'
              : 'Store and search vocabulary words you collected while practicing reading and listening.'}
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-blue-500/10 self-start sm:self-center"
        >
          <Plus size={14} />
          {language === 'vi' ? 'Thêm từ mới' : 'Add New Word'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleFormSubmit} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 border-b border-slate-50 dark:border-slate-800 pb-2">
            {language === 'vi' ? 'Nhập thông tin từ mới' : 'Enter New Word Details'}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{language === 'vi' ? 'Từ vựng (Bắt buộc)' : 'Word (Required)'}</label>
              <input
                type="text"
                required
                value={word}
                onChange={e => setWord(e.target.value)}
                placeholder="e.g. Inevitable"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-850 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{language === 'vi' ? 'Phiên âm (IPA)' : 'IPA Transcription'}</label>
              <input
                type="text"
                value={ipa}
                onChange={e => setIpa(e.target.value)}
                placeholder="e.g. /ɪˈnev.ɪ.tə.bəl/"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-850 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{language === 'vi' ? 'Nghĩa tiếng Anh' : 'English Meaning'}</label>
              <input
                type="text"
                value={meaning}
                onChange={e => setMeaning(e.target.value)}
                placeholder="e.g. Certain to happen; unavoidable."
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-850 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{language === 'vi' ? 'Nghĩa tiếng Việt' : 'Vietnamese Meaning'}</label>
              <input
                type="text"
                value={vietnameseMeaning}
                onChange={e => setVietnameseMeaning(e.target.value)}
                placeholder="e.g. Không thể tránh khỏi, tất yếu"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-850 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{language === 'vi' ? 'Ví dụ' : 'Example Sentence'}</label>
              <textarea
                value={example}
                onChange={e => setExample(e.target.value)}
                placeholder="e.g. It was inevitable that there would be job losses."
                rows={2}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-850 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{language === 'vi' ? 'Cụm từ đi kèm (Collocation)' : 'Collocations'}</label>
              <input
                type="text"
                value={collocation}
                onChange={e => setCollocation(e.target.value)}
                placeholder="e.g. seem inevitable, practically inevitable"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-850 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{language === 'vi' ? 'Từ đồng nghĩa (Synonym)' : 'Synonyms'}</label>
              <input
                type="text"
                value={synonym}
                onChange={e => setSynonym(e.target.value)}
                placeholder="e.g. unavoidable, inescapable, fated"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-850 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{language === 'vi' ? 'Nguồn tham khảo (Source)' : 'Source'}</label>
              <input
                type="text"
                value={source}
                onChange={e => setSource(e.target.value)}
                placeholder="e.g. Reading Section 1 / Academic Test 1"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-850 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{language === 'vi' ? 'Liên kết phát âm' : 'Pronunciation link'}</label>
              <input
                type="text"
                value={pronunciation}
                onChange={e => setPronunciation(e.target.value)}
                placeholder="Audio pronunciation URL (optional)"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-850 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-lg text-xs font-bold transition-all"
            >
              {language === 'vi' ? 'Hủy' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all"
            >
              {language === 'vi' ? 'Lưu lại' : 'Save'}
            </button>
          </div>
        </form>
      )}

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder={language === 'vi' ? 'Tìm từ vựng hoặc nghĩa tiếng Việt...' : 'Search word or translation...'}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-700 dark:text-slate-300 shadow-sm"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto shrink-0">
          <button
            onClick={() => setFavoriteOnly(!favoriteOnly)}
            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              favoriteOnly
                ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50 text-amber-600 dark:text-amber-400'
                : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            <Star size={14} className={favoriteOnly ? 'fill-amber-500 text-amber-500' : ''} />
            <span>{language === 'vi' ? 'Yêu thích' : 'Favorites'}</span>
          </button>
        </div>
      </div>

      {/* Vocabulary List */}
      <div className="space-y-3">
        {filteredList.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400 dark:text-slate-500">
            <AlertCircle className="mx-auto text-slate-300 mb-2" size={32} />
            <p className="text-xs">
              {language === 'vi'
                ? 'Không tìm thấy từ vựng nào phù hợp.'
                : 'No vocabulary matches found.'}
            </p>
          </div>
        ) : (
          filteredList.map(item => {
            const isExpanded = expandedId === item.id;
            return (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 sm:p-5 transition-all shadow-sm hover:border-slate-200 dark:hover:border-slate-700"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onToggleFavorite(item)}
                      className="text-slate-300 hover:text-amber-500 transition-colors"
                    >
                      <Star size={18} className={item.favorite ? 'fill-amber-500 text-amber-500' : ''} />
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-base text-slate-800 dark:text-slate-100">{item.word}</h4>
                        <button
                          onClick={() => speak(item.word)}
                          className="text-slate-400 hover:text-blue-600 transition-colors"
                          title="Listen Pronunciation"
                        >
                          <Volume2 size={14} />
                        </button>
                        {item.ipa && (
                          <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded">
                            {item.ipa}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 font-medium">
                        {item.vietnameseMeaning || <span className="italic text-slate-400">{language === 'vi' ? 'Đang cập nhật.' : 'Updating...'}</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-400 dark:text-slate-500 transition-colors"
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(language === 'vi' ? 'Bạn có chắc chắn muốn xóa từ này?' : 'Are you sure you want to delete this word?')) {
                          onDeleteVocab(item.id);
                        }
                      }}
                      className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg text-rose-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="block font-bold text-slate-400 uppercase tracking-wider mb-1">{language === 'vi' ? 'Nghĩa chi tiết (English)' : 'English Meaning'}</span>
                      <p className="text-slate-700 dark:text-slate-300 font-medium">
                        {item.meaning || <span className="italic text-slate-400">{language === 'vi' ? 'Đang cập nhật.' : 'Updating...'}</span>}
                      </p>
                    </div>

                    <div>
                      <span className="block font-bold text-slate-400 uppercase tracking-wider mb-1">{language === 'vi' ? 'Nguồn tham khảo' : 'Reference Source'}</span>
                      <p className="text-slate-700 dark:text-slate-300 font-medium">
                        {item.source || <span className="italic text-slate-400">{language === 'vi' ? 'Đang cập nhật.' : 'Updating...'}</span>}
                      </p>
                    </div>

                    <div className="md:col-span-2">
                      <span className="block font-bold text-slate-400 uppercase tracking-wider mb-1">{language === 'vi' ? 'Ví dụ đặt câu' : 'Example Sentence'}</span>
                      <p className="text-slate-700 dark:text-slate-300 font-medium italic">
                        {item.example ? `"${item.example}"` : <span className="italic text-slate-400">{language === 'vi' ? 'Đang cập nhật.' : 'Updating...'}</span>}
                      </p>
                    </div>

                    <div>
                      <span className="block font-bold text-slate-400 uppercase tracking-wider mb-1">{language === 'vi' ? 'Cụm từ đi kèm (Collocation)' : 'Collocations'}</span>
                      <p className="text-slate-700 dark:text-slate-300 font-medium">
                        {item.collocation || <span className="italic text-slate-400">{language === 'vi' ? 'Đang cập nhật.' : 'Updating...'}</span>}
                      </p>
                    </div>

                    <div>
                      <span className="block font-bold text-slate-400 uppercase tracking-wider mb-1">{language === 'vi' ? 'Từ đồng nghĩa (Synonyms)' : 'Synonyms'}</span>
                      <p className="text-slate-700 dark:text-slate-300 font-medium">
                        {item.synonym || <span className="italic text-slate-400">{language === 'vi' ? 'Đang cập nhật.' : 'Updating...'}</span>}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
