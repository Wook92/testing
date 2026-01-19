import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, ChevronLeft, ChevronRight, Pencil, Trash2, Loader2, GraduationCap, School, Calendar as CalendarIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, invalidateQueriesStartingWith } from "@/lib/queryClient";
import { UserRole } from "@shared/schema";
import { cn } from "@/lib/utils";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isSameDay, parseISO, startOfWeek, endOfWeek } from "date-fns";
import { ko } from "date-fns/locale";

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  eventType: "school_exam" | "school_event" | "academy_event";
  schoolName?: string;
  startDate: string;
  endDate?: string;
  color?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

const EVENT_TYPES = [
  { value: "school_exam", label: "학교 시험", icon: GraduationCap, defaultColor: "#EF4444" },
  { value: "school_event", label: "학교 일정", icon: School, defaultColor: "#3B82F6" },
  { value: "academy_event", label: "학원 일정", icon: CalendarIcon, defaultColor: "#10B981" },
];

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function CalendarPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [showEventDialog, setShowEventDialog] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    eventType: "academy_event" as "school_exam" | "school_event" | "academy_event",
    schoolName: "",
    startDate: "",
    endDate: "",
    color: "",
  });

  const canEdit = user && user.role >= UserRole.TEACHER;

  const { data: events = [], isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/calendar-events"],
    enabled: !!user,
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", `/api/calendar-events?actorId=${user?.id}`, {
        ...data,
        color: data.color || EVENT_TYPES.find((t) => t.value === data.eventType)?.defaultColor,
      });
      return res.json();
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/calendar-events");
      toast({ title: "일정이 추가되었습니다" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "일정 추가 실패", variant: "destructive" });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const res = await apiRequest("PATCH", `/api/calendar-events/${id}?actorId=${user?.id}`, {
        ...data,
        color: data.color || EVENT_TYPES.find((t) => t.value === data.eventType)?.defaultColor,
      });
      return res.json();
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/calendar-events");
      toast({ title: "일정이 수정되었습니다" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "일정 수정 실패", variant: "destructive" });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/calendar-events/${id}?actorId=${user?.id}`);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/calendar-events");
      toast({ title: "일정이 삭제되었습니다" });
    },
    onError: () => {
      toast({ title: "일정 삭제 실패", variant: "destructive" });
    },
  });

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentDate]);

  const getEventsForDay = (date: Date) => {
    return events.filter((event) => {
      const eventStart = parseISO(event.startDate);
      const eventEnd = event.endDate ? parseISO(event.endDate) : eventStart;
      return date >= eventStart && date <= eventEnd;
    });
  };

  const openCreateDialog = (date?: Date) => {
    setEditingEvent(null);
    setFormData({
      title: "",
      description: "",
      eventType: "academy_event",
      schoolName: "",
      startDate: date ? format(date, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      endDate: "",
      color: "",
    });
    setShowEventDialog(true);
  };

  const openEditDialog = (event: CalendarEvent) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || "",
      eventType: event.eventType,
      schoolName: event.schoolName || "",
      startDate: event.startDate,
      endDate: event.endDate || "",
      color: event.color || "",
    });
    setShowEventDialog(true);
  };

  const closeDialog = () => {
    setShowEventDialog(false);
    setEditingEvent(null);
    setFormData({
      title: "",
      description: "",
      eventType: "academy_event",
      schoolName: "",
      startDate: "",
      endDate: "",
      color: "",
    });
  };

  const handleSubmit = () => {
    if (!formData.title || !formData.startDate) {
      toast({ title: "제목과 시작일을 입력해주세요", variant: "destructive" });
      return;
    }

    if (editingEvent) {
      updateEventMutation.mutate({ id: editingEvent.id, data: formData });
    } else {
      createEventMutation.mutate(formData);
    }
  };

  const handleDelete = (event: CalendarEvent) => {
    if (confirm(`"${event.title}" 일정을 삭제하시겠습니까?`)) {
      deleteEventMutation.mutate(event.id);
    }
  };

  const goToPrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  const getEventTypeInfo = (type: string) => {
    return EVENT_TYPES.find((t) => t.value === type) || EVENT_TYPES[2];
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">캘린더</h1>
          <p className="text-muted-foreground">학교 시험, 학교 일정, 학원 일정을 관리합니다</p>
        </div>
        {canEdit && (
          <Button onClick={() => openCreateDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            일정 추가
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {EVENT_TYPES.map((type) => (
          <div key={type.value} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: type.defaultColor }} />
            <span className="text-sm">{type.label}</span>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={goToPrevMonth}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={goToNextMonth}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday}>
                오늘
              </Button>
            </div>
            <CardTitle className="text-xl">
              {format(currentDate, "yyyy년 M월", { locale: ko })}
            </CardTitle>
            <div className="w-[140px]" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden">
            {WEEKDAYS.map((day, idx) => (
              <div
                key={day}
                className={cn(
                  "p-2 text-center text-sm font-medium bg-background",
                  idx === 0 && "text-red-500",
                  idx === 6 && "text-blue-500"
                )}
              >
                {day}
              </div>
            ))}
            {calendarDays.map((day, idx) => {
              const dayEvents = getEventsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isToday = isSameDay(day, new Date());
              const dayOfWeek = getDay(day);

              return (
                <div
                  key={idx}
                  onClick={() => {
                    setSelectedDate(day);
                    if (canEdit && dayEvents.length === 0) {
                      openCreateDialog(day);
                    }
                  }}
                  className={cn(
                    "min-h-[100px] p-1 bg-background cursor-pointer hover:bg-muted/50 transition-colors",
                    !isCurrentMonth && "opacity-50"
                  )}
                >
                  <div
                    className={cn(
                      "text-sm font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full",
                      isToday && "bg-primary text-primary-foreground",
                      dayOfWeek === 0 && "text-red-500",
                      dayOfWeek === 6 && "text-blue-500"
                    )}
                  >
                    {format(day, "d")}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((event) => {
                      const typeInfo = getEventTypeInfo(event.eventType);
                      return (
                        <div
                          key={event.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (canEdit) {
                              openEditDialog(event);
                            }
                          }}
                          className="text-xs p-1 rounded truncate cursor-pointer hover:opacity-80"
                          style={{ backgroundColor: event.color || typeInfo.defaultColor, color: "white" }}
                        >
                          {event.title}
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-muted-foreground text-center">
                        +{dayEvents.length - 3} 더 보기
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">이번 달 일정</CardTitle>
        </CardHeader>
        <CardContent>
          {events.filter((e) => {
            const start = parseISO(e.startDate);
            return isSameMonth(start, currentDate);
          }).length === 0 ? (
            <p className="text-muted-foreground text-center py-8">이번 달 등록된 일정이 없습니다</p>
          ) : (
            <div className="space-y-2">
              {events
                .filter((e) => {
                  const start = parseISO(e.startDate);
                  return isSameMonth(start, currentDate);
                })
                .sort((a, b) => a.startDate.localeCompare(b.startDate))
                .map((event) => {
                  const typeInfo = getEventTypeInfo(event.eventType);
                  const Icon = typeInfo.icon;
                  return (
                    <div
                      key={event.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: event.color || typeInfo.defaultColor }}
                        >
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="font-medium">{event.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {format(parseISO(event.startDate), "M월 d일 (E)", { locale: ko })}
                            {event.endDate && event.endDate !== event.startDate && (
                              <> ~ {format(parseISO(event.endDate), "M월 d일 (E)", { locale: ko })}</>
                            )}
                            {event.schoolName && <> · {event.schoolName}</>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{typeInfo.label}</Badge>
                        {canEdit && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(event)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(event)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEvent ? "일정 수정" : "일정 추가"}</DialogTitle>
            <DialogDescription>
              학교 시험, 학교 일정, 학원 일정을 추가할 수 있습니다
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>일정 종류</Label>
              <Select
                value={formData.eventType}
                onValueChange={(v: "school_exam" | "school_event" | "academy_event") =>
                  setFormData({ ...formData, eventType: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: type.defaultColor }} />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>제목 *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="예: 중간고사, 체육대회"
              />
            </div>

            {(formData.eventType === "school_exam" || formData.eventType === "school_event") && (
              <div className="space-y-2">
                <Label>학교명</Label>
                <Input
                  value={formData.schoolName}
                  onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                  placeholder="예: 서울중학교"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>시작일 *</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>종료일</Label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>설명</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="일정에 대한 추가 설명"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              취소
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createEventMutation.isPending || updateEventMutation.isPending}
            >
              {(createEventMutation.isPending || updateEventMutation.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {editingEvent ? "수정" : "추가"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
