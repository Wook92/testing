import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { queryClient, apiRequest, invalidateQueriesStartingWith } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, FileText, Send, RefreshCw, ChevronLeft, ChevronRight, Plus, Trash2, Clock, BookOpen, ClipboardCheck, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { User, Center, StudentMonthlyReport, Class as ClassType } from "@shared/schema";
import { UserRole } from "@shared/schema";
import { format, startOfMonth, addMonths, subMonths } from "date-fns";
import { ko } from "date-fns/locale";

interface AttendanceSummary {
  totalDays: number;
  presentDays: number;
  lateDays: number;
  absentDays: number;
  attendanceRate: number;
}

interface HomeworkSummary {
  totalAssigned: number;
  completed: number;
  completionRate: number;
  byClass: { className: string; assigned: number; completed: number }[];
}

interface AssessmentSummary {
  className: string;
  scores: { date: string; score: number; maxScore: number }[];
  averageScore: number;
  trend: "improving" | "stable" | "declining";
}

interface ReportWithDetails extends StudentMonthlyReport {
  student?: User;
  creator?: User;
}

export default function StudentReportsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(startOfMonth(new Date()));
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [editingReport, setEditingReport] = useState<ReportWithDetails | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [showSmsDialog, setShowSmsDialog] = useState(false);
  const [smsReport, setSmsReport] = useState<ReportWithDetails | null>(null);
  const [selectedRecipients, setSelectedRecipients] = useState<{ phone: string; type: string }[]>([]);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generateStudentId, setGenerateStudentId] = useState<string>("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth() + 1;

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: !!user,
  });

  const { data: classes = [] } = useQuery<ClassType[]>({
    queryKey: ["/api/classes"],
    enabled: !!user,
  });

  const { data: enrollments = [] } = useQuery<{ id: string; classId: string; studentId: string }[]>({
    queryKey: ["/api/enrollments"],
    enabled: !!user,
  });

  const allClassIds = classes.map(c => c.id);
  const enrolledStudentIds = enrollments
    .filter(e => allClassIds.includes(e.classId))
    .map(e => e.studentId);
  const uniqueEnrolledStudentIds = Array.from(new Set(enrolledStudentIds));

  const students = users.filter(u => u.role === UserRole.STUDENT);
  const enrolledStudents = students.filter(s => uniqueEnrolledStudentIds.includes(s.id));
  
  // For teachers, only show students whose homeroom teacher is themselves
  const isTeacher = user?.role === UserRole.TEACHER;
  const homeroomFilteredStudents = isTeacher 
    ? enrolledStudents.filter(s => s.homeroomTeacherId === user?.id)
    : enrolledStudents;
  
  // Filter students by search query
  const filteredStudents = searchQuery.trim() 
    ? homeroomFilteredStudents.filter(s => 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.school && s.school.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : homeroomFilteredStudents;

  const { data: reports = [], isLoading: reportsLoading, refetch: refetchReports } = useQuery<ReportWithDetails[]>({
    queryKey: [`/api/student-reports?year=${year}&month=${month}`],
    enabled: !!user,
  });

  const createReportMutation = useMutation({
    mutationFn: async ({ studentId, content }: { studentId: string; content: string }) => {
      const response = await apiRequest("POST", "/api/student-reports", {
        studentId,
        year,
        month,
        createdById: user?.id,
        reportContent: content,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "보고서가 생성되었습니다" });
      setShowGenerateDialog(false);
      setGenerateStudentId("");
      setCustomInstructions("");
      refetchReports();
    },
    onError: (error) => {
      toast({ title: "보고서 생성 실패", description: error.message, variant: "destructive" });
    },
  });

  const updateReportMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const response = await apiRequest("PATCH", `/api/student-reports/${id}`, {
        reportContent: content,
        actorId: user?.id,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "보고서가 수정되었습니다" });
      setEditingReport(null);
      refetchReports();
    },
    onError: (error) => {
      toast({ title: "수정 실패", description: error.message, variant: "destructive" });
    },
  });


  const sendSmsMutation = useMutation({
    mutationFn: async ({ id, recipients }: { id: string; recipients: { phone: string; type: string }[] }) => {
      const response = await apiRequest("POST", `/api/student-reports/${id}/send-sms`, {
        actorId: user?.id,
        recipients,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "문자가 발송되었습니다" });
      setShowSmsDialog(false);
      setSmsReport(null);
      refetchReports();
    },
    onError: (error) => {
      toast({ title: "문자 발송 실패", description: error.message, variant: "destructive" });
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/student-reports/${id}?actorId=${user?.id}`);
    },
    onSuccess: () => {
      toast({ title: "보고서가 삭제되었습니다" });
      refetchReports();
    },
    onError: (error) => {
      toast({ title: "삭제 실패", description: error.message, variant: "destructive" });
    },
  });

  const handleOpenGenerateDialog = (studentId: string) => {
    setGenerateStudentId(studentId);
    setCustomInstructions("");
    setShowGenerateDialog(true);
  };

  const handleCreateReport = () => {
    if (generateStudentId && customInstructions.trim()) {
      createReportMutation.mutate({ studentId: generateStudentId, content: customInstructions });
    }
  };

  const parseAttendanceSummary = (json: string | null | undefined): AttendanceSummary | null => {
    if (!json) return null;
    try {
      const parsed = JSON.parse(json);
      if (typeof parsed.attendanceRate === 'number') return parsed;
      return null;
    } catch {
      return null;
    }
  };

  const parseHomeworkSummary = (json: string | null | undefined): HomeworkSummary | null => {
    if (!json) return null;
    try {
      const parsed = JSON.parse(json);
      if (typeof parsed.completionRate === 'number') return parsed;
      return null;
    } catch {
      return null;
    }
  };

  const parseAssessmentSummary = (json: string | null | undefined): AssessmentSummary[] | null => {
    if (!json) return null;
    try {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) return parsed;
      return null;
    } catch {
      return null;
    }
  };

  const handleEditReport = (report: ReportWithDetails) => {
    setEditingReport(report);
    setEditedContent(report.reportContent);
  };

  const handleSaveReport = () => {
    if (editingReport) {
      updateReportMutation.mutate({ id: editingReport.id, content: editedContent });
    }
  };


  const handleOpenSmsDialog = (report: ReportWithDetails) => {
    setSmsReport(report);
    const student = report.student;
    const recipients: { phone: string; type: string }[] = [];
    if (student?.motherPhone) {
      recipients.push({ phone: student.motherPhone, type: "mother" });
    }
    if (student?.fatherPhone) {
      recipients.push({ phone: student.fatherPhone, type: "father" });
    }
    setSelectedRecipients(recipients);
    setShowSmsDialog(true);
  };

  const handleSendSms = () => {
    if (smsReport && selectedRecipients.length > 0) {
      sendSmsMutation.mutate({ id: smsReport.id, recipients: selectedRecipients });
    }
  };

  const toggleRecipient = (phone: string, type: string) => {
    const exists = selectedRecipients.some(r => r.phone === phone);
    if (exists) {
      setSelectedRecipients(selectedRecipients.filter(r => r.phone !== phone));
    } else {
      setSelectedRecipients([...selectedRecipients, { phone, type }]);
    }
  };

  const getStudentReport = (studentId: string) => {
    return reports.find(r => r.studentId === studentId);
  };

  if (!user || user.role < UserRole.TEACHER) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">접근 권한이 없습니다.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 h-full overflow-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">학생 월간 보고서</h1>
          <p className="text-muted-foreground">학생별 월간 학습 보고서를 작성하고 학부모에게 발송합니다</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="outline"
              onClick={() => setSelectedDate(subMonths(selectedDate, 1))}
              data-testid="button-prev-month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="px-3 py-2 font-medium min-w-[120px] text-center">
              {format(selectedDate, "yyyy년 M월", { locale: ko })}
            </div>
            <Button
              size="icon"
              variant="outline"
              onClick={() => setSelectedDate(addMonths(selectedDate, 1))}
              data-testid="button-next-month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button
            variant="outline"
            onClick={() => refetchReports()}
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="학생 이름 또는 학교로 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          data-testid="input-search-student"
        />
      </div>

      {reportsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : enrolledStudents.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">등록된 학생이 없습니다.</p>
          </CardContent>
        </Card>
      ) : filteredStudents.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">검색 결과가 없습니다.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredStudents.map(student => {
            const report = getStudentReport(student.id);
            const hasMotherPhone = !!student.motherPhone;
            const hasFatherPhone = !!student.fatherPhone;
            
            return (
              <Card key={student.id} data-testid={`card-student-${student.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{student.name}</CardTitle>
                    {report?.smsStatus === "sent" && (
                      <Badge className="text-xs bg-green-500 text-white dark:bg-green-600">발송완료</Badge>
                    )}
                    {report?.smsStatus === "partial" && (
                      <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600 dark:text-yellow-400">일부발송</Badge>
                    )}
                    {report?.smsStatus === "failed" && (
                      <Badge variant="destructive" className="text-xs">발송실패</Badge>
                    )}
                  </div>
                  <CardDescription>
                    {student.school && `${student.school} `}
                    {student.grade && `${student.grade}`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {report ? (
                    <>
                      {(() => {
                        const attendance = parseAttendanceSummary(report.attendanceSummary);
                        const homework = parseHomeworkSummary(report.homeworkSummary);
                        const assessments = parseAssessmentSummary(report.assessmentSummary);
                        
                        return (
                          <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="p-2 rounded-md bg-muted/50">
                              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                                <Clock className="h-3 w-3" />
                                <span>출석률</span>
                              </div>
                              <div className="font-semibold">
                                {attendance ? `${attendance.attendanceRate}%` : "-"}
                              </div>
                              {attendance && attendance.lateDays > 0 && (
                                <div className="text-muted-foreground text-[10px]">
                                  지각 {attendance.lateDays}회
                                </div>
                              )}
                            </div>
                            <div className="p-2 rounded-md bg-muted/50">
                              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                                <BookOpen className="h-3 w-3" />
                                <span>숙제</span>
                              </div>
                              <div className="font-semibold">
                                {homework ? `${homework.completionRate}%` : "-"}
                              </div>
                              {homework && homework.totalAssigned > 0 && (
                                <div className="text-muted-foreground text-[10px]">
                                  {homework.completed}/{homework.totalAssigned}
                                </div>
                              )}
                            </div>
                            <div className="p-2 rounded-md bg-muted/50">
                              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                                <ClipboardCheck className="h-3 w-3" />
                                <span>평가</span>
                              </div>
                              <div className="font-semibold">
                                {assessments && assessments.length > 0 
                                  ? `${Math.round(assessments.reduce((sum, a) => sum + a.averageScore, 0) / assessments.length)}점`
                                  : "-"}
                              </div>
                              {assessments && assessments.length > 0 && (
                                <div className="text-muted-foreground text-[10px]">
                                  {assessments.length}개 과목
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                      <div className="text-sm text-muted-foreground line-clamp-3 pt-1 border-t">
                        {report.reportContent}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditReport(report)}
                          data-testid={`button-edit-${student.id}`}
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          수정
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenSmsDialog(report)}
                          disabled={!hasMotherPhone && !hasFatherPhone}
                          data-testid={`button-send-${student.id}`}
                        >
                          <Send className="h-4 w-4 mr-1" />
                          발송
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteReportMutation.mutate(report.id)}
                          data-testid={`button-delete-${student.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleOpenGenerateDialog(student.id)}
                      disabled={createReportMutation.isPending}
                      data-testid={`button-generate-${student.id}`}
                    >
                      {createReportMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4 mr-1" />
                      )}
                      보고서 작성
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!editingReport} onOpenChange={() => setEditingReport(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingReport?.student?.name} - {format(selectedDate, "yyyy년 M월", { locale: ko })} 보고서
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>보고서 내용</Label>
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                rows={8}
                className="mt-2"
                data-testid="textarea-report-content"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {editedContent.length}자
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              onClick={handleSaveReport}
              disabled={updateReportMutation.isPending}
              data-testid="button-save"
            >
              {updateReportMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSmsDialog} onOpenChange={setShowSmsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>문자 발송</DialogTitle>
          </DialogHeader>
          {smsReport && smsReport.student && (
            <div className="space-y-4">
              <div>
                <Label>받는 사람</Label>
                <div className="mt-2 space-y-2">
                  {smsReport.student.motherPhone && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="mother"
                        checked={selectedRecipients.some(r => r.phone === smsReport.student?.motherPhone)}
                        onCheckedChange={() => toggleRecipient(smsReport.student!.motherPhone!, "mother")}
                        data-testid="checkbox-mother"
                      />
                      <label htmlFor="mother" className="text-sm">
                        어머니 ({smsReport.student.motherPhone})
                      </label>
                    </div>
                  )}
                  {smsReport.student.fatherPhone && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="father"
                        checked={selectedRecipients.some(r => r.phone === smsReport.student?.fatherPhone)}
                        onCheckedChange={() => toggleRecipient(smsReport.student!.fatherPhone!, "father")}
                        data-testid="checkbox-father"
                      />
                      <label htmlFor="father" className="text-sm">
                        아버지 ({smsReport.student.fatherPhone})
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label>문자 내용</Label>
                <div className="mt-2 p-3 bg-muted rounded-md text-sm whitespace-pre-wrap">
                  {smsReport.reportContent}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {smsReport.reportContent.length}자
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSmsDialog(false)}>
              취소
            </Button>
            <Button
              onClick={handleSendSms}
              disabled={sendSmsMutation.isPending || selectedRecipients.length === 0}
              data-testid="button-confirm-send"
            >
              {sendSmsMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-1" />
              )}
              발송하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>보고서 작성</DialogTitle>
            <DialogDescription>
              학생의 월간 학습 보고서를 작성합니다
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>학생</Label>
              <p className="text-sm font-medium mt-1">
                {homeroomFilteredStudents.find((s: User) => s.id === generateStudentId)?.name}
              </p>
            </div>
            <div>
              <Label htmlFor="custom-instructions">보고서 내용</Label>
              <Textarea
                id="custom-instructions"
                value={customInstructions}
                onChange={(e) => {
                  if (e.target.value.length <= 2000) {
                    setCustomInstructions(e.target.value);
                  }
                }}
                placeholder="이번 달 학습 내용, 성과, 개선점 등을 작성해 주세요"
                rows={8}
                className="mt-2"
                data-testid="textarea-custom-instructions"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {customInstructions.length}/2000자
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>
              취소
            </Button>
            <Button
              onClick={handleCreateReport}
              disabled={createReportMutation.isPending || !customInstructions.trim()}
              data-testid="button-confirm-generate"
            >
              {createReportMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-1" />
              )}
              보고서 저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
