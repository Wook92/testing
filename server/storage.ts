import { 
  type User, type InsertUser,
  type Center, type InsertCenter,
  type UserCenter, type InsertUserCenter,
  type Class, type InsertClass,
  type Enrollment, type InsertEnrollment,
  type Homework, type InsertHomework,
  type HomeworkSubmission, type InsertHomeworkSubmission,
  type Assessment, type InsertAssessment,
  type ClassVideo, type InsertClassVideo,
  type Textbook, type InsertTextbook,
  type TextbookVideo, type InsertTextbookVideo,
  type ClinicAssignment, type InsertClinicAssignment,
  type ClinicAssignmentStep, type InsertClinicAssignmentStep,
  type ClinicAssignmentFile, type InsertClinicAssignmentFile,
  type ClinicComment, type InsertClinicComment,
  type ClinicProgressLog, type InsertClinicProgressLog,
  type ClinicAssignmentWithDetails,
  type ClinicStudent, type InsertClinicStudent,
  type ClinicWeeklyRecord, type InsertClinicWeeklyRecord,
  type ClinicStudentWithDetails,
  type ClinicResource, type InsertClinicResource,
  type ClinicResourceWithUploader,
  type ClinicDailyNote, type InsertClinicDailyNote,
  type ClinicDailyNoteWithCreator,
  type AttendancePin, type InsertAttendancePin,
  type TeacherCheckInSettings, type InsertTeacherCheckInSettings,
  type AttendanceRecord, type InsertAttendanceRecord,
  type TeacherWorkRecord, type InsertTeacherWorkRecord,
  type MessageTemplate, type InsertMessageTemplate,
  type NotificationLog, type InsertNotificationLog,
  type AttendancePinWithStudent, type AttendanceRecordWithStudent, type AttendanceRecordWithClass,
  type ClassNote, type InsertClassNote,
  type StudentClassNote, type InsertStudentClassNote,
  type ClassNoteWithTeacher, type StudentClassNoteWithDetails,
  type SolapiCredentials, type InsertSolapiCredentials,
  type StudyCafeSettings, type InsertStudyCafeSettings,
  type StudyCafeSeat, type InsertStudyCafeSeat,
  type StudyCafeReservation, type InsertStudyCafeReservation,
  type StudyCafeFixedSeat, type InsertStudyCafeFixedSeat,
  type StudyCafeSeatWithStatus,
  type TuitionAccessPassword,
  type TuitionGuidance,
  type TuitionNotification, type InsertTuitionNotification,
  type StudentMonthlyReport, type InsertStudentMonthlyReport,
  type Notification, type InsertNotification,
  type Todo, type InsertTodo,
  type TodoAssignee, type InsertTodoAssignee,
  type TodoWithDetails,
  type StudentExitRecord, type InsertStudentExitRecord,
  type MonthlyStudentSnapshot, type InsertMonthlyStudentSnapshot,
  UserRole,
  users,
  centers,
  userCenters,
  classes,
  enrollments,
  homework,
  homeworkSubmissions,
  assessments,
  classVideos,
  textbooks,
  textbookVideos,
  clinicAssignments,
  clinicAssignmentSteps,
  clinicAssignmentFiles,
  clinicComments,
  clinicProgressLogs,
  clinicStudents,
  clinicWeeklyRecords,
  clinicResources,
  clinicDailyNotes,
  clinicInstructionDefaults,
  clinicWeeklyRecordFiles,
  clinicSharedInstructionGroups,
  clinicSharedInstructionMembers,
  type ClinicInstructionDefault, type InsertClinicInstructionDefault,
  type ClinicWeeklyRecordFile, type InsertClinicWeeklyRecordFile,
  type ClinicSharedInstructionGroup, type InsertClinicSharedInstructionGroup,
  type ClinicSharedInstructionMember, type InsertClinicSharedInstructionMember,
  type ClinicSharedInstructionGroupWithMembers,
  attendancePins,
  teacherCheckInSettings,
  attendanceRecords,
  teacherWorkRecords,
  messageTemplates,
  notificationLogs,
  classNotes,
  studentClassNotes,
  solapiCredentials,
  studyCafeSettings,
  studyCafeSeats,
  studyCafeReservations,
  studyCafeFixedSeats,
  tuitionAccessPasswords,
  tuitionGuidances,
  tuitionNotifications,
  studentMonthlyReports,
  systemSettings,
  notifications,
  todos,
  todoAssignees,
  studentExitRecords,
  monthlyStudentSnapshots,
  marketingCampaigns,
  type MarketingCampaign, type InsertMarketingCampaign,
  monthlyFinancialRecords,
  type MonthlyFinancialRecord, type InsertMonthlyFinancialRecord,
  type SystemSetting,
  teacherSalarySettings,
  type TeacherSalarySettings, type InsertTeacherSalarySettings,
  teacherSalaryAdjustments,
  type TeacherSalaryAdjustment, type InsertTeacherSalaryAdjustment,
  studentTextbookPurchases,
  type StudentTextbookPurchase, type InsertStudentTextbookPurchase,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, inArray, lt, desc, gte, lte, isNull } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(centerId?: string): Promise<User[]>;
  deleteUser(id: string): Promise<void>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User>;
  updateUserPassword(id: string, password: string): Promise<void>;

  getCenter(id: string): Promise<Center | undefined>;
  getCenters(): Promise<Center[]>;
  createCenter(center: InsertCenter): Promise<Center>;
  updateCenter(id: string, data: Partial<InsertCenter>): Promise<Center>;
  deleteCenter(id: string): Promise<void>;
  getCenterStats(): Promise<any[]>;

  getUserCenters(userId: string): Promise<Center[]>;
  addUserToCenter(data: InsertUserCenter): Promise<UserCenter>;
  removeUserFromCenter(userId: string, centerId: string): Promise<void>;
  getCenterUsers(centerId: string, role?: number): Promise<User[]>;

  getClass(id: string): Promise<Class | undefined>;
  getClasses(centerId?: string, includeArchived?: boolean): Promise<Class[]>;
  createClass(cls: InsertClass): Promise<Class>;
  updateClass(id: string, data: Partial<InsertClass>): Promise<Class>;
  deleteClass(id: string): Promise<void>;
  getClassStudents(classId: string): Promise<User[]>;

  getEnrollment(studentId: string, classId: string): Promise<Enrollment | undefined>;
  getEnrollmentById(id: string): Promise<Enrollment | undefined>;
  getStudentEnrollments(studentId: string): Promise<Enrollment[]>;
  getClassEnrollments(classId: string): Promise<Enrollment[]>;
  createEnrollment(enrollment: InsertEnrollment): Promise<Enrollment>;
  deleteEnrollment(id: string): Promise<void>;
  checkTimeConflict(studentId: string, newClass: Class): Promise<boolean>;

  getHomework(id: string): Promise<Homework | undefined>;
  getHomeworkByClass(classId: string): Promise<Homework[]>;
  getHomeworkByCenter(centerId: string): Promise<Homework[]>;
  getStudentHomework(studentId: string): Promise<Homework[]>;
  createHomework(homework: InsertHomework): Promise<Homework>;
  updateHomework(id: string, data: Partial<InsertHomework>): Promise<Homework>;
  deleteHomework(id: string): Promise<void>;

  getSubmission(id: string): Promise<HomeworkSubmission | undefined>;
  getSubmissionByHomeworkAndStudent(homeworkId: string, studentId: string): Promise<HomeworkSubmission | undefined>;
  getSubmissionsByCenter(centerId: string): Promise<any[]>;
  getStudentSubmissions(studentId: string): Promise<HomeworkSubmission[]>;
  getSubmissionPhotos(id: string): Promise<string[]>;
  createSubmission(submission: InsertHomeworkSubmission): Promise<HomeworkSubmission>;
  updateSubmission(id: string, data: Partial<InsertHomeworkSubmission>): Promise<HomeworkSubmission>;

  getAssessment(id: string): Promise<Assessment | undefined>;
  getAssessmentsByCenter(centerId: string): Promise<any[]>;
  getStudentAssessments(studentId: string, month?: string): Promise<any[]>;
  createAssessments(assessments: InsertAssessment[]): Promise<Assessment[]>;
  updateAssessment(id: string, data: { score: number; maxScore?: number }): Promise<Assessment>;
  deleteAssessment(id: string): Promise<void>;

  getClassVideos(centerId?: string): Promise<ClassVideo[]>;
  createClassVideo(video: InsertClassVideo): Promise<ClassVideo>;
  updateClassVideo(id: string, data: Partial<InsertClassVideo>): Promise<ClassVideo>;
  deleteClassVideo(id: string): Promise<void>;

  getTextbooks(): Promise<Textbook[]>;
  createTextbook(textbook: InsertTextbook): Promise<Textbook>;
  updateTextbook(id: string, data: Partial<InsertTextbook>): Promise<Textbook>;
  deleteTextbook(id: string): Promise<void>;

  getTextbookVideos(textbookId: string): Promise<TextbookVideo[]>;
  createTextbookVideo(video: InsertTextbookVideo): Promise<TextbookVideo>;
  updateTextbookVideo(id: string, data: Partial<InsertTextbookVideo>): Promise<TextbookVideo>;
  deleteTextbookVideo(id: string): Promise<void>;

  // Clinic methods
  getClinicAssignment(id: string): Promise<ClinicAssignmentWithDetails | undefined>;
  getClinicAssignments(options: { centerId?: string; regularTeacherId?: string; clinicTeacherId?: string; studentId?: string }): Promise<ClinicAssignmentWithDetails[]>;
  createClinicAssignment(assignment: InsertClinicAssignment): Promise<ClinicAssignment>;
  updateClinicAssignment(id: string, data: Partial<InsertClinicAssignment>): Promise<ClinicAssignment>;
  deleteClinicAssignment(id: string): Promise<void>;

  createClinicAssignmentStep(step: InsertClinicAssignmentStep): Promise<ClinicAssignmentStep>;
  updateClinicAssignmentStep(id: string, data: Partial<InsertClinicAssignmentStep>): Promise<ClinicAssignmentStep>;
  deleteClinicAssignmentStep(id: string): Promise<void>;

  createClinicAssignmentFile(file: InsertClinicAssignmentFile): Promise<ClinicAssignmentFile>;
  deleteClinicAssignmentFile(id: string): Promise<void>;

  createClinicComment(comment: InsertClinicComment): Promise<ClinicComment>;
  deleteClinicComment(id: string): Promise<void>;

  getClinicProgressLogs(assignmentId: string): Promise<ClinicProgressLog[]>;
  createClinicProgressLog(log: InsertClinicProgressLog): Promise<ClinicProgressLog>;
  updateClinicProgressLog(id: string, data: Partial<InsertClinicProgressLog>): Promise<ClinicProgressLog>;

  // New Clinic System (Weekly Workflow)
  getClinicStudent(id: string): Promise<ClinicStudentWithDetails | undefined>;
  getClinicStudentByStudentAndCenter(studentId: string, centerId: string): Promise<ClinicStudent | undefined>;
  getClinicStudentByStudentCenterAndType(studentId: string, centerId: string, clinicType: string): Promise<ClinicStudent | undefined>;
  getClinicStudents(centerId: string): Promise<ClinicStudentWithDetails[]>;
  createClinicStudent(student: InsertClinicStudent): Promise<ClinicStudent>;
  updateClinicStudent(id: string, data: Partial<InsertClinicStudent>): Promise<ClinicStudent>;
  deleteClinicStudent(id: string): Promise<void>;

  getClinicWeeklyRecord(id: string): Promise<ClinicWeeklyRecord | undefined>;
  getClinicWeeklyRecords(clinicStudentId: string, weekStartDate?: string): Promise<ClinicWeeklyRecord[]>;
  getClinicWeeklyRecordsByCenter(centerId: string, weekStartDate: string): Promise<(ClinicWeeklyRecord & { clinicStudent?: ClinicStudentWithDetails })[]>;
  getClinicWeeklyRecordsByMonth(centerId: string, year: number, month: number): Promise<(ClinicWeeklyRecord & { clinicStudent?: ClinicStudentWithDetails })[]>;
  createClinicWeeklyRecord(record: InsertClinicWeeklyRecord): Promise<ClinicWeeklyRecord>;
  updateClinicWeeklyRecord(id: string, data: Partial<InsertClinicWeeklyRecord>): Promise<ClinicWeeklyRecord>;
  deleteClinicWeeklyRecord(id: string): Promise<void>;
  deleteOldClinicWeeklyRecords(centerId: string, beforeDate: string): Promise<number>;

  // Clinic Resources (자료 모음)
  getClinicResource(id: string): Promise<ClinicResource | undefined>;
  getClinicResources(centerId: string): Promise<ClinicResourceWithUploader[]>;
  createClinicResource(resource: InsertClinicResource): Promise<ClinicResource>;
  deleteClinicResource(id: string): Promise<void>;
  deleteOldTemporaryClinicResources(beforeDate: string): Promise<{ count: number; filePaths: string[] }>;

  // Clinic Daily Notes (날짜별 기록)
  getClinicDailyNotes(clinicStudentId: string): Promise<ClinicDailyNoteWithCreator[]>;
  createClinicDailyNote(note: InsertClinicDailyNote): Promise<ClinicDailyNote>;
  updateClinicDailyNote(id: string, data: Partial<InsertClinicDailyNote>): Promise<ClinicDailyNote>;
  deleteClinicDailyNote(id: string): Promise<void>;

  // Attendance System (출결 시스템)
  getAttendancePinByPin(centerId: string, pin: string): Promise<AttendancePinWithStudent | undefined>;
  getAttendancePins(centerId: string): Promise<AttendancePinWithStudent[]>;
  getAttendancePinByStudent(studentId: string, centerId: string): Promise<AttendancePin | undefined>;
  createAttendancePin(data: InsertAttendancePin): Promise<AttendancePin>;
  updateAttendancePin(id: string, data: Partial<InsertAttendancePin>): Promise<AttendancePin>;
  deleteAttendancePin(id: string): Promise<void>;

  // Teacher Check-in Settings (선생님 출근 설정)
  getTeacherCheckInSettings(teacherId: string, centerId: string): Promise<TeacherCheckInSettings | undefined>;
  getTeacherCheckInSettingsByCode(centerId: string, code: string): Promise<(TeacherCheckInSettings & { teacher?: User }) | undefined>;
  getAllTeacherCheckInSettings(centerId: string): Promise<TeacherCheckInSettings[]>;
  createTeacherCheckInSettings(data: InsertTeacherCheckInSettings): Promise<TeacherCheckInSettings>;
  updateTeacherCheckInSettings(id: string, data: Partial<InsertTeacherCheckInSettings>): Promise<TeacherCheckInSettings>;
  deleteTeacherCheckInSettings(id: string): Promise<void>;

  getAttendanceRecords(centerId: string, date: string): Promise<AttendanceRecordWithStudent[]>;
  getAttendanceRecordByStudentAndDate(studentId: string, date: string): Promise<AttendanceRecord | undefined>;
  getAttendanceRecordByStudentDateAndClass(studentId: string, date: string, classId: string): Promise<AttendanceRecord | undefined>;
  getStudentEnrolledClasses(studentId: string, centerId: string): Promise<Class[]>;
  createAttendanceRecord(data: InsertAttendanceRecord): Promise<AttendanceRecord>;
  createAttendanceRecordCheckOutOnly(data: { studentId: string; centerId: string; checkInDate: string; checkOutAt: Date }): Promise<AttendanceRecord>;
  updateAttendanceRecord(id: string, data: Partial<AttendanceRecord>): Promise<AttendanceRecord>;
  updateAttendanceRecordCheckOut(id: string, checkOutTime: Date): Promise<void>;
  updateAttendanceRecordCheckOutNotificationSent(id: string): Promise<void>;
  getAttendanceRecordsForStudent(studentId: string, startDate: string, endDate: string): Promise<AttendanceRecordWithClass[]>;
  deleteOldAttendanceRecords(beforeDate: string): Promise<number>;

  // Teacher Work Records (선생님 출퇴근 기록)
  getTeacherWorkRecords(centerId: string, startDate: string, endDate: string): Promise<TeacherWorkRecord[]>;
  getTeacherWorkRecordByDate(teacherId: string, centerId: string, workDate: string): Promise<TeacherWorkRecord | undefined>;
  createTeacherWorkRecord(data: InsertTeacherWorkRecord): Promise<TeacherWorkRecord>;
  updateTeacherWorkRecord(id: string, data: Partial<InsertTeacherWorkRecord>): Promise<TeacherWorkRecord>;
  getTeacherWorkRecordsWithoutCheckOut(date: string): Promise<TeacherWorkRecord[]>;
  markTeacherWorkRecordNoCheckOut(id: string): Promise<void>;
  markMissingCheckOuts(workDate: string): Promise<number>;
  deleteOldTeacherWorkRecords(beforeDate: string): Promise<number>;

  getMessageTemplates(centerId: string): Promise<MessageTemplate[]>;
  getMessageTemplate(id: string): Promise<MessageTemplate | undefined>;
  createMessageTemplate(data: InsertMessageTemplate): Promise<MessageTemplate>;
  updateMessageTemplate(id: string, data: Partial<InsertMessageTemplate>): Promise<MessageTemplate>;
  deleteMessageTemplate(id: string): Promise<void>;

  createNotificationLog(data: InsertNotificationLog): Promise<NotificationLog>;
  updateNotificationLog(id: string, data: Partial<NotificationLog>): Promise<NotificationLog>;
  getNotificationLogsByAttendanceRecord(attendanceRecordId: string): Promise<NotificationLog[]>;

  // Class Notes (수업 기록)
  getClassNotes(classId: string, noteDate: string): Promise<ClassNoteWithTeacher[]>;
  getClassNote(id: string): Promise<ClassNote | undefined>;
  createClassNote(data: InsertClassNote): Promise<ClassNote>;
  updateClassNote(id: string, data: Partial<InsertClassNote>): Promise<ClassNote>;
  deleteClassNote(id: string): Promise<void>;

  getStudentClassNotes(classId: string, noteDate: string): Promise<StudentClassNoteWithDetails[]>;
  getStudentClassNote(id: string): Promise<StudentClassNote | undefined>;
  createStudentClassNote(data: InsertStudentClassNote): Promise<StudentClassNote>;
  updateStudentClassNote(id: string, data: Partial<InsertStudentClassNote>): Promise<StudentClassNote>;
  deleteStudentClassNote(id: string): Promise<void>;

  // SOLAPI Credentials (센터별 SMS 설정)
  getSolapiCredentials(centerId: string): Promise<SolapiCredentials | undefined>;
  upsertSolapiCredentials(data: InsertSolapiCredentials): Promise<SolapiCredentials>;
  deleteSolapiCredentials(centerId: string): Promise<void>;

  // Study Cafe (스터디카페)
  getStudyCafeSettings(centerId: string): Promise<StudyCafeSettings | undefined>;
  upsertStudyCafeSettings(data: InsertStudyCafeSettings): Promise<StudyCafeSettings>;
  getStudyCafeEnabledCenters(): Promise<StudyCafeSettings[]>;
  
  getStudyCafeSeats(centerId: string): Promise<StudyCafeSeat[]>;
  createStudyCafeSeat(data: InsertStudyCafeSeat): Promise<StudyCafeSeat>;
  updateStudyCafeSeat(id: string, data: Partial<InsertStudyCafeSeat>): Promise<StudyCafeSeat>;
  deleteStudyCafeSeat(id: string): Promise<void>;
  initializeStudyCafeSeats(centerId: string): Promise<StudyCafeSeat[]>;
  
  getStudyCafeSeatsWithStatus(centerId: string): Promise<StudyCafeSeatWithStatus[]>;
  
  getActiveReservation(seatId: string): Promise<StudyCafeReservation | undefined>;
  getStudentActiveReservation(studentId: string, centerId: string): Promise<StudyCafeReservation | undefined>;
  getStudyCafeReservation(id: string): Promise<StudyCafeReservation | undefined>;
  createStudyCafeReservation(data: InsertStudyCafeReservation): Promise<StudyCafeReservation>;
  updateStudyCafeReservation(id: string, data: Partial<InsertStudyCafeReservation>): Promise<StudyCafeReservation>;
  expireOldReservations(): Promise<number>;
  
  getActiveFixedSeat(seatId: string): Promise<StudyCafeFixedSeat | undefined>;
  getStudentActiveFixedSeat(studentId: string, centerId: string): Promise<StudyCafeFixedSeat | undefined>;
  getStudyCafeFixedSeatById(id: string): Promise<StudyCafeFixedSeat | undefined>;
  getFixedSeats(centerId: string): Promise<(StudyCafeFixedSeat & { student?: User; seat?: StudyCafeSeat })[]>;
  createStudyCafeFixedSeat(data: InsertStudyCafeFixedSeat): Promise<StudyCafeFixedSeat>;
  updateStudyCafeFixedSeat(id: string, data: Partial<InsertStudyCafeFixedSeat>): Promise<StudyCafeFixedSeat>;
  deleteStudyCafeFixedSeat(id: string): Promise<void>;
  expireOldFixedSeats(): Promise<number>;

  // Tuition Access Passwords (수강료 열람 비밀번호)
  getTuitionAccessPassword(studentId: string): Promise<TuitionAccessPassword | undefined>;
  setTuitionAccessPassword(studentId: string, password: string): Promise<TuitionAccessPassword>;
  deleteTuitionAccessPassword(studentId: string): Promise<void>;

  // Tuition Guidance (교육비 안내)
  getTuitionGuidance(centerId: string): Promise<TuitionGuidance | undefined>;
  upsertTuitionGuidance(centerId: string, data: { guidanceText?: string | null; imageUrls?: string[] }): Promise<TuitionGuidance>;

  // Tuition Notifications (교육비 안내 문자)
  getTuitionNotifications(centerId: string): Promise<(TuitionNotification & { student?: User; parent?: User; sender?: User })[]>;
  getTuitionNotificationsByStudent(studentId: string): Promise<TuitionNotification[]>;
  createTuitionNotification(data: InsertTuitionNotification): Promise<TuitionNotification>;

  // Student Monthly Reports (학생 월간 보고서)
  getStudentMonthlyReport(id: string): Promise<StudentMonthlyReport | undefined>;
  getStudentMonthlyReportByMonth(studentId: string, year: number, month: number): Promise<StudentMonthlyReport | undefined>;
  getStudentMonthlyReports(centerId: string, year: number, month: number): Promise<(StudentMonthlyReport & { student?: User; creator?: User })[]>;
  createStudentMonthlyReport(data: InsertStudentMonthlyReport): Promise<StudentMonthlyReport>;
  updateStudentMonthlyReport(id: string, data: Partial<InsertStudentMonthlyReport>): Promise<StudentMonthlyReport>;
  deleteStudentMonthlyReport(id: string): Promise<void>;

  // Notifications (알림)
  getNotifications(userId: string): Promise<Notification[]>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string): Promise<void>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  deleteNotification(id: string): Promise<void>;

  // Todos (투두리스트)
  getTodo(id: string): Promise<TodoWithDetails | undefined>;
  getTodos(centerId: string, assigneeId?: string): Promise<TodoWithDetails[]>;
  getTodosByDate(centerId: string, date: string, assigneeId?: string): Promise<TodoWithDetails[]>;
  createTodo(todo: InsertTodo, assigneeIds: string[]): Promise<TodoWithDetails>;
  updateTodo(id: string, data: Partial<InsertTodo>, assigneeIds?: string[]): Promise<Todo>;
  deleteTodo(id: string): Promise<void>;
  
  // Todo Assignees
  toggleTodoComplete(todoId: string, assigneeId: string, date: string): Promise<TodoAssignee>;
  getTodoAssignees(todoId: string): Promise<(TodoAssignee & { user?: User })[]>;
  isTodoCompletedForDate(todoId: string, assigneeId: string, date: string): Promise<boolean>;

  // Student Exit Records (학생 퇴원 기록)
  createStudentExitRecord(data: InsertStudentExitRecord): Promise<StudentExitRecord>;
  getStudentExitRecords(centerId: string): Promise<StudentExitRecord[]>;
  getMonthlyExitSummary(centerId: string, months: number): Promise<{ month: string; exitCount: number; reasons: Record<string, number> }[]>;
  
  // Monthly Student Snapshots (월별 학생 수)
  getOrCreateMonthlySnapshot(centerId: string, month: string): Promise<MonthlyStudentSnapshot>;
  getMonthlyStudentSnapshots(centerId: string, months: number): Promise<MonthlyStudentSnapshot[]>;
  updateMonthlyStudentCount(centerId: string, month: string): Promise<MonthlyStudentSnapshot>;

  // Marketing Campaigns (마케팅 캠페인)
  getMarketingCampaigns(centerId: string, year?: number): Promise<MarketingCampaign[]>;
  getMarketingCampaign(id: string): Promise<MarketingCampaign | undefined>;
  createMarketingCampaign(data: InsertMarketingCampaign): Promise<MarketingCampaign>;
  updateMarketingCampaign(id: string, data: Partial<InsertMarketingCampaign>): Promise<MarketingCampaign>;
  deleteMarketingCampaign(id: string): Promise<void>;

  // Monthly Financial Records
  getMonthlyFinancialRecords(centerId: string, year?: number): Promise<MonthlyFinancialRecord[]>;
  getMonthlyFinancialRecord(centerId: string, yearMonth: string): Promise<MonthlyFinancialRecord | undefined>;
  getMonthlyFinancialRecordById(id: string): Promise<MonthlyFinancialRecord | undefined>;
  createMonthlyFinancialRecord(data: InsertMonthlyFinancialRecord): Promise<MonthlyFinancialRecord>;
  updateMonthlyFinancialRecord(id: string, data: Partial<InsertMonthlyFinancialRecord>): Promise<MonthlyFinancialRecord>;
  deleteMonthlyFinancialRecord(id: string): Promise<void>;

  // Teacher Salary Settings (선생님 급여 설정)
  getTeacherSalarySettings(teacherId: string, centerId: string): Promise<TeacherSalarySettings | undefined>;
  getTeacherSalarySettingsByCenter(centerId: string): Promise<TeacherSalarySettings[]>;
  createTeacherSalarySettings(data: InsertTeacherSalarySettings): Promise<TeacherSalarySettings>;
  updateTeacherSalarySettings(id: string, data: Partial<InsertTeacherSalarySettings>): Promise<TeacherSalarySettings>;
  deleteTeacherSalarySettings(id: string): Promise<void>;

  // Teacher Salary Adjustments (급여 조정 항목)
  getTeacherSalaryAdjustments(teacherId: string, centerId: string, yearMonth: string): Promise<TeacherSalaryAdjustment[]>;
  getTeacherSalaryAdjustmentsByCenter(centerId: string, yearMonth: string): Promise<TeacherSalaryAdjustment[]>;
  createTeacherSalaryAdjustment(data: InsertTeacherSalaryAdjustment): Promise<TeacherSalaryAdjustment>;
  updateTeacherSalaryAdjustment(id: string, data: Partial<InsertTeacherSalaryAdjustment>): Promise<TeacherSalaryAdjustment>;
  deleteTeacherSalaryAdjustment(id: string): Promise<void>;

  // Student Textbook Purchases (학생 교재비)
  getStudentTextbookPurchases(studentId: string): Promise<StudentTextbookPurchase[]>;
  getStudentTextbookPurchasesByCenter(centerId: string): Promise<StudentTextbookPurchase[]>;
  createStudentTextbookPurchase(data: InsertStudentTextbookPurchase): Promise<StudentTextbookPurchase>;
  updateStudentTextbookPurchase(id: string, data: Partial<InsertStudentTextbookPurchase>): Promise<StudentTextbookPurchase>;
  deleteStudentTextbookPurchase(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
    return result[0];
  }

  async checkUserExists(normalizedPhone: string | null, normalizedUsername: string): Promise<User | undefined> {
    // Efficient DB query instead of loading all users
    if (normalizedPhone) {
      const byPhone = await db.select().from(users).where(
        or(eq(users.phone, normalizedPhone), eq(users.username, normalizedPhone))
      ).limit(1);
      if (byPhone[0]) return byPhone[0];
    }
    const byUsername = await db.select().from(users).where(eq(users.username, normalizedUsername)).limit(1);
    return byUsername[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values({
      ...insertUser,
      role: insertUser.role ?? UserRole.STUDENT,
    }).returning();
    return result[0];
  }

  async getUsers(centerId?: string): Promise<User[]> {
    if (!centerId) {
      return await db.select().from(users);
    }
    const ucs = await db.select().from(userCenters).where(eq(userCenters.centerId, centerId));
    const userIds = ucs.map((uc) => uc.userId);
    if (userIds.length === 0) return [];
    return await db.select().from(users).where(inArray(users.id, userIds));
  }

  async deleteUser(id: string): Promise<void> {
    // Get user to check role
    const user = await this.getUser(id);
    
    // If teacher or higher, archive their classes instead of deleting
    // This preserves homework/assessment history for students
    if (user && user.role >= UserRole.TEACHER) {
      // Find all classes taught by this teacher
      const teacherClasses = await db.select().from(classes).where(eq(classes.teacherId, id));
      const classIds = teacherClasses.map(c => c.id);
      
      if (classIds.length > 0) {
        // Delete class videos (teacher's content)
        await db.delete(classVideos).where(inArray(classVideos.classId, classIds));
        
        // Archive classes: set isArchived=true, save teacher name, clear teacherId
        for (const cls of teacherClasses) {
          await db.update(classes).set({
            isArchived: true,
            teacherName: user.name,
            teacherId: null,
          }).where(eq(classes.id, cls.id));
        }
      }
    }
    
    // For students: delete their enrollments but keep homework/assessment records for history
    await db.delete(enrollments).where(eq(enrollments.studentId, id));
    
    // Delete user center associations
    await db.delete(userCenters).where(eq(userCenters.userId, id));
    
    // Delete user
    await db.delete(users).where(eq(users.id, id));
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User> {
    const result = await db.update(users).set(data).where(eq(users.id, id)).returning();
    if (!result[0]) throw new Error("User not found");
    return result[0];
  }

  async updateUserPassword(id: string, password: string): Promise<void> {
    await db.update(users).set({ password }).where(eq(users.id, id));
  }

  async getCenter(id: string): Promise<Center | undefined> {
    const result = await db.select().from(centers).where(eq(centers.id, id));
    return result[0];
  }

  async getCenters(): Promise<Center[]> {
    return await db.select().from(centers);
  }

  async createCenter(center: InsertCenter): Promise<Center> {
    const result = await db.insert(centers).values(center).returning();
    return result[0];
  }

  async updateCenter(id: string, data: Partial<InsertCenter>): Promise<Center> {
    const result = await db.update(centers).set(data).where(eq(centers.id, id)).returning();
    if (!result[0]) throw new Error("Center not found");
    return result[0];
  }

  async deleteCenter(id: string): Promise<void> {
    await db.delete(centers).where(eq(centers.id, id));
  }

  async getCenterStats(): Promise<any[]> {
    // Optimized: fetch all data in parallel with fewer queries
    const [allCenters, allUserCenters, allUsers, allClasses] = await Promise.all([
      db.select().from(centers),
      db.select().from(userCenters),
      db.select({ id: users.id, role: users.role }).from(users),
      db.select({ id: classes.id, centerId: classes.centerId }).from(classes),
    ]);

    // Create lookup maps for efficient access
    const userRoleMap = new Map(allUsers.map(u => [u.id, u.role]));
    
    return allCenters.map(center => {
      const centerUserIds = allUserCenters
        .filter(uc => uc.centerId === center.id)
        .map(uc => uc.userId);
      
      let studentCount = 0;
      let teacherCount = 0;
      for (const userId of centerUserIds) {
        const role = userRoleMap.get(userId);
        if (role === UserRole.STUDENT) studentCount++;
        else if (role === UserRole.TEACHER) teacherCount++;
      }
      
      const classCount = allClasses.filter(c => c.centerId === center.id).length;
      
      return { ...center, studentCount, teacherCount, classCount };
    });
  }

  async getUserCenters(userId: string): Promise<Center[]> {
    const ucs = await db.select().from(userCenters).where(eq(userCenters.userId, userId));
    const centerIds = ucs.map((uc) => uc.centerId);
    if (centerIds.length === 0) return [];
    return await db.select().from(centers).where(inArray(centers.id, centerIds));
  }

  async addUserToCenter(data: InsertUserCenter): Promise<UserCenter> {
    const result = await db.insert(userCenters).values(data).returning();
    return result[0];
  }

  async removeUserFromCenter(userId: string, centerId: string): Promise<void> {
    await db.delete(userCenters).where(and(eq(userCenters.userId, userId), eq(userCenters.centerId, centerId)));
  }

  async getCenterUsers(centerId: string, role?: number): Promise<User[]> {
    const ucs = await db.select().from(userCenters).where(eq(userCenters.centerId, centerId));
    const userIds = ucs.map((uc) => uc.userId);
    if (userIds.length === 0) return [];
    const allUsers = await db.select().from(users).where(inArray(users.id, userIds));
    if (role !== undefined) {
      return allUsers.filter((u) => u.role === role);
    }
    return allUsers;
  }

  async getClass(id: string): Promise<Class | undefined> {
    const result = await db.select().from(classes).where(eq(classes.id, id));
    return result[0];
  }

  async getClasses(centerId?: string, includeArchived: boolean = false): Promise<Class[]> {
    if (!centerId) {
      if (includeArchived) {
        return await db.select().from(classes);
      }
      return await db.select().from(classes).where(eq(classes.isArchived, false));
    }
    if (includeArchived) {
      return await db.select().from(classes).where(eq(classes.centerId, centerId));
    }
    return await db.select().from(classes).where(
      and(eq(classes.centerId, centerId), eq(classes.isArchived, false))
    );
  }

  async createClass(cls: InsertClass): Promise<Class> {
    const result = await db.insert(classes).values(cls).returning();
    return result[0];
  }

  async updateClass(id: string, data: Partial<InsertClass>): Promise<Class> {
    const result = await db.update(classes).set(data).where(eq(classes.id, id)).returning();
    if (!result[0]) throw new Error("Class not found");
    return result[0];
  }

  async deleteClass(id: string): Promise<void> {
    await db.delete(classes).where(eq(classes.id, id));
  }

  async getClassStudents(classId: string): Promise<User[]> {
    const enrs = await db.select().from(enrollments).where(eq(enrollments.classId, classId));
    const studentIds = enrs.map((e) => e.studentId);
    if (studentIds.length === 0) return [];
    return await db.select().from(users).where(inArray(users.id, studentIds));
  }

  async getEnrollment(studentId: string, classId: string): Promise<Enrollment | undefined> {
    const result = await db.select().from(enrollments).where(
      and(eq(enrollments.studentId, studentId), eq(enrollments.classId, classId))
    );
    return result[0];
  }

  async getEnrollmentById(id: string): Promise<Enrollment | undefined> {
    const result = await db.select().from(enrollments).where(eq(enrollments.id, id));
    return result[0];
  }

  async getStudentEnrollments(studentId: string): Promise<Enrollment[]> {
    return await db.select().from(enrollments).where(eq(enrollments.studentId, studentId));
  }

  async getClassEnrollments(classId: string): Promise<Enrollment[]> {
    return await db.select().from(enrollments).where(eq(enrollments.classId, classId));
  }

  async createEnrollment(enrollment: InsertEnrollment): Promise<Enrollment> {
    const result = await db.insert(enrollments).values(enrollment).returning();
    return result[0];
  }

  async deleteEnrollment(id: string): Promise<void> {
    await db.delete(enrollments).where(eq(enrollments.id, id));
  }

  async checkTimeConflict(studentId: string, newClass: Class): Promise<boolean> {
    const studentEnrollments = await this.getStudentEnrollments(studentId);
    for (const enrollment of studentEnrollments) {
      const existingClass = await this.getClass(enrollment.classId);
      if (!existingClass) continue;

      const hasOverlappingDay = newClass.days.some((d) => existingClass.days.includes(d));
      if (!hasOverlappingDay) continue;

      const newStart = parseInt(newClass.startTime.replace(":", ""));
      const newEnd = parseInt(newClass.endTime.replace(":", ""));
      const existStart = parseInt(existingClass.startTime.replace(":", ""));
      const existEnd = parseInt(existingClass.endTime.replace(":", ""));

      if (!(newEnd <= existStart || newStart >= existEnd)) {
        return true;
      }
    }
    return false;
  }

  async getHomework(id: string): Promise<Homework | undefined> {
    const result = await db.select().from(homework).where(eq(homework.id, id));
    return result[0];
  }

  async getHomeworkByClass(classId: string): Promise<Homework[]> {
    return await db.select().from(homework).where(eq(homework.classId, classId));
  }

  async getHomeworkByCenter(centerId: string): Promise<Homework[]> {
    const centerClasses = await db.select().from(classes).where(eq(classes.centerId, centerId));
    const classIds = centerClasses.map((c) => c.id);
    if (classIds.length === 0) return [];
    return await db.select().from(homework).where(inArray(homework.classId, classIds));
  }

  async getStudentHomework(studentId: string): Promise<Homework[]> {
    const studentEnrollments = await this.getStudentEnrollments(studentId);
    const classIds = studentEnrollments.map((e) => e.classId);
    if (classIds.length === 0) return [];
    
    const homeworkList = await db.select().from(homework).where(
      and(
        inArray(homework.classId, classIds),
        or(
          isNull(homework.studentId),
          eq(homework.studentId, studentId)
        )
      )
    );
    if (homeworkList.length === 0) return [];
    
    // Batch fetch classes
    const classData = await db.select().from(classes).where(inArray(classes.id, classIds));
    const classMap = new Map(classData.map(c => [c.id, c]));
    
    return homeworkList.map(h => ({
      ...h,
      class: classMap.get(h.classId),
    }));
  }

  async createHomework(hw: InsertHomework): Promise<Homework> {
    const result = await db.insert(homework).values(hw).returning();
    return result[0];
  }

  async updateHomework(id: string, data: Partial<InsertHomework>): Promise<Homework> {
    const result = await db.update(homework).set(data).where(eq(homework.id, id)).returning();
    if (!result[0]) throw new Error("Homework not found");
    return result[0];
  }

  async deleteHomework(id: string): Promise<void> {
    await db.delete(homework).where(eq(homework.id, id));
  }

  async getSubmission(id: string): Promise<HomeworkSubmission | undefined> {
    const result = await db.select().from(homeworkSubmissions).where(eq(homeworkSubmissions.id, id));
    return result[0];
  }

  async getSubmissionByHomeworkAndStudent(homeworkId: string, studentId: string): Promise<HomeworkSubmission | undefined> {
    const result = await db.select().from(homeworkSubmissions).where(
      and(eq(homeworkSubmissions.homeworkId, homeworkId), eq(homeworkSubmissions.studentId, studentId))
    );
    return result[0];
  }

  async getSubmissionsByCenter(centerId: string): Promise<any[]> {
    const centerHomework = await this.getHomeworkByCenter(centerId);
    const homeworkIds = centerHomework.map((h) => h.id);
    if (homeworkIds.length === 0) return [];
    
    // Exclude photos field from list query to reduce memory usage
    const submissions = await db.select({
      id: homeworkSubmissions.id,
      homeworkId: homeworkSubmissions.homeworkId,
      studentId: homeworkSubmissions.studentId,
      completionRate: homeworkSubmissions.completionRate,
      status: homeworkSubmissions.status,
      feedback: homeworkSubmissions.feedback,
      resubmitReason: homeworkSubmissions.resubmitReason,
      submittedAt: homeworkSubmissions.submittedAt,
      reviewedAt: homeworkSubmissions.reviewedAt,
    }).from(homeworkSubmissions).where(inArray(homeworkSubmissions.homeworkId, homeworkIds));
    if (submissions.length === 0) return [];
    
    // Batch fetch all homework and students at once
    const homeworkMap = new Map(centerHomework.map(h => [h.id, h]));
    const studentIds = Array.from(new Set(submissions.map(s => s.studentId)));
    const studentsData = studentIds.length > 0 
      ? await db.select().from(users).where(inArray(users.id, studentIds))
      : [];
    const studentMap = new Map(studentsData.map(s => [s.id, s]));
    
    return submissions.map(s => ({
      ...s,
      photos: [], // Placeholder - photos loaded separately when needed
      homework: homeworkMap.get(s.homeworkId),
      student: studentMap.get(s.studentId),
    }));
  }

  async getStudentSubmissions(studentId: string): Promise<HomeworkSubmission[]> {
    // Exclude photos from list query to reduce memory usage
    const results = await db.select({
      id: homeworkSubmissions.id,
      homeworkId: homeworkSubmissions.homeworkId,
      studentId: homeworkSubmissions.studentId,
      completionRate: homeworkSubmissions.completionRate,
      status: homeworkSubmissions.status,
      feedback: homeworkSubmissions.feedback,
      resubmitReason: homeworkSubmissions.resubmitReason,
      submittedAt: homeworkSubmissions.submittedAt,
      reviewedAt: homeworkSubmissions.reviewedAt,
    }).from(homeworkSubmissions).where(eq(homeworkSubmissions.studentId, studentId));
    return results.map(r => ({ ...r, photos: [] })) as HomeworkSubmission[];
  }

  async getSubmissionPhotos(id: string): Promise<string[]> {
    const result = await db.select({ photos: homeworkSubmissions.photos })
      .from(homeworkSubmissions)
      .where(eq(homeworkSubmissions.id, id));
    return result[0]?.photos || [];
  }

  async createSubmission(submission: InsertHomeworkSubmission): Promise<HomeworkSubmission> {
    const result = await db.insert(homeworkSubmissions).values({
      ...submission,
      status: submission.status || "submitted",
      submittedAt: new Date(),
    }).returning();
    return result[0];
  }

  async updateSubmission(id: string, data: Partial<InsertHomeworkSubmission>): Promise<HomeworkSubmission> {
    const updateData: any = { ...data };
    if (data.status === "reviewed" || data.status === "in_person") {
      updateData.reviewedAt = new Date();
    }
    const result = await db.update(homeworkSubmissions).set(updateData).where(eq(homeworkSubmissions.id, id)).returning();
    if (!result[0]) throw new Error("Submission not found");
    return result[0];
  }

  async getAssessment(id: string): Promise<Assessment | undefined> {
    const result = await db.select().from(assessments).where(eq(assessments.id, id));
    return result[0];
  }

  async getAssessmentsByCenter(centerId: string): Promise<any[]> {
    const centerClasses = await db.select().from(classes).where(eq(classes.centerId, centerId));
    const classIds = centerClasses.map((c) => c.id);
    if (classIds.length === 0) return [];
    
    const allAssessments = await db.select().from(assessments).where(inArray(assessments.classId, classIds));
    if (allAssessments.length === 0) return [];
    
    // Batch fetch classes and students
    const classMap = new Map(centerClasses.map(c => [c.id, c]));
    const studentIds = Array.from(new Set(allAssessments.map(a => a.studentId)));
    const studentsData = studentIds.length > 0
      ? await db.select().from(users).where(inArray(users.id, studentIds))
      : [];
    const studentMap = new Map(studentsData.map(s => [s.id, s]));
    
    return allAssessments.map(a => ({
      ...a,
      class: classMap.get(a.classId),
      student: studentMap.get(a.studentId),
    }));
  }

  async getStudentAssessments(studentId: string, month?: string): Promise<any[]> {
    let allAssessments = await db.select().from(assessments).where(eq(assessments.studentId, studentId));
    if (month) {
      allAssessments = allAssessments.filter((a) => a.assessmentDate.startsWith(month));
    }
    
    // Pre-calculate monthly rankings per class for efficiency
    const classMonthlyRankings = new Map<string, { studentAverages: Map<string, number>; topScore: number; totalStudents: number }>();
    
    // Get unique class IDs from student's assessments
    const classIds = Array.from(new Set(allAssessments.map(a => a.classId)));
    
    for (const classId of classIds) {
      // Get all assessments for this class in the month
      let classAssessments = await db.select().from(assessments).where(eq(assessments.classId, classId));
      if (month) {
        classAssessments = classAssessments.filter((a) => a.assessmentDate.startsWith(month));
      }
      
      // Calculate monthly average per student
      const studentScores = new Map<string, number[]>();
      for (const ca of classAssessments) {
        if (!studentScores.has(ca.studentId)) {
          studentScores.set(ca.studentId, []);
        }
        studentScores.get(ca.studentId)!.push(ca.score);
      }
      
      const studentAverages = new Map<string, number>();
      let topScore = 0;
      studentScores.forEach((scores, sid) => {
        const avg = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
        studentAverages.set(sid, avg);
        if (avg > topScore) topScore = avg;
      });
      
      classMonthlyRankings.set(classId, {
        studentAverages,
        topScore,
        totalStudents: studentScores.size
      });
    }
    
    const result = [];
    for (const a of allAssessments) {
      const cls = await this.getClass(a.classId);
      const ranking = classMonthlyRankings.get(a.classId);
      
      // Get monthly class average
      const allAverages = ranking ? Array.from(ranking.studentAverages.values()) : [a.score];
      const monthlyClassAverage = allAverages.length > 0
        ? Math.round(allAverages.reduce((sum, avg) => sum + avg, 0) / allAverages.length)
        : a.score;
      
      // Check if this student is first for the month in this class
      const studentMonthlyAvg = ranking?.studentAverages.get(studentId) || a.score;
      const isFirst = ranking && ranking.topScore > 0 && studentMonthlyAvg === ranking.topScore && ranking.totalStudents > 1;
      
      // Calculate monthly rank
      const sortedAverages = allAverages.sort((x, y) => y - x);
      const monthlyRank = sortedAverages.indexOf(studentMonthlyAvg) + 1;
      
      result.push({ 
        ...a, 
        class: cls, 
        average: monthlyClassAverage, 
        rank: monthlyRank, 
        isFirst, 
        totalStudents: ranking?.totalStudents || 1,
        studentMonthlyAverage: studentMonthlyAvg
      });
    }
    return result;
  }

  async createAssessments(assessmentList: InsertAssessment[]): Promise<Assessment[]> {
    const results: Assessment[] = [];
    for (const assessment of assessmentList) {
      const existing = await db.select().from(assessments).where(
        and(
          eq(assessments.studentId, assessment.studentId),
          eq(assessments.classId, assessment.classId),
          eq(assessments.assessmentDate, assessment.assessmentDate)
        )
      );
      if (existing[0]) {
        const updated = await db.update(assessments).set({ 
          score: assessment.score, 
          maxScore: assessment.maxScore 
        }).where(eq(assessments.id, existing[0].id)).returning();
        results.push(updated[0]);
      } else {
        const created = await db.insert(assessments).values(assessment).returning();
        results.push(created[0]);
      }
    }
    return results;
  }

  async updateAssessment(id: string, data: { score: number; maxScore?: number }): Promise<Assessment> {
    const [updated] = await db.update(assessments).set(data).where(eq(assessments.id, id)).returning();
    return updated;
  }

  async deleteAssessment(id: string): Promise<void> {
    await db.delete(assessments).where(eq(assessments.id, id));
  }

  async getClassVideos(centerId?: string): Promise<ClassVideo[]> {
    if (!centerId) {
      return await db.select().from(classVideos);
    }
    const centerClasses = await db.select().from(classes).where(eq(classes.centerId, centerId));
    const classIds = centerClasses.map((c) => c.id);
    if (classIds.length === 0) return [];
    return await db.select().from(classVideos).where(inArray(classVideos.classId, classIds));
  }

  async createClassVideo(video: InsertClassVideo): Promise<ClassVideo> {
    const result = await db.insert(classVideos).values(video).returning();
    return result[0];
  }

  async updateClassVideo(id: string, data: Partial<InsertClassVideo>): Promise<ClassVideo> {
    const result = await db.update(classVideos).set(data).where(eq(classVideos.id, id)).returning();
    if (!result[0]) throw new Error("Video not found");
    return result[0];
  }

  async deleteClassVideo(id: string): Promise<void> {
    await db.delete(classVideos).where(eq(classVideos.id, id));
  }

  async getTextbooks(): Promise<Textbook[]> {
    return await db.select().from(textbooks);
  }

  async createTextbook(textbook: InsertTextbook): Promise<Textbook> {
    const result = await db.insert(textbooks).values(textbook).returning();
    return result[0];
  }

  async updateTextbook(id: string, data: Partial<InsertTextbook>): Promise<Textbook> {
    const result = await db.update(textbooks).set(data).where(eq(textbooks.id, id)).returning();
    if (!result[0]) throw new Error("Textbook not found");
    return result[0];
  }

  async deleteTextbook(id: string): Promise<void> {
    await db.delete(textbooks).where(eq(textbooks.id, id));
  }

  async getTextbookVideos(textbookId: string): Promise<TextbookVideo[]> {
    const videos = await db.select().from(textbookVideos).where(eq(textbookVideos.textbookId, textbookId));
    return videos.sort((a, b) => a.pageNumber - b.pageNumber || a.problemNumber - b.problemNumber);
  }

  async createTextbookVideo(video: InsertTextbookVideo): Promise<TextbookVideo> {
    const result = await db.insert(textbookVideos).values(video).returning();
    return result[0];
  }

  async updateTextbookVideo(id: string, data: Partial<InsertTextbookVideo>): Promise<TextbookVideo> {
    const result = await db.update(textbookVideos).set(data).where(eq(textbookVideos.id, id)).returning();
    if (!result[0]) throw new Error("Video not found");
    return result[0];
  }

  async deleteTextbookVideo(id: string): Promise<void> {
    await db.delete(textbookVideos).where(eq(textbookVideos.id, id));
  }

  // Clinic methods
  async getClinicAssignment(id: string): Promise<ClinicAssignmentWithDetails | undefined> {
    const result = await db.select().from(clinicAssignments).where(eq(clinicAssignments.id, id));
    if (!result[0]) return undefined;
    return this.enrichClinicAssignment(result[0]);
  }

  async getClinicAssignments(options: { centerId?: string; regularTeacherId?: string; clinicTeacherId?: string; studentId?: string }): Promise<ClinicAssignmentWithDetails[]> {
    let assignments = await db.select().from(clinicAssignments);
    
    if (options.centerId) {
      assignments = assignments.filter(a => a.centerId === options.centerId);
    }
    if (options.regularTeacherId) {
      assignments = assignments.filter(a => a.regularTeacherId === options.regularTeacherId);
    }
    if (options.clinicTeacherId) {
      assignments = assignments.filter(a => a.clinicTeacherId === options.clinicTeacherId);
    }
    if (options.studentId) {
      assignments = assignments.filter(a => a.studentId === options.studentId);
    }

    return Promise.all(assignments.map(a => this.enrichClinicAssignment(a)));
  }

  private async enrichClinicAssignment(assignment: ClinicAssignment): Promise<ClinicAssignmentWithDetails> {
    const [student, regularTeacher, clinicTeacher, steps, files, comments, progressLogs] = await Promise.all([
      this.getUser(assignment.studentId),
      this.getUser(assignment.regularTeacherId),
      assignment.clinicTeacherId ? this.getUser(assignment.clinicTeacherId) : Promise.resolve(undefined),
      db.select().from(clinicAssignmentSteps).where(eq(clinicAssignmentSteps.assignmentId, assignment.id)),
      db.select().from(clinicAssignmentFiles).where(eq(clinicAssignmentFiles.assignmentId, assignment.id)),
      db.select().from(clinicComments).where(eq(clinicComments.assignmentId, assignment.id)),
      db.select().from(clinicProgressLogs).where(eq(clinicProgressLogs.assignmentId, assignment.id)),
    ]);

    return {
      ...assignment,
      student,
      regularTeacher,
      clinicTeacher,
      steps: steps.sort((a, b) => a.stepOrder - b.stepOrder),
      files,
      comments,
      progressLogs,
    };
  }

  async createClinicAssignment(assignment: InsertClinicAssignment): Promise<ClinicAssignment> {
    const result = await db.insert(clinicAssignments).values(assignment).returning();
    return result[0];
  }

  async updateClinicAssignment(id: string, data: Partial<InsertClinicAssignment>): Promise<ClinicAssignment> {
    const result = await db.update(clinicAssignments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(clinicAssignments.id, id))
      .returning();
    if (!result[0]) throw new Error("Assignment not found");
    return result[0];
  }

  async deleteClinicAssignment(id: string): Promise<void> {
    await db.delete(clinicProgressLogs).where(eq(clinicProgressLogs.assignmentId, id));
    await db.delete(clinicComments).where(eq(clinicComments.assignmentId, id));
    await db.delete(clinicAssignmentFiles).where(eq(clinicAssignmentFiles.assignmentId, id));
    await db.delete(clinicAssignmentSteps).where(eq(clinicAssignmentSteps.assignmentId, id));
    await db.delete(clinicAssignments).where(eq(clinicAssignments.id, id));
  }

  async createClinicAssignmentStep(step: InsertClinicAssignmentStep): Promise<ClinicAssignmentStep> {
    const result = await db.insert(clinicAssignmentSteps).values(step).returning();
    return result[0];
  }

  async updateClinicAssignmentStep(id: string, data: Partial<InsertClinicAssignmentStep>): Promise<ClinicAssignmentStep> {
    const result = await db.update(clinicAssignmentSteps)
      .set(data)
      .where(eq(clinicAssignmentSteps.id, id))
      .returning();
    if (!result[0]) throw new Error("Step not found");
    return result[0];
  }

  async deleteClinicAssignmentStep(id: string): Promise<void> {
    await db.delete(clinicAssignmentFiles).where(eq(clinicAssignmentFiles.stepId, id));
    await db.delete(clinicAssignmentSteps).where(eq(clinicAssignmentSteps.id, id));
  }

  async createClinicAssignmentFile(file: InsertClinicAssignmentFile): Promise<ClinicAssignmentFile> {
    const result = await db.insert(clinicAssignmentFiles).values(file).returning();
    return result[0];
  }

  async deleteClinicAssignmentFile(id: string): Promise<void> {
    await db.delete(clinicAssignmentFiles).where(eq(clinicAssignmentFiles.id, id));
  }

  async createClinicComment(comment: InsertClinicComment): Promise<ClinicComment> {
    const result = await db.insert(clinicComments).values(comment).returning();
    return result[0];
  }

  async deleteClinicComment(id: string): Promise<void> {
    await db.delete(clinicComments).where(eq(clinicComments.id, id));
  }

  async getClinicProgressLogs(assignmentId: string): Promise<ClinicProgressLog[]> {
    return db.select().from(clinicProgressLogs).where(eq(clinicProgressLogs.assignmentId, assignmentId));
  }

  async createClinicProgressLog(log: InsertClinicProgressLog): Promise<ClinicProgressLog> {
    const result = await db.insert(clinicProgressLogs).values(log).returning();
    return result[0];
  }

  async updateClinicProgressLog(id: string, data: Partial<InsertClinicProgressLog>): Promise<ClinicProgressLog> {
    const result = await db.update(clinicProgressLogs)
      .set(data)
      .where(eq(clinicProgressLogs.id, id))
      .returning();
    if (!result[0]) throw new Error("Progress log not found");
    return result[0];
  }

  // ===== New Clinic System (Weekly Workflow) =====
  async getClinicStudent(id: string): Promise<ClinicStudentWithDetails | undefined> {
    const result = await db.select().from(clinicStudents).where(eq(clinicStudents.id, id));
    if (!result[0]) return undefined;

    const cs = result[0];
    const [student, regularTeacher, clinicTeacher, weeklyRecords] = await Promise.all([
      this.getUser(cs.studentId),
      this.getUser(cs.regularTeacherId),
      cs.clinicTeacherId ? this.getUser(cs.clinicTeacherId) : Promise.resolve(undefined),
      db.select().from(clinicWeeklyRecords).where(eq(clinicWeeklyRecords.clinicStudentId, cs.id)),
    ]);

    return { ...cs, student, regularTeacher, clinicTeacher, weeklyRecords };
  }

  async getClinicStudentByStudentAndCenter(studentId: string, centerId: string): Promise<ClinicStudent | undefined> {
    const result = await db.select().from(clinicStudents)
      .where(and(
        eq(clinicStudents.studentId, studentId),
        eq(clinicStudents.centerId, centerId)
      ));
    return result[0];
  }

  async getClinicStudentByStudentCenterAndType(studentId: string, centerId: string, clinicType: string): Promise<ClinicStudent | undefined> {
    const result = await db.select().from(clinicStudents)
      .where(and(
        eq(clinicStudents.studentId, studentId),
        eq(clinicStudents.centerId, centerId),
        eq(clinicStudents.clinicType, clinicType)
      ));
    return result[0];
  }

  async getClinicStudents(centerId: string): Promise<ClinicStudentWithDetails[]> {
    const allClinicStudents = await db.select().from(clinicStudents)
      .where(eq(clinicStudents.centerId, centerId));

    return Promise.all(allClinicStudents.map(async (cs) => {
      const [student, regularTeacher, clinicTeacher] = await Promise.all([
        this.getUser(cs.studentId),
        this.getUser(cs.regularTeacherId),
        cs.clinicTeacherId ? this.getUser(cs.clinicTeacherId) : Promise.resolve(undefined),
      ]);
      return { ...cs, student, regularTeacher, clinicTeacher };
    }));
  }

  async createClinicStudent(student: InsertClinicStudent): Promise<ClinicStudent> {
    const result = await db.insert(clinicStudents).values(student).returning();
    return result[0];
  }

  async updateClinicStudent(id: string, data: Partial<InsertClinicStudent>): Promise<ClinicStudent> {
    const result = await db.update(clinicStudents)
      .set(data)
      .where(eq(clinicStudents.id, id))
      .returning();
    if (!result[0]) throw new Error("Clinic student not found");
    return result[0];
  }

  async deleteClinicStudent(id: string): Promise<void> {
    await db.delete(clinicWeeklyRecords).where(eq(clinicWeeklyRecords.clinicStudentId, id));
    await db.delete(clinicStudents).where(eq(clinicStudents.id, id));
  }

  async getClinicWeeklyRecord(id: string): Promise<ClinicWeeklyRecord | undefined> {
    const result = await db.select().from(clinicWeeklyRecords).where(eq(clinicWeeklyRecords.id, id));
    return result[0];
  }

  async getClinicWeeklyRecords(clinicStudentId: string, weekStartDate?: string): Promise<ClinicWeeklyRecord[]> {
    if (weekStartDate) {
      return db.select().from(clinicWeeklyRecords)
        .where(and(
          eq(clinicWeeklyRecords.clinicStudentId, clinicStudentId),
          eq(clinicWeeklyRecords.weekStartDate, weekStartDate)
        ));
    }
    return db.select().from(clinicWeeklyRecords)
      .where(eq(clinicWeeklyRecords.clinicStudentId, clinicStudentId));
  }

  async getClinicWeeklyRecordsByCenter(centerId: string, weekStartDate: string): Promise<(ClinicWeeklyRecord & { clinicStudent?: ClinicStudentWithDetails })[]> {
    const clinicStudentsList = await this.getClinicStudents(centerId);
    const clinicStudentIds = clinicStudentsList.map(cs => cs.id);
    
    if (clinicStudentIds.length === 0) return [];
    
    const records = await db.select().from(clinicWeeklyRecords)
      .where(and(
        inArray(clinicWeeklyRecords.clinicStudentId, clinicStudentIds),
        eq(clinicWeeklyRecords.weekStartDate, weekStartDate)
      ));

    return records.map(record => ({
      ...record,
      clinicStudent: clinicStudentsList.find(cs => cs.id === record.clinicStudentId),
    }));
  }

  async getClinicWeeklyRecordsByMonth(centerId: string, year: number, month: number): Promise<(ClinicWeeklyRecord & { clinicStudent?: ClinicStudentWithDetails })[]> {
    const clinicStudentsList = await this.getClinicStudents(centerId);
    const clinicStudentIds = clinicStudentsList.map(cs => cs.id);
    
    if (clinicStudentIds.length === 0) return [];
    
    // Calculate the first day of the month and last day of the month
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month, 0);
    
    // Find the Monday of the week containing the first day of the month
    // This ensures boundary-spanning weeks are included
    const firstMonday = new Date(firstDayOfMonth);
    const dayOfWeek = firstDayOfMonth.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, Monday = 1
    firstMonday.setDate(firstDayOfMonth.getDate() - daysToMonday);
    
    // Find the Monday of the week containing the last day of the month
    const lastMonday = new Date(lastDayOfMonth);
    const lastDayOfWeek = lastDayOfMonth.getDay();
    const daysToLastMonday = lastDayOfWeek === 0 ? 6 : lastDayOfWeek - 1;
    lastMonday.setDate(lastDayOfMonth.getDate() - daysToLastMonday);
    
    // Format dates for comparison
    const formatDate = (d: Date) => {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const startDate = formatDate(firstMonday);
    const endDate = formatDate(lastMonday);
    
    const records = await db.select().from(clinicWeeklyRecords)
      .where(and(
        inArray(clinicWeeklyRecords.clinicStudentId, clinicStudentIds),
        gte(clinicWeeklyRecords.weekStartDate, startDate),
        lte(clinicWeeklyRecords.weekStartDate, endDate)
      ));

    return records.map(record => ({
      ...record,
      clinicStudent: clinicStudentsList.find(cs => cs.id === record.clinicStudentId),
    }));
  }

  async createClinicWeeklyRecord(record: InsertClinicWeeklyRecord): Promise<ClinicWeeklyRecord> {
    // Check for existing record to prevent duplicates
    if (record.clinicStudentId && record.weekStartDate) {
      const existing = await db.select().from(clinicWeeklyRecords)
        .where(and(
          eq(clinicWeeklyRecords.clinicStudentId, record.clinicStudentId),
          eq(clinicWeeklyRecords.weekStartDate, record.weekStartDate as string)
        ));
      if (existing.length > 0) {
        return existing[0]; // Return existing record instead of creating duplicate
      }
    }
    const result = await db.insert(clinicWeeklyRecords).values(record).returning();
    return result[0];
  }

  async updateClinicWeeklyRecord(id: string, data: Partial<InsertClinicWeeklyRecord>): Promise<ClinicWeeklyRecord> {
    const result = await db.update(clinicWeeklyRecords)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(clinicWeeklyRecords.id, id))
      .returning();
    if (!result[0]) throw new Error("Clinic weekly record not found");
    return result[0];
  }

  async deleteClinicWeeklyRecord(id: string): Promise<void> {
    await db.delete(clinicWeeklyRecords).where(eq(clinicWeeklyRecords.id, id));
  }

  async deleteOldClinicWeeklyRecords(centerId: string, beforeDate: string): Promise<number> {
    const clinicStudentsList = await this.getClinicStudents(centerId);
    const clinicStudentIds = clinicStudentsList.map(cs => cs.id);
    
    if (clinicStudentIds.length === 0) {
      return 0;
    }
    
    // First delete associated files
    const oldRecords = await db.select({ id: clinicWeeklyRecords.id })
      .from(clinicWeeklyRecords)
      .where(and(
        inArray(clinicWeeklyRecords.clinicStudentId, clinicStudentIds),
        lt(clinicWeeklyRecords.weekStartDate, beforeDate)
      ));
    
    for (const record of oldRecords) {
      await this.deleteClinicWeeklyRecordFilesByRecordId(record.id);
    }
    
    // Then delete the records
    const result = await db.delete(clinicWeeklyRecords)
      .where(and(
        inArray(clinicWeeklyRecords.clinicStudentId, clinicStudentIds),
        lt(clinicWeeklyRecords.weekStartDate, beforeDate)
      ))
      .returning();
    
    return result.length;
  }

  // Clinic Resources
  async getClinicResource(id: string): Promise<ClinicResource | undefined> {
    const result = await db.select().from(clinicResources)
      .where(eq(clinicResources.id, id))
      .limit(1);
    return result[0];
  }

  async getClinicResources(centerId: string): Promise<ClinicResourceWithUploader[]> {
    const resources = await db.select().from(clinicResources)
      .where(eq(clinicResources.centerId, centerId));
    
    const uploaderIds = Array.from(new Set(resources.map(r => r.uploadedById)));
    const uploaders = uploaderIds.length > 0 
      ? await db.select().from(users).where(inArray(users.id, uploaderIds))
      : [];
    const uploaderMap = new Map(uploaders.map(u => [u.id, u]));
    
    return resources.map(r => ({
      ...r,
      uploader: uploaderMap.get(r.uploadedById),
    }));
  }

  async createClinicResource(resource: InsertClinicResource): Promise<ClinicResource> {
    const result = await db.insert(clinicResources).values(resource).returning();
    return result[0];
  }

  async deleteClinicResource(id: string): Promise<void> {
    await db.delete(clinicResources).where(eq(clinicResources.id, id));
  }

  async deleteOldTemporaryClinicResources(beforeDate: string): Promise<{ count: number; filePaths: string[] }> {
    // Delete temporary resources (isPermanent = false) where createdAt < beforeDate (14 days ago)
    const result = await db.delete(clinicResources)
      .where(and(
        eq(clinicResources.isPermanent, false),
        lt(clinicResources.createdAt, new Date(beforeDate))
      ))
      .returning();
    return { 
      count: result.length, 
      filePaths: result.map(r => r.filePath).filter(Boolean) as string[]
    };
  }

  // ============================================
  // Clinic Daily Notes Implementation (날짜별 기록)
  // ============================================

  async getClinicDailyNotes(clinicStudentId: string): Promise<ClinicDailyNoteWithCreator[]> {
    const notes = await db.select().from(clinicDailyNotes)
      .where(eq(clinicDailyNotes.clinicStudentId, clinicStudentId))
      .orderBy(desc(clinicDailyNotes.noteDate));
    
    const notesWithCreator: ClinicDailyNoteWithCreator[] = [];
    for (const note of notes) {
      const creator = await db.select().from(users).where(eq(users.id, note.createdById)).limit(1);
      notesWithCreator.push({
        ...note,
        creator: creator[0]
      });
    }
    return notesWithCreator;
  }

  async createClinicDailyNote(note: InsertClinicDailyNote): Promise<ClinicDailyNote> {
    const [created] = await db.insert(clinicDailyNotes).values(note).returning();
    return created;
  }

  async updateClinicDailyNote(id: string, data: Partial<InsertClinicDailyNote>): Promise<ClinicDailyNote> {
    const [updated] = await db.update(clinicDailyNotes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(clinicDailyNotes.id, id))
      .returning();
    return updated;
  }

  async deleteClinicDailyNote(id: string): Promise<void> {
    await db.delete(clinicDailyNotes).where(eq(clinicDailyNotes.id, id));
  }

  // ============================================
  // Clinic Instruction Defaults Implementation
  // ============================================

  async getClinicInstructionDefaults(clinicStudentId: string): Promise<ClinicInstructionDefault[]> {
    return db.select().from(clinicInstructionDefaults)
      .where(eq(clinicInstructionDefaults.clinicStudentId, clinicStudentId));
  }

  async getClinicInstructionDefaultByWeekday(clinicStudentId: string, weekday: string): Promise<ClinicInstructionDefault | undefined> {
    const result = await db.select().from(clinicInstructionDefaults)
      .where(and(
        eq(clinicInstructionDefaults.clinicStudentId, clinicStudentId),
        eq(clinicInstructionDefaults.weekday, weekday)
      ));
    return result[0];
  }

  async upsertClinicInstructionDefault(data: InsertClinicInstructionDefault): Promise<ClinicInstructionDefault> {
    const existing = await this.getClinicInstructionDefaultByWeekday(data.clinicStudentId, data.weekday);
    if (existing) {
      const [updated] = await db.update(clinicInstructionDefaults)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(clinicInstructionDefaults.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(clinicInstructionDefaults).values(data).returning();
    return created;
  }

  async deleteClinicInstructionDefault(id: string): Promise<void> {
    await db.delete(clinicInstructionDefaults).where(eq(clinicInstructionDefaults.id, id));
  }

  // ============================================
  // Clinic Weekly Record Files Implementation
  // ============================================

  async getClinicWeeklyRecordFiles(recordId: string): Promise<ClinicWeeklyRecordFile[]> {
    return db.select().from(clinicWeeklyRecordFiles)
      .where(eq(clinicWeeklyRecordFiles.recordId, recordId));
  }

  async getClinicWeeklyRecordFilesByPeriod(recordId: string, period: string): Promise<ClinicWeeklyRecordFile[]> {
    return db.select().from(clinicWeeklyRecordFiles)
      .where(and(
        eq(clinicWeeklyRecordFiles.recordId, recordId),
        eq(clinicWeeklyRecordFiles.period, period)
      ));
  }

  async createClinicWeeklyRecordFile(file: InsertClinicWeeklyRecordFile): Promise<ClinicWeeklyRecordFile> {
    const [created] = await db.insert(clinicWeeklyRecordFiles).values(file).returning();
    return created;
  }

  async getClinicWeeklyRecordFileById(id: string): Promise<ClinicWeeklyRecordFile | null> {
    const result = await db.select().from(clinicWeeklyRecordFiles)
      .where(eq(clinicWeeklyRecordFiles.id, id));
    return result[0] || null;
  }

  async deleteClinicWeeklyRecordFile(id: string): Promise<void> {
    await db.delete(clinicWeeklyRecordFiles).where(eq(clinicWeeklyRecordFiles.id, id));
  }

  async deleteClinicWeeklyRecordFilesByRecordId(recordId: string): Promise<void> {
    await db.delete(clinicWeeklyRecordFiles).where(eq(clinicWeeklyRecordFiles.recordId, recordId));
  }

  // ============================================
  // Clinic Shared Instruction Groups Implementation
  // ============================================

  async getClinicSharedInstructionGroups(
    centerId: string,
    teacherId?: string,
    weekStartDate?: string
  ): Promise<ClinicSharedInstructionGroupWithMembers[]> {
    let query = db.select().from(clinicSharedInstructionGroups)
      .where(eq(clinicSharedInstructionGroups.centerId, centerId));
    
    const groups = await query;
    
    const filtered = groups.filter(g => {
      if (teacherId && g.teacherId !== teacherId) return false;
      if (weekStartDate && g.weekStartDate !== weekStartDate) return false;
      return true;
    });
    
    const result: ClinicSharedInstructionGroupWithMembers[] = [];
    for (const group of filtered) {
      const members = await db.select().from(clinicSharedInstructionMembers)
        .where(eq(clinicSharedInstructionMembers.sharedGroupId, group.id));
      
      const membersWithRecords = await Promise.all(members.map(async m => {
        const records = await db.select().from(clinicWeeklyRecords)
          .where(eq(clinicWeeklyRecords.id, m.recordId));
        return { ...m, record: records[0] };
      }));
      
      result.push({ ...group, members: membersWithRecords });
    }
    
    return result;
  }

  async getClinicSharedInstructionGroupWithMembers(id: string): Promise<ClinicSharedInstructionGroupWithMembers | undefined> {
    const groups = await db.select().from(clinicSharedInstructionGroups)
      .where(eq(clinicSharedInstructionGroups.id, id));
    
    if (groups.length === 0) return undefined;
    
    const group = groups[0];
    const members = await db.select().from(clinicSharedInstructionMembers)
      .where(eq(clinicSharedInstructionMembers.sharedGroupId, id));
    
    const membersWithRecords = await Promise.all(members.map(async m => {
      const records = await db.select().from(clinicWeeklyRecords)
        .where(eq(clinicWeeklyRecords.id, m.recordId));
      return { ...m, record: records[0] };
    }));
    
    return { ...group, members: membersWithRecords };
  }

  async createClinicSharedInstructionGroup(data: InsertClinicSharedInstructionGroup): Promise<ClinicSharedInstructionGroup> {
    const [created] = await db.insert(clinicSharedInstructionGroups).values(data).returning();
    return created;
  }

  async updateClinicSharedInstructionGroup(id: string, data: Partial<InsertClinicSharedInstructionGroup>): Promise<ClinicSharedInstructionGroup> {
    const [updated] = await db.update(clinicSharedInstructionGroups)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(clinicSharedInstructionGroups.id, id))
      .returning();
    return updated;
  }

  async deleteClinicSharedInstructionGroup(id: string): Promise<void> {
    await db.delete(clinicSharedInstructionMembers).where(eq(clinicSharedInstructionMembers.sharedGroupId, id));
    await db.delete(clinicSharedInstructionGroups).where(eq(clinicSharedInstructionGroups.id, id));
  }

  async addClinicSharedInstructionMember(data: InsertClinicSharedInstructionMember): Promise<ClinicSharedInstructionMember> {
    // First, get the group to find its period and weekStartDate
    const groups = await db.select().from(clinicSharedInstructionGroups)
      .where(eq(clinicSharedInstructionGroups.id, data.sharedGroupId));
    
    if (groups.length > 0) {
      const targetGroup = groups[0];
      
      // Find all existing memberships for this recordId
      const existingMemberships = await db.select().from(clinicSharedInstructionMembers)
        .where(eq(clinicSharedInstructionMembers.recordId, data.recordId));
      
      // Check each membership's group to see if it's for the same period/weekStartDate
      for (const membership of existingMemberships) {
        const membershipGroups = await db.select().from(clinicSharedInstructionGroups)
          .where(eq(clinicSharedInstructionGroups.id, membership.sharedGroupId));
        
        if (membershipGroups.length > 0) {
          const existingGroup = membershipGroups[0];
          // Remove from old group if same period and weekStartDate (but different group)
          if (existingGroup.period === targetGroup.period && 
              existingGroup.weekStartDate === targetGroup.weekStartDate &&
              existingGroup.id !== targetGroup.id) {
            await db.delete(clinicSharedInstructionMembers)
              .where(eq(clinicSharedInstructionMembers.id, membership.id));
            
            // Check if old group is now empty and delete it if so
            const remainingMembers = await db.select().from(clinicSharedInstructionMembers)
              .where(eq(clinicSharedInstructionMembers.sharedGroupId, existingGroup.id));
            if (remainingMembers.length === 0) {
              await db.delete(clinicSharedInstructionGroups)
                .where(eq(clinicSharedInstructionGroups.id, existingGroup.id));
            }
          }
        }
      }
    }
    
    const [created] = await db.insert(clinicSharedInstructionMembers).values(data).returning();
    return created;
  }

  async clearClinicSharedInstructionMembers(sharedGroupId: string): Promise<void> {
    await db.delete(clinicSharedInstructionMembers).where(eq(clinicSharedInstructionMembers.sharedGroupId, sharedGroupId));
  }

  async getClinicSharedInstructionMembersByRecord(recordId: string): Promise<(ClinicSharedInstructionMember & { group?: ClinicSharedInstructionGroup })[]> {
    const members = await db.select().from(clinicSharedInstructionMembers)
      .where(eq(clinicSharedInstructionMembers.recordId, recordId));
    
    const result = await Promise.all(members.map(async m => {
      const groups = await db.select().from(clinicSharedInstructionGroups)
        .where(eq(clinicSharedInstructionGroups.id, m.sharedGroupId));
      return { ...m, group: groups[0] };
    }));
    
    return result;
  }

  // ============================================
  // Attendance System Implementation
  // ============================================

  async getAttendancePinByPin(centerId: string, pin: string): Promise<AttendancePinWithStudent | undefined> {
    const result = await db.select().from(attendancePins)
      .where(and(
        eq(attendancePins.centerId, centerId),
        eq(attendancePins.pin, pin),
        eq(attendancePins.isActive, true)
      ));
    if (result.length === 0) return undefined;
    const pinRecord = result[0];
    const student = await this.getUser(pinRecord.studentId);
    return { ...pinRecord, student };
  }

  async getAttendancePins(centerId: string): Promise<AttendancePinWithStudent[]> {
    const pins = await db.select().from(attendancePins)
      .where(eq(attendancePins.centerId, centerId));
    const studentsMap = new Map<string, User>();
    const studentIds = Array.from(new Set(pins.map(p => p.studentId)));
    if (studentIds.length > 0) {
      const studentList = await db.select().from(users).where(inArray(users.id, studentIds));
      studentList.forEach(s => studentsMap.set(s.id, s));
    }
    return pins.map(p => ({ ...p, student: studentsMap.get(p.studentId) }));
  }

  async getAttendancePinByStudent(studentId: string, centerId: string): Promise<AttendancePin | undefined> {
    const result = await db.select().from(attendancePins)
      .where(and(
        eq(attendancePins.studentId, studentId),
        eq(attendancePins.centerId, centerId)
      ));
    return result[0];
  }

  async createAttendancePin(data: InsertAttendancePin): Promise<AttendancePin> {
    const result = await db.insert(attendancePins).values(data).returning();
    return result[0];
  }

  async updateAttendancePin(id: string, data: Partial<InsertAttendancePin>): Promise<AttendancePin> {
    const result = await db.update(attendancePins).set(data).where(eq(attendancePins.id, id)).returning();
    return result[0];
  }

  async deleteAttendancePin(id: string): Promise<void> {
    await db.delete(attendancePins).where(eq(attendancePins.id, id));
  }

  // Teacher Check-in Settings
  async getTeacherCheckInSettings(teacherId: string, centerId: string): Promise<TeacherCheckInSettings | undefined> {
    const result = await db.select().from(teacherCheckInSettings)
      .where(and(
        eq(teacherCheckInSettings.teacherId, teacherId),
        eq(teacherCheckInSettings.centerId, centerId)
      ));
    return result[0];
  }

  async getTeacherCheckInSettingsByCode(centerId: string, code: string): Promise<(TeacherCheckInSettings & { teacher?: User }) | undefined> {
    const result = await db.select().from(teacherCheckInSettings)
      .where(and(
        eq(teacherCheckInSettings.centerId, centerId),
        eq(teacherCheckInSettings.checkInCode, code),
        eq(teacherCheckInSettings.isActive, true)
      ));
    if (result.length === 0) return undefined;
    const settings = result[0];
    const teacherResult = await db.select().from(users).where(eq(users.id, settings.teacherId));
    return { ...settings, teacher: teacherResult[0] };
  }

  async getAllTeacherCheckInSettings(centerId: string): Promise<TeacherCheckInSettings[]> {
    return await db.select().from(teacherCheckInSettings)
      .where(eq(teacherCheckInSettings.centerId, centerId));
  }

  async createTeacherCheckInSettings(data: InsertTeacherCheckInSettings): Promise<TeacherCheckInSettings> {
    const result = await db.insert(teacherCheckInSettings).values(data).returning();
    return result[0];
  }

  async updateTeacherCheckInSettings(id: string, data: Partial<InsertTeacherCheckInSettings>): Promise<TeacherCheckInSettings> {
    const result = await db.update(teacherCheckInSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(teacherCheckInSettings.id, id))
      .returning();
    return result[0];
  }

  async deleteTeacherCheckInSettings(id: string): Promise<void> {
    await db.delete(teacherCheckInSettings).where(eq(teacherCheckInSettings.id, id));
  }

  async getAttendanceRecords(centerId: string, date: string): Promise<AttendanceRecordWithStudent[]> {
    const records = await db.select().from(attendanceRecords)
      .where(and(
        eq(attendanceRecords.centerId, centerId),
        eq(attendanceRecords.checkInDate, date)
      ));
    const studentsMap = new Map<string, User>();
    const studentIds = Array.from(new Set(records.map(r => r.studentId)));
    if (studentIds.length > 0) {
      const studentList = await db.select().from(users).where(inArray(users.id, studentIds));
      studentList.forEach(s => studentsMap.set(s.id, s));
    }
    return records.map(r => ({ ...r, student: studentsMap.get(r.studentId) }));
  }

  async getAttendanceRecordByStudentAndDate(studentId: string, date: string): Promise<AttendanceRecord | undefined> {
    const result = await db.select().from(attendanceRecords)
      .where(and(
        eq(attendanceRecords.studentId, studentId),
        eq(attendanceRecords.checkInDate, date)
      ));
    return result[0];
  }

  async getAttendanceRecordByStudentDateAndClass(studentId: string, date: string, classId: string): Promise<AttendanceRecord | undefined> {
    const result = await db.select().from(attendanceRecords)
      .where(and(
        eq(attendanceRecords.studentId, studentId),
        eq(attendanceRecords.checkInDate, date),
        eq(attendanceRecords.classId, classId)
      ));
    return result[0];
  }

  async getStudentEnrolledClasses(studentId: string, centerId: string): Promise<Class[]> {
    const studentEnrollments = await db.select().from(enrollments).where(eq(enrollments.studentId, studentId));
    const classIds = studentEnrollments.map(e => e.classId);
    if (classIds.length === 0) return [];
    const allClasses = await db.select().from(classes).where(
      and(
        inArray(classes.id, classIds),
        eq(classes.centerId, centerId)
      )
    );
    return allClasses;
  }

  async createAttendanceRecord(data: InsertAttendanceRecord): Promise<AttendanceRecord> {
    const result = await db.insert(attendanceRecords).values({
      ...data,
      checkInAt: new Date(),
    }).returning();
    return result[0];
  }

  async createAttendanceRecordCheckOutOnly(data: { studentId: string; centerId: string; checkInDate: string; checkOutAt: Date }): Promise<AttendanceRecord> {
    const result = await db.insert(attendanceRecords).values({
      studentId: data.studentId,
      centerId: data.centerId,
      checkInDate: data.checkInDate,
      checkInAt: data.checkOutAt, // Set checkInAt same as checkOutAt to indicate no separate check-in
      checkOutAt: data.checkOutAt,
      attendanceStatus: "present",
    }).returning();
    return result[0];
  }

  async updateAttendanceRecord(id: string, data: Partial<AttendanceRecord>): Promise<AttendanceRecord> {
    const result = await db.update(attendanceRecords).set(data).where(eq(attendanceRecords.id, id)).returning();
    return result[0];
  }

  async updateAttendanceRecordCheckOut(id: string, checkOutTime: Date): Promise<void> {
    await db.update(attendanceRecords).set({ checkOutAt: checkOutTime }).where(eq(attendanceRecords.id, id));
  }

  async updateAttendanceRecordCheckOutNotificationSent(id: string): Promise<void> {
    await db.update(attendanceRecords).set({ checkOutNotificationSent: true }).where(eq(attendanceRecords.id, id));
  }

  async getAttendanceRecordsForStudent(studentId: string, startDate: string, endDate: string): Promise<AttendanceRecordWithClass[]> {
    const records = await db.select().from(attendanceRecords)
      .where(and(
        eq(attendanceRecords.studentId, studentId),
        gte(attendanceRecords.checkInDate, startDate),
        lte(attendanceRecords.checkInDate, endDate)
      ))
      .orderBy(desc(attendanceRecords.checkInDate));
    
    // Get class information for each record
    const classIds = Array.from(new Set(records.filter(r => r.classId).map(r => r.classId as string)));
    const classMap = new Map<string, Class>();
    if (classIds.length > 0) {
      const classList = await db.select().from(classes).where(inArray(classes.id, classIds));
      classList.forEach(c => classMap.set(c.id, c));
    }
    
    return records.map(r => ({
      ...r,
      class: r.classId ? classMap.get(r.classId) : undefined
    }));
  }

  async deleteOldAttendanceRecords(beforeDate: string): Promise<number> {
    const result = await db.delete(attendanceRecords)
      .where(lt(attendanceRecords.checkInDate, beforeDate))
      .returning();
    return result.length;
  }

  // Teacher Work Records (선생님 근무 기록)
  async getTeacherWorkRecords(centerId: string, startDate: string, endDate: string): Promise<TeacherWorkRecord[]> {
    return await db.select().from(teacherWorkRecords)
      .where(and(
        eq(teacherWorkRecords.centerId, centerId),
        gte(teacherWorkRecords.workDate, startDate),
        lte(teacherWorkRecords.workDate, endDate)
      ))
      .orderBy(desc(teacherWorkRecords.workDate));
  }

  async getTeacherWorkRecordByDate(teacherId: string, centerId: string, workDate: string): Promise<TeacherWorkRecord | undefined> {
    const result = await db.select().from(teacherWorkRecords)
      .where(and(
        eq(teacherWorkRecords.teacherId, teacherId),
        eq(teacherWorkRecords.centerId, centerId),
        eq(teacherWorkRecords.workDate, workDate)
      ));
    return result[0];
  }

  async createTeacherWorkRecord(data: InsertTeacherWorkRecord): Promise<TeacherWorkRecord> {
    const result = await db.insert(teacherWorkRecords).values(data).returning();
    return result[0];
  }

  async updateTeacherWorkRecord(id: string, data: Partial<InsertTeacherWorkRecord>): Promise<TeacherWorkRecord> {
    const result = await db.update(teacherWorkRecords).set({
      ...data,
      updatedAt: new Date(),
    }).where(eq(teacherWorkRecords.id, id)).returning();
    return result[0];
  }

  async getTeacherWorkRecordsWithoutCheckOut(date: string): Promise<TeacherWorkRecord[]> {
    return await db.select().from(teacherWorkRecords)
      .where(and(
        eq(teacherWorkRecords.workDate, date),
        isNull(teacherWorkRecords.checkOutAt),
        eq(teacherWorkRecords.noCheckOut, false)
      ));
  }

  async markTeacherWorkRecordNoCheckOut(id: string): Promise<void> {
    await db.update(teacherWorkRecords).set({ 
      noCheckOut: true,
      updatedAt: new Date() 
    }).where(eq(teacherWorkRecords.id, id));
  }

  async markMissingCheckOuts(workDate: string): Promise<number> {
    const recordsWithoutCheckOut = await this.getTeacherWorkRecordsWithoutCheckOut(workDate);
    for (const record of recordsWithoutCheckOut) {
      await this.markTeacherWorkRecordNoCheckOut(record.id);
    }
    return recordsWithoutCheckOut.length;
  }

  async deleteOldTeacherWorkRecords(beforeDate: string): Promise<number> {
    const result = await db.delete(teacherWorkRecords)
      .where(lt(teacherWorkRecords.workDate, beforeDate))
      .returning();
    return result.length;
  }

  async getMessageTemplates(centerId: string): Promise<MessageTemplate[]> {
    return await db.select().from(messageTemplates).where(eq(messageTemplates.centerId, centerId));
  }

  async getMessageTemplate(id: string): Promise<MessageTemplate | undefined> {
    const result = await db.select().from(messageTemplates).where(eq(messageTemplates.id, id));
    return result[0];
  }

  async createMessageTemplate(data: InsertMessageTemplate): Promise<MessageTemplate> {
    const result = await db.insert(messageTemplates).values(data).returning();
    return result[0];
  }

  async updateMessageTemplate(id: string, data: Partial<InsertMessageTemplate>): Promise<MessageTemplate> {
    const result = await db.update(messageTemplates).set({
      ...data,
      updatedAt: new Date(),
    }).where(eq(messageTemplates.id, id)).returning();
    return result[0];
  }

  async deleteMessageTemplate(id: string): Promise<void> {
    await db.delete(messageTemplates).where(eq(messageTemplates.id, id));
  }

  async createNotificationLog(data: InsertNotificationLog): Promise<NotificationLog> {
    const result = await db.insert(notificationLogs).values(data).returning();
    return result[0];
  }

  async updateNotificationLog(id: string, data: Partial<NotificationLog>): Promise<NotificationLog> {
    const result = await db.update(notificationLogs).set(data).where(eq(notificationLogs.id, id)).returning();
    return result[0];
  }

  async getNotificationLogsByAttendanceRecord(attendanceRecordId: string): Promise<NotificationLog[]> {
    return await db.select().from(notificationLogs)
      .where(eq(notificationLogs.attendanceRecordId, attendanceRecordId))
      .orderBy(notificationLogs.sentAt);
  }

  // Class Notes (수업 공통 기록)
  async getClassNotes(classId: string, noteDate: string): Promise<ClassNoteWithTeacher[]> {
    const notes = await db.select().from(classNotes)
      .where(and(eq(classNotes.classId, classId), eq(classNotes.noteDate, noteDate)));
    
    const result: ClassNoteWithTeacher[] = [];
    for (const note of notes) {
      const teacher = await this.getUser(note.teacherId);
      result.push({ ...note, teacher });
    }
    return result;
  }

  async getClassNote(id: string): Promise<ClassNote | undefined> {
    const result = await db.select().from(classNotes).where(eq(classNotes.id, id));
    return result[0];
  }

  async createClassNote(data: InsertClassNote): Promise<ClassNote> {
    const result = await db.insert(classNotes).values(data).returning();
    return result[0];
  }

  async updateClassNote(id: string, data: Partial<InsertClassNote>): Promise<ClassNote> {
    const result = await db.update(classNotes).set({
      ...data,
      updatedAt: new Date(),
    }).where(eq(classNotes.id, id)).returning();
    return result[0];
  }

  async deleteClassNote(id: string): Promise<void> {
    await db.delete(classNotes).where(eq(classNotes.id, id));
  }

  // Student Class Notes (학생별 수업 기록)
  async getStudentClassNotes(classId: string, noteDate: string): Promise<StudentClassNoteWithDetails[]> {
    const notes = await db.select().from(studentClassNotes)
      .where(and(eq(studentClassNotes.classId, classId), eq(studentClassNotes.noteDate, noteDate)));
    
    const result: StudentClassNoteWithDetails[] = [];
    for (const note of notes) {
      const student = await this.getUser(note.studentId);
      const teacher = await this.getUser(note.teacherId);
      result.push({ ...note, student, teacher });
    }
    return result;
  }

  async getStudentClassNote(id: string): Promise<StudentClassNote | undefined> {
    const result = await db.select().from(studentClassNotes).where(eq(studentClassNotes.id, id));
    return result[0];
  }

  async createStudentClassNote(data: InsertStudentClassNote): Promise<StudentClassNote> {
    const result = await db.insert(studentClassNotes).values(data).returning();
    return result[0];
  }

  async updateStudentClassNote(id: string, data: Partial<InsertStudentClassNote>): Promise<StudentClassNote> {
    const result = await db.update(studentClassNotes).set({
      ...data,
      updatedAt: new Date(),
    }).where(eq(studentClassNotes.id, id)).returning();
    return result[0];
  }

  async deleteStudentClassNote(id: string): Promise<void> {
    await db.delete(studentClassNotes).where(eq(studentClassNotes.id, id));
  }

  // SOLAPI Credentials
  async getSolapiCredentials(centerId: string): Promise<SolapiCredentials | undefined> {
    const result = await db.select().from(solapiCredentials).where(eq(solapiCredentials.centerId, centerId));
    return result[0];
  }

  async upsertSolapiCredentials(data: InsertSolapiCredentials): Promise<SolapiCredentials> {
    const existing = await this.getSolapiCredentials(data.centerId);
    if (existing) {
      const result = await db.update(solapiCredentials).set({
        apiKey: data.apiKey,
        apiSecret: data.apiSecret,
        senderNumber: data.senderNumber,
        updatedAt: new Date(),
      }).where(eq(solapiCredentials.centerId, data.centerId)).returning();
      return result[0];
    }
    const result = await db.insert(solapiCredentials).values(data).returning();
    return result[0];
  }

  async deleteSolapiCredentials(centerId: string): Promise<void> {
    await db.delete(solapiCredentials).where(eq(solapiCredentials.centerId, centerId));
  }

  // Study Cafe Settings
  async getStudyCafeSettings(centerId: string): Promise<StudyCafeSettings | undefined> {
    const result = await db.select().from(studyCafeSettings).where(eq(studyCafeSettings.centerId, centerId));
    return result[0];
  }

  async upsertStudyCafeSettings(data: InsertStudyCafeSettings): Promise<StudyCafeSettings> {
    const existing = await this.getStudyCafeSettings(data.centerId);
    if (existing) {
      const updateData: Record<string, any> = {
        isEnabled: data.isEnabled,
        notice: data.notice,
        updatedAt: new Date(),
      };
      if (data.entryPassword !== undefined) {
        updateData.entryPassword = data.entryPassword;
      }
      const result = await db.update(studyCafeSettings).set(updateData).where(eq(studyCafeSettings.centerId, data.centerId)).returning();
      return result[0];
    }
    const result = await db.insert(studyCafeSettings).values(data).returning();
    return result[0];
  }

  async getStudyCafeEnabledCenters(): Promise<StudyCafeSettings[]> {
    return await db.select().from(studyCafeSettings).where(eq(studyCafeSettings.isEnabled, true));
  }

  // Study Cafe Seats
  async getStudyCafeSeats(centerId: string): Promise<StudyCafeSeat[]> {
    return await db.select().from(studyCafeSeats).where(eq(studyCafeSeats.centerId, centerId));
  }

  async createStudyCafeSeat(data: InsertStudyCafeSeat): Promise<StudyCafeSeat> {
    const result = await db.insert(studyCafeSeats).values(data).returning();
    return result[0];
  }

  async updateStudyCafeSeat(id: string, data: Partial<InsertStudyCafeSeat>): Promise<StudyCafeSeat> {
    const result = await db.update(studyCafeSeats).set(data).where(eq(studyCafeSeats.id, id)).returning();
    return result[0];
  }

  async deleteStudyCafeSeat(id: string): Promise<void> {
    await db.delete(studyCafeSeats).where(eq(studyCafeSeats.id, id));
  }

  async initializeStudyCafeSeats(centerId: string): Promise<StudyCafeSeat[]> {
    const existingSeats = await this.getStudyCafeSeats(centerId);
    if (existingSeats.length > 0) {
      return existingSeats;
    }

    const seatLayout: { seatNumber: number; row: number; col: number }[] = [
      { seatNumber: 21, row: 0, col: 0 },
      { seatNumber: 22, row: 1, col: 0 },
      { seatNumber: 23, row: 2, col: 0 },
      { seatNumber: 24, row: 3, col: 0 },
      { seatNumber: 25, row: 4, col: 0 },
      { seatNumber: 26, row: 5, col: 0 },
      { seatNumber: 20, row: 0, col: 1 },
      { seatNumber: 19, row: 1, col: 1 },
      { seatNumber: 18, row: 2, col: 1 },
      { seatNumber: 17, row: 3, col: 1 },
      { seatNumber: 16, row: 4, col: 1 },
      { seatNumber: 15, row: 0, col: 2 },
      { seatNumber: 14, row: 1, col: 2 },
      { seatNumber: 13, row: 2, col: 2 },
      { seatNumber: 12, row: 3, col: 2 },
      { seatNumber: 11, row: 4, col: 2 },
      { seatNumber: 6, row: 0, col: 3 },
      { seatNumber: 7, row: 1, col: 3 },
      { seatNumber: 8, row: 2, col: 3 },
      { seatNumber: 9, row: 3, col: 3 },
      { seatNumber: 10, row: 4, col: 3 },
      { seatNumber: 5, row: 0, col: 4 },
      { seatNumber: 4, row: 1, col: 4 },
      { seatNumber: 3, row: 2, col: 4 },
      { seatNumber: 2, row: 3, col: 4 },
      { seatNumber: 1, row: 4, col: 4 },
    ];

    const createdSeats: StudyCafeSeat[] = [];
    for (const seat of seatLayout) {
      const created = await this.createStudyCafeSeat({
        centerId,
        seatNumber: seat.seatNumber,
        row: seat.row,
        col: seat.col,
        isActive: true,
      });
      createdSeats.push(created);
    }
    return createdSeats;
  }

  async getStudyCafeSeatsWithStatus(centerId: string): Promise<StudyCafeSeatWithStatus[]> {
    await this.expireOldReservations();
    await this.expireOldFixedSeats();

    const seats = await this.getStudyCafeSeats(centerId);
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    const result: StudyCafeSeatWithStatus[] = [];
    for (const seat of seats) {
      const activeReservation = await this.getActiveReservation(seat.id);
      const activeFixedSeat = await this.getActiveFixedSeat(seat.id);

      let remainingMinutes: number | undefined;
      let reservationWithStudent: (StudyCafeReservation & { student?: User }) | undefined;
      let fixedSeatWithStudent: (StudyCafeFixedSeat & { student?: User }) | undefined;

      if (activeReservation) {
        const endTime = new Date(activeReservation.endAt);
        remainingMinutes = Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 60000));
        const student = await this.getUser(activeReservation.studentId);
        reservationWithStudent = { ...activeReservation, student };
      }

      if (activeFixedSeat) {
        const student = await this.getUser(activeFixedSeat.studentId);
        fixedSeatWithStudent = { ...activeFixedSeat, student };
      }

      result.push({
        ...seat,
        reservation: reservationWithStudent,
        fixedSeat: fixedSeatWithStudent,
        remainingMinutes,
        isAvailable: !activeReservation && !activeFixedSeat,
        isFixed: !!activeFixedSeat,
      });
    }

    return result.sort((a, b) => a.seatNumber - b.seatNumber);
  }

  // Reservations
  async getActiveReservation(seatId: string): Promise<StudyCafeReservation | undefined> {
    const now = new Date();
    const result = await db.select().from(studyCafeReservations)
      .where(and(
        eq(studyCafeReservations.seatId, seatId),
        eq(studyCafeReservations.status, "active")
      ));
    const reservation = result[0];
    if (reservation && new Date(reservation.endAt) > now) {
      return reservation;
    }
    return undefined;
  }

  async getStudentActiveReservation(studentId: string, centerId: string): Promise<StudyCafeReservation | undefined> {
    const now = new Date();
    const result = await db.select().from(studyCafeReservations)
      .where(and(
        eq(studyCafeReservations.studentId, studentId),
        eq(studyCafeReservations.centerId, centerId),
        eq(studyCafeReservations.status, "active")
      ));
    const reservation = result[0];
    if (reservation && new Date(reservation.endAt) > now) {
      return reservation;
    }
    return undefined;
  }

  async getStudyCafeReservation(id: string): Promise<StudyCafeReservation | undefined> {
    const result = await db.select().from(studyCafeReservations)
      .where(eq(studyCafeReservations.id, id));
    return result[0];
  }

  async createStudyCafeReservation(data: InsertStudyCafeReservation): Promise<StudyCafeReservation> {
    const result = await db.insert(studyCafeReservations).values(data).returning();
    return result[0];
  }

  async updateStudyCafeReservation(id: string, data: Partial<InsertStudyCafeReservation>): Promise<StudyCafeReservation> {
    const result = await db.update(studyCafeReservations).set(data).where(eq(studyCafeReservations.id, id)).returning();
    return result[0];
  }

  async expireOldReservations(): Promise<number> {
    const now = new Date();
    const result = await db.update(studyCafeReservations).set({ status: "expired" })
      .where(and(
        eq(studyCafeReservations.status, "active"),
        lt(studyCafeReservations.endAt, now)
      )).returning();
    return result.length;
  }

  // Fixed Seats
  async getActiveFixedSeat(seatId: string): Promise<StudyCafeFixedSeat | undefined> {
    const today = new Date().toISOString().split('T')[0];
    const result = await db.select().from(studyCafeFixedSeats)
      .where(eq(studyCafeFixedSeats.seatId, seatId));
    const fixedSeat = result[0];
    if (fixedSeat && fixedSeat.startDate <= today && fixedSeat.endDate >= today) {
      return fixedSeat;
    }
    return undefined;
  }

  async getStudentActiveFixedSeat(studentId: string, centerId: string): Promise<StudyCafeFixedSeat | undefined> {
    const today = new Date().toISOString().split('T')[0];
    const result = await db.select().from(studyCafeFixedSeats)
      .where(and(
        eq(studyCafeFixedSeats.studentId, studentId),
        eq(studyCafeFixedSeats.centerId, centerId)
      ));
    const fixedSeat = result[0];
    if (fixedSeat && fixedSeat.startDate <= today && fixedSeat.endDate >= today) {
      return fixedSeat;
    }
    return undefined;
  }

  async getStudyCafeFixedSeatById(id: string): Promise<StudyCafeFixedSeat | undefined> {
    const result = await db.select().from(studyCafeFixedSeats)
      .where(eq(studyCafeFixedSeats.id, id));
    return result[0];
  }

  async getFixedSeats(centerId: string): Promise<(StudyCafeFixedSeat & { student?: User; seat?: StudyCafeSeat })[]> {
    const fixedSeats = await db.select().from(studyCafeFixedSeats)
      .where(eq(studyCafeFixedSeats.centerId, centerId));
    
    const result: (StudyCafeFixedSeat & { student?: User; seat?: StudyCafeSeat })[] = [];
    for (const fs of fixedSeats) {
      const student = await this.getUser(fs.studentId);
      const seats = await db.select().from(studyCafeSeats).where(eq(studyCafeSeats.id, fs.seatId));
      result.push({ ...fs, student, seat: seats[0] });
    }
    return result;
  }

  async createStudyCafeFixedSeat(data: InsertStudyCafeFixedSeat): Promise<StudyCafeFixedSeat> {
    const result = await db.insert(studyCafeFixedSeats).values(data).returning();
    return result[0];
  }

  async updateStudyCafeFixedSeat(id: string, data: Partial<InsertStudyCafeFixedSeat>): Promise<StudyCafeFixedSeat> {
    const result = await db.update(studyCafeFixedSeats).set(data).where(eq(studyCafeFixedSeats.id, id)).returning();
    return result[0];
  }

  async deleteStudyCafeFixedSeat(id: string): Promise<void> {
    await db.delete(studyCafeFixedSeats).where(eq(studyCafeFixedSeats.id, id));
  }

  async expireOldFixedSeats(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const result = await db.delete(studyCafeFixedSeats)
      .where(lt(studyCafeFixedSeats.endDate, today))
      .returning();
    return result.length;
  }

  // Tuition Access Passwords
  async getTuitionAccessPassword(studentId: string): Promise<TuitionAccessPassword | undefined> {
    const result = await db.select().from(tuitionAccessPasswords)
      .where(eq(tuitionAccessPasswords.studentId, studentId));
    return result[0];
  }

  async setTuitionAccessPassword(studentId: string, password: string): Promise<TuitionAccessPassword> {
    const existing = await this.getTuitionAccessPassword(studentId);
    if (existing) {
      const result = await db.update(tuitionAccessPasswords)
        .set({ password, updatedAt: new Date() })
        .where(eq(tuitionAccessPasswords.studentId, studentId))
        .returning();
      return result[0];
    }
    const result = await db.insert(tuitionAccessPasswords)
      .values({ studentId, password })
      .returning();
    return result[0];
  }

  async deleteTuitionAccessPassword(studentId: string): Promise<void> {
    await db.delete(tuitionAccessPasswords)
      .where(eq(tuitionAccessPasswords.studentId, studentId));
  }

  // Tuition Guidance
  async getTuitionGuidance(centerId: string): Promise<TuitionGuidance | undefined> {
    const result = await db.select().from(tuitionGuidances)
      .where(eq(tuitionGuidances.centerId, centerId));
    return result[0];
  }

  async upsertTuitionGuidance(centerId: string, data: { guidanceText?: string | null; imageUrls?: string[] }): Promise<TuitionGuidance> {
    const existing = await this.getTuitionGuidance(centerId);
    if (existing) {
      const result = await db.update(tuitionGuidances)
        .set({ 
          guidanceText: data.guidanceText ?? existing.guidanceText,
          imageUrls: data.imageUrls ?? existing.imageUrls,
          updatedAt: new Date() 
        })
        .where(eq(tuitionGuidances.centerId, centerId))
        .returning();
      return result[0];
    }
    const result = await db.insert(tuitionGuidances)
      .values({ 
        centerId, 
        guidanceText: data.guidanceText,
        imageUrls: data.imageUrls || []
      })
      .returning();
    return result[0];
  }

  // Tuition Notifications
  async getTuitionNotifications(centerId: string): Promise<(TuitionNotification & { student?: User; parent?: User; sender?: User })[]> {
    const notifications = await db.select().from(tuitionNotifications)
      .where(eq(tuitionNotifications.centerId, centerId))
      .orderBy(tuitionNotifications.createdAt);
    
    const results: (TuitionNotification & { student?: User; parent?: User; sender?: User })[] = [];
    for (const notification of notifications) {
      const student = await this.getUser(notification.studentId);
      const parent = notification.parentId ? await this.getUser(notification.parentId) : undefined;
      const sender = await this.getUser(notification.sentById);
      results.push({ ...notification, student, parent, sender });
    }
    return results.reverse(); // Most recent first
  }

  async getTuitionNotificationsByStudent(studentId: string): Promise<TuitionNotification[]> {
    return await db.select().from(tuitionNotifications)
      .where(eq(tuitionNotifications.studentId, studentId))
      .orderBy(tuitionNotifications.createdAt);
  }

  async createTuitionNotification(data: InsertTuitionNotification): Promise<TuitionNotification> {
    const result = await db.insert(tuitionNotifications).values(data).returning();
    return result[0];
  }

  // Student Monthly Reports
  async getStudentMonthlyReport(id: string): Promise<StudentMonthlyReport | undefined> {
    const result = await db.select().from(studentMonthlyReports).where(eq(studentMonthlyReports.id, id));
    return result[0];
  }

  async getStudentMonthlyReportByMonth(studentId: string, year: number, month: number): Promise<StudentMonthlyReport | undefined> {
    const result = await db.select().from(studentMonthlyReports)
      .where(and(
        eq(studentMonthlyReports.studentId, studentId),
        eq(studentMonthlyReports.year, year),
        eq(studentMonthlyReports.month, month)
      ));
    return result[0];
  }

  async getStudentMonthlyReports(centerId: string, year: number, month: number): Promise<(StudentMonthlyReport & { student?: User; creator?: User })[]> {
    const reports = await db.select().from(studentMonthlyReports)
      .where(and(
        eq(studentMonthlyReports.centerId, centerId),
        eq(studentMonthlyReports.year, year),
        eq(studentMonthlyReports.month, month)
      ));
    
    const results: (StudentMonthlyReport & { student?: User; creator?: User })[] = [];
    for (const report of reports) {
      const student = await this.getUser(report.studentId);
      const creator = await this.getUser(report.createdById);
      results.push({ ...report, student, creator });
    }
    return results;
  }

  async createStudentMonthlyReport(data: InsertStudentMonthlyReport): Promise<StudentMonthlyReport> {
    const result = await db.insert(studentMonthlyReports).values(data).returning();
    return result[0];
  }

  async updateStudentMonthlyReport(id: string, data: Partial<InsertStudentMonthlyReport>): Promise<StudentMonthlyReport> {
    const result = await db.update(studentMonthlyReports)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(studentMonthlyReports.id, id))
      .returning();
    return result[0];
  }

  async deleteStudentMonthlyReport(id: string): Promise<void> {
    await db.delete(studentMonthlyReports).where(eq(studentMonthlyReports.id, id));
  }

  // System Settings
  async getSystemSetting(key: string): Promise<string | null> {
    const result = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    return result[0]?.value ?? null;
  }

  async setSystemSetting(key: string, value: string): Promise<void> {
    await db.insert(systemSettings)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value, updatedAt: new Date() }
      });
  }

  // Promote all student grades (for auto-promotion)
  async promoteAllStudentGrades(): Promise<number> {
    const gradeMap: Record<string, string> = {
      "초1": "초2", "초2": "초3", "초3": "초4", "초4": "초5", "초5": "초6", "초6": "중1",
      "중1": "중2", "중2": "중3", "중3": "고1",
      "고1": "고2", "고2": "고3", "고3": "고3",
    };
    
    const allUsers = await this.getUsers();
    const students = allUsers.filter(u => u.role === 1 && u.grade);
    
    let promotedCount = 0;
    for (const student of students) {
      const currentGrade = student.grade;
      const nextGrade = currentGrade ? gradeMap[currentGrade] : null;
      
      if (nextGrade && nextGrade !== currentGrade) {
        await this.updateUser(student.id, { grade: nextGrade });
        promotedCount++;
      }
    }
    
    return promotedCount;
  }

  // Notification methods
  async getNotifications(userId: string): Promise<Notification[]> {
    return await db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db.select().from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ));
    return result.length;
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const result = await db.insert(notifications).values(notification).returning();
    return result[0];
  }

  async markNotificationAsRead(id: string): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id));
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));
  }

  async deleteNotification(id: string): Promise<void> {
    await db.delete(notifications).where(eq(notifications.id, id));
  }

  // Todo methods
  async getTodo(id: string): Promise<TodoWithDetails | undefined> {
    const result = await db.select().from(todos).where(eq(todos.id, id));
    if (!result[0]) return undefined;

    const todo = result[0];
    const creator = await this.getUser(todo.creatorId);
    const assigneesList = await this.getTodoAssignees(id);

    return {
      ...todo,
      creator,
      assignees: assigneesList,
    };
  }

  async getTodos(centerId: string, assigneeId?: string): Promise<TodoWithDetails[]> {
    const allTodos = await db.select().from(todos)
      .where(and(
        eq(todos.centerId, centerId),
        eq(todos.isActive, true)
      ))
      .orderBy(desc(todos.createdAt));

    if (allTodos.length === 0) return [];

    const todoIds = allTodos.map(t => t.id);
    
    // Batch fetch all assignees for all todos at once
    const allAssignees = await db.select().from(todoAssignees)
      .where(inArray(todoAssignees.todoId, todoIds));
    
    // Batch fetch all users (creators + assignees)
    const creatorIds = allTodos.map(t => t.creatorId);
    const assigneeUserIds = allAssignees.map(a => a.assigneeId);
    const allUserIds = Array.from(new Set([...creatorIds, ...assigneeUserIds]));
    const allUsers = allUserIds.length > 0 
      ? await db.select().from(users).where(inArray(users.id, allUserIds))
      : [];
    const userMap = new Map(allUsers.map(u => [u.id, u]));
    
    // Group assignees by todoId
    const assigneesByTodoId = new Map<string, (TodoAssignee & { user?: User })[]>();
    for (const assignee of allAssignees) {
      if (!assigneesByTodoId.has(assignee.todoId)) {
        assigneesByTodoId.set(assignee.todoId, []);
      }
      assigneesByTodoId.get(assignee.todoId)!.push({
        ...assignee,
        user: userMap.get(assignee.assigneeId),
      });
    }

    const result: TodoWithDetails[] = [];
    for (const todo of allTodos) {
      const assigneesList = assigneesByTodoId.get(todo.id) || [];
      
      if (assigneeId) {
        const isAssigned = assigneesList.some(a => a.assigneeId === assigneeId);
        if (!isAssigned) continue;
      }

      result.push({
        ...todo,
        creator: userMap.get(todo.creatorId),
        assignees: assigneesList,
      });
    }

    return result;
  }

  async getTodosByDate(centerId: string, date: string, assigneeId?: string): Promise<TodoWithDetails[]> {
    const allTodos = await this.getTodos(centerId, assigneeId);
    
    return allTodos.filter(todo => {
      if (todo.recurrence === "none") {
        return todo.dueDate === date;
      }
      
      const anchor = todo.recurrenceAnchorDate || todo.dueDate;
      const anchorDate = new Date(anchor);
      const targetDate = new Date(date);
      
      if (targetDate < anchorDate) return false;
      
      if (todo.recurrence === "weekly") {
        const diffDays = Math.floor((targetDate.getTime() - anchorDate.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays % 7 === 0;
      }
      
      if (todo.recurrence === "monthly") {
        return anchorDate.getDate() === targetDate.getDate();
      }
      
      return false;
    });
  }

  async createTodo(todo: InsertTodo, assigneeIds: string[]): Promise<TodoWithDetails> {
    const result = await db.insert(todos).values({
      ...todo,
      recurrenceAnchorDate: todo.recurrence !== "none" ? todo.dueDate : null,
    }).returning();
    const newTodo = result[0];

    for (const assigneeId of assigneeIds) {
      await db.insert(todoAssignees).values({
        todoId: newTodo.id,
        assigneeId,
      });
    }

    return (await this.getTodo(newTodo.id))!;
  }

  async updateTodo(id: string, data: Partial<InsertTodo>, assigneeIds?: string[]): Promise<Todo> {
    const result = await db.update(todos)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(todos.id, id))
      .returning();
    if (!result[0]) throw new Error("Todo not found");

    // Update assignees if provided
    if (assigneeIds !== undefined) {
      // Get existing base assignees (without completedForDate)
      const existingAssignees = await db.select().from(todoAssignees)
        .where(and(
          eq(todoAssignees.todoId, id),
          eq(todoAssignees.completedForDate, null as any)
        ));

      const existingIds = existingAssignees.map(a => a.assigneeId);
      const toAdd = assigneeIds.filter(id => !existingIds.includes(id));
      const toRemove = existingIds.filter(id => !assigneeIds.includes(id));

      // Remove old assignees (including their completion records)
      for (const assigneeId of toRemove) {
        await db.delete(todoAssignees).where(and(
          eq(todoAssignees.todoId, id),
          eq(todoAssignees.assigneeId, assigneeId)
        ));
      }

      // Add new assignees
      for (const assigneeId of toAdd) {
        await db.insert(todoAssignees).values({
          todoId: id,
          assigneeId,
        });
      }
    }

    return result[0];
  }

  async deleteTodo(id: string): Promise<void> {
    await db.delete(todoAssignees).where(eq(todoAssignees.todoId, id));
    await db.delete(todos).where(eq(todos.id, id));
  }

  async toggleTodoComplete(todoId: string, assigneeId: string, date: string): Promise<TodoAssignee> {
    const existing = await db.select().from(todoAssignees)
      .where(and(
        eq(todoAssignees.todoId, todoId),
        eq(todoAssignees.assigneeId, assigneeId),
        eq(todoAssignees.completedForDate, date)
      ));

    if (existing[0]) {
      await db.delete(todoAssignees).where(eq(todoAssignees.id, existing[0].id));
      const base = await db.select().from(todoAssignees)
        .where(and(
          eq(todoAssignees.todoId, todoId),
          eq(todoAssignees.assigneeId, assigneeId),
          eq(todoAssignees.completedForDate, null as any)
        ));
      return base[0] || existing[0];
    }

    const result = await db.insert(todoAssignees).values({
      todoId,
      assigneeId,
      isCompleted: true,
      completedAt: new Date(),
      completedForDate: date,
    }).returning();
    return result[0];
  }

  async getTodoAssignees(todoId: string): Promise<(TodoAssignee & { user?: User })[]> {
    const assignees = await db.select().from(todoAssignees)
      .where(eq(todoAssignees.todoId, todoId));

    const result: (TodoAssignee & { user?: User })[] = [];
    for (const assignee of assignees) {
      const user = await this.getUser(assignee.assigneeId);
      result.push({ ...assignee, user });
    }
    return result;
  }

  async isTodoCompletedForDate(todoId: string, assigneeId: string, date: string): Promise<boolean> {
    const result = await db.select().from(todoAssignees)
      .where(and(
        eq(todoAssignees.todoId, todoId),
        eq(todoAssignees.assigneeId, assigneeId),
        eq(todoAssignees.completedForDate, date)
      ));
    return result.length > 0;
  }

  // Student Exit Records (학생 퇴원 기록)
  async createStudentExitRecord(data: InsertStudentExitRecord): Promise<StudentExitRecord> {
    const result = await db.insert(studentExitRecords).values(data).returning();
    return result[0];
  }

  async getStudentExitRecords(centerId: string): Promise<StudentExitRecord[]> {
    return await db.select().from(studentExitRecords)
      .where(eq(studentExitRecords.centerId, centerId))
      .orderBy(desc(studentExitRecords.createdAt));
  }

  async getMonthlyExitSummary(centerId: string, months: number): Promise<{ month: string; exitCount: number; reasons: Record<string, number> }[]> {
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
    const startMonthStr = `${startMonth.getFullYear()}-${String(startMonth.getMonth() + 1).padStart(2, '0')}`;
    
    const records = await db.select().from(studentExitRecords)
      .where(and(
        eq(studentExitRecords.centerId, centerId),
        gte(studentExitRecords.exitMonth, startMonthStr)
      ));
    
    const summary: Record<string, { exitCount: number; reasons: Record<string, number> }> = {};
    
    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - months + 1 + i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      summary[monthKey] = { exitCount: 0, reasons: {} };
    }
    
    for (const record of records) {
      if (summary[record.exitMonth]) {
        summary[record.exitMonth].exitCount++;
        for (const reason of record.reasons || []) {
          summary[record.exitMonth].reasons[reason] = (summary[record.exitMonth].reasons[reason] || 0) + 1;
        }
      }
    }
    
    return Object.entries(summary)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  // Monthly Student Snapshots (월별 학생 수)
  async getOrCreateMonthlySnapshot(centerId: string, month: string): Promise<MonthlyStudentSnapshot> {
    const existing = await db.select().from(monthlyStudentSnapshots)
      .where(and(
        eq(monthlyStudentSnapshots.centerId, centerId),
        eq(monthlyStudentSnapshots.month, month)
      ));
    
    if (existing[0]) return existing[0];
    
    const students = await this.getCenterUsers(centerId, UserRole.STUDENT);
    const studentCount = students.length;
    
    const result = await db.insert(monthlyStudentSnapshots)
      .values({ centerId, month, studentCount })
      .returning();
    return result[0];
  }

  async getMonthlyStudentSnapshots(centerId: string, months: number): Promise<MonthlyStudentSnapshot[]> {
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
    const startMonthStr = `${startMonth.getFullYear()}-${String(startMonth.getMonth() + 1).padStart(2, '0')}`;
    
    return await db.select().from(monthlyStudentSnapshots)
      .where(and(
        eq(monthlyStudentSnapshots.centerId, centerId),
        gte(monthlyStudentSnapshots.month, startMonthStr)
      ))
      .orderBy(monthlyStudentSnapshots.month);
  }

  async updateMonthlyStudentCount(centerId: string, month: string): Promise<MonthlyStudentSnapshot> {
    const students = await this.getCenterUsers(centerId, UserRole.STUDENT);
    const studentCount = students.length;
    
    const existing = await db.select().from(monthlyStudentSnapshots)
      .where(and(
        eq(monthlyStudentSnapshots.centerId, centerId),
        eq(monthlyStudentSnapshots.month, month)
      ));
    
    if (existing[0]) {
      const result = await db.update(monthlyStudentSnapshots)
        .set({ studentCount })
        .where(eq(monthlyStudentSnapshots.id, existing[0].id))
        .returning();
      return result[0];
    }
    
    const result = await db.insert(monthlyStudentSnapshots)
      .values({ centerId, month, studentCount })
      .returning();
    return result[0];
  }

  // Marketing Campaigns (마케팅 캠페인)
  async getMarketingCampaigns(centerId: string, year?: number): Promise<MarketingCampaign[]> {
    if (year) {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      return await db.select().from(marketingCampaigns)
        .where(and(
          eq(marketingCampaigns.centerId, centerId),
          gte(marketingCampaigns.startDate, startDate),
          lte(marketingCampaigns.startDate, endDate)
        ))
        .orderBy(desc(marketingCampaigns.startDate));
    }
    return await db.select().from(marketingCampaigns)
      .where(eq(marketingCampaigns.centerId, centerId))
      .orderBy(desc(marketingCampaigns.startDate));
  }

  async getMarketingCampaign(id: string): Promise<MarketingCampaign | undefined> {
    const result = await db.select().from(marketingCampaigns).where(eq(marketingCampaigns.id, id));
    return result[0];
  }

  async createMarketingCampaign(data: InsertMarketingCampaign): Promise<MarketingCampaign> {
    const result = await db.insert(marketingCampaigns).values(data).returning();
    return result[0];
  }

  async updateMarketingCampaign(id: string, data: Partial<InsertMarketingCampaign>): Promise<MarketingCampaign> {
    const result = await db.update(marketingCampaigns)
      .set(data)
      .where(eq(marketingCampaigns.id, id))
      .returning();
    return result[0];
  }

  async deleteMarketingCampaign(id: string): Promise<void> {
    await db.delete(marketingCampaigns).where(eq(marketingCampaigns.id, id));
  }

  // Monthly Financial Records
  async getMonthlyFinancialRecords(centerId: string, year?: number): Promise<MonthlyFinancialRecord[]> {
    if (year) {
      const startMonth = `${year}-01`;
      const endMonth = `${year}-12`;
      return await db.select().from(monthlyFinancialRecords)
        .where(and(
          eq(monthlyFinancialRecords.centerId, centerId),
          gte(monthlyFinancialRecords.yearMonth, startMonth),
          lte(monthlyFinancialRecords.yearMonth, endMonth)
        ))
        .orderBy(desc(monthlyFinancialRecords.yearMonth));
    }
    return await db.select().from(monthlyFinancialRecords)
      .where(eq(monthlyFinancialRecords.centerId, centerId))
      .orderBy(desc(monthlyFinancialRecords.yearMonth));
  }

  async getMonthlyFinancialRecord(centerId: string, yearMonth: string): Promise<MonthlyFinancialRecord | undefined> {
    const result = await db.select().from(monthlyFinancialRecords)
      .where(and(
        eq(monthlyFinancialRecords.centerId, centerId),
        eq(monthlyFinancialRecords.yearMonth, yearMonth)
      ));
    return result[0];
  }

  async getMonthlyFinancialRecordById(id: string): Promise<MonthlyFinancialRecord | undefined> {
    const result = await db.select().from(monthlyFinancialRecords)
      .where(eq(monthlyFinancialRecords.id, id));
    return result[0];
  }

  async createMonthlyFinancialRecord(data: InsertMonthlyFinancialRecord): Promise<MonthlyFinancialRecord> {
    const result = await db.insert(monthlyFinancialRecords).values(data).returning();
    return result[0];
  }

  async updateMonthlyFinancialRecord(id: string, data: Partial<InsertMonthlyFinancialRecord>): Promise<MonthlyFinancialRecord> {
    const result = await db.update(monthlyFinancialRecords)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(monthlyFinancialRecords.id, id))
      .returning();
    return result[0];
  }

  async deleteMonthlyFinancialRecord(id: string): Promise<void> {
    await db.delete(monthlyFinancialRecords).where(eq(monthlyFinancialRecords.id, id));
  }

  // Teacher Salary Settings
  async getTeacherSalarySettings(teacherId: string, centerId: string): Promise<TeacherSalarySettings | undefined> {
    const result = await db.select().from(teacherSalarySettings)
      .where(and(
        eq(teacherSalarySettings.teacherId, teacherId),
        eq(teacherSalarySettings.centerId, centerId)
      ));
    return result[0];
  }

  async getTeacherSalarySettingsByCenter(centerId: string): Promise<TeacherSalarySettings[]> {
    return await db.select().from(teacherSalarySettings)
      .where(eq(teacherSalarySettings.centerId, centerId));
  }

  async createTeacherSalarySettings(data: InsertTeacherSalarySettings): Promise<TeacherSalarySettings> {
    const result = await db.insert(teacherSalarySettings).values(data).returning();
    return result[0];
  }

  async updateTeacherSalarySettings(id: string, data: Partial<InsertTeacherSalarySettings>): Promise<TeacherSalarySettings> {
    const result = await db.update(teacherSalarySettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(teacherSalarySettings.id, id))
      .returning();
    return result[0];
  }

  async deleteTeacherSalarySettings(id: string): Promise<void> {
    await db.delete(teacherSalarySettings).where(eq(teacherSalarySettings.id, id));
  }

  // Teacher Salary Adjustments (급여 조정 항목)
  async getTeacherSalaryAdjustments(teacherId: string, centerId: string, yearMonth: string): Promise<TeacherSalaryAdjustment[]> {
    return await db.select().from(teacherSalaryAdjustments)
      .where(and(
        eq(teacherSalaryAdjustments.teacherId, teacherId),
        eq(teacherSalaryAdjustments.centerId, centerId),
        eq(teacherSalaryAdjustments.yearMonth, yearMonth)
      ));
  }

  async getTeacherSalaryAdjustmentsByCenter(centerId: string, yearMonth: string): Promise<TeacherSalaryAdjustment[]> {
    return await db.select().from(teacherSalaryAdjustments)
      .where(and(
        eq(teacherSalaryAdjustments.centerId, centerId),
        eq(teacherSalaryAdjustments.yearMonth, yearMonth)
      ));
  }

  async createTeacherSalaryAdjustment(data: InsertTeacherSalaryAdjustment): Promise<TeacherSalaryAdjustment> {
    const result = await db.insert(teacherSalaryAdjustments).values(data).returning();
    return result[0];
  }

  async updateTeacherSalaryAdjustment(id: string, data: Partial<InsertTeacherSalaryAdjustment>): Promise<TeacherSalaryAdjustment> {
    const result = await db.update(teacherSalaryAdjustments)
      .set(data)
      .where(eq(teacherSalaryAdjustments.id, id))
      .returning();
    return result[0];
  }

  async deleteTeacherSalaryAdjustment(id: string): Promise<void> {
    await db.delete(teacherSalaryAdjustments).where(eq(teacherSalaryAdjustments.id, id));
  }

  // Student Textbook Purchases (학생 교재비)
  async getStudentTextbookPurchases(studentId: string): Promise<StudentTextbookPurchase[]> {
    return await db.select().from(studentTextbookPurchases)
      .where(eq(studentTextbookPurchases.studentId, studentId))
      .orderBy(desc(studentTextbookPurchases.purchaseDate));
  }

  async getStudentTextbookPurchasesByCenter(centerId: string): Promise<StudentTextbookPurchase[]> {
    return await db.select().from(studentTextbookPurchases)
      .where(eq(studentTextbookPurchases.centerId, centerId))
      .orderBy(desc(studentTextbookPurchases.purchaseDate));
  }

  async createStudentTextbookPurchase(data: InsertStudentTextbookPurchase): Promise<StudentTextbookPurchase> {
    const result = await db.insert(studentTextbookPurchases).values(data).returning();
    return result[0];
  }

  async updateStudentTextbookPurchase(id: string, data: Partial<InsertStudentTextbookPurchase>): Promise<StudentTextbookPurchase> {
    const result = await db.update(studentTextbookPurchases)
      .set(data)
      .where(eq(studentTextbookPurchases.id, id))
      .returning();
    return result[0];
  }

  async deleteStudentTextbookPurchase(id: string): Promise<void> {
    await db.delete(studentTextbookPurchases).where(eq(studentTextbookPurchases.id, id));
  }
}

