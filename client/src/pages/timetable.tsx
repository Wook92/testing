import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Users, Pencil, Trash2, UserPlus, X, Calendar, BookOpen, Save, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, invalidateQueriesStartingWith } from "@/lib/queryClient";
import { UserRole, type Class, type User } from "@shared/schema";
import { cn } from "@/lib/utils";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, addMonths } from "date-fns";
import { ko } from "date-fns/locale";

const DAYS = [
  { key: "mon", label: "월" },
  { key: "tue", label: "화" },
  { key: "wed", label: "수" },
  { key: "thu", label: "목" },
  { key: "fri", label: "금" },
  { key: "sat", label: "토" },
  { key: "sun", label: "일" },
];

const TIME_SLOTS = Array.from({ length: 28 }, (_, i) => {
  const hour = Math.floor(i / 2) + 9;
  const min = (i % 2) * 30;
  return `${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
});

const CLASS_COLORS = [
  "#93C5FD", "#86EFAC", "#FCD34D", "#FCA5A5", "#C4B5FD", "#F9A8D4",
  "#67E8F9", "#BEF264", "#FDBA74", "#A5B4FC", "#D8B4FE", "#99F6E4",
  "#FDE68A", "#A7F3D0", "#FBCFE8", "#BAE6FD", "#E9D5FF", "#FED7AA",
  "#BBF7D0", "#FECACA", "#DDD6FE", "#A5F3FC", "#FEF08A", "#C7D2FE",
];

function TimetableGrid({ classes, onClassClick, isStudent = false, teacherMap }: { 
  classes: Class[]; 
  onClassClick?: (cls: Class) => void;
  isStudent?: boolean;
  teacherMap?: Map<string, User>;
}) {
  const getScheduleForDay = (cls: Class, day: string) => {
    if (cls.schedule) {
      try {
        const scheduleArray = JSON.parse(cls.schedule);
        const daySchedule = scheduleArray.find((s: any) => s.day === day);
        if (daySchedule) {
          return { startTime: daySchedule.startTime, endTime: daySchedule.endTime };
        }
      } catch {}
    }
    return { startTime: cls.startTime, endTime: cls.endTime };
  };

  const timeToMinutes = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + (m || 0);
  };

  const getClassesForSlot = (day: string, time: string) => {
    return classes.filter((cls) => {
      if (!cls.days.includes(day)) return false;
      const { startTime, endTime } = getScheduleForDay(cls, day);
      const slotMin = timeToMinutes(time);
      const startMin = timeToMinutes(startTime);
      const endMin = timeToMinutes(endTime);
      return slotMin >= startMin && slotMin < endMin;
    });
  };

  const isClassStart = (cls: Class, day: string, time: string) => {
    const { startTime } = getScheduleForDay(cls, day);
    return startTime === time;
  };

  const getClassDuration = (cls: Class, day: string) => {
    const { startTime, endTime } = getScheduleForDay(cls, day);
    const durationMin = timeToMinutes(endTime) - timeToMinutes(startTime);
    return Math.max(1, Math.ceil(durationMin / 30));
  };

  return (
    <div>
      <div className="grid grid-cols-7 gap-0.5 md:gap-1">
        {DAYS.map((day) => (
          <div
            key={day.key}
            className="h-8 md:h-12 flex items-center justify-center font-medium text-[10px] md:text-sm bg-muted rounded-sm md:rounded-md"
          >
            {day.label}
          </div>
        ))}

        {TIME_SLOTS.map((time) => {
          const isHalfHour = time.endsWith(":30");
          return [
            ...DAYS.map((day) => {
              const slotClasses = getClassesForSlot(day.key, time);
              const startingClasses = slotClasses.filter((c) => isClassStart(c, day.key, time));

              return (
                <div
                  key={`${day.key}-${time}`}
                  className={cn(
                    "h-6 md:h-8 border-x border-border/30 md:border-border/50 relative",
                    isHalfHour ? "border-b border-t-0" : "border-t"
                  )}
                >
                  {startingClasses.map((cls) => {
                    const duration = getClassDuration(cls, day.key);
                    const { startTime, endTime } = getScheduleForDay(cls, day.key);
                    return (
                      <button
                        key={cls.id}
                        onClick={() => onClassClick?.(cls)}
                        className="absolute left-0 right-0 top-0 rounded-sm md:rounded-md p-0.5 md:p-1 text-left text-[8px] md:text-xs font-medium overflow-hidden cursor-pointer transition-all hover:brightness-95 active:brightness-90"
                        style={{
                          backgroundColor: cls.color,
                          height: `calc(${duration * 100}% + ${(duration - 1) * 1}px)`,
                          zIndex: 10,
                          color: "#1a1a1a",
                        }}
                        data-testid={`class-slot-${cls.id}`}
                      >
                        <p className="truncate font-semibold leading-tight">{cls.name}</p>
                        <p className="text-[7px] md:text-[10px] opacity-80 truncate">{cls.subject}반</p>
                        <p className="text-[7px] md:text-[10px] opacity-70 hidden md:block">
                          {startTime}-{endTime}
                        </p>
                        {cls.teacherId && teacherMap?.get(cls.teacherId) && (
                          <p className="text-[7px] md:text-[10px] opacity-70 truncate hidden md:block">
                            {teacherMap.get(cls.teacherId)?.name}
                          </p>
                        )}
                        {cls.classType === "assessment" && !isStudent && (
                          <Badge variant="secondary" className="text-[7px] md:text-[9px] mt-0.5 bg-white/50 hidden md:inline-flex">
                            평가
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            }),
          ];
        })}
      </div>
    </div>
  );
}

function CreateClassDialog({ 
  teachers, 
  onClose, 
  editingClass,
  existingClasses = []
}: { 
  teachers: User[]; 
  onClose: () => void;
  editingClass?: Class | null;
  existingClasses?: Class[];
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [useDifferentTimes, setUseDifferentTimes] = useState(false);
  const isTeacherOnly = user && user.role === UserRole.TEACHER;
  const defaultTeacherId = isTeacherOnly ? user.id : (editingClass?.teacherId || "");
  const [formData, setFormData] = useState({
    name: editingClass?.name || "",
    subject: editingClass?.subject || "",
    classType: editingClass?.classType || "regular",
    classLevel: (editingClass as any)?.classLevel || "middle",
    teacherId: defaultTeacherId,
    classroom: editingClass?.classroom || "",
    days: editingClass?.days || [] as string[],
    startTime: editingClass?.startTime || "14:00",
    endTime: editingClass?.endTime || "15:00",
    color: editingClass?.color || CLASS_COLORS[0],
    weeklyPlan: editingClass?.weeklyPlan || "",
    monthlyPlan: editingClass?.monthlyPlan || "",
  });
  const [dayTimes, setDayTimes] = useState<Record<string, { startTime: string; endTime: string }>>({});

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingClass) {
        return apiRequest("PATCH", `/api/classes/${editingClass.id}`, data);
      }
      return apiRequest("POST", "/api/classes", data);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/classes");
      toast({ title: editingClass ? "수업이 수정되었습니다" : "수업이 생성되었습니다" });
      onClose();
    },
    onError: () => {
      toast({ title: editingClass ? "수업 수정에 실패했습니다" : "수업 생성에 실패했습니다", variant: "destructive" });
    },
  });

  const timeToMinutes = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };

  const checkTimeConflict = () => {
    const classesToCheck = existingClasses.filter(cls => 
      cls.id !== editingClass?.id && 
      cls.teacherId === formData.teacherId
    );

    for (const cls of classesToCheck) {
      const scheduleData = cls.schedule ? JSON.parse(cls.schedule) : null;
      
      for (const day of formData.days) {
        if (!cls.days.includes(day)) continue;
        
        let existingStart: number, existingEnd: number;
        if (scheduleData) {
          const daySchedule = scheduleData.find((s: any) => s.day === day);
          if (!daySchedule) continue;
          existingStart = timeToMinutes(daySchedule.startTime);
          existingEnd = timeToMinutes(daySchedule.endTime);
        } else {
          existingStart = timeToMinutes(cls.startTime);
          existingEnd = timeToMinutes(cls.endTime);
        }

        let newStart: number, newEnd: number;
        if (useDifferentTimes && dayTimes[day]) {
          newStart = timeToMinutes(dayTimes[day].startTime);
          newEnd = timeToMinutes(dayTimes[day].endTime);
        } else {
          newStart = timeToMinutes(formData.startTime);
          newEnd = timeToMinutes(formData.endTime);
        }

        if (newStart < existingEnd && newEnd > existingStart) {
          return cls;
        }
      }
    }
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.days.length === 0) {
      toast({ title: "요일을 선택해주세요", variant: "destructive" });
      return;
    }
    if (!formData.teacherId) {
      toast({ title: "선생님을 선택해주세요", variant: "destructive" });
      return;
    }

    const conflictingClass = checkTimeConflict();
    if (conflictingClass) {
      toast({ 
        title: "시간대가 겹치는 수업이 있습니다", 
        description: `${conflictingClass.name} 수업과 시간이 겹칩니다.`,
        variant: "destructive" 
      });
      return;
    }

    let schedule = null;
    if (useDifferentTimes) {
      schedule = JSON.stringify(
        formData.days.map((day) => ({
          day,
          startTime: dayTimes[day]?.startTime || formData.startTime,
          endTime: dayTimes[day]?.endTime || formData.endTime,
        }))
      );
    }

    mutation.mutate({
      ...formData,
      schedule,
    });
  };

  const toggleDay = (day: string) => {
    setFormData((p) => ({
      ...p,
      days: p.days.includes(day)
        ? p.days.filter((d) => d !== day)
        : [...p.days, day],
    }));
  };

  const timeOptions = Array.from({ length: 28 }, (_, i) => {
    const hour = Math.floor(i / 2) + 9;
    const min = i % 2 === 0 ? "00" : "30";
    return `${hour.toString().padStart(2, "0")}:${min}`;
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">수업명</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
            placeholder="예: 중2-2"
            required
            data-testid="input-class-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="subject">반이름</Label>
          <Input
            id="subject"
            value={formData.subject}
            onChange={(e) => setFormData((p) => ({ ...p, subject: e.target.value }))}
            placeholder="예: 화목S반 or 개념S반"
            required
            data-testid="input-class-subject"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>수업 유형</Label>
          <Select
            value={formData.classType}
            onValueChange={(v) => setFormData((p) => ({ ...p, classType: v }))}
          >
            <SelectTrigger data-testid="select-class-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="regular">정규 수업</SelectItem>
              <SelectItem value="assessment">평가 수업</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>수업 레벨</Label>
          <Select
            value={formData.classLevel}
            onValueChange={(v) => setFormData((p) => ({ ...p, classLevel: v }))}
          >
            <SelectTrigger data-testid="select-class-level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="middle">중등</SelectItem>
              <SelectItem value="high">고등</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>담당 선생님</Label>
          {isTeacherOnly ? (
            <div className="flex items-center h-9 px-3 border rounded-md bg-muted text-sm">
              {user.name} 선생님
            </div>
          ) : (
            <Select
              value={formData.teacherId}
              onValueChange={(v) => setFormData((p) => ({ ...p, teacherId: v }))}
            >
              <SelectTrigger data-testid="select-teacher">
                <SelectValue placeholder="선택" />
              </SelectTrigger>
              <SelectContent>
                {teachers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} 선생님
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="classroom">강의실</Label>
        <Input
          id="classroom"
          value={formData.classroom}
          onChange={(e) => setFormData((p) => ({ ...p, classroom: e.target.value }))}
          placeholder="예: 2관 1강의실"
          data-testid="input-classroom"
        />
      </div>

      <div className="space-y-2">
        <Label>요일 선택</Label>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((day) => (
            <Button
              key={day.key}
              type="button"
              variant={formData.days.includes(day.key) ? "default" : "outline"}
              size="sm"
              onClick={() => toggleDay(day.key)}
              data-testid={`day-${day.key}`}
            >
              {day.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>수업 시간</Label>
          {formData.days.length > 1 && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={useDifferentTimes}
                onChange={(e) => setUseDifferentTimes(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              요일별 다른 시간
            </label>
          )}
        </div>

        {useDifferentTimes && formData.days.length > 1 ? (
          <div className="space-y-2 border rounded-md p-3">
            {formData.days.map((day) => (
              <div key={day} className="flex items-center gap-2">
                <span className="w-8 text-sm font-medium">
                  {DAYS.find((d) => d.key === day)?.label}
                </span>
                <Select
                  value={dayTimes[day]?.startTime || formData.startTime}
                  onValueChange={(v) =>
                    setDayTimes((p) => ({
                      ...p,
                      [day]: { ...p[day], startTime: v, endTime: p[day]?.endTime || formData.endTime },
                    }))
                  }
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-muted-foreground">~</span>
                <Select
                  value={dayTimes[day]?.endTime || formData.endTime}
                  onValueChange={(v) =>
                    setDayTimes((p) => ({
                      ...p,
                      [day]: { ...p[day], endTime: v, startTime: p[day]?.startTime || formData.startTime },
                    }))
                  }
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Select
              value={formData.startTime}
              onValueChange={(v) => setFormData((p) => ({ ...p, startTime: v }))}
            >
              <SelectTrigger className="w-28" data-testid="select-start-time">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-muted-foreground">~</span>
            <Select
              value={formData.endTime}
              onValueChange={(v) => setFormData((p) => ({ ...p, endTime: v }))}
            >
              <SelectTrigger className="w-28" data-testid="select-end-time">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>색상</Label>
        <div className="flex flex-wrap gap-2 ml-1">
          {CLASS_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={cn(
                "w-8 h-8 rounded-full border-2 transition-transform",
                formData.color === color ? "border-foreground scale-110" : "border-transparent"
              )}
              style={{ backgroundColor: color }}
              onClick={() => setFormData((p) => ({ ...p, color }))}
              data-testid={`color-${color}`}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="weeklyPlan">주간 수업 계획 (선택)</Label>
        <Textarea
          id="weeklyPlan"
          value={formData.weeklyPlan}
          onChange={(e) => setFormData((p) => ({ ...p, weeklyPlan: e.target.value }))}
          placeholder="이번 주 수업 계획을 입력하세요... (선택사항)"
          className="min-h-[60px]"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="monthlyPlan">월간 수업 계획 (선택)</Label>
        <Textarea
          id="monthlyPlan"
          value={formData.monthlyPlan}
          onChange={(e) => setFormData((p) => ({ ...p, monthlyPlan: e.target.value }))}
          placeholder="이번 달 수업 계획을 입력하세요... (선택사항)"
          className="min-h-[60px]"
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button type="submit" disabled={mutation.isPending} data-testid="button-create-class">
          {mutation.isPending ? (editingClass ? "수정 중..." : "생성 중...") : (editingClass ? "수업 수정" : "수업 생성")}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface ClassWithTeacher extends Class {
  teacher?: User;
}

function EnrollDialog({ classItem, onClose }: { classItem: ClassWithTeacher; onClose: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("info");
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  const currentWeekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
  const currentWeekEnd = endOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
  const currentMonthStart = startOfMonth(addMonths(new Date(), monthOffset));

  const { data: enrollments } = useQuery<any[]>({
    queryKey: [`/api/students/${user?.id}/enrollments`],
    enabled: !!user?.id,
  });

  const { data: weeklyPlanData } = useQuery<{ content?: string }>({
    queryKey: [`/api/class-plans/weekly?actorId=${user?.id}&classId=${classItem.id}&weekStart=${format(currentWeekStart, "yyyy-MM-dd")}`],
    enabled: !!classItem.id && !!user,
  });

  const { data: monthlyPlanData } = useQuery<{ content?: string }>({
    queryKey: [`/api/class-plans/monthly?actorId=${user?.id}&classId=${classItem.id}&month=${format(currentMonthStart, "yyyy-MM")}`],
    enabled: !!classItem.id && !!user,
  });

  const isEnrolled = enrollments?.some((e) => e.classId === classItem.id);

  const enrollMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/enrollments", {
        studentId: user?.id,
        classId: classItem.id,
      });
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/students");
      invalidateQueriesStartingWith("/api/homework");
      invalidateQueriesStartingWith("/api/assessments");
      toast({ title: "수업 신청이 완료되었습니다" });
      onClose();
    },
    onError: () => {
      toast({
        title: "시간이 겹쳐 수업을 추가할 수 없습니다",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div
          className="w-4 h-12 rounded-full"
          style={{ backgroundColor: classItem.color }}
        />
        <div>
          <h3 className="font-semibold text-lg">{classItem.name}</h3>
          <p className="text-muted-foreground">{classItem.subject}반</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="info">수업 정보</TabsTrigger>
          <TabsTrigger value="plans">수업 계획</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-4 mt-4">
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">요일</span>
              <span>{classItem.days.map((d) => DAYS.find((day) => day.key === d)?.label).join(", ")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">시간</span>
              <span>{classItem.startTime} - {classItem.endTime}</span>
            </div>
            {classItem.teacher && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">선생님</span>
                <span>{classItem.teacher.name} 선생님</span>
              </div>
            )}
            {classItem.classroom && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">강의실</span>
                <span>{classItem.classroom}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              닫기
            </Button>
            {isEnrolled ? (
              <Button disabled variant="secondary">
                이미 신청됨
              </Button>
            ) : (
              <Button
                onClick={() => enrollMutation.mutate()}
                disabled={enrollMutation.isPending}
                data-testid="button-enroll"
              >
                {enrollMutation.isPending ? "신청 중..." : "수업 신청"}
              </Button>
            )}
          </DialogFooter>
        </TabsContent>

        <TabsContent value="plans" className="space-y-4 mt-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  주간 수업 계획
                </h4>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setWeekOffset(prev => prev - 1)}>
                    이전
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setWeekOffset(0)}>
                    이번 주
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setWeekOffset(prev => prev + 1)}>
                    다음
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {format(currentWeekStart, "yyyy년 M월 d일", { locale: ko })} - {format(currentWeekEnd, "M월 d일", { locale: ko })}
              </p>
              <div className="p-3 bg-muted rounded-md min-h-[80px]">
                {weeklyPlanData?.content ? (
                  <p className="text-sm whitespace-pre-wrap">{weeklyPlanData.content}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">등록된 주간 계획이 없습니다.</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  월간 수업 계획
                </h4>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setMonthOffset(prev => prev - 1)}>
                    이전
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setMonthOffset(0)}>
                    이번 달
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setMonthOffset(prev => prev + 1)}>
                    다음
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {format(currentMonthStart, "yyyy년 M월", { locale: ko })}
              </p>
              <div className="p-3 bg-muted rounded-md min-h-[80px]">
                {monthlyPlanData?.content ? (
                  <p className="text-sm whitespace-pre-wrap">{monthlyPlanData.content}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">등록된 월간 계획이 없습니다.</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              닫기
            </Button>
          </DialogFooter>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EditClassDialog({ 
  classItem, 
  teachers,
  onClose,
  existingClasses = []
}: { 
  classItem: ClassWithTeacher; 
  teachers: User[];
  onClose: () => void;
  existingClasses?: Class[];
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [showEditForm, setShowEditForm] = useState(false);
  const [showEnrollStudents, setShowEnrollStudents] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("info");
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  const currentWeekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
  const currentWeekEnd = endOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
  const currentMonthStart = startOfMonth(addMonths(new Date(), monthOffset));

  const { data: weeklyPlanData } = useQuery<{ content?: string }>({
    queryKey: [`/api/class-plans/weekly?actorId=${user?.id}&classId=${classItem.id}&weekStart=${format(currentWeekStart, "yyyy-MM-dd")}`],
    enabled: !!classItem.id && !!user,
  });

  const { data: monthlyPlanData } = useQuery<{ content?: string }>({
    queryKey: [`/api/class-plans/monthly?actorId=${user?.id}&classId=${classItem.id}&month=${format(currentMonthStart, "yyyy-MM")}`],
    enabled: !!classItem.id && !!user,
  });

  const { data: allStudents = [] } = useQuery<User[]>({
    queryKey: ["/api/users?role=student"],
    enabled: showEnrollStudents,
  });

  // Fetch current enrollments for this class
  const { data: classEnrollments = [] } = useQuery<any[]>({
    queryKey: [`/api/classes/${classItem.id}/enrollments`],
    enabled: showEnrollStudents,
  });

  const enrolledStudentIds = new Set(classEnrollments.map((e) => e.studentId));

  const filteredStudents = allStudents.filter((student) =>
    student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.phone?.includes(searchQuery)
  );

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/classes/${classItem.id}`);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/classes");
      toast({ title: "수업이 삭제되었습니다" });
      onClose();
    },
    onError: () => {
      toast({ title: "수업 삭제에 실패했습니다", variant: "destructive" });
    },
  });

  const enrollMutation = useMutation({
    mutationFn: async (studentId: string) => {
      return apiRequest("POST", "/api/enrollments", {
        studentId,
        classId: classItem.id,
      });
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/classes");
      invalidateQueriesStartingWith("/api/students");
      invalidateQueriesStartingWith("/api/homework");
      invalidateQueriesStartingWith("/api/assessments");
      toast({ title: "학생이 수업에 등록되었습니다" });
    },
    onError: () => {
      toast({ title: "등록에 실패했습니다. 시간이 겹칠 수 있습니다.", variant: "destructive" });
    },
  });

  const unenrollMutation = useMutation({
    mutationFn: async (enrollmentId: string) => {
      return apiRequest("DELETE", `/api/enrollments/${enrollmentId}?actorId=${user?.id}`);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/classes");
      invalidateQueriesStartingWith("/api/students");
      invalidateQueriesStartingWith("/api/homework");
      invalidateQueriesStartingWith("/api/assessments");
      toast({ title: "학생이 수업에서 제외되었습니다" });
    },
    onError: () => {
      toast({ title: "제외에 실패했습니다", variant: "destructive" });
    },
  });

  if (showEditForm) {
    return (
      <CreateClassDialog 
        teachers={teachers} 
        onClose={onClose} 
        editingClass={classItem}
        existingClasses={existingClasses}
      />
    );
  }

  if (showEnrollStudents) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">학생 등록 관리</h3>
          <Button variant="ghost" size="icon" onClick={() => setShowEnrollStudents(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-2 p-2 rounded-md bg-muted">
          <div className="w-3 h-8 rounded-full" style={{ backgroundColor: classItem.color }} />
          <div>
            <p className="font-medium text-sm">{classItem.name}</p>
            <p className="text-xs text-muted-foreground">{classItem.subject}반</p>
          </div>
        </div>

        <Input
          placeholder="학생 이름 또는 전화번호 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          data-testid="input-search-student"
        />

        {/* Currently enrolled students */}
        {classEnrollments.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">등록된 학생 ({classEnrollments.length}명)</Label>
            <ScrollArea className="h-32 border rounded-md p-2">
              <div className="space-y-1">
                {classEnrollments.map((enrollment) => {
                  const student = allStudents.find((s: User) => s.id === enrollment.studentId);
                  return (
                    <div key={enrollment.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                      <span className="text-sm">{student?.name || "알 수 없음"}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-destructive"
                        onClick={() => unenrollMutation.mutate(enrollment.id)}
                        disabled={unenrollMutation.isPending}
                        data-testid={`button-unenroll-${enrollment.studentId}`}
                      >
                        제외
                      </Button>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Available students to enroll */}
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">등록 가능한 학생</Label>
          <ScrollArea className="h-48 border rounded-md p-2">
            <div className="space-y-1">
              {filteredStudents
                .filter((student) => !enrolledStudentIds.has(student.id))
                .map((student) => (
                  <div key={student.id} className="flex items-center justify-between p-2 rounded-md hover-elevate">
                    <div>
                      <span className="text-sm font-medium">{student.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">{student.grade}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      onClick={() => enrollMutation.mutate(student.id)}
                      disabled={enrollMutation.isPending}
                      data-testid={`button-enroll-${student.id}`}
                    >
                      <UserPlus className="h-3 w-3 mr-1" />
                      등록
                    </Button>
                  </div>
                ))}
              {filteredStudents.filter((s) => !enrolledStudentIds.has(s.id)).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {searchQuery ? "검색 결과가 없습니다" : "모든 학생이 등록되었습니다"}
                </p>
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setShowEnrollStudents(false)}>
            완료
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div
          className="w-4 h-12 rounded-full"
          style={{ backgroundColor: classItem.color }}
        />
        <div>
          <h3 className="font-semibold text-lg">{classItem.name}</h3>
          <p className="text-muted-foreground">{classItem.subject}반</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="info">수업 정보</TabsTrigger>
          <TabsTrigger value="plans">수업 계획</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-4 mt-4">
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">요일</span>
              <span>{classItem.days.map((d) => DAYS.find((day) => day.key === d)?.label).join(", ")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">시간</span>
              <span>{classItem.startTime} - {classItem.endTime}</span>
            </div>
            {classItem.teacher && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">선생님</span>
                <span>{classItem.teacher.name} 선생님</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">유형</span>
              <Badge variant="outline">
                {classItem.classType === "regular" ? "정규 수업" : "평가 수업"}
              </Badge>
            </div>
          </div>

          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={onClose}>
              닫기
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowEnrollStudents(true)}
              data-testid="button-manage-students"
            >
              <Users className="h-4 w-4 mr-1" />
              학생 관리
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowEditForm(true)}
              data-testid="button-edit-class"
            >
              <Pencil className="h-4 w-4 mr-1" />
              수정
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              data-testid="button-delete-class"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              삭제
            </Button>
          </DialogFooter>
        </TabsContent>

        <TabsContent value="plans" className="space-y-4 mt-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  주간 수업 계획
                </h4>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setWeekOffset(prev => prev - 1)}>
                    이전
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setWeekOffset(0)}>
                    이번 주
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setWeekOffset(prev => prev + 1)}>
                    다음
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {format(currentWeekStart, "yyyy년 M월 d일", { locale: ko })} - {format(currentWeekEnd, "M월 d일", { locale: ko })}
              </p>
              <div className="p-3 bg-muted rounded-md min-h-[80px]">
                {weeklyPlanData?.content ? (
                  <p className="text-sm whitespace-pre-wrap">{weeklyPlanData.content}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">등록된 주간 계획이 없습니다.</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  월간 수업 계획
                </h4>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setMonthOffset(prev => prev - 1)}>
                    이전
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setMonthOffset(0)}>
                    이번 달
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setMonthOffset(prev => prev + 1)}>
                    다음
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {format(currentMonthStart, "yyyy년 M월", { locale: ko })}
              </p>
              <div className="p-3 bg-muted rounded-md min-h-[80px]">
                {monthlyPlanData?.content ? (
                  <p className="text-sm whitespace-pre-wrap">{monthlyPlanData.content}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">등록된 월간 계획이 없습니다.</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              닫기
            </Button>
          </DialogFooter>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ClassPlansTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [weeklyPlan, setWeeklyPlan] = useState("");
  const [monthlyPlan, setMonthlyPlan] = useState("");

  const currentWeekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
  const currentWeekEnd = endOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
  const currentMonthStart = startOfMonth(addMonths(new Date(), monthOffset));

  const { data: classes, isLoading: classesLoading } = useQuery<Class[]>({
    queryKey: [`/api/classes?actorId=${user?.id}`],
    enabled: !!user,
  });

  const { data: weeklyPlanData } = useQuery<{ content?: string }>({
    queryKey: [`/api/class-plans/weekly?actorId=${user?.id}&classId=${selectedClass}&weekStart=${format(currentWeekStart, "yyyy-MM-dd")}`],
    enabled: !!selectedClass && !!user,
  });

  const { data: monthlyPlanData } = useQuery<{ content?: string }>({
    queryKey: [`/api/class-plans/monthly?actorId=${user?.id}&classId=${selectedClass}&month=${format(currentMonthStart, "yyyy-MM")}`],
    enabled: !!selectedClass && !!user,
  });

  useEffect(() => {
    setWeeklyPlan(weeklyPlanData?.content || "");
  }, [weeklyPlanData]);

  useEffect(() => {
    setMonthlyPlan(monthlyPlanData?.content || "");
  }, [monthlyPlanData]);

  const saveWeeklyPlanMutation = useMutation({
    mutationFn: async (data: { classId: string; weekStart: string; content: string }) => {
      return apiRequest("POST", `/api/class-plans/weekly?actorId=${user?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/class-plans/weekly"] });
      toast({ title: "저장 완료", description: "주간 수업 계획이 저장되었습니다." });
    },
    onError: () => {
      toast({ title: "오류", description: "저장 중 오류가 발생했습니다.", variant: "destructive" });
    },
  });

  const saveMonthlyPlanMutation = useMutation({
    mutationFn: async (data: { classId: string; month: string; content: string }) => {
      return apiRequest("POST", `/api/class-plans/monthly?actorId=${user?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/class-plans/monthly"] });
      toast({ title: "저장 완료", description: "월간 수업 계획이 저장되었습니다." });
    },
    onError: () => {
      toast({ title: "오류", description: "저장 중 오류가 발생했습니다.", variant: "destructive" });
    },
  });

  const handleSaveWeeklyPlan = () => {
    if (!selectedClass) return;
    saveWeeklyPlanMutation.mutate({
      classId: selectedClass,
      weekStart: format(currentWeekStart, "yyyy-MM-dd"),
      content: weeklyPlan,
    });
  };

  const handleSaveMonthlyPlan = () => {
    if (!selectedClass) return;
    saveMonthlyPlanMutation.mutate({
      classId: selectedClass,
      month: format(currentMonthStart, "yyyy-MM"),
      content: monthlyPlan,
    });
  };

  if (classesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-64">
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger>
              <SelectValue placeholder="수업 선택" />
            </SelectTrigger>
            <SelectContent>
              {classes?.map((cls: any) => (
                <SelectItem key={cls.id} value={cls.id}>
                  {cls.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedClass ? (
        <Tabs defaultValue="weekly" className="space-y-4">
          <TabsList>
            <TabsTrigger value="weekly">
              <Calendar className="h-4 w-4 mr-2" />
              주간 계획
            </TabsTrigger>
            <TabsTrigger value="monthly">
              <BookOpen className="h-4 w-4 mr-2" />
              월간 계획
            </TabsTrigger>
          </TabsList>

          <TabsContent value="weekly">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>주간 수업 계획</CardTitle>
                    <CardDescription>
                      {format(currentWeekStart, "yyyy년 M월 d일", { locale: ko })} - {format(currentWeekEnd, "M월 d일", { locale: ko })}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setWeekOffset(prev => prev - 1)}>
                      이전 주
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}>
                      이번 주
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setWeekOffset(prev => prev + 1)}>
                      다음 주
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="이번 주 수업 계획을 입력하세요...&#10;&#10;예:&#10;- 월요일: 1단원 복습&#10;- 수요일: 2단원 진도&#10;- 금요일: 문제풀이"
                  value={weeklyPlan}
                  onChange={(e) => setWeeklyPlan(e.target.value)}
                  className="min-h-[200px]"
                />
                <Button onClick={handleSaveWeeklyPlan} disabled={saveWeeklyPlanMutation.isPending}>
                  {saveWeeklyPlanMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  저장
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="monthly">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>월간 수업 계획</CardTitle>
                    <CardDescription>
                      {format(currentMonthStart, "yyyy년 M월", { locale: ko })}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setMonthOffset(prev => prev - 1)}>
                      이전 달
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setMonthOffset(0)}>
                      이번 달
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setMonthOffset(prev => prev + 1)}>
                      다음 달
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="이번 달 수업 계획을 입력하세요...&#10;&#10;예:&#10;- 1주차: 1단원 개념 정리&#10;- 2주차: 2단원 진도&#10;- 3주차: 중간 점검&#10;- 4주차: 복습 및 테스트"
                  value={monthlyPlan}
                  onChange={(e) => setMonthlyPlan(e.target.value)}
                  className="min-h-[300px]"
                />
                <Button onClick={handleSaveMonthlyPlan} disabled={saveMonthlyPlanMutation.isPending}>
                  {saveMonthlyPlanMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  저장
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            수업을 선택해주세요
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function TimetablePage() {
  const { user } = useAuth();
  const [selectedTeacher, setSelectedTeacher] = useState<string>("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassWithTeacher | null>(null);
  const [mainTab, setMainTab] = useState<string>("timetable");

  const isTeacherOrAbove = user && user.role >= UserRole.TEACHER;
  const isTeacherOnly = user && user.role === UserRole.TEACHER;
  const isAdminOrPrincipal = user && user.role >= UserRole.PRINCIPAL;
  const isStudent = user && user.role === UserRole.STUDENT;

  const { data: classes, isLoading: loadingClasses } = useQuery<Class[]>({
    queryKey: ["/api/classes"],
    enabled: !!user,
  });

  const { data: teachers } = useQuery<User[]>({
    queryKey: ["/api/teachers"],
    enabled: !!user,
  });

  const teacherMap = new Map(teachers?.map((t) => [t.id, t]) ?? []);

  // For teachers, show only their classes; for admin/principal/students, show selected teacher's classes
  // "all" means show all classes (only for students)
  const effectiveTeacher = isTeacherOnly ? user?.id : selectedTeacher;

  const filteredClasses = classes?.filter((cls) => {
    if (isTeacherOnly) {
      return cls.teacherId === user?.id;
    }
    // Filter by selected teacher
    if (!effectiveTeacher) return true;
    return cls.teacherId === effectiveTeacher;
  }) ?? [];

  const handleClassClick = (cls: Class) => {
    const classWithTeacher: ClassWithTeacher = {
      ...cls,
      teacher: cls.teacherId ? teacherMap.get(cls.teacherId) : undefined,
    };
    setSelectedClass(classWithTeacher);
  };

  // Set default teacher when teachers load (default to first teacher)
  if (!isTeacherOnly && teachers && teachers.length > 0 && !selectedTeacher) {
    setSelectedTeacher(teachers[0].id);
  }

  const timetableContent = (
    <>
      {!isTeacherOnly && teachers && teachers.length > 0 && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {isStudent ? "선생님 선택" : "담당 선생님"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Tabs value={effectiveTeacher || (teachers[0]?.id ?? "")} onValueChange={setSelectedTeacher}>
              <TabsList className="flex-wrap h-auto gap-1 w-full justify-start">
                {teachers.map((t) => (
                  <TabsTrigger key={t.id} value={t.id} className="px-4">
                    {t.name} 선생님
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            {!isTeacherOnly && effectiveTeacher && teacherMap.get(effectiveTeacher) 
              ? `${teacherMap.get(effectiveTeacher)?.name} 선생님 시간표`
              : "시간표"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingClasses ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <TimetableGrid
              classes={filteredClasses}
              onClassClick={handleClassClick}
              isStudent={!isTeacherOrAbove}
              teacherMap={teacherMap}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedClass} onOpenChange={(open) => !open && setSelectedClass(null)}>
        <DialogContent className={isTeacherOrAbove ? "" : "max-w-lg"}>
          <DialogHeader>
            <DialogTitle>{isTeacherOrAbove ? "수업 관리" : "수업 상세"}</DialogTitle>
            <DialogDescription>
              {isTeacherOrAbove ? "수업을 수정하거나 삭제할 수 있습니다" : "수업 정보 및 수업 계획을 확인할 수 있습니다"}
            </DialogDescription>
          </DialogHeader>
          {selectedClass && (
            isTeacherOrAbove ? (
              <EditClassDialog
                classItem={selectedClass}
                teachers={teachers ?? []}
                onClose={() => setSelectedClass(null)}
                existingClasses={classes ?? []}
              />
            ) : (
              <EnrollDialog
                classItem={selectedClass}
                onClose={() => setSelectedClass(null)}
              />
            )
          )}
        </DialogContent>
      </Dialog>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            {isStudent ? "학원 시간표" : "수업 관리"}
          </h1>
          <p className="text-muted-foreground">
            {isStudent ? "선생님별 시간표를 확인하세요" : "시간표 및 수업 계획"}
          </p>
        </div>
        {isTeacherOrAbove && mainTab === "timetable" && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-class">
                <Plus className="h-4 w-4 mr-2" />
                수업 생성
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>새 수업 생성</DialogTitle>
                <DialogDescription>수업 정보를 입력해주세요</DialogDescription>
              </DialogHeader>
              <CreateClassDialog
                teachers={teachers ?? []}
                onClose={() => setIsCreateOpen(false)}
                existingClasses={classes ?? []}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isTeacherOrAbove ? (
        <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="timetable">
              <Calendar className="h-4 w-4 mr-2" />
              시간표
            </TabsTrigger>
            <TabsTrigger value="plans">
              <BookOpen className="h-4 w-4 mr-2" />
              수업 계획
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timetable" className="space-y-4">
            {timetableContent}
          </TabsContent>

          <TabsContent value="plans">
            <ClassPlansTab />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-4">
          {timetableContent}
        </div>
      )}
    </div>
  );
}
