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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, Trash2, Send, MessageSquare, Users, GraduationCap, BookOpen, Search } from "lucide-react";
import type { User, Center, Class as ClassType, Announcement } from "@shared/schema";
import { UserRole, AnnouncementTargetType } from "@shared/schema";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface AnnouncementWithCreator extends Announcement {
  creator?: User;
}

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showSmsDialog, setShowSmsDialog] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<AnnouncementWithCreator | null>(null);
  
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [targetType, setTargetType] = useState<string>(AnnouncementTargetType.STUDENTS);
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: announcements = [], isLoading: announcementsLoading } = useQuery<AnnouncementWithCreator[]>({
    queryKey: ["/api/announcements"],
    enabled: !!user,
  });

  const { data: students = [] } = useQuery<User[]>({
    queryKey: ["/api/announcements/targets/students"],
    enabled: !!user,
  });

  const { data: grades = [] } = useQuery<string[]>({
    queryKey: ["/api/announcements/targets/grades"],
    enabled: !!user,
  });

  const { data: classes = [] } = useQuery<ClassType[]>({
    queryKey: ["/api/classes"],
    enabled: !!user,
  });

  const activeClasses = classes.filter(c => !c.isArchived);

  const createMutation = useMutation({
    mutationFn: async (data: { title: string; content: string; targetType: string; targetIds: string[] }) => {
      return apiRequest("POST", "/api/announcements", {
        ...data,
        createdById: user?.id,
      });
    },
    onSuccess: () => {
      toast({ title: "공지사항이 등록되었습니다" });
      invalidateQueriesStartingWith("/api/announcements");
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "공지사항 등록 실패", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/announcements/${id}?actorId=${user?.id}`);
    },
    onSuccess: () => {
      toast({ title: "공지사항이 삭제되었습니다" });
      invalidateQueriesStartingWith("/api/announcements");
    },
    onError: (error: Error) => {
      toast({ title: "공지사항 삭제 실패", description: error.message, variant: "destructive" });
    },
  });

  const sendSmsMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/announcements/${id}/send-sms`, {
        actorId: user?.id,
      });
    },
    onSuccess: (data: any) => {
      const successCount = data.results?.filter((r: any) => r.success).length || 0;
      const totalCount = data.results?.length || 0;
      toast({ 
        title: "SMS 발송 완료", 
        description: `${successCount}/${totalCount}건 발송 성공` 
      });
      invalidateQueriesStartingWith("/api/announcements");
      setShowSmsDialog(false);
      setSelectedAnnouncement(null);
    },
    onError: (error: Error) => {
      toast({ title: "SMS 발송 실패", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setNewTitle("");
    setNewContent("");
    setTargetType(AnnouncementTargetType.STUDENTS);
    setSelectedTargetIds([]);
    setSearchQuery("");
  };

  const handleCreate = () => {
    if (!newTitle.trim() || !newContent.trim()) {
      toast({ title: "제목과 내용을 입력해주세요", variant: "destructive" });
      return;
    }
    if (selectedTargetIds.length === 0) {
      toast({ title: "대상을 선택해주세요", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      title: newTitle,
      content: newContent,
      targetType,
      targetIds: selectedTargetIds,
    });
  };

  const handleTargetToggle = (id: string) => {
    setSelectedTargetIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const getTargetLabel = (announcement: AnnouncementWithCreator) => {
    if (announcement.targetType === AnnouncementTargetType.CLASS) {
      const classNames = announcement.targetIds
        .map(id => activeClasses.find(c => c.id === id)?.name)
        .filter(Boolean)
        .join(", ");
      return `반: ${classNames || "알 수 없음"}`;
    } else if (announcement.targetType === AnnouncementTargetType.GRADE) {
      return `학년: ${announcement.targetIds.join(", ")}`;
    } else {
      const studentNames = announcement.targetIds
        .map(id => students.find(s => s.id === id)?.name)
        .filter(Boolean);
      if (studentNames.length <= 3) {
        return `학생: ${studentNames.join(", ")}`;
      }
      return `학생: ${studentNames.slice(0, 3).join(", ")} 외 ${studentNames.length - 3}명`;
    }
  };

  const filteredStudents = searchQuery.trim()
    ? students.filter(s => 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.grade && s.grade.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : students;

  if (!user || user.role < UserRole.TEACHER) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">접근 권한이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">공지사항</h1>
          <p className="text-muted-foreground">학부모에게 공지사항을 전달하세요</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            공지 작성
          </Button>
        </div>
      </div>

      {announcementsLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : announcements.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">등록된 공지사항이 없습니다</p>
            <Button className="mt-4" variant="outline" onClick={() => setShowCreateDialog(true)}>
              첫 공지사항 작성하기
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {announcements.map(announcement => (
            <Card key={announcement.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{announcement.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {announcement.creator?.name} · {format(new Date(announcement.createdAt!), "yyyy.MM.dd HH:mm", { locale: ko })}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {announcement.smsStatus === "sent" && (
                      <Badge variant="secondary" className="bg-green-100 text-green-700">발송완료</Badge>
                    )}
                    {announcement.smsStatus === "partial" && (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">일부발송</Badge>
                    )}
                    {announcement.smsStatus === "failed" && (
                      <Badge variant="secondary" className="bg-red-100 text-red-700">발송실패</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  {getTargetLabel(announcement)}
                </p>
                <p className="whitespace-pre-wrap text-sm mb-4">{announcement.content}</p>
                <div className="flex gap-2">
                  {!announcement.smsStatus && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedAnnouncement(announcement);
                        setShowSmsDialog(true);
                      }}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      SMS 발송
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (confirm("정말 삭제하시겠습니까?")) {
                        deleteMutation.mutate(announcement.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    삭제
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>공지사항 작성</DialogTitle>
            <DialogDescription>
              학부모에게 전달할 공지사항을 작성하세요
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>제목</Label>
              <Input
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="공지사항 제목"
              />
            </div>

            <div>
              <Label>내용</Label>
              <Textarea
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                placeholder="공지사항 내용을 입력하세요"
                rows={5}
              />
            </div>

            <div>
              <Label>대상 유형</Label>
              <Select value={targetType} onValueChange={val => {
                setTargetType(val);
                setSelectedTargetIds([]);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AnnouncementTargetType.STUDENTS}>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      학생 선택
                    </div>
                  </SelectItem>
                  <SelectItem value={AnnouncementTargetType.CLASS}>
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      반별
                    </div>
                  </SelectItem>
                  <SelectItem value={AnnouncementTargetType.GRADE}>
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4" />
                      학년별
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>대상 선택</Label>
              <p className="text-sm text-muted-foreground mb-2">
                {selectedTargetIds.length}명 선택됨
              </p>
              
              {targetType === AnnouncementTargetType.STUDENTS && (
                <>
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="학생 이름 또는 학년 검색"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="border rounded-lg max-h-48 overflow-y-auto p-2 space-y-1">
                    {filteredStudents.map(student => (
                      <div
                        key={student.id}
                        className="flex items-center gap-2 p-2 hover:bg-accent rounded cursor-pointer"
                        onClick={() => handleTargetToggle(student.id)}
                      >
                        <Checkbox checked={selectedTargetIds.includes(student.id)} />
                        <span>{student.name}</span>
                        {student.grade && (
                          <Badge variant="secondary" className="text-xs">{student.grade}</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {targetType === AnnouncementTargetType.CLASS && (
                <div className="border rounded-lg max-h-48 overflow-y-auto p-2 space-y-1">
                  {activeClasses.map(cls => (
                    <div
                      key={cls.id}
                      className="flex items-center gap-2 p-2 hover:bg-accent rounded cursor-pointer"
                      onClick={() => handleTargetToggle(cls.id)}
                    >
                      <Checkbox checked={selectedTargetIds.includes(cls.id)} />
                      <span>{cls.name}</span>
                      <Badge variant="secondary" className="text-xs">{cls.subject}</Badge>
                    </div>
                  ))}
                </div>
              )}

              {targetType === AnnouncementTargetType.GRADE && (
                <div className="border rounded-lg max-h-48 overflow-y-auto p-2 space-y-1">
                  {grades.map(grade => (
                    <div
                      key={grade}
                      className="flex items-center gap-2 p-2 hover:bg-accent rounded cursor-pointer"
                      onClick={() => handleTargetToggle(grade)}
                    >
                      <Checkbox checked={selectedTargetIds.includes(grade)} />
                      <span>{grade}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateDialog(false);
              resetForm();
            }}>
              취소
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              등록
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSmsDialog} onOpenChange={setShowSmsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>SMS 발송 확인</DialogTitle>
            <DialogDescription>
              선택된 학생들의 학부모에게 공지사항 알림 SMS를 발송합니다
            </DialogDescription>
          </DialogHeader>
          
          {selectedAnnouncement && (
            <div className="space-y-4">
              <div>
                <Label>공지 제목</Label>
                <p className="text-sm font-medium">{selectedAnnouncement.title}</p>
              </div>
              <div>
                <Label>발송 대상</Label>
                <p className="text-sm text-muted-foreground">
                  {getTargetLabel(selectedAnnouncement)}
                </p>
              </div>
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm font-medium mb-2">발송될 메시지 미리보기:</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  [프라임수학] 공지사항이 등록되었습니다.{"\n\n"}제목: {selectedAnnouncement.title}{"\n\n"}학원 앱에서 확인해주세요.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowSmsDialog(false);
              setSelectedAnnouncement(null);
            }}>
              취소
            </Button>
            <Button 
              onClick={() => selectedAnnouncement && sendSmsMutation.mutate(selectedAnnouncement.id)}
              disabled={sendSmsMutation.isPending}
            >
              {sendSmsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              발송
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