export async function seedDatabase(): Promise<void> {
  const existingCenters = await db.select().from(centers);
  if (existingCenters.length > 0) {
    console.log("Database already has data, skipping seed");
    return;
  }

  console.log("Seeding database with initial data...");

  const [dmcCenter] = await db.insert(centers).values({ name: "DMC센터" }).returning();
  const [mokdongCenter] = await db.insert(centers).values({ name: "목동센터" }).returning();

  const [admin] = await db.insert(users).values({
    username: "admin",
    password: "1234",
    name: "관리자",
    phone: "01000000000",
    role: UserRole.ADMIN,
  }).returning();
  await db.insert(userCenters).values({ userId: admin.id, centerId: dmcCenter.id });
  await db.insert(userCenters).values({ userId: admin.id, centerId: mokdongCenter.id });

  const [principal] = await db.insert(users).values({
    username: "01011111111",
    password: "1234",
    name: "김원장",
    phone: "01011111111",
    role: UserRole.PRINCIPAL,
  }).returning();
  await db.insert(userCenters).values({ userId: principal.id, centerId: dmcCenter.id });

  const [teacher] = await db.insert(users).values({
    username: "01022222222",
    password: "1234",
    name: "이선생",
    phone: "01022222222",
    role: UserRole.TEACHER,
  }).returning();
  await db.insert(userCenters).values({ userId: teacher.id, centerId: dmcCenter.id });

  const [student1] = await db.insert(users).values({
    username: "01033333333",
    password: "1234",
    name: "박학생",
    phone: "01033333333",
    motherPhone: "01055555555",
    fatherPhone: "01066666666",
    school: "서울초등학교",
    grade: "초6",
    role: UserRole.STUDENT,
  }).returning();
  await db.insert(userCenters).values({ userId: student1.id, centerId: dmcCenter.id });

  const [student2] = await db.insert(users).values({
    username: "01044444444",
    password: "1234",
    name: "최학생",
    phone: "01044444444",
    motherPhone: "01077777777",
    school: "목동중학교",
    grade: "중2",
    role: UserRole.STUDENT,
  }).returning();
  await db.insert(userCenters).values({ userId: student2.id, centerId: dmcCenter.id });

  const [teacher2] = await db.insert(users).values({
    username: "01066666666",
    password: "1234",
    name: "김수학",
    phone: "01066666666",
    role: UserRole.TEACHER,
  }).returning();
  await db.insert(userCenters).values({ userId: teacher2.id, centerId: dmcCenter.id });

  const [student3] = await db.insert(users).values({
    username: "01077777777",
    password: "1234",
    name: "정학생",
    phone: "01077777777",
    school: "DMC고등학교",
    grade: "고1",
    role: UserRole.STUDENT,
  }).returning();
  await db.insert(userCenters).values({ userId: student3.id, centerId: dmcCenter.id });

  const [principal2] = await db.insert(users).values({
    username: "01088888888",
    password: "1234",
    name: "박원장",
    phone: "01088888888",
    role: UserRole.PRINCIPAL,
  }).returning();
  await db.insert(userCenters).values({ userId: principal2.id, centerId: mokdongCenter.id });

  const [teacherMok1] = await db.insert(users).values({
    username: "01091111111",
    password: "1234",
    name: "최선생",
    phone: "01091111111",
    role: UserRole.TEACHER,
  }).returning();
  await db.insert(userCenters).values({ userId: teacherMok1.id, centerId: mokdongCenter.id });

  const [teacherMok2] = await db.insert(users).values({
    username: "01092222222",
    password: "1234",
    name: "한선생",
    phone: "01092222222",
    role: UserRole.TEACHER,
  }).returning();
  await db.insert(userCenters).values({ userId: teacherMok2.id, centerId: mokdongCenter.id });

  const [studentMok1] = await db.insert(users).values({
    username: "01093333333",
    password: "1234",
    name: "이학생",
    phone: "01093333333",
    role: UserRole.STUDENT,
  }).returning();
  await db.insert(userCenters).values({ userId: studentMok1.id, centerId: mokdongCenter.id });

  const [studentMok2] = await db.insert(users).values({
    username: "01094444444",
    password: "1234",
    name: "강학생",
    phone: "01094444444",
    role: UserRole.STUDENT,
  }).returning();
  await db.insert(userCenters).values({ userId: studentMok2.id, centerId: mokdongCenter.id });

  const [mathClass] = await db.insert(classes).values({
    name: "수학 A반",
    subject: "수학",
    classType: "regular",
    teacherId: teacher.id,
    centerId: dmcCenter.id,
    classroom: "A101",
    days: ["mon", "wed", "fri"],
    startTime: "14:00",
    endTime: "16:00",
    color: "#3B82F6",
  }).returning();

  const [englishClass] = await db.insert(classes).values({
    name: "영어 기초반",
    subject: "영어",
    classType: "regular",
    teacherId: teacher.id,
    centerId: dmcCenter.id,
    classroom: "B202",
    days: ["tue", "thu"],
    startTime: "16:00",
    endTime: "18:00",
    color: "#10B981",
  }).returning();

  const [testClass] = await db.insert(classes).values({
    name: "수학 평가",
    subject: "수학",
    classType: "assessment",
    teacherId: teacher.id,
    centerId: dmcCenter.id,
    classroom: "A101",
    days: ["sat"],
    startTime: "10:00",
    endTime: "12:00",
    color: "#EF4444",
  }).returning();

  const [mokMathClass] = await db.insert(classes).values({
    name: "수학 심화반",
    subject: "심화반",
    classType: "regular",
    teacherId: teacherMok1.id,
    centerId: mokdongCenter.id,
    classroom: "101호",
    days: ["mon", "wed"],
    startTime: "15:00",
    endTime: "17:00",
    color: "#1E3A5F",
  }).returning();

  const [mokBasicClass] = await db.insert(classes).values({
    name: "수학 기초반",
    subject: "기초반",
    classType: "regular",
    teacherId: teacherMok2.id,
    centerId: mokdongCenter.id,
    classroom: "102호",
    days: ["tue", "thu"],
    startTime: "14:00",
    endTime: "16:00",
    color: "#8B2942",
  }).returning();

  await db.insert(enrollments).values({ studentId: studentMok1.id, classId: mokMathClass.id });
  await db.insert(enrollments).values({ studentId: studentMok2.id, classId: mokBasicClass.id });
  await db.insert(enrollments).values({ studentId: student1.id, classId: mathClass.id });
  await db.insert(enrollments).values({ studentId: student1.id, classId: englishClass.id });
  await db.insert(enrollments).values({ studentId: student2.id, classId: mathClass.id });
  await db.insert(enrollments).values({ studentId: student1.id, classId: testClass.id });
  await db.insert(enrollments).values({ studentId: student2.id, classId: testClass.id });
  await db.insert(enrollments).values({ studentId: student3.id, classId: testClass.id });

  await db.insert(homework).values({
    classId: mathClass.id,
    title: "교과서 32~35페이지 풀어오세요",
    dueDate: new Date().toISOString().split("T")[0],
  });

  await db.insert(homework).values({
    classId: englishClass.id,
    title: "단어 암기 Day 5 테스트 준비하세요",
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  });

  await db.insert(textbooks).values({
    title: "수학의 정석",
    isVisible: true,
  });

  console.log("Database seeded successfully!");
}

export const storage = new DatabaseStorage();
