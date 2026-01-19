import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, date, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User roles (simplified hierarchy)
export const UserRole = {
  PRINCIPAL: 3,       // 원장 - Full system access + user management
  TEACHER: 2,         // 선생님 - Class management
  STUDENT: 1,         // 학생 - Learning activities
  KIOSK: -1,          // 출결 계정 - Attendance pad only (auto-redirects to /attendance-pad)
} as const;

export type UserRoleType = typeof UserRole[keyof typeof UserRole];

// Centers (학원 센터)
export const centers = pgTable("centers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
});

export const insertCenterSchema = createInsertSchema(centers).pick({ name: true });
export type InsertCenter = z.infer<typeof insertCenterSchema>;
export type Center = typeof centers.$inferSelect;

// Employment types for teachers (고용 형태)
export const EmploymentType = {
  REGULAR: "regular",      // 정규직
  PART_TIME: "part_time",  // 파트타임
  HOURLY: "hourly",        // 아르바이트
} as const;

export type EmploymentTypeValue = typeof EmploymentType[keyof typeof EmploymentType];

// Users (사용자)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  motherPhone: text("mother_phone"),
  fatherPhone: text("father_phone"),
  school: text("school"),
  grade: text("grade"),
  role: integer("role").notNull().default(1),
  linkedStudentIds: text("linked_student_ids").array(), // For parents: list of linked student IDs
  homeroomTeacherId: varchar("homeroom_teacher_id"), // 담임 선생님 ID
  employmentType: text("employment_type"), // 고용 형태: regular, part_time, hourly (선생님만 사용)
  dailyRate: integer("daily_rate"), // 일급 (아르바이트 선생님용, 원 단위)
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  phone: true,
  motherPhone: true,
  fatherPhone: true,
  school: true,
  grade: true,
  role: true,
  linkedStudentIds: true,
  homeroomTeacherId: true,
  employmentType: true,
  dailyRate: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// User-Center relationship (N:M)
export const userCenters = pgTable("user_centers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  centerId: varchar("center_id").notNull(),
});

export const insertUserCenterSchema = createInsertSchema(userCenters).pick({
  userId: true,
  centerId: true,
});
export type InsertUserCenter = z.infer<typeof insertUserCenterSchema>;
export type UserCenter = typeof userCenters.$inferSelect;

// Schedule slot for day-specific times
export type ScheduleSlot = {
  day: string;      // 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'
  startTime: string; // '14:00'
  endTime: string;   // '16:00'
};

// Class Level enum
export const ClassLevels = {
  MIDDLE: "middle",
  HIGH: "high",
} as const;
export type ClassLevel = typeof ClassLevels[keyof typeof ClassLevels];

// Classes (수업)
export const classes = pgTable("classes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  classType: text("class_type").notNull().default("regular"), // regular | assessment | high_clinic | middle_clinic
  classLevel: text("class_level").notNull().default("middle"), // middle | high (중등/고등)
  teacherId: varchar("teacher_id"), // nullable - null when teacher is deleted
  teacherName: text("teacher_name"), // snapshot of teacher name when archived
  centerId: varchar("center_id").notNull(),
  classroom: text("classroom"), // 강의실 (예: A101, B202)
  days: text("days").array().notNull(), // ['mon', 'wed', 'fri'] - kept for backwards compatibility
  startTime: text("start_time").notNull(), // '14:00' - default time
  endTime: text("end_time").notNull(), // '15:30' - default time
  schedule: text("schedule"), // JSON string: [{day, startTime, endTime}, ...] - for day-specific times
  color: text("color").notNull().default("#3B82F6"),
  isArchived: boolean("is_archived").notNull().default(false), // true when teacher is deleted
  baseFee: integer("base_fee").notNull().default(0), // 기본금 (첫 수업 가격)
  additionalFee: integer("additional_fee").notNull().default(0), // 추가금 (추가 수업 가격)
});

export const insertClassSchema = createInsertSchema(classes).pick({
  name: true,
  subject: true,
  classType: true,
  classLevel: true,
  teacherId: true,
  centerId: true,
  classroom: true,
  days: true,
  startTime: true,
  endTime: true,
  schedule: true,
  color: true,
  baseFee: true,
  additionalFee: true,
});
export type InsertClass = z.infer<typeof insertClassSchema>;
export type Class = typeof classes.$inferSelect;

// Class Enrollments (수업 신청)
export const enrollments = pgTable("enrollments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull(),
  classId: varchar("class_id").notNull(),
  enrolledAt: timestamp("enrolled_at").defaultNow(),
});

export const insertEnrollmentSchema = createInsertSchema(enrollments).pick({
  studentId: true,
  classId: true,
});
export type InsertEnrollment = z.infer<typeof insertEnrollmentSchema>;
export type Enrollment = typeof enrollments.$inferSelect;

// Homework (숙제)
export const homework = pgTable("homework", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  classId: varchar("class_id").notNull(),
  studentId: varchar("student_id"), // null = all students in class, set = specific student only
  title: text("title").notNull(),
  dueDate: date("due_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertHomeworkSchema = createInsertSchema(homework).pick({
  classId: true,
  studentId: true,
  title: true,
  dueDate: true,
});
export type InsertHomework = z.infer<typeof insertHomeworkSchema>;
export type Homework = typeof homework.$inferSelect;

// Homework Submissions (숙제 제출)
export const homeworkSubmissions = pgTable("homework_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  homeworkId: varchar("homework_id").notNull(),
  studentId: varchar("student_id").notNull(),
  photos: text("photos").array(),
  completionRate: integer("completion_rate").default(0), // 0-100
  status: text("status").notNull().default("pending"), // pending | submitted | reviewed | resubmit | in_person
  feedback: text("feedback"),
  resubmitReason: text("resubmit_reason"),
  submittedAt: timestamp("submitted_at"),
  reviewedAt: timestamp("reviewed_at"),
});

export const insertHomeworkSubmissionSchema = createInsertSchema(homeworkSubmissions).pick({
  homeworkId: true,
  studentId: true,
  photos: true,
  completionRate: true,
  status: true,
  feedback: true,
  resubmitReason: true,
});
export type InsertHomeworkSubmission = z.infer<typeof insertHomeworkSubmissionSchema>;
export type HomeworkSubmission = typeof homeworkSubmissions.$inferSelect;

// Assessments (평가 수업 점수)
export const assessments = pgTable("assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  classId: varchar("class_id").notNull(),
  studentId: varchar("student_id").notNull(),
  name: text("name"), // 테스트 이름
  scope: text("scope"), // 시험 범위
  score: integer("score").notNull(),
  maxScore: integer("max_score").notNull().default(100),
  assessmentDate: date("assessment_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAssessmentSchema = createInsertSchema(assessments).pick({
  classId: true,
  studentId: true,
  name: true,
  scope: true,
  score: true,
  maxScore: true,
  assessmentDate: true,
});
export type InsertAssessment = z.infer<typeof insertAssessmentSchema>;
export type Assessment = typeof assessments.$inferSelect;

// Class Videos (수업 영상)
export const classVideos = pgTable("class_videos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  classId: varchar("class_id").notNull(),
  title: text("title").notNull(),
  youtubeUrl: text("youtube_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const insertClassVideoSchema = createInsertSchema(classVideos).pick({
  classId: true,
  title: true,
  youtubeUrl: true,
  thumbnailUrl: true,
});
export type InsertClassVideo = z.infer<typeof insertClassVideoSchema>;
export type ClassVideo = typeof classVideos.$inferSelect;

// Textbooks (교재)
export const textbooks = pgTable("textbooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  coverImage: text("cover_image"),
  isVisible: boolean("is_visible").notNull().default(true),
});

export const insertTextbookSchema = createInsertSchema(textbooks).pick({
  title: true,
  coverImage: true,
  isVisible: true,
});
export type InsertTextbook = z.infer<typeof insertTextbookSchema>;
export type Textbook = typeof textbooks.$inferSelect;

