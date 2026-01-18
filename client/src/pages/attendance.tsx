import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, invalidateQueriesStartingWith } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  type User,
  type Class,
  type AttendanceRecord,
  type MessageTemplate,
  type TeacherCheckInSettings,
  UserRole,
} from "@shared/schema";
import {
  Clock,
  Users,
  CalendarDays,
  Loader2,
  UserCheck,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Settings,
  MessageSquare,
  GraduationCap,
  KeyRound,
  History,
  Send,
  XCircle,
  Search,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { format, addDays, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { ko } from "date-fns/locale";
import { Link } from "wouter";
import { formatKoreanTime } from "@/lib/utils";

type NotificationLogInfo = { sentAt: string; status: string };
type StudentWithAttendance = User & { 
  attendanceRecord: AttendanceRecord | null;
  notificationLogs: NotificationLogInfo[];
};

export default function AttendancePage() {
  const { user, selectedCenter } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("attendance");
  const [checkInMessage, setCheckInMessage] = useState("[프라임수학] {학생명} 학생이 {시간}에 출석하였습니다.");
  const [lateMessage, setLateMessage] = useState("[프라임수학] {학생명} 학생이 수업에 참여하지 않았습니다. 빠르게 등원할 수 있도록 해주세요.");
  const [checkOutMessage, setCheckOutMessage] = useState("[프라임수학] {학생명} 학생이 {시간}에 하원하였습니다.");
  const [teacherCheckInMessage, setTeacherCheckInMessage] = useState("[{센터명}] {선생님명} 선생님 출근 확인 ({시간})");

  const isTeacher = user?.role === UserRole.TEACHER;
  const isPrincipalOrAdmin = user?.role && user.role >= UserRole.PRINCIPAL;

  // Get teachers and principals for principal/admin view
  const { data: allCenterUsers = [], isLoading: teachersLoading } = useQuery<User[]>({
    queryKey: [`/api/users?centerId=${selectedCenter?.id}`],
    enabled: !!selectedCenter?.id && !!isPrincipalOrAdmin,
  });
  
  // Filter to show teachers and principals (role 2 and 3)
  const teachers = allCenterUsers.filter(u => u.role === UserRole.TEACHER || u.role === UserRole.PRINCIPAL);

  // Get classes for selected teacher (or current user if teacher)
  const teacherIdForClasses = isTeacher ? user?.id : selectedTeacherId;
  const { data: classes = [], isLoading: classesLoading } = useQuery<Class[]>({
    queryKey: [`/api/teachers/${teacherIdForClasses}/classes?centerId=${selectedCenter?.id}`],
    enabled: !!selectedCenter?.id && !!teacherIdForClasses,
  });

  // Get students with attendance for selected class
  const { data: studentsWithAttendance = [], isLoading: studentsLoading, refetch: refetchStudents } = useQuery<StudentWithAttendance[]>({
    queryKey: [`/api/classes/${selectedClassId}/attendance?date=${selectedDate}`],
    enabled: !!selectedClassId,
  });

  // Update attendance status mutation (without SMS)
  const updateStatusMutation = useMutation({
    mutationFn: async ({ studentId, status }: { studentId: string; status: string }) => {
      const res = await apiRequest("PATCH", "/api/attendance/update-status", {
        studentId,
        centerId: selectedCenter?.id,
        classId: selectedClassId,
        status,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }
      return res.json();
    },
    onSuccess: () => {
      refetchStudents();
      toast({ title: "출결 상태가 변경되었습니다" });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  // Send SMS notification mutation (separate from status)
  const sendSmsMutation = useMutation({
    mutationFn: async ({ studentId, type }: { studentId: string; type: "check_in" | "late" }) => {
      const res = await apiRequest("POST", "/api/attendance/send-sms", {
        studentId,
        centerId: selectedCenter?.id,
        classId: selectedClassId,
        type,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }
      return res.json();
    },
    onSuccess: () => {
      refetchStudents();
      toast({ title: "문자가 발송되었습니다" });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  // Manual check-in mutation (kept for attendance pad integration)
  const checkInMutation = useMutation({
    mutationFn: async ({ studentId, isLate }: { studentId: string; isLate: boolean }) => {
      const res = await apiRequest("POST", "/api/attendance/manual-checkin", {
        studentId,
        centerId: selectedCenter?.id,
        classId: selectedClassId,
        isLate,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }
      return res.json();
    },
    onSuccess: () => {
      refetchStudents();
      toast({ title: "출석 체크 완료" });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  // Auto-generate PINs mutation
  const generatePinsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/attendance-pins/auto-generate", {
        centerId: selectedCenter?.id,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to generate PINs");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: `${data.created}명의 출결번호가 생성되었습니다` });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "출결번호 생성에 실패했습니다", variant: "destructive" });
    },
  });

  // Get message templates
  const { data: templates = [] } = useQuery<MessageTemplate[]>({
    queryKey: [`/api/message-templates?centerId=${selectedCenter?.id}`],
    enabled: !!selectedCenter?.id && activeTab === "settings",
  });

  // Load templates into state when fetched
  useEffect(() => {
    if (templates.length > 0) {
      const checkInTemplate = templates.find((t) => t.type === "check_in");
      const lateTemplate = templates.find((t) => t.type === "late");
      const checkOutTemplate = templates.find((t) => t.type === "check_out");
      if (checkInTemplate) setCheckInMessage(checkInTemplate.body);
      if (lateTemplate) setLateMessage(lateTemplate.body);
      if (checkOutTemplate) setCheckOutMessage(checkOutTemplate.body);
    }
  }, [templates]);

  // Save message templates mutation
  const saveTemplatesMutation = useMutation({
    mutationFn: async () => {
      const checkInTemplate = templates.find((t) => t.type === "check_in");
      const lateTemplate = templates.find((t) => t.type === "late");
      const checkOutTemplate = templates.find((t) => t.type === "check_out");

      const requests = [];
      
      if (checkInTemplate) {
        requests.push(apiRequest("PATCH", `/api/message-templates/${checkInTemplate.id}`, {
          body: checkInMessage,
        }));
      } else {
        requests.push(apiRequest("POST", "/api/message-templates", {
          centerId: selectedCenter?.id,
          type: "check_in",
          title: "등원 알림",
          body: checkInMessage,
        }));
      }

      if (lateTemplate) {
        requests.push(apiRequest("PATCH", `/api/message-templates/${lateTemplate.id}`, {
          body: lateMessage,
        }));
      } else {
        requests.push(apiRequest("POST", "/api/message-templates", {
          centerId: selectedCenter?.id,
          type: "late",
          title: "지각 알림",
          body: lateMessage,
        }));
      }

      if (checkOutTemplate) {
        requests.push(apiRequest("PATCH", `/api/message-templates/${checkOutTemplate.id}`, {
          body: checkOutMessage,
        }));
      } else {
        requests.push(apiRequest("POST", "/api/message-templates", {
          centerId: selectedCenter?.id,
          type: "check_out",
          title: "하원 알림",
          body: checkOutMessage,
        }));
      }

      await Promise.all(requests);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/message-templates");
      toast({ title: "메시지 설정이 저장되었습니다" });
    },
    onError: () => {
      toast({ title: "저장에 실패했습니다", variant: "destructive" });
    },
  });

  // Get all teacher check-in settings for this center (for admin/principal)
  type TeacherCheckInWithUser = TeacherCheckInSettings & { teacher?: User };
  const { data: teacherCheckInSettingsList = [] } = useQuery<TeacherCheckInWithUser[]>({
    queryKey: [`/api/teacher-check-in-settings/all?centerId=${selectedCenter?.id}`],
    enabled: !!selectedCenter?.id && activeTab === "settings" && !!isPrincipalOrAdmin,
  });

  // Load teacher check-in message template from first settings or use default
  useEffect(() => {
    if (teacherCheckInSettingsList.length > 0) {
      const firstWithTemplate = teacherCheckInSettingsList.find((s) => s.messageTemplate);
      if (firstWithTemplate?.messageTemplate) {
        setTeacherCheckInMessage(firstWithTemplate.messageTemplate);
      }
    }
  }, [teacherCheckInSettingsList]);

  // Save teacher check-in message template (updates all teachers at once)
  const saveTeacherMessageMutation = useMutation({
    mutationFn: async () => {
      const requests = teacherCheckInSettingsList.map((setting) =>
        apiRequest("PATCH", `/api/teacher-check-in-settings/${setting.id}`, {
          messageTemplate: teacherCheckInMessage,
        })
      );
      await Promise.all(requests);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/teacher-check-in-settings");
      toast({ title: "선생님 출근 알림 메시지가 저장되었습니다" });
    },
    onError: () => {
      toast({ title: "저장에 실패했습니다", variant: "destructive" });
    },
  });

  const handlePrevDay = () => {
    const prev = subDays(new Date(selectedDate), 1);
    setSelectedDate(prev.toISOString().split("T")[0]);
  };

  const handleNextDay = () => {
    const next = addDays(new Date(selectedDate), 1);
    setSelectedDate(next.toISOString().split("T")[0]);
  };

  const handleToday = () => {
    setSelectedDate(new Date().toISOString().split("T")[0]);
  };

  const handleSelectTeacher = (teacherId: string) => {
    setSelectedTeacherId(teacherId);
    setSelectedClassId(null);
  };

  if (!user || user.role < UserRole.TEACHER) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">접근 권한이 없습니다</p>
      </div>
    );
  }

  const isToday = selectedDate === new Date().toISOString().split("T")[0];
  const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId);

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-bold" data-testid="text-page-title">출결 관리</h1>
          <div className="flex items-center gap-2">
            <Link href="/attendance-pad" target="_blank">
              <Button variant="outline" size="sm" data-testid="link-attendance-pad">
                <ExternalLink className="w-4 h-4 mr-2" />
                출결 패드
              </Button>
            </Link>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="attendance" data-testid="tab-attendance">
              <UserCheck className="w-4 h-4 mr-2" />
              출석 체크
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">
              <History className="w-4 h-4 mr-2" />
              출결 기록
            </TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">
              <Settings className="w-4 h-4 mr-2" />
              설정
            </TabsTrigger>
          </TabsList>

          <TabsContent value="attendance" className="space-y-4">
            {/* Date selector */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={handlePrevDay} data-testid="button-prev-day">
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-md">
                      <CalendarDays className="w-4 h-4" />
                      <span className="font-medium">
                        {format(new Date(selectedDate), "yyyy년 M월 d일 (EEE)", { locale: ko })}
                      </span>
                    </div>
                    <Button variant="outline" size="icon" onClick={handleNextDay} data-testid="button-next-day">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    {!isToday && (
                      <Button variant="ghost" size="sm" onClick={handleToday} data-testid="button-today">
                        오늘
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Teacher selection for principal/admin */}
            {isPrincipalOrAdmin && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <GraduationCap className="w-5 h-5" />
                    선생님 선택
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {teachersLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  ) : (teachers as User[]).length === 0 ? (
                    <p className="text-muted-foreground text-sm">등록된 선생님이 없습니다</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {(teachers as User[]).map((teacher: User) => (
                        <Button
                          key={teacher.id}
                          variant={selectedTeacherId === teacher.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleSelectTeacher(teacher.id)}
                          data-testid={`button-teacher-${teacher.id}`}
                        >
                          {teacher.name}
                        </Button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Classes list */}
            {(isTeacher || selectedTeacherId) && (
              <>
                {isPrincipalOrAdmin && selectedTeacher && (
                  <div className="text-sm text-muted-foreground">
                    {selectedTeacher.name} 선생님의 수업
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {classesLoading ? (
                    <div className="col-span-full flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  ) : classes.length === 0 ? (
                    <div className="col-span-full text-center py-8 text-muted-foreground">
                      등록된 수업이 없습니다
                    </div>
                  ) : (
                    classes.map((cls) => (
                      <Card
                        key={cls.id}
                        className={`cursor-pointer transition-colors ${selectedClassId === cls.id ? "ring-2 ring-primary" : ""}`}
                        onClick={() => setSelectedClassId(cls.id)}
                        data-testid={`card-class-${cls.id}`}
                      >
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">{cls.name} ({cls.subject})</CardTitle>
                          <CardDescription className="flex items-center gap-2 flex-wrap">
                            <Clock className="w-3 h-3" />
                            {cls.startTime} - {cls.endTime}
                            <span className="text-xs">
                              ({cls.days.join(", ")})
                            </span>
                          </CardDescription>
                        </CardHeader>
                      </Card>
                    ))
                  )}
                </div>
              </>
            )}

            {/* Students list for selected class */}
            {selectedClassId && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      학생 목록
                    </CardTitle>
                    <CardDescription>
                      {(() => {
                        const cls = classes.find((c) => c.id === selectedClassId);
                        return cls ? `${cls.name} (${cls.subject})` : "";
                      })()}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => refetchStudents()}
                    data-testid="button-refresh-students"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  {studentsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  ) : studentsWithAttendance.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      등록된 학생이 없습니다
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {studentsWithAttendance.map((student) => {
                        const status = student.attendanceRecord?.attendanceStatus || "pending";
                        return (
                          <div
                            key={student.id}
                            className="flex flex-col gap-2 p-3 rounded-md bg-muted/50"
                            data-testid={`row-student-${student.id}`}
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="font-medium">{student.name}</span>
                                {status === "present" && (
                                  <Badge variant="secondary" className="bg-emerald-600 text-white dark:bg-emerald-700">
                                    <UserCheck className="w-3 h-3 mr-1" />
                                    등원
                                  </Badge>
                                )}
                                {status === "late" && (
                                  <Badge variant="secondary" className="bg-amber-600 text-white dark:bg-amber-700">
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    지각
                                  </Badge>
                                )}
                                {status === "absent" && (
                                  <Badge variant="secondary" className="bg-red-600 text-white dark:bg-red-700">
                                    <XCircle className="w-3 h-3 mr-1" />
                                    결석
                                  </Badge>
                                )}
                                {status === "pending" && (
                                  <Badge variant="outline" className="text-muted-foreground">
                                    미확인
                                  </Badge>
                                )}
                                {student.notificationLogs && student.notificationLogs.length > 0 && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <MessageSquare className="w-3 h-3" />
                                    {formatKoreanTime(student.notificationLogs[student.notificationLogs.length - 1].sentAt)} 발송
                                  </span>
                                )}
                              </div>
                              {student.attendanceRecord && (
                                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    등원: {formatKoreanTime(student.attendanceRecord.checkInAt)}
                                  </span>
                                  {student.attendanceRecord.checkOutAt && (
                                    <span>하원: {formatKoreanTime(student.attendanceRecord.checkOutAt)}</span>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            {isToday && (
                              <div className="flex flex-col gap-2 mt-1">
                                {/* 출결 상태 변경 */}
                                <div className="flex items-center gap-1 p-2 bg-blue-50 dark:bg-blue-950/30 rounded border border-blue-200 dark:border-blue-800">
                                  <Badge variant="outline" className="text-xs shrink-0 w-14 justify-center bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700">
                                    <UserCheck className="w-3 h-3 mr-1" />
                                    상태
                                  </Badge>
                                  <div className="flex items-center gap-1 ml-2">
                                    <Button
                                      size="sm"
                                      variant={status === "present" ? "default" : "outline"}
                                      onClick={() => updateStatusMutation.mutate({ studentId: student.id, status: "present" })}
                                      disabled={updateStatusMutation.isPending}
                                      data-testid={`button-status-present-${student.id}`}
                                    >
                                      등원
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant={status === "late" ? "default" : "outline"}
                                      onClick={() => updateStatusMutation.mutate({ studentId: student.id, status: "late" })}
                                      disabled={updateStatusMutation.isPending}
                                      data-testid={`button-status-late-${student.id}`}
                                    >
                                      지각
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant={status === "absent" ? "default" : "outline"}
                                      onClick={() => updateStatusMutation.mutate({ studentId: student.id, status: "absent" })}
                                      disabled={updateStatusMutation.isPending}
                                      data-testid={`button-status-absent-${student.id}`}
                                    >
                                      결석
                                    </Button>
                                  </div>
                                </div>
                                
                                {/* 문자 발송 */}
                                <div className="flex items-center gap-1 p-2 bg-green-50 dark:bg-green-950/30 rounded border border-green-200 dark:border-green-800">
                                  <Badge variant="outline" className="text-xs shrink-0 w-14 justify-center bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700">
                                    <Send className="w-3 h-3 mr-1" />
                                    문자
                                  </Badge>
                                  <div className="flex items-center gap-1 ml-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-green-300 dark:border-green-700"
                                      onClick={() => sendSmsMutation.mutate({ studentId: student.id, type: "check_in" })}
                                      disabled={sendSmsMutation.isPending}
                                      data-testid={`button-sms-checkin-${student.id}`}
                                    >
                                      등원 알림
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-green-300 dark:border-green-700"
                                      onClick={() => sendSmsMutation.mutate({ studentId: student.id, type: "late" })}
                                      disabled={sendSmsMutation.isPending}
                                      data-testid={`button-sms-late-${student.id}`}
                                    >
                                      지각 알림
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <AttendanceHistorySection centerId={selectedCenter?.id || ""} />
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            {/* Auto-generate PINs */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">출결번호 자동 생성</CardTitle>
                <CardDescription>
                  학생 전화번호 뒷 4자리로 출결번호를 자동 생성합니다.
                  중복 시 가운데 4자리를 사용합니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => generatePinsMutation.mutate()}
                  disabled={generatePinsMutation.isPending}
                  data-testid="button-generate-pins"
                >
                  {generatePinsMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  출결번호 자동 생성
                </Button>
              </CardContent>
            </Card>

            {/* Message templates */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  알림 메시지 설정
                </CardTitle>
                <CardDescription>
                  등원/지각 시 학부모에게 발송되는 카카오톡/SMS 메시지 내용을 설정합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>등원 알림 메시지</Label>
                  <Textarea
                    value={checkInMessage}
                    onChange={(e) => setCheckInMessage(e.target.value)}
                    className="min-h-[80px]"
                    data-testid="input-checkin-message"
                  />
                  <p className="text-xs text-muted-foreground">
                    사용 가능한 변수: {"{학생명}"}, {"{시간}"}, {"{날짜}"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>지각 알림 메시지</Label>
                  <Textarea
                    value={lateMessage}
                    onChange={(e) => setLateMessage(e.target.value)}
                    className="min-h-[80px]"
                    data-testid="input-late-message"
                  />
                  <p className="text-xs text-muted-foreground">
                    사용 가능한 변수: {"{학생명}"}, {"{시간}"}, {"{날짜}"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>하원 알림 메시지</Label>
                  <Textarea
                    value={checkOutMessage}
                    onChange={(e) => setCheckOutMessage(e.target.value)}
                    className="min-h-[80px]"
                    data-testid="input-checkout-message"
                  />
                  <p className="text-xs text-muted-foreground">
                    사용 가능한 변수: {"{학생명}"}, {"{시간}"}, {"{날짜}"}
                  </p>
                </div>
                <Button 
                  onClick={() => saveTemplatesMutation.mutate()}
                  disabled={saveTemplatesMutation.isPending}
                  data-testid="button-save-messages"
                >
                  {saveTemplatesMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  저장
                </Button>
              </CardContent>
            </Card>

            {/* Teacher check-in message template - only for admin/principal */}
            {isPrincipalOrAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <GraduationCap className="w-5 h-5" />
                    선생님 출근 알림 메시지
                  </CardTitle>
                  <CardDescription>
                    선생님 출근 시 원장님에게 발송되는 SMS 메시지 내용을 설정합니다.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {teacherCheckInSettingsList.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      등록된 선생님 출근 설정이 없습니다. 사용자 관리에서 선생님 출근코드를 먼저 설정해주세요.
                    </p>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label>출근 알림 메시지</Label>
                        <Textarea
                          value={teacherCheckInMessage}
                          onChange={(e) => setTeacherCheckInMessage(e.target.value)}
                          className="min-h-[80px]"
                          data-testid="input-teacher-checkin-message"
                        />
                        <p className="text-xs text-muted-foreground">
                          사용 가능한 변수: {"{센터명}"}, {"{선생님명}"}, {"{시간}"}
                        </p>
                      </div>
                      <Button
                        onClick={() => saveTeacherMessageMutation.mutate()}
                        disabled={saveTeacherMessageMutation.isPending}
                        data-testid="button-save-teacher-message"
                      >
                        {saveTeacherMessageMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        저장
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

type Enrollment = { id: string; classId: string; studentId: string };
type ClassWithEnrollment = Class & { enrollment?: Enrollment };

function AttendanceHistorySection({ centerId }: { centerId: string }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>("all");
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  const { data: students = [], isLoading: studentsLoading } = useQuery<User[]>({
    queryKey: [`/api/users?centerId=${centerId}&role=1`],
    enabled: !!centerId,
  });

  const studentsOnly = students.filter(s => s.role === 1);
  
  const filteredStudents = studentsOnly.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const startDate = format(subMonths(startOfMonth(calendarMonth), 1), "yyyy-MM-dd");
  const endDate = format(endOfMonth(calendarMonth), "yyyy-MM-dd");

  type AttendanceRecordWithClass = AttendanceRecord & { class?: Class };
  
  const { data: attendanceHistory = [], isLoading: historyLoading } = useQuery<AttendanceRecordWithClass[]>({
    queryKey: [`/api/attendance/history/${selectedStudentId}?startDate=${startDate}&endDate=${endDate}`],
    enabled: !!selectedStudentId,
  });

  const { data: studentEnrollments = [] } = useQuery<ClassWithEnrollment[]>({
    queryKey: [`/api/students/${selectedStudentId}/classes`],
    enabled: !!selectedStudentId,
  });

  const filteredHistory = selectedClassFilter === "all" 
    ? attendanceHistory 
    : attendanceHistory.filter(r => r.classId === selectedClassFilter);

  const attendanceByDate = new Map<string, AttendanceRecordWithClass[]>();
  filteredHistory.forEach(record => {
    const dateKey = record.checkInDate;
    if (!attendanceByDate.has(dateKey)) {
      attendanceByDate.set(dateKey, []);
    }
    attendanceByDate.get(dateKey)!.push(record);
  });

  const getDateStatus = (dateStr: string): string | null => {
    const records = attendanceByDate.get(dateStr);
    if (!records || records.length === 0) return null;
    
    const hasAbsent = records.some(r => r.attendanceStatus === "absent");
    if (hasAbsent) return "absent";
    
    const hasLate = records.some(r => r.attendanceStatus === "late");
    if (hasLate) return "late";
    
    const hasPresent = records.some(r => r.attendanceStatus === "present");
    if (hasPresent) return "present";
    
    return "pending";
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "present":
        return "bg-blue-500 text-white hover:bg-blue-600";
      case "late":
        return "bg-orange-500 text-white hover:bg-orange-600";
      case "absent":
        return "bg-red-500 text-white hover:bg-red-600";
      default:
        return "";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present":
        return (
          <Badge variant="secondary" className="bg-blue-500 text-white">
            <UserCheck className="w-3 h-3 mr-1" />
            등원
          </Badge>
        );
      case "late":
        return (
          <Badge variant="secondary" className="bg-orange-500 text-white">
            <AlertTriangle className="w-3 h-3 mr-1" />
            지각
          </Badge>
        );
      case "absent":
        return (
          <Badge variant="secondary" className="bg-red-500 text-white">
            <XCircle className="w-3 h-3 mr-1" />
            결석
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">
            미확인
          </Badge>
        );
    }
  };

  const monthStart = startOfMonth(calendarMonth);
  const monthEnd = endOfMonth(calendarMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  const startDayOfWeek = monthStart.getDay();
  const emptyDays = Array(startDayOfWeek).fill(null);

  const selectedDateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
  const selectedDayRecords = selectedDateStr ? attendanceByDate.get(selectedDateStr) || [] : [];

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    setSearchQuery("");
    setSelectedClassFilter("all");
    setSelectedDate(null);
  };

  const clearStudent = () => {
    setSelectedStudentId(null);
    setSelectedClassFilter("all");
    setSelectedDate(null);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="w-5 h-5" />
            출결 기록 조회
          </CardTitle>
          <CardDescription>
            학생을 검색하여 출결 기록을 달력으로 확인할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {studentsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {selectedStudentId ? (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-base py-1 px-3">
                    {studentsOnly.find(s => s.id === selectedStudentId)?.name}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={clearStudent}
                    data-testid="button-clear-student"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="학생 이름으로 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-student-search"
                  />
                </div>
              )}
              
              {!selectedStudentId && searchQuery && (
                <div className="border rounded-md max-h-48 overflow-y-auto">
                  {filteredStudents.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">검색 결과가 없습니다</p>
                  ) : (
                    filteredStudents.map((student) => (
                      <button
                        key={student.id}
                        className="w-full text-left px-3 py-2 hover-elevate transition-colors border-b last:border-b-0"
                        onClick={() => handleSelectStudent(student.id)}
                        data-testid={`button-search-student-${student.id}`}
                      >
                        <span className="font-medium">{student.name}</span>
                        {student.grade && (
                          <span className="ml-2 text-sm text-muted-foreground">{student.grade}</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedStudentId && (
        <>
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CalendarDays className="w-5 h-5" />
                    {studentsOnly.find(s => s.id === selectedStudentId)?.name} 출결 달력
                  </CardTitle>
                  <CardDescription>
                    날짜를 클릭하면 상세 출결 내역을 볼 수 있습니다
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={selectedClassFilter}
                    onChange={(e) => setSelectedClassFilter(e.target.value)}
                    data-testid="select-class-filter"
                  >
                    <option value="all">전체 수업</option>
                    {studentEnrollments.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}{cls.subject ? ` (${cls.subject})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
                      data-testid="button-prev-month"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <h3 className="font-semibold text-lg">
                      {format(calendarMonth, "yyyy년 M월", { locale: ko })}
                    </h3>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
                      data-testid="button-next-month"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span>등원</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-orange-500" />
                      <span>지각</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span>결석</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
                      <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                        {day}
                      </div>
                    ))}
                    
                    {emptyDays.map((_, index) => (
                      <div key={`empty-${index}`} className="aspect-square" />
                    ))}
                    
                    {calendarDays.map((day) => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const status = getDateStatus(dateStr);
                      const isSelected = selectedDate && isSameDay(day, selectedDate);
                      const isToday = isSameDay(day, new Date());
                      
                      return (
                        <button
                          key={dateStr}
                          className={`
                            aspect-square flex items-center justify-center rounded-md text-sm
                            transition-colors relative
                            ${status ? getStatusColor(status) : "hover:bg-muted"}
                            ${isSelected ? "ring-2 ring-primary ring-offset-2" : ""}
                            ${isToday && !status ? "font-bold text-primary" : ""}
                          `}
                          onClick={() => setSelectedDate(day)}
                          data-testid={`calendar-day-${dateStr}`}
                        >
                          {format(day, "d")}
                          {attendanceByDate.get(dateStr)?.length && attendanceByDate.get(dateStr)!.length > 1 && (
                            <span className="absolute bottom-0.5 right-0.5 text-[10px] font-bold">
                              +{attendanceByDate.get(dateStr)!.length - 1}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {selectedDate && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  {format(selectedDate, "yyyy년 M월 d일 (EEE)", { locale: ko })} 출결 상세
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedDayRecords.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    해당 날짜에 출결 기록이 없습니다
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedDayRecords.map((record) => (
                      <div
                        key={record.id}
                        className="flex flex-col gap-2 p-3 rounded-md bg-muted/50"
                        data-testid={`row-detail-${record.id}`}
                      >
                        <div className="flex items-center gap-3 flex-wrap">
                          {record.class && (
                            <Badge variant="outline">
                              {record.class.name}{record.class.subject ? ` (${record.class.subject})` : ""}
                            </Badge>
                          )}
                          {getStatusBadge(record.attendanceStatus || "pending")}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            등원: {formatKoreanTime(record.checkInAt)}
                          </span>
                          {record.checkOutAt && (
                            <span className="flex items-center gap-1">
                              하원: {formatKoreanTime(record.checkOutAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
