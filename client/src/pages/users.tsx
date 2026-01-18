import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Users, Search, ChevronDown, ChevronUp, Pencil, Trash2, Phone, Calendar, Building2, BookOpen, GraduationCap, School, Upload, FileSpreadsheet, CheckCircle, XCircle, Download, KeyRound, Loader2, X } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, invalidateQueriesStartingWith, queryClient, ApiError } from "@/lib/queryClient";
import { UserRole, type User, type Center, type Class, EXIT_REASON_LIST } from "@shared/schema";
import { RoleBadge } from "@/components/role-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

function StudentExitDialog({ 
  student, 
  recordedBy,
  onConfirm, 
  onCancel,
  isDeleting 
}: { 
  student: User; 
  recordedBy: string;
  onConfirm: (reasons: string[], notes: string) => void; 
  onCancel: () => void;
  isDeleting: boolean;
}) {
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const toggleReason = (reason: string) => {
    setSelectedReasons(prev => 
      prev.includes(reason) 
        ? prev.filter(r => r !== reason) 
        : [...prev, reason]
    );
  };

  const handleConfirm = () => {
    if (selectedReasons.length === 0) {
      return;
    }
    onConfirm(selectedReasons, notes);
  };

  return (
    <AlertDialog open onOpenChange={() => !isDeleting && onCancel()}>
      <AlertDialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>학생 퇴원 처리</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-semibold text-foreground">{student.name}</span> 학생을 퇴원 처리합니다.
            <br />퇴원 사유를 선택해주세요. (복수 선택 가능)
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="space-y-3 py-2">
          <div className="grid gap-2">
            {EXIT_REASON_LIST.map(({ key, label }) => (
              <div 
                key={key} 
                className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                onClick={() => toggleReason(label)}
              >
                <Checkbox
                  id={`reason-${key}`}
                  checked={selectedReasons.includes(label)}
                  onCheckedChange={() => toggleReason(label)}
                  data-testid={`checkbox-reason-${key}`}
                />
                <label 
                  htmlFor={`reason-${key}`} 
                  className="text-sm cursor-pointer flex-1"
                >
                  {label}
                </label>
              </div>
            ))}
          </div>
          
          <div className="space-y-2 pt-2">
            <Label htmlFor="exit-notes">추가 메모 (선택)</Label>
            <Textarea
              id="exit-notes"
              placeholder="퇴원 관련 추가 메모를 입력하세요..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="resize-none"
              rows={2}
              data-testid="textarea-exit-notes"
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={isDeleting}>
            취소
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm}
            disabled={selectedReasons.length === 0 || isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="button-confirm-exit"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                처리 중...
              </>
            ) : (
              "퇴원 처리"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CreateUserDialog({ onClose, teacherOnly = false }: { onClose: () => void; teacherOnly?: boolean }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    motherPhone: "",
    fatherPhone: "",
    school: "",
    grade: "",
    role: teacherOnly ? "2" : "1",
    attendancePin: "",
    employmentType: "regular" as string,
    dailyRate: "" as string,
    baseSalary: "" as string,
    classBasePayMiddle: "" as string,
    classBasePayHigh: "" as string,
    studentThresholdMiddle: "" as string,
    studentThresholdHigh: "" as string,
    perStudentBonusMiddle: "" as string,
    perStudentBonusHigh: "" as string,
  });

  const [teacherCheckInCode, setTeacherCheckInCode] = useState("");
  const [teacherSmsRecipient1, setTeacherSmsRecipient1] = useState("");
  const [teacherSmsRecipient2, setTeacherSmsRecipient2] = useState("");

  const isPrincipal = user?.role === UserRole.PRINCIPAL;
  const isTeacherRole = formData.role === "2";
  const canSetTeacherCheckIn = isPrincipal && isTeacherRole;

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/users", data);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/users");
      invalidateQueriesStartingWith("/api/teachers");
      toast({ title: "계정이 생성되었습니다" });
      onClose();
    },
    onError: (error: any) => {
      const serverMessage = error instanceof ApiError ? error.serverMessage : null;
      const message = serverMessage || "계정 생성에 실패했습니다";
      toast({ title: message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((teacherOnly || formData.role === "1") && !formData.motherPhone && !formData.fatherPhone) {
      toast({ title: "어머니 또는 아버지 전화번호를 입력해주세요", variant: "destructive" });
      return;
    }
    if (canSetTeacherCheckIn && teacherCheckInCode && !/^\d{4}$/.test(teacherCheckInCode)) {
      toast({ title: "출근코드는 4자리 숫자여야 합니다", variant: "destructive" });
      return;
    }
    const roleValue = parseInt(formData.role);

    let teacherCheckInSettings: { checkInCode: string; smsRecipient1: string | null; smsRecipient2: string | null } | undefined;
    if (canSetTeacherCheckIn && teacherCheckInCode) {
      teacherCheckInSettings = {
        checkInCode: teacherCheckInCode,
        smsRecipient1: teacherSmsRecipient1 || null,
        smsRecipient2: teacherSmsRecipient2 || null,
      };
    }
    
    // Build salary settings for regular/part-time teachers
    let salarySettings: {
      baseSalary: number;
      classBasePayMiddle: number;
      classBasePayHigh: number;
      studentThresholdMiddle: number;
      studentThresholdHigh: number;
      perStudentBonusMiddle: number;
      perStudentBonusHigh: number;
    } | undefined;
    
    if (isTeacherRole && (formData.employmentType === "regular" || formData.employmentType === "part_time")) {
      const baseSalary = parseInt(formData.baseSalary) || 0;
      const classBasePayMiddle = parseInt(formData.classBasePayMiddle) || 0;
      const classBasePayHigh = parseInt(formData.classBasePayHigh) || 0;
      const studentThresholdMiddle = parseInt(formData.studentThresholdMiddle) || 0;
      const studentThresholdHigh = parseInt(formData.studentThresholdHigh) || 0;
      const perStudentBonusMiddle = parseInt(formData.perStudentBonusMiddle) || 0;
      const perStudentBonusHigh = parseInt(formData.perStudentBonusHigh) || 0;
      
      // Only include if at least one value is set (including thresholds and bonuses)
      const hasAnyValue = baseSalary > 0 || classBasePayMiddle > 0 || classBasePayHigh > 0 ||
        studentThresholdMiddle > 0 || studentThresholdHigh > 0 ||
        perStudentBonusMiddle > 0 || perStudentBonusHigh > 0;
      
      if (hasAnyValue) {
        salarySettings = {
          baseSalary,
          classBasePayMiddle,
          classBasePayHigh,
          studentThresholdMiddle,
          studentThresholdHigh,
          perStudentBonusMiddle,
          perStudentBonusHigh,
        };
      }
    }
    
    createMutation.mutate({
      username: formData.phone.replace(/-/g, ""),
      password: "1234",
      name: formData.name,
      phone: formData.phone,
      motherPhone: formData.motherPhone || null,
      fatherPhone: formData.fatherPhone || null,
      school: formData.school || null,
      grade: formData.grade || null,
      role: roleValue,
      attendancePin: formData.attendancePin || null,
      teacherCheckInSettings,
      employmentType: isTeacherRole ? formData.employmentType : null,
      dailyRate: isTeacherRole && formData.employmentType === "hourly" && formData.dailyRate 
        ? parseInt(formData.dailyRate) 
        : null,
      salarySettings,
    });
  };

  const availableRoles = isPrincipal
    ? [
        { value: "1", label: "학생" },
        { value: "2", label: "선생님" },
        { value: "3", label: "원장" },
        { value: "0", label: "학부모" },
        { value: "-1", label: "출결 계정" },
      ]
    : [
        { value: "1", label: "학생" },
        { value: "2", label: "선생님" },
      ];

  const showStudentFields = teacherOnly || formData.role === "1";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">이름</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
          placeholder="홍길동"
          required
          data-testid="input-user-name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">휴대폰 번호 (아이디)</Label>
        <Input
          id="phone"
          value={formData.phone}
          onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
          placeholder="010-1234-5678"
          required
          data-testid="input-user-phone"
        />
      </div>

      {!teacherOnly && (
        <div className="space-y-2">
          <Label>역할</Label>
          <Select
            value={formData.role}
            onValueChange={(v) => setFormData((p) => ({ ...p, role: v }))}
          >
            <SelectTrigger data-testid="select-user-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableRoles.map((role) => (
                <SelectItem key={role.value} value={role.value}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Employment type for teachers */}
      {isTeacherRole && (
        <div className="space-y-2">
          <Label>고용 형태</Label>
          <Select
            value={formData.employmentType}
            onValueChange={(v) => setFormData((p) => ({ ...p, employmentType: v }))}
          >
            <SelectTrigger data-testid="select-employment-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="regular">정규직</SelectItem>
              <SelectItem value="part_time">파트타임</SelectItem>
              <SelectItem value="hourly">아르바이트</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Daily rate input for hourly teachers */}
      {isTeacherRole && formData.employmentType === "hourly" && (
        <div className="space-y-2">
          <Label htmlFor="dailyRate">일급 (원)</Label>
          <Input
            id="dailyRate"
            type="number"
            placeholder="예: 100000"
            value={formData.dailyRate}
            onChange={(e) => setFormData((p) => ({ ...p, dailyRate: e.target.value }))}
            data-testid="input-daily-rate"
          />
          <p className="text-xs text-muted-foreground">출근 기록 기반으로 월급이 자동 계산됩니다</p>
        </div>
      )}

      {/* Salary settings for regular/part-time teachers */}
      {isTeacherRole && (formData.employmentType === "regular" || formData.employmentType === "part_time") && (
        <div className="space-y-4 border rounded-md p-4 bg-muted/30">
          <div className="flex items-center gap-2">
            <Label className="font-semibold">급여 설정 (선택사항)</Label>
          </div>
          <p className="text-xs text-muted-foreground">나중에 경영 탭 &gt; 선생님에서 수정할 수 있습니다</p>
          
          <div className="space-y-2">
            <Label htmlFor="create-base-salary">기본급 (월)</Label>
            <Input
              id="create-base-salary"
              type="number"
              placeholder="예: 2000000"
              value={formData.baseSalary}
              onChange={(e) => setFormData((p) => ({ ...p, baseSalary: e.target.value.replace(/^0+/, '') || '' }))}
              data-testid="input-create-base-salary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="create-class-base-middle">중등 수업당 기본급</Label>
              <Input
                id="create-class-base-middle"
                type="number"
                placeholder="예: 100000"
                value={formData.classBasePayMiddle}
                onChange={(e) => setFormData((p) => ({ ...p, classBasePayMiddle: e.target.value.replace(/^0+/, '') || '' }))}
                data-testid="input-create-class-base-middle"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-class-base-high">고등 수업당 기본급</Label>
              <Input
                id="create-class-base-high"
                type="number"
                placeholder="예: 120000"
                value={formData.classBasePayHigh}
                onChange={(e) => setFormData((p) => ({ ...p, classBasePayHigh: e.target.value.replace(/^0+/, '') || '' }))}
                data-testid="input-create-class-base-high"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="create-threshold-middle">중등 기준 인원</Label>
              <Input
                id="create-threshold-middle"
                type="number"
                placeholder="예: 5"
                value={formData.studentThresholdMiddle}
                onChange={(e) => setFormData((p) => ({ ...p, studentThresholdMiddle: e.target.value.replace(/^0+/, '') || '' }))}
                data-testid="input-create-threshold-middle"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-bonus-middle">중등 초과 학생당 추가금</Label>
              <Input
                id="create-bonus-middle"
                type="number"
                placeholder="예: 10000"
                value={formData.perStudentBonusMiddle}
                onChange={(e) => setFormData((p) => ({ ...p, perStudentBonusMiddle: e.target.value.replace(/^0+/, '') || '' }))}
                data-testid="input-create-bonus-middle"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="create-threshold-high">고등 기준 인원</Label>
              <Input
                id="create-threshold-high"
                type="number"
                placeholder="예: 4"
                value={formData.studentThresholdHigh}
                onChange={(e) => setFormData((p) => ({ ...p, studentThresholdHigh: e.target.value.replace(/^0+/, '') || '' }))}
                data-testid="input-create-threshold-high"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-bonus-high">고등 초과 학생당 추가금</Label>
              <Input
                id="create-bonus-high"
                type="number"
                placeholder="예: 15000"
                value={formData.perStudentBonusHigh}
                onChange={(e) => setFormData((p) => ({ ...p, perStudentBonusHigh: e.target.value.replace(/^0+/, '') || '' }))}
                data-testid="input-create-bonus-high"
              />
            </div>
          </div>
        </div>
      )}

      {/* Teacher check-in settings for new teachers */}
      {canSetTeacherCheckIn && (
        <div className="space-y-4 border rounded-md p-4 bg-muted/30">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            <Label className="font-semibold">출근 알림 설정</Label>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="create-teacher-checkin-code">출근코드 (4자리 숫자)</Label>
            <Input
              id="create-teacher-checkin-code"
              value={teacherCheckInCode}
              onChange={(e) => setTeacherCheckInCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="1234"
              maxLength={4}
              data-testid="input-create-teacher-checkin-code"
            />
            <p className="text-xs text-muted-foreground">
              출결패드에서 출근 시 입력하는 코드입니다
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-teacher-sms-1">담당 원장님 연락처 1</Label>
            <Input
              id="create-teacher-sms-1"
              value={teacherSmsRecipient1}
              onChange={(e) => setTeacherSmsRecipient1(e.target.value)}
              placeholder="010-1234-5678"
              data-testid="input-create-teacher-sms-1"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-teacher-sms-2">담당 원장님 연락처 2 (선택사항)</Label>
            <Input
              id="create-teacher-sms-2"
              value={teacherSmsRecipient2}
              onChange={(e) => setTeacherSmsRecipient2(e.target.value)}
              placeholder="010-1234-5678"
              data-testid="input-create-teacher-sms-2"
            />
          </div>
          
          <p className="text-xs text-muted-foreground">
            선생님이 출근코드를 입력하면 위 연락처로 출근 알림이 전송됩니다
          </p>
        </div>
      )}

      {showStudentFields && (
        <>
          <div className="space-y-2">
            <Label htmlFor="motherPhone">어머니 전화번호</Label>
            <Input
              id="motherPhone"
              value={formData.motherPhone}
              onChange={(e) => setFormData((p) => ({ ...p, motherPhone: e.target.value }))}
              placeholder="010-1234-5678"
              data-testid="input-mother-phone"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fatherPhone">아버지 전화번호</Label>
            <Input
              id="fatherPhone"
              value={formData.fatherPhone}
              onChange={(e) => setFormData((p) => ({ ...p, fatherPhone: e.target.value }))}
              placeholder="010-1234-5678"
              data-testid="input-father-phone"
            />
          </div>

          <p className="text-xs text-muted-foreground text-amber-600">
            * 어머니 또는 아버지 전화번호 중 하나는 필수입니다
          </p>

          <div className="space-y-2">
            <Label htmlFor="school">학교</Label>
            <Input
              id="school"
              value={formData.school}
              onChange={(e) => setFormData((p) => ({ ...p, school: e.target.value }))}
              placeholder="예: OO초등학교"
              data-testid="input-school"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="grade">학년</Label>
            <Select
              value={formData.grade}
              onValueChange={(v) => setFormData((p) => ({ ...p, grade: v }))}
            >
              <SelectTrigger data-testid="select-grade">
                <SelectValue placeholder="학년 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="초1">초등 1학년</SelectItem>
                <SelectItem value="초2">초등 2학년</SelectItem>
                <SelectItem value="초3">초등 3학년</SelectItem>
                <SelectItem value="초4">초등 4학년</SelectItem>
                <SelectItem value="초5">초등 5학년</SelectItem>
                <SelectItem value="초6">초등 6학년</SelectItem>
                <SelectItem value="중1">중학 1학년</SelectItem>
                <SelectItem value="중2">중학 2학년</SelectItem>
                <SelectItem value="중3">중학 3학년</SelectItem>
                <SelectItem value="고1">고등 1학년</SelectItem>
                <SelectItem value="고2">고등 2학년</SelectItem>
                <SelectItem value="고3">고등 3학년</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="attendancePin">출결번호</Label>
            <Input
              id="attendancePin"
              value={formData.attendancePin}
              onChange={(e) => setFormData((p) => ({ ...p, attendancePin: e.target.value }))}
              placeholder="예: 5678 (핸드폰 번호 뒷 4자리)"
              maxLength={6}
              data-testid="input-attendance-pin"
            />
            <p className="text-xs text-muted-foreground">
              미입력 시 핸드폰 번호 뒷 4자리로 자동 생성됩니다
            </p>
          </div>
        </>
      )}

      <p className="text-sm text-muted-foreground">
        기본 비밀번호: 1234
      </p>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button type="submit" disabled={createMutation.isPending} data-testid="button-create-user">
          {createMutation.isPending ? "생성 중..." : "계정 생성"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function EditUserDialog({ user: editingUser, onClose }: { user: User; onClose: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: editingUser.name,
    phone: editingUser.phone || editingUser.username,
    motherPhone: editingUser.motherPhone || "",
    fatherPhone: editingUser.fatherPhone || "",
    school: editingUser.school || "",
    grade: editingUser.grade || "",
    role: String(editingUser.role),
    attendancePin: "",
    employmentType: editingUser.employmentType || "regular",
    dailyRate: editingUser.dailyRate ? String(editingUser.dailyRate) : "",
    // 급여 설정
    baseSalary: "" as string,
    classBasePayMiddle: "" as string,
    classBasePayHigh: "" as string,
    studentThresholdMiddle: "" as string,
    studentThresholdHigh: "" as string,
    perStudentBonusMiddle: "" as string,
    perStudentBonusHigh: "" as string,
  });

  // Teacher check-in settings state
  const [teacherCheckInCode, setTeacherCheckInCode] = useState("");
  const [teacherSmsRecipient1, setTeacherSmsRecipient1] = useState("");
  const [teacherSmsRecipient2, setTeacherSmsRecipient2] = useState("");

  const isPrincipal = user?.role === UserRole.PRINCIPAL;
  const isStudent = editingUser.role === UserRole.STUDENT;
  const isEditingTeacher = editingUser.role === UserRole.TEACHER;
  const canEditTeacherSettings = isPrincipal && isEditingTeacher;

  // Fetch existing teacher check-in settings
  const { data: teacherCheckInSettings } = useQuery<{
    id: string;
    checkInCode: string;
    smsRecipient1: string | null;
    smsRecipient2: string | null;
  } | null>({
    queryKey: [`/api/teacher-check-in-settings?teacherId=${editingUser.id}`],
    enabled: canEditTeacherSettings,
  });

  // Populate teacher check-in settings when data loads
  useEffect(() => {
    if (teacherCheckInSettings) {
      setTeacherCheckInCode(teacherCheckInSettings.checkInCode || "");
      setTeacherSmsRecipient1(teacherCheckInSettings.smsRecipient1 || "");
      setTeacherSmsRecipient2(teacherCheckInSettings.smsRecipient2 || "");
    } else {
      setTeacherCheckInCode("");
      setTeacherSmsRecipient1("");
      setTeacherSmsRecipient2("");
    }
  }, [teacherCheckInSettings]);

  // Fetch existing salary settings for teacher
  type SalarySettingsType = {
    id: string;
    teacherId: string;
    baseSalary: number;
    classBasePay: number;
    classBasePayMiddle: number;
    classBasePayHigh: number;
    studentThreshold: number;
    studentThresholdMiddle: number;
    studentThresholdHigh: number;
    perStudentBonus: number;
    perStudentBonusMiddle: number;
    perStudentBonusHigh: number;
  };

  const { data: salarySettings } = useQuery<SalarySettingsType | null>({
    queryKey: [`/api/teacher-salary-settings/${editingUser.id}`],
    enabled: isEditingTeacher,
  });

  // Populate salary settings when data loads
  useEffect(() => {
    if (salarySettings) {
      setFormData(prev => ({
        ...prev,
        baseSalary: salarySettings.baseSalary ? String(salarySettings.baseSalary) : "",
        classBasePayMiddle: salarySettings.classBasePayMiddle ? String(salarySettings.classBasePayMiddle) : "",
        classBasePayHigh: salarySettings.classBasePayHigh ? String(salarySettings.classBasePayHigh) : "",
        studentThresholdMiddle: salarySettings.studentThresholdMiddle ? String(salarySettings.studentThresholdMiddle) : "",
        studentThresholdHigh: salarySettings.studentThresholdHigh ? String(salarySettings.studentThresholdHigh) : "",
        perStudentBonusMiddle: salarySettings.perStudentBonusMiddle ? String(salarySettings.perStudentBonusMiddle) : "",
        perStudentBonusHigh: salarySettings.perStudentBonusHigh ? String(salarySettings.perStudentBonusHigh) : "",
      }));
    }
  }, [salarySettings]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PATCH", `/api/users/${editingUser.id}`, data);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/users");
      invalidateQueriesStartingWith("/api/teachers");
      toast({ title: "계정이 수정되었습니다" });
      onClose();
    },
    onError: (error: any) => {
      const serverMessage = error instanceof ApiError ? error.serverMessage : null;
      toast({ title: serverMessage || "수정에 실패했습니다", variant: "destructive" });
    },
  });

  const saveTeacherCheckInMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/teacher-check-in-settings", data);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/teacher-check-in-settings");
    },
    onError: (error: any) => {
      const serverMessage = error instanceof ApiError ? error.serverMessage : null;
      toast({ title: serverMessage || "출근 설정 저장 실패", variant: "destructive" });
      throw error; // Re-throw to prevent user update from proceeding
    },
  });

  const saveSalarySettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/teacher-salary-settings", { ...data, actorId: user?.id });
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/teacher-salary-settings");
    },
    onError: (error: any) => {
      const serverMessage = error instanceof ApiError ? error.serverMessage : null;
      toast({ title: serverMessage || "급여 설정 저장 실패", variant: "destructive" });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const roleValue = parseInt(formData.role);
    
    try {
      // Save teacher check-in settings first if applicable
      if (canEditTeacherSettings && teacherCheckInCode) {
        if (!/^\d{4}$/.test(teacherCheckInCode)) {
          toast({ title: "출근코드는 4자리 숫자여야 합니다", variant: "destructive" });
          return;
        }
        await saveTeacherCheckInMutation.mutateAsync({
          teacherId: editingUser.id,
          checkInCode: teacherCheckInCode,
          smsRecipient1: teacherSmsRecipient1 || null,
          smsRecipient2: teacherSmsRecipient2 || null,
          isActive: true,
        });
      }

      // Save salary settings for regular/part-time teachers
      if (isEditingTeacher && (formData.employmentType === "regular" || formData.employmentType === "part_time")) {
        const hasSalaryData = formData.baseSalary || formData.classBasePayMiddle || formData.classBasePayHigh;
        if (hasSalaryData) {
          await saveSalarySettingsMutation.mutateAsync({
            teacherId: editingUser.id,
            baseSalary: parseInt(formData.baseSalary) || 0,
            classBasePay: parseInt(formData.classBasePayMiddle) || 0,
            classBasePayMiddle: parseInt(formData.classBasePayMiddle) || 0,
            classBasePayHigh: parseInt(formData.classBasePayHigh) || 0,
            studentThreshold: parseInt(formData.studentThresholdMiddle) || 0,
            studentThresholdMiddle: parseInt(formData.studentThresholdMiddle) || 0,
            studentThresholdHigh: parseInt(formData.studentThresholdHigh) || 0,
            perStudentBonus: parseInt(formData.perStudentBonusMiddle) || 0,
            perStudentBonusMiddle: parseInt(formData.perStudentBonusMiddle) || 0,
            perStudentBonusHigh: parseInt(formData.perStudentBonusHigh) || 0,
          });
        }
      }
      
      // Then update user info
      updateMutation.mutate({
        name: formData.name,
        phone: formData.phone,
        motherPhone: formData.motherPhone || null,
        fatherPhone: formData.fatherPhone || null,
        school: formData.school || null,
        grade: formData.grade || null,
        role: roleValue,
        attendancePin: formData.attendancePin || undefined,
        employmentType: isEditingTeacher ? formData.employmentType : null,
        dailyRate: isEditingTeacher && formData.employmentType === "hourly" && formData.dailyRate 
          ? parseInt(formData.dailyRate) 
          : null,
      });
    } catch (err) {
      // Error already shown by mutation onError handler
    }
  };

  const availableRoles = isPrincipal
    ? [
        { value: "1", label: "학생" },
        { value: "2", label: "선생님" },
        { value: "3", label: "원장" },
        { value: "0", label: "학부모" },
        { value: "-1", label: "출결 계정" },
      ]
    : [
        { value: "1", label: "학생" },
        { value: "2", label: "선생님" },
      ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="edit-name">이름 *</Label>
        <Input
          id="edit-name"
          value={formData.name}
          onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
          required
          data-testid="input-edit-name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-phone">전화번호 (로그인 아이디) *</Label>
        <Input
          id="edit-phone"
          value={formData.phone}
          onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
          placeholder="010-1234-5678"
          required
          data-testid="input-edit-phone"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-role">역할</Label>
        <Select
          value={formData.role}
          onValueChange={(v) => setFormData((p) => ({ ...p, role: v }))}
        >
          <SelectTrigger data-testid="select-edit-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableRoles.map((role) => (
              <SelectItem key={role.value} value={role.value}>
                {role.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Employment type for teachers */}
      {(isEditingTeacher || formData.role === "2") && (
        <div className="space-y-2">
          <Label>고용 형태</Label>
          <Select
            value={formData.employmentType}
            onValueChange={(v) => setFormData((p) => ({ ...p, employmentType: v }))}
          >
            <SelectTrigger data-testid="select-edit-employment-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="regular">정규직</SelectItem>
              <SelectItem value="part_time">파트타임</SelectItem>
              <SelectItem value="hourly">아르바이트</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Daily rate input for hourly teachers */}
      {(isEditingTeacher || formData.role === "2") && formData.employmentType === "hourly" && (
        <div className="space-y-2">
          <Label htmlFor="edit-dailyRate">일급 (원)</Label>
          <Input
            id="edit-dailyRate"
            type="number"
            placeholder="예: 100000"
            value={formData.dailyRate}
            onChange={(e) => setFormData((p) => ({ ...p, dailyRate: e.target.value }))}
            data-testid="input-edit-daily-rate"
          />
          <p className="text-xs text-muted-foreground">출근 기록 기반으로 월급이 자동 계산됩니다</p>
        </div>
      )}

      {/* Salary settings for regular/part-time teachers in edit mode */}
      {(isEditingTeacher || formData.role === "2") && (formData.employmentType === "regular" || formData.employmentType === "part_time") && (
        <div className="space-y-4 border rounded-md p-4 bg-muted/30">
          <div className="flex items-center gap-2">
            <Label className="font-semibold">급여 설정</Label>
          </div>
          <p className="text-xs text-muted-foreground">경영 탭 &gt; 재무에서도 수정 가능합니다</p>
          
          <div className="space-y-2">
            <Label htmlFor="edit-base-salary">기본급 (월)</Label>
            <Input
              id="edit-base-salary"
              type="number"
              placeholder="예: 2000000"
              value={formData.baseSalary || ""}
              onChange={(e) => setFormData((p) => ({ ...p, baseSalary: e.target.value.replace(/^0+/, '') || '' }))}
              data-testid="input-edit-base-salary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-class-base-middle">중등 수업당 기본급</Label>
              <Input
                id="edit-class-base-middle"
                type="number"
                placeholder="예: 100000"
                value={formData.classBasePayMiddle || ""}
                onChange={(e) => setFormData((p) => ({ ...p, classBasePayMiddle: e.target.value.replace(/^0+/, '') || '' }))}
                data-testid="input-edit-class-base-middle"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-class-base-high">고등 수업당 기본급</Label>
              <Input
                id="edit-class-base-high"
                type="number"
                placeholder="예: 120000"
                value={formData.classBasePayHigh || ""}
                onChange={(e) => setFormData((p) => ({ ...p, classBasePayHigh: e.target.value.replace(/^0+/, '') || '' }))}
                data-testid="input-edit-class-base-high"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-threshold-middle">중등 기준 인원</Label>
              <Input
                id="edit-threshold-middle"
                type="number"
                placeholder="예: 5"
                value={formData.studentThresholdMiddle || ""}
                onChange={(e) => setFormData((p) => ({ ...p, studentThresholdMiddle: e.target.value.replace(/^0+/, '') || '' }))}
                data-testid="input-edit-threshold-middle"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-bonus-middle">중등 초과 학생당 추가금</Label>
              <Input
                id="edit-bonus-middle"
                type="number"
                placeholder="예: 10000"
                value={formData.perStudentBonusMiddle || ""}
                onChange={(e) => setFormData((p) => ({ ...p, perStudentBonusMiddle: e.target.value.replace(/^0+/, '') || '' }))}
                data-testid="input-edit-bonus-middle"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-threshold-high">고등 기준 인원</Label>
              <Input
                id="edit-threshold-high"
                type="number"
                placeholder="예: 4"
                value={formData.studentThresholdHigh || ""}
                onChange={(e) => setFormData((p) => ({ ...p, studentThresholdHigh: e.target.value.replace(/^0+/, '') || '' }))}
                data-testid="input-edit-threshold-high"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-bonus-high">고등 초과 학생당 추가금</Label>
              <Input
                id="edit-bonus-high"
                type="number"
                placeholder="예: 15000"
                value={formData.perStudentBonusHigh || ""}
                onChange={(e) => setFormData((p) => ({ ...p, perStudentBonusHigh: e.target.value.replace(/^0+/, '') || '' }))}
                data-testid="input-edit-bonus-high"
              />
            </div>
          </div>
        </div>
      )}

      {(isStudent || formData.role === "1") && (
        <>
          <div className="space-y-2">
            <Label htmlFor="edit-motherPhone">어머니 전화번호</Label>
            <Input
              id="edit-motherPhone"
              value={formData.motherPhone}
              onChange={(e) => setFormData((p) => ({ ...p, motherPhone: e.target.value }))}
              placeholder="010-1234-5678"
              data-testid="input-edit-mother-phone"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-fatherPhone">아버지 전화번호</Label>
            <Input
              id="edit-fatherPhone"
              value={formData.fatherPhone}
              onChange={(e) => setFormData((p) => ({ ...p, fatherPhone: e.target.value }))}
              placeholder="010-1234-5678"
              data-testid="input-edit-father-phone"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-school">학교</Label>
            <Input
              id="edit-school"
              value={formData.school}
              onChange={(e) => setFormData((p) => ({ ...p, school: e.target.value }))}
              placeholder="예: OO초등학교"
              data-testid="input-edit-school"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-grade">학년</Label>
            <Select
              value={formData.grade}
              onValueChange={(v) => setFormData((p) => ({ ...p, grade: v }))}
            >
              <SelectTrigger data-testid="select-edit-grade">
                <SelectValue placeholder="학년 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="초1">초등 1학년</SelectItem>
                <SelectItem value="초2">초등 2학년</SelectItem>
                <SelectItem value="초3">초등 3학년</SelectItem>
                <SelectItem value="초4">초등 4학년</SelectItem>
                <SelectItem value="초5">초등 5학년</SelectItem>
                <SelectItem value="초6">초등 6학년</SelectItem>
                <SelectItem value="중1">중학 1학년</SelectItem>
                <SelectItem value="중2">중학 2학년</SelectItem>
                <SelectItem value="중3">중학 3학년</SelectItem>
                <SelectItem value="고1">고등 1학년</SelectItem>
                <SelectItem value="고2">고등 2학년</SelectItem>
                <SelectItem value="고3">고등 3학년</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-attendancePin">출결번호 변경</Label>
            <Input
              id="edit-attendancePin"
              value={formData.attendancePin}
              onChange={(e) => setFormData((p) => ({ ...p, attendancePin: e.target.value }))}
              placeholder="변경할 경우에만 입력"
              maxLength={6}
              data-testid="input-edit-attendance-pin"
            />
          </div>
        </>
      )}

      {/* Teacher check-in settings for Admin/Principal editing a teacher */}
      {canEditTeacherSettings && (
        <div className="space-y-4 border rounded-md p-4 bg-muted/30">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            <Label className="font-semibold">출근 알림 설정</Label>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="edit-teacher-checkin-code">출근코드 (4자리 숫자)</Label>
            <Input
              id="edit-teacher-checkin-code"
              value={teacherCheckInCode}
              onChange={(e) => setTeacherCheckInCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="1234"
              maxLength={4}
              data-testid="input-edit-teacher-checkin-code"
            />
            <p className="text-xs text-muted-foreground">
              출결패드에서 출근 시 입력하는 코드입니다
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-teacher-sms-1">담당 원장님 연락처 1</Label>
            <Input
              id="edit-teacher-sms-1"
              value={teacherSmsRecipient1}
              onChange={(e) => setTeacherSmsRecipient1(e.target.value)}
              placeholder="010-1234-5678"
              data-testid="input-edit-teacher-sms-1"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-teacher-sms-2">담당 원장님 연락처 2 (선택사항)</Label>
            <Input
              id="edit-teacher-sms-2"
              value={teacherSmsRecipient2}
              onChange={(e) => setTeacherSmsRecipient2(e.target.value)}
              placeholder="010-1234-5678"
              data-testid="input-edit-teacher-sms-2"
            />
          </div>
          
          <p className="text-xs text-muted-foreground">
            선생님이 출근코드를 입력하면 위 연락처로 출근 알림이 전송됩니다
          </p>
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button type="submit" disabled={updateMutation.isPending || saveTeacherCheckInMutation.isPending} data-testid="button-save-user">
          {updateMutation.isPending || saveTeacherCheckInMutation.isPending ? "저장 중..." : "저장"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function BulkUploadDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/users/bulk-upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "업로드 실패");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setResult(data);
      invalidateQueriesStartingWith("/api/users");
      if (data.success > 0) {
        toast({ title: `${data.success}명의 학생이 등록되었습니다` });
      }
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast({ title: "엑셀 파일을 선택해주세요", variant: "destructive" });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    uploadMutation.mutate(formData);
  };

  const downloadTemplate = () => {
    const headers = ["이름", "학교", "학년", "어머니 전화번호", "아버지 전화번호", "학생 전화번호"];
    const sampleData = ["(예시삭제)홍길동", "서울초등학교", "초6", "010-1234-5678", "010-8765-4321", "010-5555-5555"];
    const csv = [headers.join(","), sampleData.join(",")].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "학생등록_양식.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (result) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 rounded-md bg-muted">
          {result.success > 0 ? (
            <CheckCircle className="h-8 w-8 text-green-600" />
          ) : (
            <XCircle className="h-8 w-8 text-destructive" />
          )}
          <div>
            <p className="font-medium">업로드 완료</p>
            <p className="text-sm text-muted-foreground">
              성공: {result.success}명 / 실패: {result.failed}명
            </p>
          </div>
        </div>
        {result.errors.length > 0 && (
          <div className="max-h-40 overflow-auto p-3 rounded-md bg-destructive/10 text-sm space-y-1">
            {result.errors.map((error, i) => (
              <p key={i} className="text-destructive">{error}</p>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button onClick={onClose}>닫기</Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50">
        <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
        <div className="flex-1">
          <p className="text-sm font-medium">엑셀 파일 양식</p>
          <p className="text-xs text-muted-foreground">
            열: 이름, 학교, 학년, 어머니 전화번호, 아버지 전화번호, 학생 전화번호
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="h-4 w-4 mr-1" />
          양식
        </Button>
      </div>

      <div className="space-y-2">
        <Label>엑셀 파일 선택</Label>
        <Input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          data-testid="input-bulk-file"
        />
        {file && (
          <p className="text-xs text-muted-foreground">{file.name}</p>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        기본 비밀번호: 1234
      </p>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>취소</Button>
        <Button type="submit" disabled={uploadMutation.isPending}>
          {uploadMutation.isPending ? "업로드 중..." : "업로드"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function UserDetailsPanel({ userItem, onEdit, onDelete, allTeachers }: { userItem: User; onEdit: () => void; onDelete: () => void; allTeachers?: User[] }) {
  const { user } = useAuth();
  const { toast } = useToast();

  const isPrincipal = user?.role === UserRole.PRINCIPAL;
  const isTeacher = user?.role === UserRole.TEACHER;
  const isStudent = userItem.role === UserRole.STUDENT;

  const { data: enrolledClasses } = useQuery<any[]>({
    queryKey: ["/api/students", userItem.id, "classes"],
    enabled: userItem.role === UserRole.STUDENT,
  });

  const { data: attendancePin } = useQuery<{ pin: string } | null>({
    queryKey: [`/api/students/${userItem.id}/attendance-pin`],
    enabled: userItem.role === UserRole.STUDENT,
  });

  // Get homeroom teacher name
  const homeroomTeacher = allTeachers?.find(t => t.id === userItem.homeroomTeacherId);
  const isMyStudent = userItem.homeroomTeacherId === user?.id;

  // Mutation for admin/principal to assign homeroom teacher
  const assignHomeroomMutation = useMutation({
    mutationFn: async (teacherId: string | null) => {
      const res = await apiRequest("PATCH", `/api/users/${userItem.id}/homeroom-teacher`, {
        actorId: user?.id,
        teacherId,
      });
      return res.json();
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/users");
      toast({ title: "담임 선생님이 지정되었습니다" });
    },
    onError: () => {
      toast({ title: "담임 선생님 지정에 실패했습니다", variant: "destructive" });
    },
  });

  // Mutation for teacher to claim student
  const claimStudentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/homeroom/claim", {
        teacherId: user?.id,
        studentId: userItem.id,
      });
      return res.json();
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/users");
      invalidateQueriesStartingWith("/api/teachers");
      toast({ title: "내 학생으로 지정되었습니다" });
    },
    onError: () => {
      toast({ title: "지정에 실패했습니다", variant: "destructive" });
    },
  });

  // Mutation for teacher to unclaim student
  const unclaimStudentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/homeroom/unclaim", {
        teacherId: user?.id,
        studentId: userItem.id,
      });
      return res.json();
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/users");
      invalidateQueriesStartingWith("/api/teachers");
      toast({ title: "내 학생 해제되었습니다" });
    },
    onError: () => {
      toast({ title: "해제에 실패했습니다", variant: "destructive" });
    },
  });

  // Mutation for admin/principal to reset password
  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/users/${userItem.id}/reset-password`, {
        actorId: user?.id,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "비밀번호가 1234로 초기화되었습니다" });
    },
    onError: () => {
      toast({ title: "비밀번호 초기화에 실패했습니다", variant: "destructive" });
    },
  });

  const handleResetPassword = () => {
    if (confirm(`${userItem.name}의 비밀번호를 1234로 초기화하시겠습니까?`)) {
      resetPasswordMutation.mutate();
    }
  };

  const deleteEnrollmentMutation = useMutation({
    mutationFn: async (enrollmentId: string) => {
      await apiRequest("DELETE", `/api/enrollments/${enrollmentId}?actorId=${user?.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students", userItem.id, "classes"] });
      toast({ title: "수업에서 삭제되었습니다" });
    },
    onError: () => {
      toast({ title: "삭제에 실패했습니다", variant: "destructive" });
    },
  });

  const handleDeleteEnrollment = (enrollmentId: string, className: string) => {
    if (confirm(`${userItem.name} 학생을 "${className}" 수업에서 삭제하시겠습니까?`)) {
      deleteEnrollmentMutation.mutate(enrollmentId);
    }
  };

  const canDeleteEnrollment = isPrincipal || isPrincipal || isTeacher;

  return (
    <div className="mt-2 overflow-hidden rounded-lg border bg-gradient-to-br from-background to-muted/30">
      <div className="p-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Phone className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">연락처</p>
                <p className="font-medium">{userItem.phone || userItem.username}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Calendar className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">가입일</p>
                <p className="font-medium">
                  {userItem.createdAt ? format(new Date(userItem.createdAt), "yyyy년 M월 d일", { locale: ko }) : "-"}
                </p>
              </div>
            </div>

            {userItem.role === UserRole.STUDENT && (userItem.motherPhone || userItem.fatherPhone) && (
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">학부모 연락처</p>
                  <div className="space-y-1">
                    {userItem.motherPhone && (
                      <p className="font-medium text-sm">어머니: {userItem.motherPhone}</p>
                    )}
                    {userItem.fatherPhone && (
                      <p className="font-medium text-sm">아버지: {userItem.fatherPhone}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {userItem.role === UserRole.STUDENT && (userItem.school || userItem.grade) && (
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <School className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">학교/학년</p>
                  <p className="font-medium">
                    {userItem.school || "-"} {userItem.grade && `(${userItem.grade})`}
                  </p>
                </div>
              </div>
            )}

            {userItem.role === UserRole.STUDENT && (
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <KeyRound className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">출결번호</p>
                  <p className="font-medium">
                    {attendancePin?.pin || <span className="text-muted-foreground">미등록</span>}
                  </p>
                </div>
              </div>
            )}

            {isStudent && (
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <GraduationCap className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">담임 선생님</p>
                  {(isPrincipal || isPrincipal) && allTeachers && allTeachers.length > 0 ? (
                    <Select
                      value={userItem.homeroomTeacherId || "none"}
                      onValueChange={(value) => assignHomeroomMutation.mutate(value === "none" ? null : value)}
                      disabled={assignHomeroomMutation.isPending}
                    >
                      <SelectTrigger className="h-8 mt-1" data-testid={`select-homeroom-${userItem.id}`}>
                        <SelectValue placeholder="담임 선생님 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">미지정</SelectItem>
                        {allTeachers.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : isTeacher ? (
                    <div className="flex items-center gap-2 mt-1">
                      <p className="font-medium">
                        {homeroomTeacher ? homeroomTeacher.name : <span className="text-muted-foreground">미지정</span>}
                      </p>
                      {isMyStudent ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => unclaimStudentMutation.mutate()}
                          disabled={unclaimStudentMutation.isPending}
                          data-testid={`button-unclaim-${userItem.id}`}
                        >
                          {unclaimStudentMutation.isPending ? "해제 중..." : "내 학생 해제"}
                        </Button>
                      ) : !userItem.homeroomTeacherId ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => claimStudentMutation.mutate()}
                          disabled={claimStudentMutation.isPending}
                          data-testid={`button-claim-${userItem.id}`}
                        >
                          {claimStudentMutation.isPending ? "지정 중..." : "내 학생 지정"}
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <p className="font-medium">
                      {homeroomTeacher ? homeroomTeacher.name : <span className="text-muted-foreground">미지정</span>}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

        </div>

        {userItem.role === UserRole.STUDENT && enrolledClasses && enrolledClasses.length > 0 && (
          <div className="pt-3 border-t">
            <div className="flex items-center gap-2 mb-3">
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">수강 중인 수업</span>
              <Badge variant="outline">{enrolledClasses.length}개</Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {enrolledClasses.map((cls: any) => (
                <div
                  key={cls.id}
                  className={`flex items-center gap-3 p-3 rounded-md bg-background border ${
                    canDeleteEnrollment && cls.enrollmentId 
                      ? "cursor-pointer hover-elevate active-elevate-2" 
                      : ""
                  }`}
                  onClick={() => {
                    if (canDeleteEnrollment && cls.enrollmentId) {
                      handleDeleteEnrollment(cls.enrollmentId, cls.name);
                    }
                  }}
                  data-testid={`card-enrollment-${cls.id}`}
                >
                  <div
                    className="w-2 h-8 rounded-full"
                    style={{ backgroundColor: cls.color || "#3B82F6" }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{cls.name} ({cls.subject})</p>
                    <p className="text-xs text-muted-foreground">
                      {cls.teacher?.name || "선생님 미배정"} · {cls.center?.name || ""}
                    </p>
                  </div>
                  {canDeleteEnrollment && cls.enrollmentId && (
                    <X className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {userItem.id !== user?.id && (
          <div className="flex flex-wrap gap-2 pt-3 border-t">
            <Button variant="outline" size="sm" onClick={onEdit} data-testid={`button-edit-${userItem.id}`}>
              <Pencil className="h-4 w-4 mr-1" />
              수정
            </Button>
            {(isPrincipal || isPrincipal) && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetPassword}
                disabled={resetPasswordMutation.isPending}
                data-testid={`button-reset-password-${userItem.id}`}
              >
                <KeyRound className="h-4 w-4 mr-1" />
                {resetPasswordMutation.isPending ? "초기화 중..." : "비밀번호 초기화"}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              onClick={onDelete}
              data-testid={`button-delete-${userItem.id}`}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              삭제
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function UsersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "grade">("name");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [studentToExit, setStudentToExit] = useState<User | null>(null);
  const [isExitProcessing, setIsExitProcessing] = useState(false);

  const parseGradeToNumber = (grade: string | null): number => {
    if (!grade) return 999;
    const gradeMap: Record<string, number> = {
      "초1": 1, "초2": 2, "초3": 3, "초4": 4, "초5": 5, "초6": 6,
      "중1": 7, "중2": 8, "중3": 9,
      "고1": 10, "고2": 11, "고3": 12,
    };
    return gradeMap[grade] ?? 999;
  };

  const isPrincipal = user?.role === UserRole.PRINCIPAL;
  const isTeacher = user?.role === UserRole.TEACHER;

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: !isTeacher,
  });

  const { data: teacherStudents, isLoading: loadingTeacherStudents } = useQuery<User[]>({
    queryKey: [`/api/teachers/${user?.id}/students`],
    enabled: isTeacher && !!user?.id,
  });

  const { data: allTeachers = [] } = useQuery<User[]>({
    queryKey: ["/api/teachers"],
    select: (data) => data.filter(t => t.role === UserRole.TEACHER),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/users");
      invalidateQueriesStartingWith("/api/teachers");
      invalidateQueriesStartingWith("/api/management");
      setExpandedUserId(null);
      setStudentToExit(null);
      setIsExitProcessing(false);
      toast({ title: "계정이 삭제되었습니다" });
    },
    onError: (error: any) => {
      const serverMessage = error instanceof ApiError ? error.serverMessage : null;
      toast({ title: serverMessage || "삭제에 실패했습니다", variant: "destructive" });
      setIsExitProcessing(false);
    },
  });

  const displayUsers = isTeacher ? teacherStudents : users;
  const isLoadingUsers = isTeacher ? loadingTeacherStudents : isLoading;

  const filteredUsers = (displayUsers?.filter((u) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const nameMatch = u.name.toLowerCase().includes(query);
      const usernameMatch = u.username.toLowerCase().includes(query);
      const phoneMatch = u.phone?.toLowerCase().includes(query);
      const schoolMatch = u.school?.toLowerCase().includes(query);
      if (!nameMatch && !usernameMatch && !phoneMatch && !schoolMatch) {
        return false;
      }
    }
    if (roleFilter !== "all" && u.role !== parseInt(roleFilter)) {
      return false;
    }
    return true;
  }) ?? []).sort((a, b) => {
    if (sortBy === "name") {
      return a.name.localeCompare(b.name, "ko");
    } else {
      const gradeA = parseGradeToNumber(a.grade);
      const gradeB = parseGradeToNumber(b.grade);
      if (gradeA !== gradeB) return gradeA - gradeB;
      return a.name.localeCompare(b.name, "ko");
    }
  });

  const handleDeleteUser = (userToDelete: User) => {
    if (userToDelete.role === UserRole.STUDENT) {
      setStudentToExit(userToDelete);
    } else {
      if (confirm(`${userToDelete.name}님의 계정을 삭제하시겠습니까?`)) {
        deleteMutation.mutate(userToDelete.id);
      }
    }
  };

  const handleStudentExit = async (reasons: string[], notes: string) => {
    if (!studentToExit || !user?.id) return;
    
    setIsExitProcessing(true);
    try {
      await apiRequest("POST", `/api/students/${studentToExit.id}/exit-record`, {
        reasons,
        notes,
        recordedBy: user.id,
      });
      deleteMutation.mutate(studentToExit.id);
    } catch (error: any) {
      const serverMessage = error instanceof ApiError ? error.serverMessage : null;
      toast({ title: serverMessage || "퇴원 처리에 실패했습니다", variant: "destructive" });
      setIsExitProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{isTeacher ? "소속 학생" : "사용자 관리"}</h1>
          <p className="text-muted-foreground">{isTeacher ? "내 수업을 듣는 학생 목록" : "계정 생성 및 관리"}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-bulk-upload">
                <Upload className="h-4 w-4 mr-2" />
                엑셀 일괄등록
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>학생 일괄 등록</DialogTitle>
                <DialogDescription>엑셀 파일로 학생을 한번에 등록합니다</DialogDescription>
              </DialogHeader>
              <BulkUploadDialog
                onClose={() => setIsBulkOpen(false)}
              />
            </DialogContent>
          </Dialog>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-user">
                <Plus className="h-4 w-4 mr-2" />
                {isTeacher ? "학생 등록" : "계정 생성"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{isTeacher ? "학생 등록" : "새 계정 생성"}</DialogTitle>
                <DialogDescription>{isTeacher ? "학생 정보를 입력해주세요" : "사용자 정보를 입력해주세요"}</DialogDescription>
              </DialogHeader>
              <CreateUserDialog
                onClose={() => setIsCreateOpen(false)}
                teacherOnly={isTeacher}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>계정 수정</DialogTitle>
            <DialogDescription>사용자 정보를 수정합니다</DialogDescription>
          </DialogHeader>
          {editingUser && (
            <EditUserDialog
              user={editingUser}
              onClose={() => setEditingUser(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="이름, 전화번호, 학교로 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-users"
          />
        </div>
        {!isTeacher && (
          <Tabs value={roleFilter} onValueChange={setRoleFilter}>
            <TabsList>
              <TabsTrigger value="all">전체</TabsTrigger>
              <TabsTrigger value="1">학생</TabsTrigger>
              <TabsTrigger value="2">선생님</TabsTrigger>
              {isPrincipal && <TabsTrigger value="3">원장</TabsTrigger>}
            </TabsList>
          </Tabs>
        )}
        <Select value={sortBy} onValueChange={(v: "name" | "grade") => setSortBy(v)}>
          <SelectTrigger className="w-32" data-testid="select-sort-users">
            <SelectValue placeholder="정렬" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">이름순</SelectItem>
            <SelectItem value="grade">학년순</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {isTeacher ? "학생 목록" : "사용자 목록"}
          </CardTitle>
          <CardDescription>{filteredUsers.length}명</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingUsers ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>사용자가 없습니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredUsers.map((userItem) => (
                <Collapsible
                  key={userItem.id}
                  open={expandedUserId === userItem.id}
                  onOpenChange={(open) => setExpandedUserId(open ? userItem.id : null)}
                >
                  <CollapsibleTrigger asChild>
                    <button
                      className="w-full flex items-center gap-3 p-4 rounded-lg bg-muted/50 hover-elevate text-left transition-colors"
                      data-testid={`user-${userItem.id}`}
                    >
                      <Avatar className="h-11 w-11">
                        <AvatarFallback className={`text-sm font-medium ${
                          userItem.role >= 3 ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200" :
                          userItem.role === 2 ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200" :
                          userItem.role === 1 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200" :
                          "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                        }`}>
                          {userItem.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{userItem.name}</span>
                          <RoleBadge role={userItem.role} size="sm" />
                        </div>
                        <p className="text-sm text-muted-foreground">{userItem.phone || userItem.username}</p>
                      </div>
                      <div className={`p-1.5 rounded-full transition-colors ${expandedUserId === userItem.id ? 'bg-primary/10' : ''}`}>
                        {expandedUserId === userItem.id ? (
                          <ChevronUp className="h-5 w-5 text-primary" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <UserDetailsPanel 
                      userItem={userItem}
                      onEdit={() => setEditingUser(userItem)}
                      onDelete={() => handleDeleteUser(userItem)}
                      allTeachers={allTeachers}
                    />
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {studentToExit && user && (
        <StudentExitDialog
          student={studentToExit}
          recordedBy={user.id}
          onConfirm={handleStudentExit}
          onCancel={() => setStudentToExit(null)}
          isDeleting={isExitProcessing}
        />
      )}
    </div>
  );
}
