import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, ChevronLeft, ChevronRight, Pencil, Trash2, Loader2, Calendar as CalendarIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, invalidateQueriesStartingWith } from "@/lib/queryClient";
import { UserRole } from "@shared/schema";
import { cn } from "@/lib/utils";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isSameDay, parseISO, startOfWeek, endOfWeek, isWithinInterval, differenceInDays, addDays } from "date-fns";
import { ko } from "date-fns/locale";

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  eventType: string;
  schoolName?: string;
  startDate: string;
  endDate?: string;
  color?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

const PASTEL_COLORS = [
  { value: "#FF9AA2", label: "코랄" },
  { value: "#FFB347", label: "오렌지" },
  { value: "#FDFD96", label: "옐로우" },
  { value: "#77DD77", label: "그린" },
  { value: "#89CFF0", label: "스카이" },
  { value: "#B19CD9", label: "라벤더" },
  { value: "#FF6B6B", label: "레드" },
  { value: "#98D8C8", label: "민트" },
  { value: "#87CEEB", label: "블루" },
  { value: "#DDA0DD", label: "플럼" },
  { value: "#F0E68C", label: "카키" },
  { value: "#E6A8D7", label: "핑크" },
];

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function CalendarPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [isRangeEvent, setIsRangeEvent] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    startDate: "",
    endDate: "",
    color: PASTEL_COLORS[4].value,
  });

  const canEdit = user && user.role >= UserRole.TEACHER;

  const { data: events = [], isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/calendar-events"],
    enabled: !!user,
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", `/api/calendar-events?actorId=${user?.id}`, {
        title: data.title,
        description: data.description,
        eventType: "event",
        startDate: data.startDate,
        endDate: isRangeEvent ? data.endDate : null,
        color: data.color,
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
        title: data.title,
        description: data.description,
        eventType: "event",
        startDate: data.startDate,
        endDate: isRangeEvent ? data.endDate : null,
        color: data.color,
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

  const calendarWeeks = useMemo(() => {
    const weeks: Date[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      weeks.push(calendarDays.slice(i, i + 7));
    }
    return weeks;
  }, [calendarDays]);

  const getMultiDayEventsForWeek = (weekDays: Date[]) => {
    const weekStart = weekDays[0];
    const weekEnd = weekDays[6];
    
    return events
      .filter(event => {
        const eventStart = parseISO(event.startDate);
        const eventEnd = event.endDate ? parseISO(event.endDate) : eventStart;
        const isMultiDay = event.endDate && event.endDate !== event.startDate;
        
        if (!isMultiDay) return false;
        
        return (eventStart <= weekEnd && eventEnd >= weekStart);
      })
      .map(event => {
        const eventStart = parseISO(event.startDate);
        const eventEnd = parseISO(event.endDate!);
        
        const displayStart = eventStart < weekStart ? weekStart : eventStart;
        const displayEnd = eventEnd > weekEnd ? weekEnd : eventEnd;
        
        const startCol = weekDays.findIndex(d => isSameDay(d, displayStart));
        const endCol = weekDays.findIndex(d => isSameDay(d, displayEnd));
        
        const continuesFromPrev = eventStart < weekStart;
        const continuesToNext = eventEnd > weekEnd;
        
        return {
          ...event,
          startCol: startCol >= 0 ? startCol : 0,
          endCol: endCol >= 0 ? endCol : 6,
          span: (endCol >= 0 ? endCol : 6) - (startCol >= 0 ? startCol : 0) + 1,
          continuesFromPrev,
          continuesToNext,
        };
      })
      .sort((a, b) => a.startCol - b.startCol);
  };

  const getSingleDayEventsForDay = (date: Date) => {
    return events.filter((event) => {
      const eventStart = parseISO(event.startDate);
      const isMultiDay = event.endDate && event.endDate !== event.startDate;
      return !isMultiDay && isSameDay(date, eventStart);
    });
  };

  const openCreateDialog = (date?: Date) => {
    setEditingEvent(null);
    setIsRangeEvent(false);
    setFormData({
      title: "",
      description: "",
      startDate: date ? format(date, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      endDate: "",
      color: PASTEL_COLORS[4].value,
    });
    setShowEventDialog(true);
  };

  const openEditDialog = (event: CalendarEvent) => {
    setEditingEvent(event);
    const hasEndDate = event.endDate && event.endDate !== event.startDate;
    setIsRangeEvent(!!hasEndDate);
    setFormData({
      title: event.title,
      description: event.description || "",
      startDate: event.startDate,
      endDate: event.endDate || "",
      color: event.color || PASTEL_COLORS[4].value,
    });
    setShowEventDialog(true);
  };

  const closeDialog = () => {
    setShowEventDialog(false);
    setEditingEvent(null);
    setIsRangeEvent(false);
    setFormData({
      title: "",
      description: "",
      startDate: "",
      endDate: "",
      color: PASTEL_COLORS[4].value,
    });
  };

  const handleSubmit = () => {
    if (!formData.title || !formData.startDate) {
      toast({ title: "제목과 날짜를 입력해주세요", variant: "destructive" });
      return;
    }

    if (isRangeEvent && !formData.endDate) {
      toast({ title: "종료일을 입력해주세요", variant: "destructive" });
      return;
    }

    if (isRangeEvent && formData.endDate < formData.startDate) {
      toast({ title: "종료일은 시작일 이후여야 합니다", variant: "destructive" });
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
          <h1 className="text-2xl font-bold">학원 캘린더</h1>
          <p className="text-muted-foreground">학원 일정을 관리합니다</p>
        </div>
        {canEdit && (
          <Button onClick={() => openCreateDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            일정 추가
          </Button>
        )}
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
          <div className="border rounded-lg overflow-hidden">
            <div className="grid grid-cols-7 bg-muted">
              {WEEKDAYS.map((day, idx) => (
                <div
                  key={day}
                  className={cn(
                    "p-2 text-center text-sm font-medium border-b",
                    idx === 0 && "text-red-500",
                    idx === 6 && "text-blue-500"
                  )}
                >
                  {day}
                </div>
              ))}
            </div>
            {calendarWeeks.map((week, weekIdx) => {
              const multiDayEvents = getMultiDayEventsForWeek(week);
              
              return (
                <div key={weekIdx} className="relative">
                  <div className="grid grid-cols-7">
                    {week.map((day, dayIdx) => {
                      const singleDayEvents = getSingleDayEventsForDay(day);
                      const isCurrentMonth = isSameMonth(day, currentDate);
                      const isToday = isSameDay(day, new Date());
                      const dayOfWeek = getDay(day);

                      return (
                        <div
                          key={dayIdx}
                          onClick={() => {
                            setSelectedDate(day);
                            if (canEdit && singleDayEvents.length === 0) {
                              openCreateDialog(day);
                            }
                          }}
                          className={cn(
                            "min-h-[100px] p-1 border-b border-r cursor-pointer hover:bg-muted/50 transition-colors relative",
                            !isCurrentMonth && "bg-muted/30",
                            dayIdx === 0 && "border-l"
                          )}
                        >
                          <div
                            className={cn(
                              "text-sm font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full",
                              isToday && "bg-primary text-primary-foreground",
                              dayOfWeek === 0 && !isToday && "text-red-500",
                              dayOfWeek === 6 && !isToday && "text-blue-500"
                            )}
                          >
                            {format(day, "d")}
                          </div>
                          <div className="mt-6 space-y-1">
                            {singleDayEvents.slice(0, 2).map((event) => (
                              <div
                                key={event.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (canEdit) {
                                    openEditDialog(event);
                                  }
                                }}
                                className="text-xs p-1 rounded truncate cursor-pointer hover:opacity-80"
                                style={{ backgroundColor: event.color || PASTEL_COLORS[4].value, color: "#333" }}
                              >
                                {event.title}
                              </div>
                            ))}
                            {singleDayEvents.length > 2 && (
                              <div className="text-xs text-muted-foreground text-center">
                                +{singleDayEvents.length - 2}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="absolute top-8 left-0 right-0 pointer-events-none" style={{ zIndex: 10 }}>
                    {multiDayEvents.map((event, eventIdx) => (
                      <div
                        key={event.id}
                        className="pointer-events-auto mb-0.5"
                        style={{
                          marginLeft: `calc(${event.startCol * (100 / 7)}% + 2px)`,
                          width: `calc(${event.span * (100 / 7)}% - 4px)`,
                        }}
                      >
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            if (canEdit) {
                              openEditDialog(event);
                            }
                          }}
                          className={cn(
                            "text-xs py-1 px-2 truncate cursor-pointer hover:opacity-80",
                            event.continuesFromPrev ? "rounded-l-none" : "rounded-l",
                            event.continuesToNext ? "rounded-r-none" : "rounded-r"
                          )}
                          style={{ 
                            backgroundColor: event.color || PASTEL_COLORS[4].value, 
                            color: "#333",
                          }}
                        >
                          {!event.continuesFromPrev && event.title}
                        </div>
                      </div>
                    ))}
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
                  const isMultiDay = event.endDate && event.endDate !== event.startDate;
                  return (
                    <div
                      key={event.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: event.color || PASTEL_COLORS[4].value }}
                        >
                          <CalendarIcon className="w-5 h-5 text-gray-700" />
                        </div>
                        <div>
                          <div className="font-medium">{event.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {format(parseISO(event.startDate), "M월 d일 (E)", { locale: ko })}
                            {isMultiDay && (
                              <> ~ {format(parseISO(event.endDate!), "M월 d일 (E)", { locale: ko })}</>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
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
              학원 일정을 등록합니다
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>제목 *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="일정 제목을 입력하세요"
              />
            </div>

            <div className="space-y-2">
              <Label>일정 유형</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={!isRangeEvent ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsRangeEvent(false)}
                >
                  하루
                </Button>
                <Button
                  type="button"
                  variant={isRangeEvent ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsRangeEvent(true)}
                >
                  기간
                </Button>
              </div>
            </div>

            {!isRangeEvent ? (
              <div className="space-y-2">
                <Label>날짜 *</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
            ) : (
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
                  <Label>종료일 *</Label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>색상</Label>
              <div className="grid grid-cols-6 gap-2">
                {PASTEL_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, color: color.value })}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-all hover:scale-110",
                      formData.color === color.value ? "border-primary ring-2 ring-primary ring-offset-2" : "border-transparent"
                    )}
                    style={{ backgroundColor: color.value }}
                    title={color.label}
                  />
                ))}
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
