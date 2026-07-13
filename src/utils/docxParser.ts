// Custom Parser for IELTS Word Documents (.docx)
// Supports tags: THÔNG TIN ĐỀ, SECTION, PASSAGE, QUESTION GROUP, QUESTION TYPE, QUESTION, ANSWER, TRANSCRIPT, VOCABULARY

export interface ParsedQuestion {
  number: number;
  text: string;
  options?: string[];
  answer?: string;
  explanation?: string;
}

export interface ParsedQuestionGroup {
  range: string;
  type: string;
  instruction: string;
  questions: ParsedQuestion[];
}

export interface ParsedPassage {
  title: string;
  content: string;
  translation?: string;
  vocabulary?: string;
}

export interface ParsedSection {
  id: string; // e.g., SECTION 1
  title?: string;
  passages: ParsedPassage[];
  questionGroups: ParsedQuestionGroup[];
  transcript?: string;
  translation?: string;
  vocabulary?: string;
}

export interface ParsedVocabulary {
  word: string;
  definition: string;
}

export interface ParsedExamData {
  info: {
    title: string;
    code: string;
    skill: string;
    difficulty: string;
    timeLimit: number;
    description: string;
  };
  sections: ParsedSection[];
  vocabulary: ParsedVocabulary[];
}

export interface ParserError {
  line: number;
  message: string;
  context: string;
}

export interface ParserResult {
  success: boolean;
  data?: ParsedExamData;
  error?: ParserError;
}

