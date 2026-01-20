import OpenAI from "openai";
import { storage } from "../storage";
import type { Assessment, ClinicWeeklyRecord, ClassVideo } from "@shared/schema";

const openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
const openaiBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

const openai = new OpenAI({
  apiKey: openaiApiKey,
  ...(openaiBaseUrl && { baseURL: openaiBaseUrl }),
});

export interface StudentDataSummary {
  studentId: string;
  studentName: string;
  school?: string;
  grade?: string;
  year: number;
  month: number;
  assessments: {
    className: string;
    scores: { date: string; score: number; maxScore: number }[];
    averageScore: number;
    trend: "improving" | "stable" | "declining";
  }[];
  attendance: {
    totalDays: number;
    presentDays: number;
    lateDays: number;
    absentDays: number;
    attendanceRate: number;
  };
  homework: {
    totalAssigned: number;
    completed: number;
    completionRate: number;
    byClass: { className: string; assigned: number; completed: number }[];
  };
  clinic: {
    comments: string[];
    progress: string[];
  };
  videoViewing: {
    totalViews: number;
    viewsByClass: { className: string; viewCount: number }[];
  };
  studyCafe: {
    totalHours: number;
    sessionsCount: number;
  };
}

export async function gatherStudentData(
  studentId: string,
  year: number,
  month: number
): Promise<StudentDataSummary> {
  const student = await storage.getUser(studentId);
  if (!student) {
    throw new Error("Student not found");
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const allAssessments = await storage.getAllAssessments();
  const studentAssessments = allAssessments.filter(
    (a: Assessment & { studentId?: string }) => a.studentId === studentId
  );

  const classGroups = new Map<string, { className: string; scores: { date: string; score: number; maxScore: number }[] }>();
  for (const assessment of studentAssessments) {
    if (assessment.createdAt) {
      const assessDate = new Date(assessment.createdAt);
      if (assessDate >= startDate && assessDate <= endDate) {
        const key = assessment.classId;
        if (!classGroups.has(key)) {
          classGroups.set(key, { className: assessment.className || "수업", scores: [] });
        }
        classGroups.get(key)!.scores.push({
          date: assessDate.toISOString().split("T")[0],
          score: assessment.score,
          maxScore: assessment.maxScore || 100,
        });
      }
    }
  }

  const assessmentData: StudentDataSummary["assessments"] = [];
  const groupValues = Array.from(classGroups.values());
  for (const group of groupValues) {
    if (group.scores.length > 0) {
      const avgScore = group.scores.reduce((sum: number, s: { score: number; maxScore: number }) => sum + (s.score / s.maxScore) * 100, 0) / group.scores.length;
      let trend: "improving" | "stable" | "declining" = "stable";
      if (group.scores.length >= 2) {
        const firstHalf = group.scores.slice(0, Math.floor(group.scores.length / 2));
        const secondHalf = group.scores.slice(Math.floor(group.scores.length / 2));
        const firstAvg = firstHalf.reduce((s: number, x: { score: number; maxScore: number }) => s + x.score / x.maxScore * 100, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((s: number, x: { score: number; maxScore: number }) => s + x.score / x.maxScore * 100, 0) / secondHalf.length;
        if (secondAvg > firstAvg + 5) trend = "improving";
        else if (secondAvg < firstAvg - 5) trend = "declining";
      }
      assessmentData.push({
        className: group.className,
        scores: group.scores,
        averageScore: Math.round(avgScore * 10) / 10,
        trend,
      });
    }
  }

  let presentDays = 0;
  let lateDays = 0;
  let totalDays = 0;
  const currentDate = new Date(startDate);
  while (currentDate <= endDate && currentDate <= new Date()) {
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0) {
      totalDays++;
      const dateStr = currentDate.toISOString().split("T")[0];
      const record = await storage.getAttendanceRecordByStudentAndDate(studentId, dateStr);
      if (record) {
        presentDays++;
        if (record.wasLate) lateDays++;
      }
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const clinicComments: string[] = [];
  const clinicProgress: string[] = [];
  const clinicStudentsList = await storage.getClinicStudentsGlobal();
  const studentClinic = clinicStudentsList.find((cs) => cs.studentId === studentId);
  if (studentClinic) {
    const records = await storage.getClinicWeeklyRecords(studentClinic.id);
    for (const rec of records) {
      if (rec.createdAt && new Date(rec.createdAt) >= startDate && new Date(rec.createdAt) <= endDate) {
        if (rec.clinicTeacherFeedback) clinicComments.push(rec.clinicTeacherFeedback);
        if (rec.progressNotes) clinicProgress.push(rec.progressNotes);
      }
    }
  }

  // Gather homework data
  const homeworkByClass = new Map<string, { className: string; assigned: number; completed: number }>();
  const allHomework = await storage.getAllHomework();
  const studentEnrollments = await storage.getStudentEnrollments(studentId);
  const enrolledClassIds = studentEnrollments.map(e => e.classId);
  
  for (const hw of allHomework) {
    // Skip if student is not enrolled in this class
    if (!enrolledClassIds.includes(hw.classId)) continue;
    if (!hw.dueDate) continue;
    
    // Include homework if it's for all students (studentId is null) or for this specific student
    if (hw.studentId !== null && hw.studentId !== studentId) continue;
    
    const dueDate = new Date(hw.dueDate);
    if (dueDate >= startDate && dueDate <= endDate) {
      const classInfo = await storage.getClass(hw.classId);
      const className = classInfo?.name || "수업";
      
      if (!homeworkByClass.has(hw.classId)) {
        homeworkByClass.set(hw.classId, { className, assigned: 0, completed: 0 });
      }
      
      const entry = homeworkByClass.get(hw.classId)!;
      entry.assigned++;
      
      const submission = await storage.getSubmissionByHomeworkAndStudent(hw.id, studentId);
      if (submission) {
        entry.completed++;
      }
    }
  }
  
  const homeworkByClassList = Array.from(homeworkByClass.values());
  const totalAssigned = homeworkByClassList.reduce((sum, h) => sum + h.assigned, 0);
  const totalCompleted = homeworkByClassList.reduce((sum, h) => sum + h.completed, 0);

  return {
    studentId,
    studentName: student.name,
    school: student.school || undefined,
    grade: student.grade || undefined,
    year,
    month,
    assessments: assessmentData,
    attendance: {
      totalDays,
      presentDays,
      lateDays,
      absentDays: totalDays - presentDays,
      attendanceRate: totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0,
    },
    homework: {
      totalAssigned,
      completed: totalCompleted,
      completionRate: totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0,
      byClass: homeworkByClassList,
    },
    clinic: {
      comments: clinicComments,
      progress: clinicProgress,
    },
    videoViewing: {
      totalViews: 0,
      viewsByClass: [],
    },
    studyCafe: {
      totalHours: 0,
      sessionsCount: 0,
    },
  };
}

export async function generateReportWithAI(data: StudentDataSummary, customInstructions?: string): Promise<string> {
  const prompt = buildReportPrompt(data, customInstructions);
  
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-nano",
    messages: [
      {
        role: "system",
        content: `당신은 수학 학원 선생님입니다. 학부모에게 보내는 월간 학습 보고서를 작성합니다.

작성 지침:
- 반드시 "안녕하세요. 수학의 깊이를 배우는 프라임수학입니다."로 시작합니다.
- 그 다음 줄에 "[이름] 학생의 [월]월 학습한 부분에 대해 안내드립니다."라고 작성합니다.
- 학생을 지칭할 때 "학생"이 아닌, 성을 뺀 이름(예: 김철수 → 철수)으로 지칭합니다. 학생 정보에 표시된 "이름"을 사용하세요.
- "님"을 붙이지 않습니다. 학생은 선생님보다 어리기 때문에 이름만 사용합니다. (예: "철수가", "철수는" O, "철수님" X)
- 따뜻하고 격려하는 톤으로 작성하되, 객관적인 사실에 기반합니다.
- 500-700자 정도로 충분히 상세하게 작성합니다.
- 가독성을 위해 문단을 나누고 줄바꿈을 적극 활용합니다.
- 각 주제(출석, 숙제, 평가, 종합 코멘트)를 구분하여 작성합니다.
- 이모지는 사용하지 않습니다.
- 마지막에 다음 달 목표나 격려의 말로 마무리합니다.
- 중요: "학교생활", "학교"라는 단어를 절대 사용하지 않습니다. 우리는 학원입니다.
- "보고서를 드리게 되어 기쁩니다" 같은 어색한 표현은 사용하지 않습니다.`
      },
      {
        role: "user",
        content: prompt
      }
    ],
    max_completion_tokens: 2048,
  });

  return response.choices[0]?.message?.content || "";
}

export async function refineReportWithAI(content: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-nano",
    messages: [
      {
        role: "system",
        content: `당신은 문장 다듬기 전문가입니다. 

다듬기 지침:
- 주어진 학습 보고서를 더 자연스럽고 읽기 쉽게 다듬어 주세요.
- 내용의 핵심은 유지하면서, 문법을 교정하고 어색한 표현을 부드럽게 수정합니다.
- 가독성을 위해 문단을 적절히 나누고 줄바꿈을 활용합니다.
- 500-700자 정도의 상세한 보고서 형식을 유지합니다.
- 이모지는 사용하지 않습니다.`
      },
      {
        role: "user",
        content: `다음 학습 보고서 문자를 다듬어 주세요:\n\n${content}`
      }
    ],
    max_completion_tokens: 2048,
  });

  return response.choices[0]?.message?.content || content;
}