// Textbook Videos (교재별 풀이 영상)
export const textbookVideos = pgTable("textbook_videos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  textbookId: varchar("textbook_id").notNull(),
  pageNumber: integer("page_number").notNull(),
  problemNumber: integer("problem_number").notNull(),
  youtubeUrl: text("youtube_url").notNull(),
  uploadedBy: varchar("uploaded_by").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const insertTextbookVideoSchema = createInsertSchema(textbookVideos).pick({
  textbookId: true,
  pageNumber: true,
  problemNumber: true,
  youtubeUrl: true,
  uploadedBy: true,
});
export type InsertTextbookVideo = z.infer<typeof insertTextbookVideoSchema>;
export type TextbookVideo = typeof textbookVideos.$inferSelect;

// ===== NEW CLINIC SYSTEM (Weekly Workflow) =====

// Clinic Students (클리닉 학생 프로필) - Persistent profile with template instructions
export const clinicStudents = pgTable("clinic_students", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull(), // FK to users
  regularTeacherId: varchar("regular_teacher_id").notNull(), // 담당 선생님
  clinicTeacherId: varchar("clinic_teacher_id"), // 클리닉 선생님 (can be null)
  centerId: varchar("center_id").notNull(),
  clinicType: text("clinic_type").notNull().default("middle"), // 클리닉 유형: "high" (고등) | "middle" (중등)
  grade: text("grade"), // 학년 (예: 초1, 초2, 중1, 중2, 고1, 고2, 고3)
  classGroup: text("class_group"), // 반 (예: A반, B반) - 미등록이면 null
  clinicDays: text("clinic_days").array().notNull(), // 클리닉 요일들: ['mon', 'tue'] 등 복수 선택 가능
  clinicTime: text("clinic_time"), // 클리닉 시간 (예: "12~1pm 사이 등원")
  defaultInstructions: text("default_instructions").notNull(), // 기본 지시사항 템플릿 (매주 재사용)
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertClinicStudentSchema = createInsertSchema(clinicStudents).pick({
  studentId: true,
  regularTeacherId: true,
  clinicTeacherId: true,
  centerId: true,
  clinicType: true,
  grade: true,
  classGroup: true,
  clinicDays: true,
  clinicTime: true,
  defaultInstructions: true,
  isActive: true,
});
export type InsertClinicStudent = z.infer<typeof insertClinicStudentSchema>;
export type ClinicStudent = typeof clinicStudents.$inferSelect;

// Clinic Instruction Defaults (요일별 기본 지시사항) - Per teacher, per weekday defaults
export const clinicInstructionDefaults = pgTable("clinic_instruction_defaults", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clinicStudentId: varchar("clinic_student_id").notNull(), // FK to clinicStudents
  weekday: text("weekday").notNull(), // mon, tue, wed, thu, fri, sat
  period1Default: text("period1_default"), // 1교시 기본 지시사항
  period2Default: text("period2_default"), // 2교시 기본 지시사항
  period3Default: text("period3_default"), // 3교시 기본 지시사항
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertClinicInstructionDefaultSchema = createInsertSchema(clinicInstructionDefaults).pick({
  clinicStudentId: true,
  weekday: true,
  period1Default: true,
  period2Default: true,
  period3Default: true,
});
export type InsertClinicInstructionDefault = z.infer<typeof insertClinicInstructionDefaultSchema>;
export type ClinicInstructionDefault = typeof clinicInstructionDefaults.$inferSelect;

// Clinic Weekly Records (주간 클리닉 기록) - Created each week
export const clinicWeeklyRecords = pgTable("clinic_weekly_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clinicStudentId: varchar("clinic_student_id").notNull(), // FK to clinicStudents
  weekStartDate: date("week_start_date").notNull(), // 주 시작일 (월요일)
  // Legacy fields (keep for backward compatibility)
  filePath: text("file_path"), // 이번 주 PDF 파일 경로
  fileName: text("file_name"), // 파일명
  additionalNotes: text("additional_notes"), // 담당선생님 추가 메모/문의사항
  clinicTeacherFeedback: text("clinic_teacher_feedback"), // 클리닉 선생님 피드백
  progressNotes: text("progress_notes"), // 오늘 공부한 부분 (상세하게)
  status: text("status").notNull().default("pending"), // pending | in_progress | completed
  // New fields for redesigned clinic
  clinicDayTimeNote: text("clinic_day_time_note"), // 클리닉요일/시간 특별 메모 (예: "1/10 안옵니다")
  weeklyEvaluation: text("weekly_evaluation"), // 담당선생님 지시사항 (1교시)
  period2Instruction: text("period2_instruction"), // 담당선생님 지시사항 (2교시)
  period3Instruction: text("period3_instruction"), // 담당선생님 지시사항 (3교시)
  clinicTeacherNotes: text("clinic_teacher_notes"), // 클리닉 선생님 기록사항
  useDefaultPeriod1: boolean("use_default_period1").notNull().default(true), // 1교시 기본값 사용 여부
  useDefaultPeriod2: boolean("use_default_period2").notNull().default(true), // 2교시 기본값 사용 여부
  useDefaultPeriod3: boolean("use_default_period3").notNull().default(true), // 3교시 기본값 사용 여부
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertClinicWeeklyRecordSchema = createInsertSchema(clinicWeeklyRecords).pick({
  clinicStudentId: true,
  weekStartDate: true,
  filePath: true,
  fileName: true,
  additionalNotes: true,
  clinicTeacherFeedback: true,
  progressNotes: true,
  status: true,
  clinicDayTimeNote: true,
  weeklyEvaluation: true,
  period2Instruction: true,
  period3Instruction: true,
  clinicTeacherNotes: true,
  useDefaultPeriod1: true,
  useDefaultPeriod2: true,
  useDefaultPeriod3: true,
});
export type InsertClinicWeeklyRecord = z.infer<typeof insertClinicWeeklyRecordSchema>;
export type ClinicWeeklyRecord = typeof clinicWeeklyRecords.$inferSelect;

// Extended type for clinic student with user details
export type ClinicStudentWithDetails = ClinicStudent & {
  student?: User;
  regularTeacher?: User;
  clinicTeacher?: User;
  weeklyRecords?: ClinicWeeklyRecord[];
  instructionDefaults?: ClinicInstructionDefault[];
};

// Clinic Weekly Record Files (주간 기록 첨부파일) - PDF/Image per period
export const clinicWeeklyRecordFiles = pgTable("clinic_weekly_record_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recordId: varchar("record_id").notNull(), // FK to clinicWeeklyRecords
  period: text("period").notNull(), // weekly_evaluation | period2 | period3 | clinic_notes
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(), // Object storage path
  fileType: text("file_type").notNull(), // pdf | image | hwp | etc
  fileSize: integer("file_size"), // bytes
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const insertClinicWeeklyRecordFileSchema = createInsertSchema(clinicWeeklyRecordFiles).pick({
  recordId: true,
  period: true,
  fileName: true,
  filePath: true,
  fileType: true,
  fileSize: true,
});
export type InsertClinicWeeklyRecordFile = z.infer<typeof insertClinicWeeklyRecordFileSchema>;
export type ClinicWeeklyRecordFile = typeof clinicWeeklyRecordFiles.$inferSelect;

// Extended weekly record type with files
export type ClinicWeeklyRecordWithFiles = ClinicWeeklyRecord & {
  files?: ClinicWeeklyRecordFile[];
  clinicStudent?: ClinicStudentWithDetails;
};

// Clinic Shared Instruction Groups (공통 지시사항 그룹) - Groups of students sharing same instructions
export const clinicSharedInstructionGroups = pgTable("clinic_shared_instruction_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  teacherId: varchar("teacher_id").notNull(), // 담당선생님
  weekStartDate: date("week_start_date").notNull(), // 주 시작일
  period: text("period").notNull(), // weekly_evaluation | period2 | period3
  content: text("content"), // 공통 지시사항 내용
  useDefault: boolean("use_default").notNull().default(false), // 기본값 사용 여부
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertClinicSharedInstructionGroupSchema = createInsertSchema(clinicSharedInstructionGroups).pick({
  centerId: true,
  teacherId: true,
  weekStartDate: true,
  period: true,
  content: true,
  useDefault: true,
});
export type InsertClinicSharedInstructionGroup = z.infer<typeof insertClinicSharedInstructionGroupSchema>;
export type ClinicSharedInstructionGroup = typeof clinicSharedInstructionGroups.$inferSelect;

// Clinic Shared Instruction Members (공통 지시사항 그룹 멤버) - Links records to shared groups
export const clinicSharedInstructionMembers = pgTable("clinic_shared_instruction_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sharedGroupId: varchar("shared_group_id").notNull(), // FK to clinicSharedInstructionGroups
  recordId: varchar("record_id").notNull(), // FK to clinicWeeklyRecords
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const insertClinicSharedInstructionMemberSchema = createInsertSchema(clinicSharedInstructionMembers).pick({
  sharedGroupId: true,
  recordId: true,
});
export type InsertClinicSharedInstructionMember = z.infer<typeof insertClinicSharedInstructionMemberSchema>;
export type ClinicSharedInstructionMember = typeof clinicSharedInstructionMembers.$inferSelect;

// Extended shared group type with members
export type ClinicSharedInstructionGroupWithMembers = ClinicSharedInstructionGroup & {
  members?: (ClinicSharedInstructionMember & { record?: ClinicWeeklyRecord })[];
};

// Clinic Resources (클리닉 자료 모음) - Shared problem files for clinic students
export const clinicResources = pgTable("clinic_resources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  description: text("description"), // 자료 설명
  isPermanent: boolean("is_permanent").notNull().default(false), // true = 영구 보관, false = 2주 후 자동 삭제
  weekStartDate: date("week_start_date"), // 임시 자료의 경우 주 시작일 (삭제 기준)
  uploadedById: varchar("uploaded_by_id").notNull(), // 업로더 ID
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertClinicResourceSchema = createInsertSchema(clinicResources).pick({
  centerId: true,
  fileName: true,
  filePath: true,
  description: true,
  isPermanent: true,
  weekStartDate: true,
  uploadedById: true,
});
export type InsertClinicResource = z.infer<typeof insertClinicResourceSchema>;
export type ClinicResource = typeof clinicResources.$inferSelect;
export type ClinicResourceWithUploader = ClinicResource & { uploader?: User };

// Clinic Daily Notes (클리닉 학생 날짜별 기록) - Cumulative notes for each student
export const clinicDailyNotes = pgTable("clinic_daily_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clinicStudentId: varchar("clinic_student_id").notNull(), // FK to clinicStudents
  noteDate: date("note_date").notNull(), // 기록 날짜
  content: text("content").notNull(), // 기록 내용
  createdById: varchar("created_by_id").notNull(), // 작성자 ID
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertClinicDailyNoteSchema = createInsertSchema(clinicDailyNotes).pick({
  clinicStudentId: true,
  noteDate: true,
  content: true,
  createdById: true,
});
export type InsertClinicDailyNote = z.infer<typeof insertClinicDailyNoteSchema>;
export type ClinicDailyNote = typeof clinicDailyNotes.$inferSelect;
export type ClinicDailyNoteWithCreator = ClinicDailyNote & { creator?: User };

// ===== LEGACY CLINIC SYSTEM (kept for backwards compatibility) =====

// Clinic Assignments (클리닉 지시사항) - Regular teacher assigns to clinic teacher
export const clinicAssignments = pgTable("clinic_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull(),
  regularTeacherId: varchar("regular_teacher_id").notNull(), // 정규 선생님 (작성자)
  clinicTeacherId: varchar("clinic_teacher_id"), // 클리닉 선생님 (수행자) - null if self
  centerId: varchar("center_id").notNull(),
  assignmentDate: date("assignment_date").notNull(),
  title: text("title").notNull(),
  description: text("description"), // 전체 설명
  status: text("status").notNull().default("pending"), // pending | in_progress | completed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertClinicAssignmentSchema = createInsertSchema(clinicAssignments).pick({
  studentId: true,
  regularTeacherId: true,
  clinicTeacherId: true,
  centerId: true,
  assignmentDate: true,
  title: true,
  description: true,
  status: true,
});
export type InsertClinicAssignment = z.infer<typeof insertClinicAssignmentSchema>;
export type ClinicAssignment = typeof clinicAssignments.$inferSelect;

// Clinic Assignment Steps (단계별 지시사항)
export const clinicAssignmentSteps = pgTable("clinic_assignment_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: varchar("assignment_id").notNull(),
  stepOrder: integer("step_order").notNull(), // 순서
  instruction: text("instruction").notNull(), // 지시 내용
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
});

export const insertClinicAssignmentStepSchema = createInsertSchema(clinicAssignmentSteps).pick({
  assignmentId: true,
  stepOrder: true,
  instruction: true,
  isCompleted: true,
});
export type InsertClinicAssignmentStep = z.infer<typeof insertClinicAssignmentStepSchema>;
export type ClinicAssignmentStep = typeof clinicAssignmentSteps.$inferSelect;

// Clinic Assignment Files (PDF 첨부파일)
export const clinicAssignmentFiles = pgTable("clinic_assignment_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: varchar("assignment_id").notNull(),
  stepId: varchar("step_id"), // null if attached to whole assignment
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileType: text("file_type").notNull(), // pdf, image, etc.
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const insertClinicAssignmentFileSchema = createInsertSchema(clinicAssignmentFiles).pick({
  assignmentId: true,
  stepId: true,
  fileName: true,
  filePath: true,
  fileType: true,
});
export type InsertClinicAssignmentFile = z.infer<typeof insertClinicAssignmentFileSchema>;
export type ClinicAssignmentFile = typeof clinicAssignmentFiles.$inferSelect;

// Clinic Comments (클리닉 선생님이 작성하는 코멘트)
export const clinicComments = pgTable("clinic_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: varchar("assignment_id").notNull(),
  authorId: varchar("author_id").notNull(), // 작성자 (클리닉 선생님)
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertClinicCommentSchema = createInsertSchema(clinicComments).pick({
  assignmentId: true,
  authorId: true,
  content: true,
});
export type InsertClinicComment = z.infer<typeof insertClinicCommentSchema>;
export type ClinicComment = typeof clinicComments.$inferSelect;

// Clinic Progress Logs (진도 기록 - 문제 풀이 기록)
export const clinicProgressLogs = pgTable("clinic_progress_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: varchar("assignment_id").notNull(),
  studentId: varchar("student_id").notNull(),
  logDate: date("log_date").notNull(),
  problemsSolved: text("problems_solved"), // 푼 문제 (예: "p.25 1-5번, p.26 1-3번")
  stoppedAt: text("stopped_at"), // 어디까지 풀었는지 (예: "p.26 3번까지")
  notes: text("notes"), // 추가 메모
  createdAt: timestamp("created_at").defaultNow(),
  updatedBy: varchar("updated_by").notNull(),
});

export const insertClinicProgressLogSchema = createInsertSchema(clinicProgressLogs).pick({
  assignmentId: true,
  studentId: true,
  logDate: true,
  problemsSolved: true,
  stoppedAt: true,
  notes: true,
  updatedBy: true,
});
export type InsertClinicProgressLog = z.infer<typeof insertClinicProgressLogSchema>;
export type ClinicProgressLog = typeof clinicProgressLogs.$inferSelect;

// ============================================
// Attendance System (출결 시스템)
// ============================================

// Attendance PINs (출결 번호) - Each student has a unique PIN per center
export const attendancePins = pgTable("attendance_pins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull(),
  centerId: varchar("center_id").notNull(),
  pin: text("pin").notNull(), // 4-6 digit PIN (e.g., "1234")
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAttendancePinSchema = createInsertSchema(attendancePins).pick({
  studentId: true,
  centerId: true,
  pin: true,
  isActive: true,
});
export type InsertAttendancePin = z.infer<typeof insertAttendancePinSchema>;
export type AttendancePin = typeof attendancePins.$inferSelect;

// Teacher Check-in Settings (선생님 출근 설정)
export const teacherCheckInSettings = pgTable("teacher_check_in_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teacherId: varchar("teacher_id").notNull(),
  centerId: varchar("center_id").notNull(),
  checkInCode: text("check_in_code").notNull(), // 4-digit check-in code
  smsRecipient1: text("sms_recipient_1"), // First phone number to receive SMS
  smsRecipient2: text("sms_recipient_2"), // Second phone number to receive SMS (optional)
  messageTemplate: text("message_template"), // Custom SMS message template
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTeacherCheckInSettingsSchema = createInsertSchema(teacherCheckInSettings).pick({
  teacherId: true,
  centerId: true,
  checkInCode: true,
  smsRecipient1: true,
  smsRecipient2: true,
  messageTemplate: true,
  isActive: true,
});
export type InsertTeacherCheckInSettings = z.infer<typeof insertTeacherCheckInSettingsSchema>;
export type TeacherCheckInSettings = typeof teacherCheckInSettings.$inferSelect;

// Attendance Status
export const ATTENDANCE_STATUS = {
  PENDING: "pending",    // 미확인
  PRESENT: "present",    // 등원
  LATE: "late",          // 지각
  ABSENT: "absent",      // 결석
} as const;
export type AttendanceStatus = typeof ATTENDANCE_STATUS[keyof typeof ATTENDANCE_STATUS];

// Attendance Records (출결 기록)
export const attendanceRecords = pgTable("attendance_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull(),
  centerId: varchar("center_id").notNull(),
  classId: varchar("class_id"), // Optional: which class the student is checking in for
  checkInAt: timestamp("check_in_at").notNull().defaultNow(),
  checkInDate: date("check_in_date").notNull(), // For easy date filtering
  wasLate: boolean("was_late").notNull().default(false),
  attendanceStatus: text("attendance_status").notNull().default("pending"), // pending | present | late | absent
  lateNotificationSent: boolean("late_notification_sent").notNull().default(false),
  lateNotificationSentAt: timestamp("late_notification_sent_at"),
  checkInNotificationSent: boolean("check_in_notification_sent").notNull().default(false),
  checkOutAt: timestamp("check_out_at"), // 하원 시간
  checkOutNotificationSent: boolean("check_out_notification_sent").notNull().default(false),
});

export const insertAttendanceRecordSchema = createInsertSchema(attendanceRecords).pick({
  studentId: true,
  centerId: true,
  classId: true,
  checkInDate: true,
  wasLate: true,
  attendanceStatus: true,
});
export type InsertAttendanceRecord = z.infer<typeof insertAttendanceRecordSchema>;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;

// Teacher Work Records (선생님 근무 기록)
export const teacherWorkRecords = pgTable("teacher_work_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teacherId: varchar("teacher_id").notNull(),
  centerId: varchar("center_id").notNull(),
  workDate: date("work_date").notNull(), // 근무일 (YYYY-MM-DD)
  checkInAt: timestamp("check_in_at"), // 출근 시각
  checkOutAt: timestamp("check_out_at"), // 퇴근 시각
  workMinutes: integer("work_minutes"), // 근무 시간 (분 단위)
  noCheckOut: boolean("no_check_out").notNull().default(false), // 퇴근 기록 없음 여부
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTeacherWorkRecordSchema = createInsertSchema(teacherWorkRecords).pick({
  teacherId: true,
  centerId: true,
  workDate: true,
  checkInAt: true,
  checkOutAt: true,
  workMinutes: true,
  noCheckOut: true,
});
export type InsertTeacherWorkRecord = z.infer<typeof insertTeacherWorkRecordSchema>;
export type TeacherWorkRecord = typeof teacherWorkRecords.$inferSelect;

// Message Templates (알림 메시지 템플릿)
export const messageTemplates = pgTable("message_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  type: text("type").notNull(), // 'check_in' | 'late' | 'check_out'
  title: text("title").notNull(),
  body: text("body").notNull(), // Supports variables like {{studentName}}, {{time}}, {{date}}
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertMessageTemplateSchema = createInsertSchema(messageTemplates).pick({
  centerId: true,
  type: true,
  title: true,
  body: true,
  isActive: true,
});
export type InsertMessageTemplate = z.infer<typeof insertMessageTemplateSchema>;
export type MessageTemplate = typeof messageTemplates.$inferSelect;

// Notification Logs (알림 발송 기록)
export const notificationLogs = pgTable("notification_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  attendanceRecordId: varchar("attendance_record_id"),
  templateId: varchar("template_id"),
  recipientPhone: text("recipient_phone").notNull(),
  recipientType: text("recipient_type").notNull(), // 'student' | 'mother' | 'father'
  messageType: text("message_type").notNull(), // 'check_in' | 'late' | 'check_out'
  channel: text("channel").notNull(), // 'alimtalk' | 'sms'
  status: text("status").notNull().default("pending"), // 'pending' | 'sent' | 'failed'
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNotificationLogSchema = createInsertSchema(notificationLogs).pick({
  attendanceRecordId: true,
  templateId: true,
  recipientPhone: true,
  recipientType: true,
  messageType: true,
  channel: true,
  status: true,
  errorMessage: true,
});
export type InsertNotificationLog = z.infer<typeof insertNotificationLogSchema>;
export type NotificationLog = typeof notificationLogs.$inferSelect;

// Extended types for frontend
export type ClassWithTeacher = Class & { teacher?: User };
export type HomeworkWithClass = Homework & { class?: Class };
export type SubmissionWithDetails = HomeworkSubmission & { homework?: Homework; student?: User };
export type AssessmentWithDetails = Assessment & { class?: Class; student?: User };
export type ClinicAssignmentWithDetails = ClinicAssignment & { 
  student?: User; 
  regularTeacher?: User; 
  clinicTeacher?: User;
  steps?: ClinicAssignmentStep[];
  files?: ClinicAssignmentFile[];
  comments?: ClinicComment[];
  progressLogs?: ClinicProgressLog[];
};

// Attendance extended types
export type AttendancePinWithStudent = AttendancePin & { student?: User };
export type AttendanceRecordWithStudent = AttendanceRecord & { student?: User };
export type AttendanceRecordWithClass = AttendanceRecord & { class?: Class };

// Class Notes (수업 공통 기록)
export const classNotes = pgTable("class_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  classId: varchar("class_id").notNull(),
  teacherId: varchar("teacher_id").notNull(),
  noteDate: date("note_date").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertClassNoteSchema = createInsertSchema(classNotes).pick({
  classId: true,
  teacherId: true,
  noteDate: true,
  content: true,
});
export type InsertClassNote = z.infer<typeof insertClassNoteSchema>;
export type ClassNote = typeof classNotes.$inferSelect;

// Student Class Notes (학생별 수업 기록)
export const studentClassNotes = pgTable("student_class_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  classId: varchar("class_id").notNull(),
  studentId: varchar("student_id").notNull(),
  teacherId: varchar("teacher_id").notNull(),
  noteDate: date("note_date").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertStudentClassNoteSchema = createInsertSchema(studentClassNotes).pick({
  classId: true,
  studentId: true,
  teacherId: true,
  noteDate: true,
  content: true,
});
export type InsertStudentClassNote = z.infer<typeof insertStudentClassNoteSchema>;
export type StudentClassNote = typeof studentClassNotes.$inferSelect;

// Extended types for class notes
export type ClassNoteWithTeacher = ClassNote & { teacher?: User };
export type StudentClassNoteWithDetails = StudentClassNote & { student?: User; teacher?: User };

// SOLAPI Credentials (센터별 SMS/카카오톡 설정)
export const solapiCredentials = pgTable("solapi_credentials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull().unique(),
  apiKey: text("api_key").notNull(),           // encrypted
  apiSecret: text("api_secret").notNull(),     // encrypted
  senderNumber: text("sender_number").notNull(), // plaintext phone number
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSolapiCredentialsSchema = createInsertSchema(solapiCredentials).pick({
  centerId: true,
  apiKey: true,
  apiSecret: true,
  senderNumber: true,
});
export type InsertSolapiCredentials = z.infer<typeof insertSolapiCredentialsSchema>;
export type SolapiCredentials = typeof solapiCredentials.$inferSelect;

// Study Cafe Settings (스터디카페 센터 설정)
export const studyCafeSettings = pgTable("study_cafe_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull().unique(),
  isEnabled: boolean("is_enabled").notNull().default(false),
  notice: text("notice"), // 공지사항
  entryPassword: text("entry_password"), // 출입 비밀번호
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertStudyCafeSettingsSchema = createInsertSchema(studyCafeSettings).pick({
  centerId: true,
  isEnabled: true,
}).extend({
  notice: z.string().nullable().optional(),
  entryPassword: z.string().nullable().optional(),
});
export type InsertStudyCafeSettings = z.infer<typeof insertStudyCafeSettingsSchema>;
export type StudyCafeSettings = typeof studyCafeSettings.$inferSelect;

// Study Cafe Seats (스터디카페 좌석)
export const studyCafeSeats = pgTable("study_cafe_seats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  seatNumber: integer("seat_number").notNull(),
  row: integer("row").notNull(), // 행 (위치 정보)
  col: integer("col").notNull(), // 열 (위치 정보)
  isActive: boolean("is_active").notNull().default(true), // 좌석 사용 가능 여부
});

export const insertStudyCafeSeatSchema = createInsertSchema(studyCafeSeats).pick({
  centerId: true,
  seatNumber: true,
  row: true,
  col: true,
  isActive: true,
});
export type InsertStudyCafeSeat = z.infer<typeof insertStudyCafeSeatSchema>;
export type StudyCafeSeat = typeof studyCafeSeats.$inferSelect;

// Study Cafe Reservations (스터디카페 좌석 예약 - 2시간 단위)
export const studyCafeReservations = pgTable("study_cafe_reservations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  seatId: varchar("seat_id").notNull(),
  studentId: varchar("student_id").notNull(),
  centerId: varchar("center_id").notNull(),
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at").notNull(), // startAt + 2시간
  status: text("status").notNull().default("active"), // active, released, expired
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStudyCafeReservationSchema = createInsertSchema(studyCafeReservations).pick({
  seatId: true,
  studentId: true,
  centerId: true,
  startAt: true,
  endAt: true,
  status: true,
});
export type InsertStudyCafeReservation = z.infer<typeof insertStudyCafeReservationSchema>;
export type StudyCafeReservation = typeof studyCafeReservations.$inferSelect;

// Study Cafe Fixed Seats (스터디카페 고정석)
export const studyCafeFixedSeats = pgTable("study_cafe_fixed_seats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  seatId: varchar("seat_id").notNull(),
  studentId: varchar("student_id").notNull(),
  centerId: varchar("center_id").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  assignedById: varchar("assigned_by_id").notNull(), // 지정한 사람 (선생님/원장/관리자)
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStudyCafeFixedSeatSchema = createInsertSchema(studyCafeFixedSeats).pick({
  seatId: true,
  studentId: true,
  centerId: true,
  startDate: true,
  endDate: true,
  assignedById: true,
});
export type InsertStudyCafeFixedSeat = z.infer<typeof insertStudyCafeFixedSeatSchema>;
export type StudyCafeFixedSeat = typeof studyCafeFixedSeats.$inferSelect;

// Extended types for study cafe
export type StudyCafeSeatWithStatus = StudyCafeSeat & {
  reservation?: StudyCafeReservation & { student?: User };
  fixedSeat?: StudyCafeFixedSeat & { student?: User };
  remainingMinutes?: number;
  isAvailable: boolean;
  isFixed: boolean;
};

// Tuition Access Passwords (수강료 열람 비밀번호)
// Parents set this password for their children; students must enter it to view tuition fees
export const tuitionAccessPasswords = pgTable("tuition_access_passwords", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull().unique(), // One password per student
  password: text("password").notNull(), // Plain text for simplicity (parent-set PIN)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTuitionAccessPasswordSchema = createInsertSchema(tuitionAccessPasswords).pick({
  studentId: true,
  password: true,
});
export type InsertTuitionAccessPassword = z.infer<typeof insertTuitionAccessPasswordSchema>;
export type TuitionAccessPassword = typeof tuitionAccessPasswords.$inferSelect;

// Tuition Guidance (교육비 안내)
// Per-center guidance text and images that students/parents can view
export const tuitionGuidances = pgTable("tuition_guidances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull().unique(),
  guidanceText: text("guidance_text"),
  imageUrls: text("image_urls").array().default([]),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTuitionGuidanceSchema = createInsertSchema(tuitionGuidances).pick({
  centerId: true,
  guidanceText: true,
  imageUrls: true,
});
export type InsertTuitionGuidance = z.infer<typeof insertTuitionGuidanceSchema>;
export type TuitionGuidance = typeof tuitionGuidances.$inferSelect;

// Tuition Notifications (교육비 안내 문자 발송 기록)
// Tracks SMS notifications sent to parents about education fees
export const PaymentMethod = {
  IN_PERSON: "in_person",         // 대면결제
  BANK_TRANSFER: "bank_transfer", // 계좌이체
  ZERO_PAY: "zero_pay",           // 제로페이
  ONLINE: "online",               // 비대면결제 (토스페이먼츠 등)
} as const;

export type PaymentMethodType = typeof PaymentMethod[keyof typeof PaymentMethod];

export const tuitionNotifications = pgTable("tuition_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull(),
  parentId: varchar("parent_id"), // The parent who received the notification (optional, may use phone from student)
  centerId: varchar("center_id").notNull(),
  sentById: varchar("sent_by_id").notNull(), // The principal/admin who sent it
  
  // Fee details
  calculatedTotal: integer("calculated_total").notNull(), // Auto-calculated amount
  sentAmount: integer("sent_amount").notNull(), // Actually sent amount (may differ if modified)
  feeBreakdown: text("fee_breakdown"), // JSON: [{className, fee, isFirst}]
  
  // Payment information
  paymentMethod: text("payment_method").notNull(), // in_person, bank_transfer, zero_pay, online
  paymentDetails: text("payment_details"), // Extra info (e.g., bank account for transfer)
  
  // Message content
  messageContent: text("message_content").notNull(), // The actual SMS content sent
  recipientPhone: text("recipient_phone").notNull(), // Phone number SMS was sent to
  recipientType: text("recipient_type"), // "mother" or "father" when using student's phone fields
  
  // Status tracking
  status: text("status").notNull().default("sent"), // sent, failed
  errorMessage: text("error_message"), // Error if sending failed
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTuitionNotificationSchema = createInsertSchema(tuitionNotifications).pick({
  studentId: true,
  parentId: true,
  centerId: true,
  sentById: true,
  calculatedTotal: true,
  sentAmount: true,
  feeBreakdown: true,
  paymentMethod: true,
  paymentDetails: true,
  messageContent: true,
  recipientPhone: true,
  recipientType: true,
  status: true,
  errorMessage: true,
});
export type InsertTuitionNotification = z.infer<typeof insertTuitionNotificationSchema>;
export type TuitionNotification = typeof tuitionNotifications.$inferSelect;

// Student Textbook Purchases (학생 교재비 기록)
// Tracks textbook purchases for each student with individual pricing
export const studentTextbookPurchases = pgTable("student_textbook_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull(),
  centerId: varchar("center_id").notNull(),
  textbookName: varchar("textbook_name").notNull(),
  price: integer("price").notNull().default(0),
  purchaseDate: timestamp("purchase_date").defaultNow(),
  notes: text("notes"),
  createdById: varchar("created_by_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStudentTextbookPurchaseSchema = createInsertSchema(studentTextbookPurchases).pick({
  studentId: true,
  centerId: true,
  textbookName: true,
  price: true,
  purchaseDate: true,
  notes: true,
  createdById: true,
});
export type InsertStudentTextbookPurchase = z.infer<typeof insertStudentTextbookPurchaseSchema>;
export type StudentTextbookPurchase = typeof studentTextbookPurchases.$inferSelect;

// Student Monthly Reports (학생 월간 보고서)
// AI-generated reports synthesizing student performance data
export const studentMonthlyReports = pgTable("student_monthly_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull(),
  centerId: varchar("center_id").notNull(),
  createdById: varchar("created_by_id").notNull(), // Teacher/admin who created/edited
  
  // Report period
  year: integer("year").notNull(),
  month: integer("month").notNull(), // 1-12
  
  // Report content
  reportContent: text("report_content").notNull(), // The actual report text
  customInstructions: text("custom_instructions"), // Teacher's custom instructions for AI
  
  // Data snapshots (JSON strings for reference)
  assessmentSummary: text("assessment_summary"), // JSON: score averages, trends
  attendanceSummary: text("attendance_summary"), // JSON: attendance rate, late count
  homeworkSummary: text("homework_summary"), // JSON: completion rate, on-time count
  clinicSummary: text("clinic_summary"), // JSON: comments summary
  videoViewingSummary: text("video_viewing_summary"), // JSON: view counts
  studyCafeSummary: text("study_cafe_summary"), // JSON: usage hours
  
  // SMS sending status
  smsSentAt: timestamp("sms_sent_at"),
  smsRecipients: text("sms_recipients"), // JSON: [{phone, type, sentAt}]
  smsStatus: text("sms_status"), // pending, sent, partial, failed
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertStudentMonthlyReportSchema = createInsertSchema(studentMonthlyReports).pick({
  studentId: true,
  centerId: true,
  createdById: true,
  year: true,
  month: true,
  reportContent: true,
  customInstructions: true,
  assessmentSummary: true,
  attendanceSummary: true,
  homeworkSummary: true,
  clinicSummary: true,
  videoViewingSummary: true,
  studyCafeSummary: true,
  smsSentAt: true,
  smsRecipients: true,
  smsStatus: true,
});
export type InsertStudentMonthlyReport = z.infer<typeof insertStudentMonthlyReportSchema>;
export type StudentMonthlyReport = typeof studentMonthlyReports.$inferSelect;

// Notifications (알림)
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // 알림 받는 사용자
  type: text("type").notNull(), // homework_submitted, homework_due, etc.
  title: text("title").notNull(),
  message: text("message").notNull(),
  relatedId: varchar("related_id"), // 관련 숙제/수업 ID
  relatedType: text("related_type"), // homework, class, etc.
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).pick({
  userId: true,
  type: true,
  title: true,
  message: true,
  relatedId: true,
  relatedType: true,
  isRead: true,
});
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// System settings (시스템 설정)
export const systemSettings = pgTable("system_settings", {
  key: varchar("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type SystemSetting = typeof systemSettings.$inferSelect;

// Todos (투두리스트)
export const todos = pgTable("todos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  creatorId: varchar("creator_id").notNull(), // 생성자 (Admin/Principal/Teacher)
  title: text("title").notNull(), // 할일 제목
  description: text("description"), // 상세 설명
  startDate: date("start_date"), // 시작 날짜 (기간 설정용)
  dueDate: date("due_date").notNull(), // 기한 날짜
  priority: text("priority").notNull().default("medium"), // urgent, high, medium, low
  recurrence: text("recurrence").notNull().default("none"), // none, weekly, monthly
  recurrenceAnchorDate: date("recurrence_anchor_date"), // 반복 기준 날짜
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTodoSchema = createInsertSchema(todos).pick({
  centerId: true,
  creatorId: true,
  title: true,
  description: true,
  startDate: true,
  dueDate: true,
  priority: true,
  recurrence: true,
  recurrenceAnchorDate: true,
  isActive: true,
});
export type InsertTodo = z.infer<typeof insertTodoSchema>;
export type Todo = typeof todos.$inferSelect;

// Todo Assignees (투두 담당자)
export const todoAssignees = pgTable("todo_assignees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  todoId: varchar("todo_id").notNull(),
  assigneeId: varchar("assignee_id").notNull(), // 담당자 ID
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  completedForDate: date("completed_for_date"), // 반복 투두의 경우 어느 날짜에 완료했는지
});

export const insertTodoAssigneeSchema = createInsertSchema(todoAssignees).pick({
  todoId: true,
  assigneeId: true,
  isCompleted: true,
  completedAt: true,
  completedForDate: true,
});
export type InsertTodoAssignee = z.infer<typeof insertTodoAssigneeSchema>;
export type TodoAssignee = typeof todoAssignees.$inferSelect;

// Extended types for todos with details
export type TodoWithDetails = Todo & {
  creator?: User;
  assignees?: (TodoAssignee & { user?: User })[];
};

// Student Exit Reasons (학생 퇴원 사유)
export const ExitReasons = {
  PERFORMANCE: "성적/효과 불만",
  NO_INTEREST: "학업에 관심 없음/수학포기",
  HOMEWORK_MANAGEMENT: "숙제·관리 방식 불만",
  TEACHING_STYLE: "강사/수업 스타일",
  LEVEL_PLACEMENT: "레벨·반 편성",
  SCHEDULE_MISMATCH: "시간표 불일치",
  DISTANCE: "거리/동선",
  COST: "비용 부담",
  RELOCATION: "이사/전학",
  OVERLOAD: "일정 과부하(다른 학원/활동)",
  OTHER_ACADEMY: "다른 학원 이동(상위반/추천)",
  SEASONAL_PROGRAM: "윈터/썸머스쿨",
  OTHER: "기타",
} as const;

export type ExitReasonKey = keyof typeof ExitReasons;
export type ExitReasonValue = typeof ExitReasons[keyof typeof ExitReasons];

export const EXIT_REASON_LIST = Object.entries(ExitReasons).map(([key, label]) => ({
  key: key as ExitReasonKey,
  label,
}));

// Student Exit Records (학생 퇴원 기록)
export const studentExitRecords = pgTable("student_exit_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull(), // 퇴원 학생 ID
  studentName: text("student_name").notNull(), // 퇴원 시점 학생 이름 (스냅샷)
  centerId: varchar("center_id").notNull(), // 센터 ID
  exitMonth: text("exit_month").notNull(), // 퇴원 월 (YYYY-MM 형식)
  reasons: text("reasons").array().notNull(), // 퇴원 사유 배열
  notes: text("notes"), // 추가 메모
  recordedBy: varchar("recorded_by").notNull(), // 기록자 ID
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStudentExitRecordSchema = createInsertSchema(studentExitRecords).pick({
  studentId: true,
  studentName: true,
  centerId: true,
  exitMonth: true,
  reasons: true,
  notes: true,
  recordedBy: true,
});
export type InsertStudentExitRecord = z.infer<typeof insertStudentExitRecordSchema>;
export type StudentExitRecord = typeof studentExitRecords.$inferSelect;

// Monthly student count snapshot for management dashboard
export const monthlyStudentSnapshots = pgTable("monthly_student_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  month: text("month").notNull(), // YYYY-MM 형식
  studentCount: integer("student_count").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMonthlyStudentSnapshotSchema = createInsertSchema(monthlyStudentSnapshots).pick({
  centerId: true,
  month: true,
  studentCount: true,
});
export type InsertMonthlyStudentSnapshot = z.infer<typeof insertMonthlyStudentSnapshotSchema>;
export type MonthlyStudentSnapshot = typeof monthlyStudentSnapshots.$inferSelect;

// Marketing Campaigns (마케팅 캠페인)
export const MarketingChannels = {
  NAVER_BLOG: "네이버 블로그",
  NAVER_SEARCH: "네이버 검색광고",
  GOOGLE_ADS: "구글 광고",
  INSTAGRAM: "인스타그램",
  FACEBOOK: "페이스북",
  YOUTUBE: "유튜브",
  KAKAOTALK: "카카오톡",
  FLYER: "전단지/현수막",
  REFERRAL: "지인소개 프로모션",
  LOCAL_EVENT: "지역 행사",
  OTHER: "기타",
} as const;

export type MarketingChannelKey = keyof typeof MarketingChannels;
export type MarketingChannelValue = typeof MarketingChannels[keyof typeof MarketingChannels];

export const MARKETING_CHANNEL_LIST = Object.entries(MarketingChannels).map(([key, label]) => ({
  key: key as MarketingChannelKey,
  label,
}));

export const marketingCampaigns = pgTable("marketing_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  name: text("name").notNull(),
  channel: text("channel").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  budget: integer("budget").notNull(),
  notes: text("notes"),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMarketingCampaignSchema = createInsertSchema(marketingCampaigns).pick({
  centerId: true,
  name: true,
  channel: true,
  startDate: true,
  endDate: true,
  budget: true,
  notes: true,
  createdBy: true,
});
export type InsertMarketingCampaign = z.infer<typeof insertMarketingCampaignSchema>;
export type MarketingCampaign = typeof marketingCampaigns.$inferSelect;

// Monthly Financial Records (월별 재무 기록)
// Each category has an amount and optional notes/details in JSON format
export const monthlyFinancialRecords = pgTable("monthly_financial_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerId: varchar("center_id").notNull(),
  yearMonth: text("year_month").notNull(), // YYYY-MM format
  
  // 매출 (Revenue)
  revenueTuition: integer("revenue_tuition").notNull().default(0), // 수강료
  revenueTuitionDetails: text("revenue_tuition_details"), // JSON: sub-items
  
  // 인건비 (Labor costs)
  expenseRegularSalary: integer("expense_regular_salary").notNull().default(0), // 정규선생님 급여
  expenseRegularSalaryDetails: text("expense_regular_salary_details"),
  expensePartTimeSalary: integer("expense_part_time_salary").notNull().default(0), // 파트선생님 급여
  expensePartTimeSalaryDetails: text("expense_part_time_salary_details"),
  expenseHourlySalary: integer("expense_hourly_salary").notNull().default(0), // 아르바이트 급여
  expenseHourlySalaryDetails: text("expense_hourly_salary_details"),
  expenseEmployeeInsurance: integer("expense_employee_insurance").notNull().default(0), // 4대보험
  expenseEmployeeInsuranceDetails: text("expense_employee_insurance_details"),
  
  // 임대료 및 관리비
  expenseRent: integer("expense_rent").notNull().default(0),
  expenseRentDetails: text("expense_rent_details"),
  
  // 복리후생비 (간식비, 회식비, 직원교육비)
  expenseWelfare: integer("expense_welfare").notNull().default(0),
  expenseWelfareDetails: text("expense_welfare_details"),
  
  // 수도광열비 (전기, 수도, 가스)
  expenseUtilities: integer("expense_utilities").notNull().default(0),
  expenseUtilitiesDetails: text("expense_utilities_details"),
  
  // 통신비 (인터넷, 전화)
  expenseCommunication: integer("expense_communication").notNull().default(0),
  expenseCommunicationDetails: text("expense_communication_details"),
  
  // 소모품비 (복사용지, 사무용품)
  expenseSupplies: integer("expense_supplies").notNull().default(0),
  expenseSuppliesDetails: text("expense_supplies_details"),
  
  // 광고선전비
  expenseAdvertising: integer("expense_advertising").notNull().default(0),
  expenseAdvertisingDetails: text("expense_advertising_details"),
  
  // 지급수수료 (세무회계 대행료, 외주개발비, 카드수수료)
  expenseFees: integer("expense_fees").notNull().default(0),
  expenseFeesDetails: text("expense_fees_details"),
  
  // 보험료 (화재보험, 학원 책임보험)
  expenseInsurance: integer("expense_insurance").notNull().default(0),
  expenseInsuranceDetails: text("expense_insurance_details"),
  
  // 감가상각비 (인테리어, 집기, 컴퓨터)
  expenseDepreciation: integer("expense_depreciation").notNull().default(0),
  expenseDepreciationDetails: text("expense_depreciation_details"),
  
  // 차량유지비 (유류비, 차량보험료)
  expenseVehicle: integer("expense_vehicle").notNull().default(0),
  expenseVehicleDetails: text("expense_vehicle_details"),
  
  // 교육운영비 (교재비, 온라인 플랫폼 사용료)
  expenseEducation: integer("expense_education").notNull().default(0),
  expenseEducationDetails: text("expense_education_details"),
  
  // 기타판관비 (회의비)
  expenseOther: integer("expense_other").notNull().default(0),
  expenseOtherDetails: text("expense_other_details"),
  
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertMonthlyFinancialRecordSchema = createInsertSchema(monthlyFinancialRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMonthlyFinancialRecord = z.infer<typeof insertMonthlyFinancialRecordSchema>;
export type MonthlyFinancialRecord = typeof monthlyFinancialRecords.$inferSelect;

// Financial expense categories for UI
export const FinancialExpenseCategories = {
  // 인건비 그룹
  labor: {
    label: "인건비",
    group: "인건비",
    items: [
      { key: "expenseRegularSalary", label: "정규선생님 급여" },
      { key: "expensePartTimeSalary", label: "파트선생님 급여" },
      { key: "expenseHourlySalary", label: "아르바이트 급여" },
      { key: "expenseEmployeeInsurance", label: "4대보험" },
    ],
  },
  // 고정비 그룹 - 매달 유지되는 금액
  rent: {
    label: "임대료 및 관리비",
    group: "고정비",
    items: [{ key: "expenseRent", label: "임대료 및 관리비" }],
  },
  utilities: {
    label: "수도광열비",
    group: "고정비",
    items: [{ key: "expenseUtilities", label: "전기, 수도, 가스" }],
  },
  communication: {
    label: "통신비",
    group: "고정비",
    items: [{ key: "expenseCommunication", label: "인터넷, 전화" }],
  },
  insurance: {
    label: "보험료",
    group: "고정비",
    items: [{ key: "expenseInsurance", label: "화재보험, 학원 책임보험" }],
  },
  depreciation: {
    label: "감가상각비",
    group: "고정비",
    items: [{ key: "expenseDepreciation", label: "인테리어, 집기, 컴퓨터" }],
  },
  // 판관비 그룹
  welfare: {
    label: "복리후생비",
    group: "판관비",
    items: [{ key: "expenseWelfare", label: "간식비, 회식비, 직원교육비" }],
  },
  supplies: {
    label: "소모품비",
    group: "판관비",
    items: [{ key: "expenseSupplies", label: "복사용지, 사무용품" }],
  },
  advertising: {
    label: "광고선전비",
    group: "판관비",
    items: [{ key: "expenseAdvertising", label: "광고선전비" }],
  },
  fees: {
    label: "지급수수료",
    group: "판관비",
    items: [{ key: "expenseFees", label: "세무회계 대행료, 외주개발비, 카드수수료" }],
  },
  vehicle: {
    label: "차량유지비",
    group: "판관비",
    items: [{ key: "expenseVehicle", label: "유류비, 차량보험료" }],
  },
  education: {
    label: "교육운영비",
    group: "판관비",
    items: [{ key: "expenseEducation", label: "교재비, 온라인 플랫폼 사용료" }],
  },
  other: {
    label: "기타판관비",
    group: "판관비",
    items: [{ key: "expenseOther", label: "회의비" }],
  },
} as const;

// Teacher Salary Settings (선생님 급여 설정 - 정규직/파트타임)
export const teacherSalarySettings = pgTable("teacher_salary_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teacherId: varchar("teacher_id").notNull(),
  centerId: varchar("center_id").notNull(),
  baseSalary: integer("base_salary").notNull().default(0), // 기본급 (월)
  classBasePay: integer("class_base_pay").notNull().default(0), // 수업당 기본급 (중등) - legacy, kept for backwards compatibility
  classBasePayMiddle: integer("class_base_pay_middle").notNull().default(0), // 중등 수업당 기본급
  classBasePayHigh: integer("class_base_pay_high").notNull().default(0), // 고등 수업당 기본급
  studentThreshold: integer("student_threshold").notNull().default(0), // 기준 인원 (legacy)
  studentThresholdMiddle: integer("student_threshold_middle").notNull().default(0), // 중등 기준 인원
  studentThresholdHigh: integer("student_threshold_high").notNull().default(0), // 고등 기준 인원
  perStudentBonus: integer("per_student_bonus").notNull().default(0), // 초과 학생당 추가금 (legacy)
  perStudentBonusMiddle: integer("per_student_bonus_middle").notNull().default(0), // 중등 초과 학생당 추가금
  perStudentBonusHigh: integer("per_student_bonus_high").notNull().default(0), // 고등 초과 학생당 추가금
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  teacherCenterUnique: uniqueIndex("teacher_center_unique").on(table.teacherId, table.centerId),
}));

export const insertTeacherSalarySettingsSchema = createInsertSchema(teacherSalarySettings).pick({
  teacherId: true,
  centerId: true,
  baseSalary: true,
  classBasePay: true,
  classBasePayMiddle: true,
  classBasePayHigh: true,
  studentThreshold: true,
  studentThresholdMiddle: true,
  studentThresholdHigh: true,
  perStudentBonus: true,
  perStudentBonusMiddle: true,
  perStudentBonusHigh: true,
});
export type InsertTeacherSalarySettings = z.infer<typeof insertTeacherSalarySettingsSchema>;
export type TeacherSalarySettings = typeof teacherSalarySettings.$inferSelect;

// Teacher salary adjustments - 급여 조정 항목 (플러스/마이너스)
export const teacherSalaryAdjustments = pgTable("teacher_salary_adjustments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teacherId: varchar("teacher_id").notNull(),
  centerId: varchar("center_id").notNull(),
  yearMonth: varchar("year_month", { length: 7 }).notNull(), // YYYY-MM 형식
  amount: integer("amount").notNull(), // 양수: 추가, 음수: 차감
  description: text("description").notNull(), // 조정 사유
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"), // 생성한 관리자 ID
});

export const insertTeacherSalaryAdjustmentSchema = createInsertSchema(teacherSalaryAdjustments).pick({
  teacherId: true,
  centerId: true,
  yearMonth: true,
  amount: true,
  description: true,
  createdBy: true,
});
export type InsertTeacherSalaryAdjustment = z.infer<typeof insertTeacherSalaryAdjustmentSchema>;
export type TeacherSalaryAdjustment = typeof teacherSalaryAdjustments.$inferSelect;

// Points system (학생 포인트)
export const studentPoints = pgTable("student_points", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull(),
  totalPoints: integer("total_points").notNull().default(0),
  availablePoints: integer("available_points").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertStudentPointsSchema = createInsertSchema(studentPoints).pick({
  studentId: true,
  totalPoints: true,
  availablePoints: true,
});
export type InsertStudentPoints = z.infer<typeof insertStudentPointsSchema>;
export type StudentPoints = typeof studentPoints.$inferSelect;

// Points transactions (포인트 내역)
export const pointTransactions = pgTable("point_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull(),
  amount: integer("amount").notNull(), // positive = earned, negative = used
  type: text("type").notNull(), // attendance, homework, test, manual, usage
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"), // teacher/admin who created manual transaction
});

export const insertPointTransactionSchema = createInsertSchema(pointTransactions).pick({
  studentId: true,
  amount: true,
  type: true,
  description: true,
  createdBy: true,
});
export type InsertPointTransaction = z.infer<typeof insertPointTransactionSchema>;
export type PointTransaction = typeof pointTransactions.$inferSelect;

// Class plans (수업 계획)
export const classPlans = pgTable("class_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  classId: varchar("class_id").notNull(),
  planType: text("plan_type").notNull(), // weekly, monthly
  periodStart: date("period_start").notNull(), // week start or month start
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by"),
});

export const insertClassPlanSchema = createInsertSchema(classPlans).pick({
  classId: true,
  planType: true,
  periodStart: true,
  content: true,
  createdBy: true,
});
export type InsertClassPlan = z.infer<typeof insertClassPlanSchema>;
export type ClassPlan = typeof classPlans.$inferSelect;

// Announcements (공지사항)
// Target types: class (반별), grade (학년별), students (학생 선택)
export const AnnouncementTargetType = {
  CLASS: "class",     // 반별
  GRADE: "grade",     // 학년별
  STUDENTS: "students", // 학생 선택
} as const;
export type AnnouncementTargetTypeValue = typeof AnnouncementTargetType[keyof typeof AnnouncementTargetType];

export const announcements = pgTable("announcements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  createdById: varchar("created_by_id").notNull(),
  
  title: text("title").notNull(),
  content: text("content").notNull(),
  
  // Targeting
  targetType: text("target_type").notNull(), // class, grade, students
  targetIds: text("target_ids").array().notNull(), // class IDs, grade values, or student IDs
  
  // SMS notification
  smsSentAt: timestamp("sms_sent_at"),
  smsStatus: text("sms_status"), // pending, sent, partial, failed
  smsRecipients: text("sms_recipients"), // JSON: [{phone, studentName, sentAt, status}]
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAnnouncementSchema = createInsertSchema(announcements).pick({
  createdById: true,
  title: true,
  content: true,
  targetType: true,
  targetIds: true,
  smsSentAt: true,
  smsStatus: true,
  smsRecipients: true,
});
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type Announcement = typeof announcements.$inferSelect;

// Calendar Events (학원 캘린더)
export const CalendarEventType = {
  SCHOOL_EXAM: "school_exam",     // 학교 시험일정
  SCHOOL_EVENT: "school_event",   // 학교일정
  ACADEMY_EVENT: "academy_event", // 학원일정
} as const;
export type CalendarEventTypeValue = typeof CalendarEventType[keyof typeof CalendarEventType];

export const calendarEvents = pgTable("calendar_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  eventType: text("event_type").notNull(), // school_exam, school_event, academy_event
  schoolName: text("school_name"), // 학교명 (for school events)
  startDate: date("start_date").notNull(),
  endDate: date("end_date"), // optional, for multi-day events
  color: text("color"), // optional custom color
  createdById: varchar("created_by_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCalendarEventSchema = createInsertSchema(calendarEvents).pick({
  title: true,
  description: true,
  eventType: true,
  schoolName: true,
  startDate: true,
  endDate: true,
  color: true,
  createdById: true,
});
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type CalendarEvent = typeof calendarEvents.$inferSelect;

// Re-export chat models for OpenAI integration
export * from "./models/chat";