export function parseIELTSDocumentText(text: string): ParserResult {
  const lines = text.split(/\r?\n/);
  
  const data: ParsedExamData = {
    info: {
      title: '',
      code: '',
      skill: 'listening',
      difficulty: 'Medium',
      timeLimit: 40,
      description: ''
    },
    sections: [],
    vocabulary: []
  };

  let currentState: 'NONE' | 'INFO' | 'SECTION' | 'PASSAGE' | 'QUESTION_GROUP' | 'TRANSCRIPT' | 'VOCABULARY' | 'TRANSLATION' | 'EXPLANATION' = 'NONE';
  let currentSection: ParsedSection | null = null;
  let currentPassage: ParsedPassage | null = null;
  let currentGroup: ParsedQuestionGroup | null = null;
  let answersMap = new Map<number, { text: string; explanation?: string }>();
  let lastQuestionNumber = 0;

  // For verifying missing answers
  const declaredQuestions = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    // Strip zero-width spaces, replace non-breaking spaces, then trim
    const line = rawLine
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\u00A0/g, ' ')
      .trim();
    const lineNum = i + 1;

    if (!line) {
      // Accumulate blank lines for formatting if we are in PASSAGE or TRANSCRIPT
      if (currentState === 'PASSAGE' && currentPassage) {
        currentPassage.content += '\n';
      } else if (currentState === 'TRANSCRIPT' && currentSection) {
        currentSection.transcript = (currentSection.transcript || '') + '\n';
      } else if (currentState === 'TRANSLATION') {
        if (currentPassage) {
          currentPassage.translation = (currentPassage.translation || '') + '\n';
        } else if (currentSection) {
          currentSection.translation = (currentSection.translation || '') + '\n';
        }
      }
      continue;
    }

    // Detect main section tags
    const upperLine = line.toUpperCase();

    if (upperLine.startsWith('THÔNG TIN ĐỀ') || upperLine.startsWith('THONG TIN DE') || upperLine.startsWith('EXAM INFO') || upperLine.startsWith('INFORMATION')) {
      currentState = 'INFO';
      continue;
    }

    if (upperLine.startsWith('SECTION') || upperLine.startsWith('PHẦN') || upperLine.startsWith('PHAN')) {
      currentState = 'SECTION';
      const secId = line; // Maintain original casing or format, e.g. "SECTION 1"
      currentSection = {
        id: secId,
        passages: [],
        questionGroups: []
      };
      data.sections.push(currentSection);
      currentPassage = null;
      currentGroup = null;
      continue;
    }

    if (upperLine.startsWith('PASSAGE') || upperLine.startsWith('BÀI ĐỌC') || upperLine.startsWith('BAI DOC')) {
      if (!currentSection) {
        // Auto-create a default section instead of crashing
        currentSection = {
          id: 'SECTION 1',
          passages: [],
          questionGroups: []
        };
        data.sections.push(currentSection);
      }
      currentState = 'PASSAGE';
      const title = line
        .replace(/^(?:[Pp]assage|[Bb]ài\s+đọc|[Bb]ai\s+doc)(?:\s*(?:số|so))?\s*\d+[\s.:\-]*\s*/i, '')
        .trim() || 'Untitled Passage';
      currentPassage = {
        title,
        content: ''
      };
      currentSection.passages.push(currentPassage);
      currentGroup = null;
      continue;
    }

    const isQuestionGroup = upperLine.startsWith('QUESTION GROUP') || 
                            upperLine.startsWith('NHÓM CÂU HỎI') || 
                            upperLine.startsWith('NHOM CAU HOI') ||
                            /^(?:QUESTIONS|CÂU|CAU|NHÓM|NHOM)\s*\d+\s*[-–—]\s*\d+/i.test(line);
    if (isQuestionGroup) {
      if (!currentSection) {
        // Auto-create a default section instead of crashing
        currentSection = {
          id: 'SECTION 1',
          passages: [],
          questionGroups: []
        };
        data.sections.push(currentSection);
      }
      currentState = 'QUESTION_GROUP';
      // Extract range like "1-10" or "Questions 1-5"
      const rangeMatch = line.match(/(\d+)\s*[-–—]\s*(\d+)/);
      const range = rangeMatch ? `${rangeMatch[1]}-${rangeMatch[2]}` : line.replace(/^[Qq]uestion\s+[Gg]roup:?\s*/i, '').trim() || '1-10';
      
      currentGroup = {
        range,
        type: 'Sentence Completion', // Default
        instruction: '',
        questions: []
      };
      currentSection.questionGroups.push(currentGroup);
      continue;
    }

    if (upperLine.startsWith('TRANSCRIPT') || upperLine.startsWith('BÀI NGHE') || upperLine.startsWith('BAI NGHE')) {
      if (!currentSection) {
        // Auto-create a default section instead of crashing
        currentSection = {
          id: 'SECTION 1',
          passages: [],
          questionGroups: []
        };
        data.sections.push(currentSection);
      }
      currentState = 'TRANSCRIPT';
      currentSection.transcript = '';
      currentPassage = null;
      currentGroup = null;
      continue;
    }

    if (upperLine.startsWith('TRANSLATION') || upperLine.startsWith('BẢN DỊCH') || upperLine.startsWith('BAN DICH')) {
      currentState = 'TRANSLATION';
      currentGroup = null;
      continue;
    }

    if (upperLine.startsWith('VOCABULARY') || upperLine.startsWith('TỪ VỰNG') || upperLine.startsWith('TU VUNG')) {
      currentState = 'VOCABULARY';
      currentGroup = null;
      continue;
    }

    if (upperLine.startsWith('EXPLANATION') || upperLine.startsWith('GIẢI THÍCH') || upperLine.startsWith('GIAI THICH')) {
      currentState = 'EXPLANATION';
      currentGroup = null;
      continue;
    }

    // Handle states
    if (currentState === 'INFO') {
      const parts = line.split(':');
      if (parts.length >= 2) {
        const key = parts[0].trim().toUpperCase();
        const val = parts.slice(1).join(':').trim();
        
        if (key.includes('TÊN ĐỀ') || key.includes('TEN DE') || key.includes('TITLE')) {
          data.info.title = val;
        } else if (key.includes('MÃ ĐỀ') || key.includes('MA DE') || key.includes('CODE')) {
          data.info.code = val;
        } else if (key.includes('KỸ NĂNG') || key.includes('KY NANG') || key.includes('SKILL')) {
          data.info.skill = val.toLowerCase();
        } else if (key.includes('ĐỘ KHÓ') || key.includes('DO KHO') || key.includes('DIFFICULTY')) {
          data.info.difficulty = val;
        } else if (key.includes('THỜI GIAN') || key.includes('THOI GIAN') || key.includes('TIME')) {
          data.info.timeLimit = parseInt(val) || 40;
        } else if (key.includes('MÔ TẢ') || key.includes('MO TA') || key.includes('DESCRIPTION')) {
          data.info.description = val;
        }
      } else if (data.info.description) {
        // Multi-line description support
        data.info.description += '\n' + line;
      }
      continue;
    }

    if (currentState === 'PASSAGE') {
      if (currentPassage) {
        currentPassage.content += (currentPassage.content ? '\n' : '') + rawLine;
      }
      continue;
    }

    if (currentState === 'TRANSCRIPT') {
      if (currentSection) {
        currentSection.transcript += (currentSection.transcript ? '\n' : '') + rawLine;
      }
      continue;
    }

    if (currentState === 'TRANSLATION') {
      if (currentPassage) {
        currentPassage.translation = (currentPassage.translation || '') + (currentPassage.translation ? '\n' : '') + rawLine;
      } else if (currentSection) {
        currentSection.translation = (currentSection.translation || '') + (currentSection.translation ? '\n' : '') + rawLine;
      }
      continue;
    }

    if (currentState === 'VOCABULARY') {
      // Expecting formats like: "- word: definition" or "word - definition"
      const cleaned = line.replace(/^-\s*/, '');
      const parts = cleaned.split(/[:\-]/);
      if (parts.length >= 2) {
        const vocabWord = cleanVocabularyWord(parts[0]);
        if (vocabWord) {
          data.vocabulary.push({
            word: vocabWord,
            definition: parts.slice(1).join(':').trim()
          });
        }
      }
      
      // Also append to active passage or section vocabulary text for display
      if (currentPassage) {
        currentPassage.vocabulary = (currentPassage.vocabulary || '') + (currentPassage.vocabulary ? '\n' : '') + rawLine;
      } else if (currentSection) {
        currentSection.vocabulary = (currentSection.vocabulary || '') + (currentSection.vocabulary ? '\n' : '') + rawLine;
      }
      continue;
    }

    if (currentState === 'EXPLANATION') {
      const match = line.match(/^(?:Question|Câu|Cau|Q|q)?\s*(\d+)[\s.:\)\-–—\/]*\s*(.*)/i);
      if (match) {
        lastQuestionNumber = parseInt(match[1]);
        const expText = match[2].trim();
        const existing = answersMap.get(lastQuestionNumber) || { text: '' };
        existing.explanation = expText;
        answersMap.set(lastQuestionNumber, existing);
      } else if (lastQuestionNumber > 0) {
        const existing = answersMap.get(lastQuestionNumber);
        if (existing) {
          existing.explanation = (existing.explanation || '') + (existing.explanation ? '\n' : '') + line;
          answersMap.set(lastQuestionNumber, existing);
        }
      }
      continue;
    }

    if (currentState === 'QUESTION_GROUP') {
      const upperLine = line.toUpperCase();
      
      // Look for QUESTION TYPE or DẠNG CÂU HỎI
      const isQuestionTypeLine = upperLine.startsWith('QUESTION TYPE') || 
                                 upperLine.startsWith('DẠNG CÂU HỎI') || 
                                 upperLine.startsWith('DANG CAU HOI') ||
                                 upperLine.startsWith('LOẠI CÂU HỎI') ||
                                 upperLine.startsWith('LOAI CAU HOI') ||
                                 upperLine.startsWith('DẠNG BÀI') ||
                                 upperLine.startsWith('DANG BAI') ||
                                 upperLine.startsWith('LOẠI BÀI') ||
                                 upperLine.startsWith('LOAI BAI');
      if (isQuestionTypeLine) {
        if (currentGroup) {
          const parts = line.split(':');
          let parsedType = '';
          if (parts.length >= 2) {
            parsedType = parts.slice(1).join(':').trim();
          } else {
            parsedType = line.replace(/^(?:QUESTION TYPE|DẠNG CÂU HỎI|DANG CAU HOI|LOẠI CÂU HỎI|LOAI CAU HOI|DẠNG BÀI|DANG BAI|LOẠI BÀI|LOAI BAI)[:\s]*/i, '').trim();
          }
          
          // If no type was found on the same line, peek at the next non-empty line
          if (!parsedType) {
            for (let j = i + 1; j < Math.min(lines.length, i + 5); j++) {
              const peekLine = lines[j].trim();
              if (!peekLine) continue;
              if (peekLine.toUpperCase().startsWith('SECTION') || 
                  peekLine.toUpperCase().startsWith('QUESTION GROUP') || 
                  peekLine.toUpperCase().startsWith('QUESTION') || 
                  peekLine.toUpperCase().startsWith('CÂU') || 
                  peekLine.toUpperCase().startsWith('CAU') || 
                  peekLine.toUpperCase().startsWith('ANSWER') || 
                  peekLine.toUpperCase().startsWith('PASSAGE') || 
                  peekLine.toUpperCase().startsWith('TRANSCRIPT') || 
                  peekLine.toUpperCase().startsWith('VOCABULARY')) {
                break;
              }
              parsedType = peekLine;
              break;
            }
          }
          
          if (parsedType) {
            currentGroup.type = parsedType;
          }
        }
        continue;
      }

      // Look for QUESTION (e.g. QUESTION 1, CÂU 1, CAU 1, Q1, 1., 1/, 1:) or standalone QUESTION label
      let qNum: number | null = null;
      let qText = '';

      const isStandaloneQuestionLabel = /^(?:QUESTION|CÂU|CAU)[:\s\-\/.]*$/i.test(line);

      if (isStandaloneQuestionLabel) {
        lastQuestionNumber = lastQuestionNumber + 1;
        qNum = lastQuestionNumber;
        
        // Peek ahead to find the question text
        let foundText = '';
        let nextIdx = i + 1;
        while (nextIdx < lines.length) {
          const peekLine = lines[nextIdx].trim();
          if (peekLine) {
            const upperPeek = peekLine.toUpperCase();
            if (upperPeek.startsWith('SECTION') || 
                upperPeek.startsWith('QUESTION') || 
                upperPeek.startsWith('CÂU') || 
                upperPeek.startsWith('CAU') || 
                upperPeek.startsWith('ANSWER') || 
                upperPeek.startsWith('ĐÁP') || 
                upperPeek.startsWith('DAP') || 
                upperPeek.startsWith('PASSAGE') || 
                upperPeek.startsWith('TRANSCRIPT') || 
                upperPeek.startsWith('VOCABULARY')) {
              break;
            }
            foundText = peekLine;
            i = nextIdx; // Consume this line
            break;
          }
          nextIdx++;
        }
        qText = foundText;
      } else {
        const qWithPrefixMatch = line.match(/^(?:QUESTION|CÂU|CAU|Q)\s*(\d+)[\s.:\)\-–—\/]*\s*(.*)/i);
        const qRawNumberMatch = line.match(/^(\d+)[\s.:\)\-–—\/]+\s*(.*)/) || line.match(/^\[(\d+)\]\s*(.*)/);

        if (qWithPrefixMatch) {
          qNum = parseInt(qWithPrefixMatch[1]);
          qText = qWithPrefixMatch[2].trim();
        } else if (qRawNumberMatch) {
          qNum = parseInt(qRawNumberMatch[1]);
          qText = qRawNumberMatch[2].trim();
        }

        if (qNum !== null) {
          lastQuestionNumber = Math.max(lastQuestionNumber, qNum);
        }
      }

      if (qNum !== null) {
        if (!currentGroup) {
          return {
            success: false,
            error: {
              line: lineNum,
              message: 'Tìm thấy QUESTION nhưng không nằm trong QUESTION GROUP nào!',
              context: line
            }
          };
        }

        // If qText is empty, peek and consume the next non-empty line
        if (!qText) {
          let nextIdx = i + 1;
          while (nextIdx < lines.length) {
            const peekLine = lines[nextIdx].trim();
            if (peekLine) {
              const upperPeek = peekLine.toUpperCase();
              if (upperPeek.startsWith('SECTION') || 
                  upperPeek.startsWith('QUESTION') || 
                  upperPeek.startsWith('CÂU') || 
                  upperPeek.startsWith('CAU') || 
                  upperPeek.startsWith('ANSWER') || 
                  upperPeek.startsWith('ĐÁP') || 
                  upperPeek.startsWith('DAP') || 
                  upperPeek.startsWith('PASSAGE') || 
                  upperPeek.startsWith('TRANSCRIPT') || 
                  upperPeek.startsWith('VOCABULARY')) {
                break;
              }
              qText = peekLine;
              i = nextIdx; // Consume this line
              break;
            }
            nextIdx++;
          }
        }

        const newQ: ParsedQuestion = {
          number: qNum,
          text: qText || `Câu hỏi số ${qNum}`,
          options: []
        };
        currentGroup.questions.push(newQ);
        declaredQuestions.add(qNum);
        continue;
      }

      // Look for Option lines (A. Option A, B. Option B)
      const optionMatch = line.match(/^([A-F])[\s.)\-\/:]+\s*(.*)/i);
      if (optionMatch && currentGroup && currentGroup.questions.length > 0) {
        const lastQ = currentGroup.questions[currentGroup.questions.length - 1];
        lastQ.options = lastQ.options || [];
        lastQ.options.push(line);
        continue;
      }

      // Look for EXPLANATION or GIẢI THÍCH or GIAI THICH lines
      const isExplanationLine = /^(?:EXPLANATION|GIẢI\s*THÍCH|GIAI\s*THICH|EXPLAIN|EXPL)(?:\s*CÂU|\s*CAU)?\s*(\d+)?/i.test(line);
      if (isExplanationLine) {
        let expNum: number | null = null;
        let expText = '';

        const match = line.match(/^(?:EXPLANATION|GIẢI\s*THÍCH|GIAI\s*THICH|EXPLAIN|EXPL)(?:\s*CÂU|\s*CAU)?\s*(\d+)[\s.:\)\-–—\/]*\s*(.*)/i);
        if (match) {
          expNum = parseInt(match[1]);
          expText = match[2].trim();
        } else {
          expNum = lastQuestionNumber;
        }

        // If expText is empty, peek and consume the next non-empty line
        if (!expText && expNum !== null) {
          let nextIdx = i + 1;
          while (nextIdx < lines.length) {
            const peekLine = lines[nextIdx].trim();
            if (peekLine) {
              const upperPeek = peekLine.toUpperCase();
              if (upperPeek.startsWith('SECTION') || 
                  upperPeek.startsWith('QUESTION') || 
                  upperPeek.startsWith('CÂU') || 
                  upperPeek.startsWith('CAU') || 
                  upperPeek.startsWith('ANSWER') || 
                  upperPeek.startsWith('ĐÁP') || 
                  upperPeek.startsWith('DAP') || 
                  upperPeek.startsWith('EXPLANATION') || 
                  upperPeek.startsWith('GIẢI THÍCH') || 
                  upperPeek.startsWith('GIAI THICH') || 
                  upperPeek.startsWith('PASSAGE') || 
                  upperPeek.startsWith('TRANSCRIPT') || 
                  upperPeek.startsWith('VOCABULARY')) {
                break;
              }
              expText = peekLine;
              i = nextIdx; // Consume this line
              break;
            }
            nextIdx++;
          }
        }

        if (expNum !== null && expNum > 0) {
          const existing = answersMap.get(expNum) || { text: '' };
          existing.explanation = expText;
          answersMap.set(expNum, existing);
        }
        continue;
      }

      // Look for ANSWER or standalone ANSWER label
      const isAnswerLine = /^(?:ANSWER|ĐÁP\s*ÁN|DAP\s*AN|ĐÁP\s*ÁN\s*CÂU|DAP\s*AN\s*CAU|ANS|KEY)/i.test(line);
      if (isAnswerLine) {
        let ansNum: number | null = null;
        let ansText = '';

        // Match numbered answer, e.g. ANSWER 1: TRUE
        const match = line.match(/^(?:ANSWER|ĐÁP\s*ÁN|DAP\s*AN|ĐÁP\s*ÁN\s*CÂU|DAP\s*AN\s*CAU|ANS|KEY)\s*(\d+)[\s.:\)\-–—\/]*\s*(.*)/i);
        if (match) {
          ansNum = parseInt(match[1]);
          ansText = match[2].trim();
        } else {
          // It's a standalone ANSWER label, e.g. ANSWER
          ansNum = lastQuestionNumber;
        }

        // If ansText is empty, peek and consume the next non-empty line
        if (!ansText && ansNum !== null) {
          let nextIdx = i + 1;
          while (nextIdx < lines.length) {
            const peekLine = lines[nextIdx].trim();
            if (peekLine) {
              const upperPeek = peekLine.toUpperCase();
              if (upperPeek.startsWith('SECTION') || 
                  upperPeek.startsWith('QUESTION') || 
                  upperPeek.startsWith('CÂU') || 
                  upperPeek.startsWith('CAU') || 
                  upperPeek.startsWith('ANSWER') || 
                  upperPeek.startsWith('ĐÁP') || 
                  upperPeek.startsWith('DAP') || 
                  upperPeek.startsWith('PASSAGE') || 
                  upperPeek.startsWith('TRANSCRIPT') || 
                  upperPeek.startsWith('VOCABULARY')) {
                break;
              }
              ansText = peekLine;
              i = nextIdx; // Consume this line
              break;
            }
            nextIdx++;
          }
        }

        if (ansNum !== null && ansNum > 0) {
          // Check for inline explanation
          let textOnly = ansText || 'No answer provided';
          let inlineExp = '';
          const inlineMatch = textOnly.match(/(?:\(|\[)\s*(?:explanation|giải\s*thích|giai\s*thich|explain|why)\s*[:\-]\s*(.*?)\s*(?:\)|\])/i);
          if (inlineMatch) {
            inlineExp = inlineMatch[1].trim();
            textOnly = textOnly.replace(inlineMatch[0], '').trim();
          }

          const existing = answersMap.get(ansNum) || { text: '' };
          existing.text = textOnly;
          if (inlineExp) {
            existing.explanation = inlineExp;
          }
          answersMap.set(ansNum, existing);
        }
        continue;
      }

      // If it's none of the above:
      if (currentGroup) {
        if (currentGroup.questions.length === 0) {
          // Accumulate instruction text
          if (!currentGroup.instruction) {
            currentGroup.instruction = line;
          } else {
            currentGroup.instruction += '\n' + line;
          }
        } else {
          // Append extra text to the last question if it's multi-line question text
          const lastQ = currentGroup.questions[currentGroup.questions.length - 1];
          lastQ.text += '\n' + line;
        }
      }
    }
  }

  // Post-parse check: Map answers to questions and verify completeness
  let missingAnswerQ: number | null = null;
  for (const qNum of declaredQuestions) {
    const ans = answersMap.get(qNum);
    if (!ans) {
      missingAnswerQ = qNum;
      break;
    }
  }

  if (missingAnswerQ !== null) {
    // Find the line index of that question to report
    let qLine = 1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toUpperCase().includes(`QUESTION ${missingAnswerQ}`) || lines[i].toUpperCase().includes(`CÂU ${missingAnswerQ}`) || lines[i].toUpperCase().includes(`CAU ${missingAnswerQ}`)) {
        qLine = i + 1;
        break;
      }
    }
    return {
      success: false,
      error: {
        line: qLine,
        message: `Thiếu đáp án cho Câu hỏi số ${missingAnswerQ} (Hãy bổ sung thẻ ANSWER ${missingAnswerQ}: <đáp án>)`,
        context: lines[qLine - 1] || `Question ${missingAnswerQ}`
      }
    };
  }

  // Attach the answers directly to the parsed question objects
  data.sections.forEach(sec => {
    sec.questionGroups.forEach(grp => {
      grp.questions.forEach(q => {
        const ans = answersMap.get(q.number);
        if (ans) {
          q.answer = ans.text;
          if (ans.explanation) {
            q.explanation = ans.explanation;
          }
        }
      });
    });
  });

  // Basic check: did we find any sections?
  if (data.sections.length === 0) {
    return {
      success: false,
      error: {
        line: 1,
        message: 'Đề thi không có phần thi nào! Vui lòng định nghĩa ít nhất một nhãn "SECTION 1" hoặc "SECTION 2".',
        context: lines[0] || ''
      }
    };
  }

  return {
    success: true,
    data
  };
}

