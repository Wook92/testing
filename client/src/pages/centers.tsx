import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Building2, Users, BookOpen, MoreVertical, Pencil, Trash2, GraduationCap, X, MessageSquare, Eye, EyeOff, Coffee } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, invalidateQueriesStartingWith } from "@/lib/queryClient";
import { UserRole, type Center, type User, type Class } from "@shared/schema";
import { RoleBadge } from "@/components/role-badge";

function CreateCenterDialog({ onClose, editingCenter }: { onClose: () => void; editingCenter?: any }) {
  const { toast } = useToast();
  const [name, setName] = useState(editingCenter?.name || "");

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingCenter) {
        return apiRequest("PATCH", `/api/centers/${editingCenter.id}`, data);
      }
      return apiRequest("POST", "/api/centers", data);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/centers");
      toast({ title: editingCenter ? "센터가 수정되었습니다" : "센터가 생성되었습니다" });
      onClose();
    },
    onError: () => {
      toast({ title: editingCenter ? "센터 수정에 실패했습니다" : "센터 생성에 실패했습니다", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ name });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">센터명</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 강남센터"
          required
          data-testid="input-center-name"
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button type="submit" disabled={mutation.isPending} data-testid="button-save-center">
          {mutation.isPending ? (editingCenter ? "수정 중..." : "생성 중...") : (editingCenter ? "센터 수정" : "센터 생성")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function SolapiSettingsDialog({ center, onClose }: { center: any; onClose: () => void }) {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [senderNumber, setSenderNumber] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);

  const { data: credentials, isLoading } = useQuery<any>({
    queryKey: [`/api/centers/${center.id}/solapi`],
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { apiKey: string; apiSecret: string; senderNumber: string }) => {
      return apiRequest("PUT", `/api/centers/${center.id}/solapi`, data);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith(`/api/centers/${center.id}/solapi`);
      toast({ title: "SOLAPI 설정이 저장되었습니다" });
      onClose();
    },
    onError: () => {
      toast({ title: "저장에 실패했습니다", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey || !apiSecret || !senderNumber) {
      toast({ title: "모든 필드를 입력해주세요", variant: "destructive" });
      return;
    }
    saveMutation.mutate({ apiKey, apiSecret, senderNumber });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <>
          {credentials?.hasCredentials && (
            <div className="p-3 rounded-md bg-muted text-sm text-muted-foreground">
              <p>현재 설정됨: {credentials.senderNumber}</p>
              <p className="text-xs">마지막 업데이트: {credentials.updatedAt ? new Date(credentials.updatedAt).toLocaleString("ko-KR") : "-"}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="SOLAPI API Key"
                data-testid="input-solapi-api-key"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiSecret">API Secret</Label>
            <div className="relative">
              <Input
                id="apiSecret"
                type={showApiSecret ? "text" : "password"}
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="SOLAPI API Secret"
                data-testid="input-solapi-api-secret"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2"
                onClick={() => setShowApiSecret(!showApiSecret)}
              >
                {showApiSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="senderNumber">발신번호</Label>
            <Input
              id="senderNumber"
              type="tel"
              value={senderNumber}
              onChange={(e) => setSenderNumber(e.target.value)}
              placeholder="01012345678"
              data-testid="input-solapi-sender-number"
            />
            <p className="text-xs text-muted-foreground">SOLAPI에 등록된 발신번호를 입력하세요</p>
          </div>
        </>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-solapi">
          {saveMutation.isPending ? "저장 중..." : "설정 저장"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function StudyCafeSettingsDialog({ center, onClose }: { center: any; onClose: () => void }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [notice, setNotice] = useState("");

  const { data: settings, isLoading } = useQuery<any>({
    queryKey: [`/api/study-cafe/settings/${center.id}`],
  });

  const isEnabled = settings?.isEnabled ?? false;

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      return apiRequest("POST", "/api/study-cafe/settings", {
        centerId: center.id,
        isEnabled: enabled,
        notice: notice || settings?.notice,
        actorId: user?.id,
      });
    },
    onSuccess: (_, enabled) => {
      invalidateQueriesStartingWith("/api/study-cafe");
      toast({ title: enabled ? "스터디카페가 활성화되었습니다" : "스터디카페가 비활성화되었습니다" });
    },
    onError: () => {
      toast({ title: "설정 변경에 실패했습니다", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">로딩 중...</div>
      ) : (
        <>
          <div className="flex items-center justify-between p-4 rounded-md bg-muted/50">
            <div className="flex items-center gap-3">
              <Coffee className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">스터디카페</p>
                <p className="text-sm text-muted-foreground">
                  {isEnabled ? "이 센터에서 스터디카페를 이용할 수 있습니다" : "스터디카페가 비활성화되어 있습니다"}
                </p>
              </div>
            </div>
            <Button
              variant={isEnabled ? "destructive" : "default"}
              onClick={() => toggleMutation.mutate(!isEnabled)}
              disabled={toggleMutation.isPending}
              data-testid="button-toggle-study-cafe"
            >
              {isEnabled ? "비활성화" : "활성화"}
            </Button>
          </div>

          {isEnabled && (
            <div className="space-y-2">
              <Label htmlFor="notice">공지사항</Label>
              <Input
                id="notice"
                value={notice || settings?.notice || ""}
                onChange={(e) => setNotice(e.target.value)}
                placeholder="스터디카페 이용 안내 (선택사항)"
                data-testid="input-study-cafe-notice"
              />
            </div>
          )}
        </>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          닫기
        </Button>
      </DialogFooter>
    </div>
  );
}

function CenterDetailsDialog({ 
  center, 
  type, 
  onClose 
}: { 
  center: any; 
  type: "students" | "teachers" | "classes"; 
  onClose: () => void;
}) {
  const { data: students } = useQuery<User[]>({
    queryKey: ["/api/centers", center.id, "students"],
    enabled: type === "students",
  });

  const { data: teachers } = useQuery<User[]>({
    queryKey: ["/api/centers", center.id, "teachers"],
    enabled: type === "teachers",
  });

  const { data: classes } = useQuery<Class[]>({
    queryKey: [`/api/classes?centerId=${center.id}`],
    enabled: type === "classes",
  });

  const titles = {
    students: `${center.name} - 학생 목록`,
    teachers: `${center.name} - 선생님 목록`,
    classes: `${center.name} - 수업 목록`,
  };

  const renderStudents = () => (
    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      {students?.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">등록된 학생이 없습니다</p>
      ) : (
        students?.map((student) => (
          <div key={student.id} className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
            <Avatar>
              <AvatarFallback>{student.name.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-medium">{student.name}</p>
              <p className="text-sm text-muted-foreground">{student.phone || student.username}</p>
            </div>
            <RoleBadge role={student.role} size="sm" />
          </div>
        ))
      )}
    </div>
  );

  const renderTeachers = () => (
    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      {teachers?.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">등록된 선생님이 없습니다</p>
      ) : (
        teachers?.map((teacher) => (
          <div key={teacher.id} className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
            <Avatar>
              <AvatarFallback>{teacher.name.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-medium">{teacher.name}</p>
              <p className="text-sm text-muted-foreground">{teacher.phone || teacher.username}</p>
            </div>
            <RoleBadge role={teacher.role} size="sm" />
          </div>
        ))
      )}
    </div>
  );

  const renderClasses = () => (
    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      {classes?.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">등록된 수업이 없습니다</p>
      ) : (
        classes?.map((cls) => (
          <div key={cls.id} className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: cls.color }}
            />
            <div className="flex-1">
              <p className="font-medium">{cls.name}</p>
              <p className="text-sm text-muted-foreground">{cls.subject} · {cls.startTime}-{cls.endTime}</p>
            </div>
            <Badge variant="outline">{cls.classType === "regular" ? "정규" : "평가"}</Badge>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {type === "students" && renderStudents()}
      {type === "teachers" && renderTeachers()}
      {type === "classes" && renderClasses()}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          닫기
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function CentersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCenter, setEditingCenter] = useState<any>(null);
  const [detailsDialog, setDetailsDialog] = useState<{ center: any; type: "students" | "teachers" | "classes" } | null>(null);
  const [solapiCenter, setSolapiCenter] = useState<any>(null);
  const [studyCafeCenter, setStudyCafeCenter] = useState<any>(null);

  const isPrincipal = user?.role === UserRole.PRINCIPAL;

  const { data: centers, isLoading } = useQuery<any[]>({
    queryKey: [`/api/centers/stats`],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/centers/${id}`);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/centers");
      toast({ title: "센터가 삭제되었습니다" });
    },
    onError: () => {
      toast({ title: "삭제에 실패했습니다", variant: "destructive" });
    },
  });

  if (!isPrincipal) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>접근 권한이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">센터 관리</h1>
          <p className="text-muted-foreground">학원 센터 생성 및 관리</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-center">
              <Plus className="h-4 w-4 mr-2" />
              센터 생성
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>새 센터 생성</DialogTitle>
              <DialogDescription>센터 정보를 입력해주세요</DialogDescription>
            </DialogHeader>
            <CreateCenterDialog onClose={() => setIsCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : centers?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>등록된 센터가 없습니다</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {centers?.map((center) => (
            <Card key={center.id} data-testid={`center-${center.id}`}>
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-primary/10">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{center.name}</CardTitle>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" data-testid={`button-menu-${center.id}`}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                      onClick={() => setEditingCenter(center)}
                      data-testid={`button-edit-${center.id}`}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      수정
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setSolapiCenter(center)}
                      data-testid={`button-solapi-${center.id}`}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      SOLAPI 설정
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setStudyCafeCenter(center)}
                      data-testid={`button-study-cafe-${center.id}`}
                    >
                      <Coffee className="h-4 w-4 mr-2" />
                      스터디카페 설정
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => deleteMutation.mutate(center.id)}
                      data-testid={`button-delete-${center.id}`}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      삭제
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <button
                    onClick={() => setDetailsDialog({ center, type: "students" })}
                    className="p-3 rounded-md bg-muted hover-elevate"
                    data-testid={`button-students-${center.id}`}
                  >
                    <GraduationCap className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-2xl font-bold">{center.studentCount ?? 0}</p>
                    <p className="text-xs text-muted-foreground">학생</p>
                  </button>
                  <button
                    onClick={() => setDetailsDialog({ center, type: "teachers" })}
                    className="p-3 rounded-md bg-muted hover-elevate"
                    data-testid={`button-teachers-${center.id}`}
                  >
                    <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-2xl font-bold">{center.teacherCount ?? 0}</p>
                    <p className="text-xs text-muted-foreground">선생님</p>
                  </button>
                  <button
                    onClick={() => setDetailsDialog({ center, type: "classes" })}
                    className="p-3 rounded-md bg-muted hover-elevate"
                    data-testid={`button-classes-${center.id}`}
                  >
                    <BookOpen className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-2xl font-bold">{center.classCount ?? 0}</p>
                    <p className="text-xs text-muted-foreground">수업</p>
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editingCenter} onOpenChange={(open) => !open && setEditingCenter(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>센터 수정</DialogTitle>
            <DialogDescription>센터 정보를 수정하세요</DialogDescription>
          </DialogHeader>
          {editingCenter && (
            <CreateCenterDialog 
              editingCenter={editingCenter} 
              onClose={() => setEditingCenter(null)} 
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailsDialog} onOpenChange={(open) => !open && setDetailsDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {detailsDialog?.center.name} - {detailsDialog?.type === "students" ? "학생 목록" : detailsDialog?.type === "teachers" ? "선생님 목록" : "수업 목록"}
            </DialogTitle>
          </DialogHeader>
          {detailsDialog && (
            <CenterDetailsDialog 
              center={detailsDialog.center} 
              type={detailsDialog.type} 
              onClose={() => setDetailsDialog(null)} 
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!solapiCenter} onOpenChange={(open) => !open && setSolapiCenter(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{solapiCenter?.name} - SOLAPI 설정</DialogTitle>
            <DialogDescription>SMS/카카오톡 알림 발송을 위한 SOLAPI 설정</DialogDescription>
          </DialogHeader>
          {solapiCenter && (
            <SolapiSettingsDialog 
              center={solapiCenter} 
              onClose={() => setSolapiCenter(null)} 
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!studyCafeCenter} onOpenChange={(open) => !open && setStudyCafeCenter(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{studyCafeCenter?.name} - 스터디카페 설정</DialogTitle>
            <DialogDescription>스터디카페 활성화 및 공지사항 관리</DialogDescription>
          </DialogHeader>
          {studyCafeCenter && (
            <StudyCafeSettingsDialog 
              center={studyCafeCenter} 
              onClose={() => setStudyCafeCenter(null)} 
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
