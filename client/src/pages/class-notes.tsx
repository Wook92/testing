import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addWeeks, subWeeks } from "date-fns";
import { ko } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Edit, Trash2, Save, X, FileText, Users, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, invalidateQueriesStartingWith } from "@/lib/queryClient";
import { UserRole, type Class, type ClassNoteWithTeacher, type StudentClassNoteWithDetails } from "@shared/schema";
import { cn } from "@/lib/utils";

function WeekSelector({ 
  currentWeek, 
  onWeekChange,
  selectedDate,
  onDateSelect
}: { 
  currentWeek: Date; 
  onWeekChange: (date: Date) => void;
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}) {
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday start
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const weekDays = ["월", "화", "수", "목", "금", "토", "일"];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onWeekChange(subWeeks(currentWeek, 1))}
          data-testid="button-prev-week"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-semibold text-sm">
          {format(weekStart, "yyyy년 M월 d일", { locale: ko })} ~ {format(weekEnd, "M월 d일", { locale: ko })}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onWeekChange(addWeeks(currentWeek, 1))}
          data-testid="button-next-week"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
          const isToday = isSameDay(day, new Date());
          const isSelected = isSameDay(day, selectedDate);

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDateSelect(day)}
              className={cn(
                "flex flex-col items-center p-2 rounded-md transition-colors",
                isSelected && "bg-primary text-primary-foreground",
                !isSelected && isToday && "bg-secondary",
                !isSelected && !isToday && "hover-elevate"
              )}
              data-testid={`date-${format(day, "yyyy-MM-dd")}`}
            >
              <span className="text-xs font-medium">{weekDays[idx]}</span>
              <span className="text-lg font-semibold">{format(day, "d")}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ClassNoteCard({ 
  note, 
  onEdit, 
  onDelete,
  canEdit
}: { 
  note: ClassNoteWithTeacher;
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean;
}) {
  return (
    <Card className="mb-3">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                <FileText className="h-3 w-3 mr-1" />
                공통 기록
              </Badge>
              {note.teacher && (
                <span className="text-xs text-muted-foreground">
                  {note.teacher.name}
                </span>
              )}
            </div>
            <p className="text-sm whitespace-pre-wrap">{note.content}</p>
          </div>
          {canEdit && (
            <div className="flex gap-1 shrink-0">
              <Button size="icon" variant="ghost" onClick={onEdit} data-testid={`button-edit-note-${note.id}`}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={onDelete} data-testid={`button-delete-note-${note.id}`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StudentNoteCard({ 
  note, 
  onEdit, 
  onDelete,
  canEdit
}: { 
  note: StudentClassNoteWithDetails;
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean;
}) {
  return (
    <Card className="mb-3">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant="outline" className="text-xs">
                <Users className="h-3 w-3 mr-1" />
                {note.student?.name || "학생"}
              </Badge>
              {note.teacher && (
                <span className="text-xs text-muted-foreground">
                  {note.teacher.name}
                </span>
              )}
            </div>
            <p className="text-sm whitespace-pre-wrap">{note.content}</p>
          </div>
          {canEdit && (
            <div className="flex gap-1 shrink-0">
              <Button size="icon" variant="ghost" onClick={onEdit} data-testid={`button-edit-student-note-${note.id}`}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={onDelete} data-testid={`button-delete-student-note-${note.id}`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function NoteEditor({ 
  isOpen, 
  onClose, 
  mode,
  noteType,
  classId,
  teacherId,
  selectedDate,
  editingNote,
  students
}: { 
  isOpen: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  noteType: "class" | "student";
  classId: string;
  teacherId: string;
  selectedDate: Date;
  editingNote?: ClassNoteWithTeacher | StudentClassNoteWithDetails | null;
  students?: any[];
}) {
  const { toast } = useToast();
  const [content, setContent] = useState(editingNote?.content || "");
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    (editingNote as StudentClassNoteWithDetails)?.studentId || ""
  );

  useEffect(() => {
    setContent(editingNote?.content || "");
    setSelectedStudentId((editingNote as StudentClassNoteWithDetails)?.studentId || "");
  }, [editingNote]);

  const createClassNoteMutation = useMutation({
    mutationFn: async (data: any) => {
      if (mode === "edit" && editingNote) {
        return apiRequest("PATCH", `/api/class-notes/${editingNote.id}`, { content: data.content });
      }
      return apiRequest("POST", "/api/class-notes", data);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/class-notes");
      toast({ title: mode === "edit" ? "기록이 수정되었습니다" : "기록이 저장되었습니다" });
      onClose();
    },
    onError: () => {
      toast({ title: "기록 저장에 실패했습니다", variant: "destructive" });
    },
  });

  const createStudentNoteMutation = useMutation({
    mutationFn: async (data: any) => {
      if (mode === "edit" && editingNote) {
        return apiRequest("PATCH", `/api/student-class-notes/${editingNote.id}`, { content: data.content });
      }
      return apiRequest("POST", "/api/student-class-notes", data);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/student-class-notes");
      toast({ title: mode === "edit" ? "기록이 수정되었습니다" : "기록이 저장되었습니다" });
      onClose();
    },
    onError: () => {
      toast({ title: "기록 저장에 실패했습니다", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!content.trim()) {
      toast({ title: "내용을 입력해주세요", variant: "destructive" });
      return;
    }

    if (noteType === "student" && mode === "create" && !selectedStudentId) {
      toast({ title: "학생을 선택해주세요", variant: "destructive" });
      return;
    }

    const noteDate = format(selectedDate, "yyyy-MM-dd");

    if (noteType === "class") {
      createClassNoteMutation.mutate({ classId, teacherId, noteDate, content });
    } else {
      createStudentNoteMutation.mutate({ classId, studentId: selectedStudentId, teacherId, noteDate, content });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {noteType === "class" ? "공통 수업 기록" : "학생별 수업 기록"}
            {mode === "edit" ? " 수정" : " 추가"}
          </DialogTitle>
          <DialogDescription>
            {format(selectedDate, "yyyy년 M월 d일 (EEEE)", { locale: ko })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {noteType === "student" && mode === "create" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">학생 선택</label>
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger data-testid="select-student">
                  <SelectValue placeholder="학생을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {students?.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.name} {student.grade ? `(${student.grade})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">내용</label>
            <Textarea
              placeholder="수업 내용을 기록하세요..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[150px]"
              data-testid="input-note-content"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel">
            취소
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={createClassNoteMutation.isPending || createStudentNoteMutation.isPending}
            data-testid="button-save-note"
          >
            <Save className="h-4 w-4 mr-1" />
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ClassNotesPage() {
  const { user, selectedCenter } = useAuth();
  const { toast } = useToast();
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<"class" | "student">("class");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editingNote, setEditingNote] = useState<ClassNoteWithTeacher | StudentClassNoteWithDetails | null>(null);

  const isTeacher = user && user.role >= UserRole.TEACHER;
  const isPrincipalOrAbove = !!(user && user.role >= UserRole.PRINCIPAL);
  const centerId = typeof selectedCenter === 'string' ? selectedCenter : selectedCenter?.id;

  // Get teachers in the center for principal/admin
  const { data: teachers = [] } = useQuery<any[]>({
    queryKey: [`/api/centers/${centerId}/teachers`],
    enabled: !!centerId && isPrincipalOrAbove,
  });

  // Set default selected teacher for principals/admins (themselves or first teacher)
  useEffect(() => {
    if (isPrincipalOrAbove && teachers.length > 0 && !selectedTeacherId) {
      // Default to the logged-in user if they are in the list, otherwise first teacher
      const selfInList = teachers.find((t: any) => t.id === user?.id);
      setSelectedTeacherId(selfInList ? selfInList.id : teachers[0].id);
    } else if (!isPrincipalOrAbove && user) {
      setSelectedTeacherId(user.id);
    }
  }, [teachers, isPrincipalOrAbove, user, selectedTeacherId]);

  // Get classes for the selected teacher
  const { data: allClasses, isLoading: classesLoading } = useQuery<Class[]>({
    queryKey: [`/api/teachers/${selectedTeacherId}/classes`],
    enabled: !!selectedTeacherId,
  });

  const classes = allClasses?.filter((c) => {
    if (!centerId) return false;
    return c.centerId === centerId;
  }) || [];

  // Set default selected class
  useEffect(() => {
    if (classes.length > 0 && !selectedClassId) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  const noteDate = format(selectedDate, "yyyy-MM-dd");

  // Fetch class notes
  const { data: classNotes, isLoading: classNotesLoading } = useQuery<ClassNoteWithTeacher[]>({
    queryKey: ["/api/class-notes", { classId: selectedClassId, noteDate }],
    queryFn: async () => {
      const res = await fetch(`/api/class-notes?classId=${selectedClassId}&noteDate=${noteDate}`);
      if (!res.ok) throw new Error("Failed to fetch class notes");
      return res.json();
    },
    enabled: !!selectedClassId,
  });

  // Fetch student class notes
  const { data: studentNotes, isLoading: studentNotesLoading } = useQuery<StudentClassNoteWithDetails[]>({
    queryKey: ["/api/student-class-notes", { classId: selectedClassId, noteDate }],
    queryFn: async () => {
      const res = await fetch(`/api/student-class-notes?classId=${selectedClassId}&noteDate=${noteDate}`);
      if (!res.ok) throw new Error("Failed to fetch student class notes");
      return res.json();
    },
    enabled: !!selectedClassId,
  });

  // Fetch students in the class
  const { data: classStudents } = useQuery<any[]>({
    queryKey: ["/api/classes", selectedClassId, "students"],
    enabled: !!selectedClassId,
  });

  const deleteClassNoteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/class-notes/${id}`),
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/class-notes");
      toast({ title: "기록이 삭제되었습니다" });
    },
    onError: () => {
      toast({ title: "삭제에 실패했습니다", variant: "destructive" });
    },
  });

  const deleteStudentNoteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/student-class-notes/${id}`),
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/student-class-notes");
      toast({ title: "기록이 삭제되었습니다" });
    },
    onError: () => {
      toast({ title: "삭제에 실패했습니다", variant: "destructive" });
    },
  });

  const handleAddNote = (type: "class" | "student") => {
    setActiveTab(type);
    setEditorMode("create");
    setEditingNote(null);
    setEditorOpen(true);
  };

  const handleEditNote = (note: ClassNoteWithTeacher | StudentClassNoteWithDetails, type: "class" | "student") => {
    setActiveTab(type);
    setEditorMode("edit");
    setEditingNote(note);
    setEditorOpen(true);
  };

  if (!user || !isTeacher) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        이 페이지는 선생님 이상만 접근할 수 있습니다.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background border-b p-4 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            수업 기록
          </h1>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Teacher selector for principal/admin */}
            {isPrincipalOrAbove && teachers.length > 0 && (
              <Select 
                value={selectedTeacherId} 
                onValueChange={(value) => {
                  setSelectedTeacherId(value);
                  setSelectedClassId(""); // Reset class when teacher changes
                }}
              >
                <SelectTrigger className="w-auto min-w-[120px]" data-testid="select-teacher">
                  <SelectValue placeholder="선생님 선택" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((teacher: any) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.name}
                      {teacher.id === user?.id ? " (나)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Class selector */}
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger className="w-auto min-w-[140px]" data-testid="select-class">
                <SelectValue placeholder="수업 선택" />
              </SelectTrigger>
              <SelectContent>
                {classes.length > 0 ? (
                  classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name} ({cls.subject})
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-1 text-sm text-muted-foreground">
                    수업이 없습니다
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Week selector */}
        <WeekSelector
          currentWeek={currentWeek}
          onWeekChange={setCurrentWeek}
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {classesLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : !selectedClassId ? (
          <div className="text-center py-8 text-muted-foreground">
            수업을 선택해주세요
          </div>
        ) : (
          <>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "class" | "student")}>
              <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
                <TabsList>
                  <TabsTrigger value="class" data-testid="tab-class-notes">
                    <FileText className="h-4 w-4 mr-1" />
                    공통 기록
                  </TabsTrigger>
                  <TabsTrigger value="student" data-testid="tab-student-notes">
                    <Users className="h-4 w-4 mr-1" />
                    학생별 기록
                  </TabsTrigger>
                </TabsList>

                <Button size="sm" onClick={() => handleAddNote(activeTab)} data-testid="button-add-note">
                  <Plus className="h-4 w-4 mr-1" />
                  기록 추가
                </Button>
              </div>

              <TabsContent value="class" className="mt-0">
                {classNotesLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : classNotes && classNotes.length > 0 ? (
                  classNotes.map((note) => (
                    <ClassNoteCard
                      key={note.id}
                      note={note}
                      onEdit={() => handleEditNote(note, "class")}
                      onDelete={() => deleteClassNoteMutation.mutate(note.id)}
                      canEdit={user.role >= UserRole.TEACHER}
                    />
                  ))
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>{format(selectedDate, "M월 d일", { locale: ko })} 공통 기록이 없습니다</p>
                      <Button
                        variant="ghost"
                        className="mt-2"
                        onClick={() => handleAddNote("class")}
                        data-testid="button-add-first-class-note"
                      >
                        기록 추가하기
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="student" className="mt-0">
                {studentNotesLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : studentNotes && studentNotes.length > 0 ? (
                  studentNotes.map((note) => (
                    <StudentNoteCard
                      key={note.id}
                      note={note}
                      onEdit={() => handleEditNote(note, "student")}
                      onDelete={() => deleteStudentNoteMutation.mutate(note.id)}
                      canEdit={user.role >= UserRole.TEACHER}
                    />
                  ))
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>{format(selectedDate, "M월 d일", { locale: ko })} 학생별 기록이 없습니다</p>
                      <Button
                        variant="ghost"
                        className="mt-2"
                        onClick={() => handleAddNote("student")}
                        data-testid="button-add-first-student-note"
                      >
                        기록 추가하기
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      {/* Note Editor Dialog */}
      <NoteEditor
        isOpen={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setEditingNote(null);
        }}
        mode={editorMode}
        noteType={activeTab}
        classId={selectedClassId}
        teacherId={selectedTeacherId}
        selectedDate={selectedDate}
        editingNote={editingNote}
        students={classStudents}
      />
    </div>
  );
}