// Extract given name (first name without surname) from Korean name
function getGivenName(fullName: string): string {
  // Korean names are typically: 성(1자) + 이름(1-2자)
  // Remove first character (surname) to get given name
  if (fullName.length > 1) {
    return fullName.slice(1);
  }
  return fullName;
}

function buildReportPrompt(data: StudentDataSummary, customInstructions?: string): string {
  const lines: string[] = [];
  const givenName = getGivenName(data.studentName);
  
  lines.push(`학생 정보: ${data.studentName} (이름: ${givenName})`);
  if (data.school) lines.push(`학교: ${data.school}`);
  if (data.grade) lines.push(`학년: ${data.grade}`);
  lines.push(`보고 기간: ${data.year}년 ${data.month}월`);
  lines.push("");

  if (data.assessments.length > 0) {
    lines.push("## 평가 성적");
    for (const a of data.assessments) {
      lines.push(`- ${a.className}: 평균 ${a.averageScore}점 (${
        a.trend === "improving" ? "향상 중" : 
        a.trend === "declining" ? "하락 추세" : "안정적"
      })`);
    }
    lines.push("");
  }

  lines.push("## 출결 현황");
  lines.push(`- 수업일: ${data.attendance.totalDays}일`);
  lines.push(`- 출석: ${data.attendance.presentDays}일 (출석률 ${data.attendance.attendanceRate}%)`);
  if (data.attendance.lateDays > 0) {
    lines.push(`- 지각: ${data.attendance.lateDays}회`);
  }
  lines.push("");

  if (data.homework.totalAssigned > 0) {
    lines.push("## 숙제 완성도");
    lines.push(`- 총 배정: ${data.homework.totalAssigned}개`);
    lines.push(`- 제출 완료: ${data.homework.completed}개 (완성률 ${data.homework.completionRate}%)`);
    lines.push("");
  }

  if (data.clinic.comments.length > 0 || data.clinic.progress.length > 0) {
    lines.push("## 클리닉 피드백");
    for (const c of data.clinic.comments.slice(0, 3)) {
      lines.push(`- ${c}`);
    }
    for (const p of data.clinic.progress.slice(0, 2)) {
      lines.push(`- 진행: ${p}`);
    }
    lines.push("");
  }

  if (data.videoViewing.totalViews > 0) {
    lines.push("## 수업 영상 시청");
    lines.push(`- 총 시청 횟수: ${data.videoViewing.totalViews}회`);
    for (const v of data.videoViewing.viewsByClass.slice(0, 3)) {
      lines.push(`- ${v.className}: ${v.viewCount}회`);
    }
    lines.push("");
  }

  if (data.studyCafe.sessionsCount > 0) {
    lines.push("## 스터디카페 이용");
    lines.push(`- 총 이용 시간: ${data.studyCafe.totalHours}시간`);
    lines.push(`- 이용 횟수: ${data.studyCafe.sessionsCount}회`);
  }

  lines.push("");
  lines.push("위 정보를 바탕으로 학부모에게 보내는 따뜻하고 격려하는 월간 학습 보고서를 작성해주세요.");
  
  if (customInstructions && customInstructions.trim()) {
    lines.push("");
    lines.push("## 선생님 추가 요청사항");
    lines.push(customInstructions.trim());
  }

  return lines.join("\n");
}