// Generate standard default Word text templates for each skill type
export function getDefaultIELTSTemplateText(skill: string, title: string = 'Sample Practice Test', code: string = 'IELTS-TST-01'): string {
  if (skill === 'listening') {
    return `THÔNG TIN ĐỀ
Tên đề: ${title}
Mã đề: ${code}
Kỹ năng: listening
Độ khó: Medium
Thời gian: 40 phút
Mô tả: Bài luyện tập Listening tiêu chuẩn đầy đủ.

SECTION 1
QUESTION GROUP 1-5
QUESTION TYPE: Sentence Completion
Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.
Complete the travel reservation details.

QUESTION 1: Name of the traveler: Mr. James [1] _______________
QUESTION 2: Departure city: [2] _______________
QUESTION 3: Date of flight: [3] _______________ September
QUESTION 4: Seat preference: [4] _______________ seat
QUESTION 5: Total cost of ticket: £[5] _______________

ANSWER 1: Harrison
ANSWER 2: Sydney
ANSWER 3: 21st
ANSWER 4: window
ANSWER 5: 450

TRANSCRIPT
MAN: Travel booking services, Mr. Harrison speaking. How can I help you today?
WOMAN: Hello, I would like to confirm my booking to Sydney on the 21st of September.
MAN: Certainly, let me pull up your records. Yes, Mr. James Harrison...

VOCABULARY
- reservation: sự đặt chỗ (noun)
- confirm: xác nhận (verb)
- departure: sự khởi hành (noun)
`;
  } else if (skill === 'reading') {
    return `THÔNG TIN ĐỀ
Tên đề: ${title}
Mã đề: ${code}
Kỹ năng: reading
Độ khó: Medium
Thời gian: 60 phút
Mô tả: Bài thi Reading chuẩn hóa.

SECTION 1
PASSAGE 1: The Rise of Artificial Intelligence
Artificial Intelligence (AI) is transforming the landscape of modern education. By automating grading systems and delivering customized tutoring feedback, AI systems enable educators to focus on mentoring rather than administration. However, concerns regarding data privacy and the loss of interpersonal connection remain primary obstacles to widespread institutional integration.

QUESTION GROUP 1-5
QUESTION TYPE: True/False/Not Given
Do the following statements agree with the information given in Reading Passage 1?
Write TRUE if the statement agrees with the information, FALSE if it contradicts, or NOT GIVEN if there is no information.

QUESTION 1: AI helps teachers reduce their grading workload.
QUESTION 2: Educators completely dislike using AI in universities.
QUESTION 3: Data privacy is a minor concern in school AI deployments.

ANSWER 1: TRUE
ANSWER 2: FALSE
ANSWER 3: FALSE

VOCABULARY
- artificial: nhân tạo (adj)
- obstacle: trở ngại (noun)
- customized: tùy biến, cá nhân hóa (adj)
`;
  } else if (skill === 'writing') {
    return `THÔNG TIN ĐỀ
Tên đề: ${title}
Mã đề: ${code}
Kỹ năng: writing
Độ khó: Hard
Thời gian: 60 phút
Mô tả: Đề bài IELTS Writing Học thuật Task 1 & Task 2.

SECTION 1
QUESTION GROUP 1-1
QUESTION TYPE: Academic Writing Task 1
The chart below shows the percentage of energy generated from coal in three European countries from 2000 to 2020.
Summarize the information by selecting and reporting the main features, and make comparisons where relevant.
Write at least 150 words.

QUESTION 1: [Task 1 Prompt] Describe the energy source comparisons shown in the chart.

ANSWER 1: [Sample Band 8.0 Model Answer] The line graph compares the percentage of total electricity produced from coal in Sweden, Germany, and France between 2000 and 2020...

VOCABULARY
- electricity: điện năng (noun)
- compare: so sánh (verb)
- transition: sự chuyển dịch (noun)
`;
  } else if (skill === 'speaking') {
    return `THÔNG TIN ĐỀ
Tên đề: ${title}
Mã đề: ${code}
Kỹ năng: speaking
Độ khó: Medium
Thời gian: 15 phút
Mô tả: Đề phỏng vấn IELTS Speaking gồm Part 1, 2 và 3.

SECTION 1
QUESTION GROUP 1-3
QUESTION TYPE: Interview Q&A
Answer the examiner's speaking questions as naturally as possible.

QUESTION 1: Part 1 - What is your favorite hobby and why?
QUESTION 2: Part 2 - Describe a book you read recently that you found helpful.
QUESTION 3: Part 3 - Do you think technology will completely replace paper books?

ANSWER 1: My absolute favorite hobby is reading history books, because it teaches me...
ANSWER 2: Recently, I read Atomic Habits by James Clear. It has very practical tips...
ANSWER 3: I do not believe technology will fully replace printed books, because holding a real book...

VOCABULARY
- hobby: sở thích (noun)
- printed: được in ấn (adj)
- substitute: sự thay thế (noun)
`;
  }

  // Fallback Full Test
  return `THÔNG TIN ĐỀ
Tên đề: ${title}
Mã đề: ${code}
Kỹ năng: full
Độ khó: Hard
Thời gian: 140 phút
Mô tả: Full Test IELTS bao gồm các kỹ năng đầy đủ.

SECTION 1
QUESTION GROUP 1-10
QUESTION TYPE: Listening Section 1
QUESTION 1: Booking Reference: [1] _______________
ANSWER 1: BR-9988

VOCABULARY
- enrollment: sự tuyển sinh (noun)
`;
}

export function cleanVocabularyWord(rawWord: string): string {
  if (!rawWord) return '';
  let word = rawWord.trim();
  
  // 1. Remove list/bullets or numbers at the start (e.g. "- reservation", "1. confirm", "• departure")
  word = word.replace(/^[-*•\d+.\s]+/g, '');
  
  // 2. Remove IPA phonetics if written inside the word part, e.g. "reservation /ˌrez.əˈveɪ.ʃən/" -> "reservation"
  word = word.replace(/\/.*?\//g, '');
  
  // 3. Remove parts of speech in parentheses (e.g., "(noun)", "(v)", "(adj)", "(adverb)", "(adj.)", etc.)
  word = word.replace(/\((?:noun|verb|adj|adverb|adjective|pronoun|preposition|conjunction|interjection|n|v|adj|adv)\.?\)/i, '');
  
  // 4. Remove other parenthesized contents
  word = word.replace(/\(.*?\)/g, '');
  
  // 5. Clean any trailing or leading non-word symbols except space (like dashes, colons, dots)
  word = word.replace(/^[:\-.\s]+|[:\-.\s]+$/g, '');
  
  return word.trim();
}
