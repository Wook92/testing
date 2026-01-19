import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Minus, Gift, Search, CheckCircle, BookOpen, Trophy, Info } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { apiRequest } from "@/lib/queryClient";

export default function PointsManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [pointAmount, setPointAmount] = useState("");
  const [pointReason, setPointReason] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isUseDialogOpen, setIsUseDialogOpen] = useState(false);

  const { data: students, isLoading } = useQuery({
    queryKey: [`/api/students/with-points?actorId=${user?.id}`],
    enabled: !!user,
  });

  const addPointsMutation = useMutation({
    mutationFn: async (data: { studentId: string; amount: number; reason: string }) => {
      return apiRequest("POST", `/api/points/add?actorId=${user?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/students/with-points?actorId=${user?.id}`] });
      toast({ title: "포인트 지급 완료", description: "포인트가 성공적으로 지급되었습니다." });
      setIsAddDialogOpen(false);
      setSelectedStudent(null);
      setPointAmount("");
      setPointReason("");
    },
    onError: () => {
      toast({ title: "오류", description: "포인트 지급 중 오류가 발생했습니다.", variant: "destructive" });
    },
  });

  const usePointsMutation = useMutation({
    mutationFn: async (data: { studentId: string; amount: number; reason: string }) => {
      return apiRequest("POST", `/api/points/use?actorId=${user?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/students/with-points?actorId=${user?.id}`] });
      toast({ title: "포인트 사용 완료", description: "포인트가 성공적으로 차감되었습니다." });
      setIsUseDialogOpen(false);
      setSelectedStudent(null);
      setPointAmount("");
      setPointReason("");
    },
    onError: () => {
      toast({ title: "오류", description: "포인트 사용 중 오류가 발생했습니다.", variant: "destructive" });
    },
  });

  const handleAddPoints = () => {
    if (!selectedStudent || !pointAmount || !pointReason) return;
    addPointsMutation.mutate({
      studentId: selectedStudent.id,
      amount: parseInt(pointAmount),
      reason: pointReason,
    });
  };

  const handleUsePoints = () => {
    if (!selectedStudent || !pointAmount || !pointReason) return;
    usePointsMutation.mutate({
      studentId: selectedStudent.id,
      amount: parseInt(pointAmount),
      reason: pointReason,
    });
  };

  const filteredStudents = students?.filter((s: any) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.phone?.includes(searchTerm)
  ) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">포인트 관리</h1>
          <p className="text-muted-foreground">학생들의 포인트를 관리하고 지급/사용 처리를 합니다</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="학생 이름 또는 전화번호 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-500" />
            <CardTitle className="text-base">포인트 적립 기준</CardTitle>
          </div>
          <CardDescription>학생들에게 아래 기준으로 포인트가 적립됩니다</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
              <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
              <div>
                <div className="font-medium text-sm">출석</div>
                <div className="text-xs text-muted-foreground">수업 출석 시 10P</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
              <BookOpen className="h-5 w-5 text-blue-500 shrink-0" />
              <div>
                <div className="font-medium text-sm">숙제 제출</div>
                <div className="text-xs text-muted-foreground">완료 20P, 우수 완료 30P</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
              <Trophy className="h-5 w-5 text-yellow-500 shrink-0" />
              <div>
                <div className="font-medium text-sm">테스트 성적</div>
                <div className="text-xs text-muted-foreground">90점↑ 50P, 80점↑ 30P, 70점↑ 20P</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>학생 포인트 현황</CardTitle>
          <CardDescription>각 학생의 현재 포인트와 관리 기능</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead>학년</TableHead>
                <TableHead>총 포인트</TableHead>
                <TableHead>이번 달 적립</TableHead>
                <TableHead className="text-right">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student: any) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">{student.name}</TableCell>
                    <TableCell>{student.grade || "-"}</TableCell>
                    <TableCell className="font-bold text-primary">
                      {(student.points || 0).toLocaleString()} P
                    </TableCell>
                    <TableCell>{(student.monthlyPoints || 0).toLocaleString()} P</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Dialog open={isAddDialogOpen && selectedStudent?.id === student.id} onOpenChange={(open) => {
                          setIsAddDialogOpen(open);
                          if (open) setSelectedStudent(student);
                        }}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              <Plus className="h-4 w-4 mr-1" />
                              지급
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>포인트 지급</DialogTitle>
                              <DialogDescription>{student.name} 학생에게 포인트를 지급합니다</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label>포인트</Label>
                                <Input
                                  type="number"
                                  placeholder="지급할 포인트"
                                  value={pointAmount}
                                  onChange={(e) => setPointAmount(e.target.value)}
                                />
                              </div>
                              <div>
                                <Label>지급 사유</Label>
                                <Textarea
                                  placeholder="포인트 지급 사유를 입력하세요"
                                  value={pointReason}
                                  onChange={(e) => setPointReason(e.target.value)}
                                />
                              </div>
                              <Button onClick={handleAddPoints} disabled={addPointsMutation.isPending} className="w-full">
                                {addPointsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "지급하기"}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>

                        <Dialog open={isUseDialogOpen && selectedStudent?.id === student.id} onOpenChange={(open) => {
                          setIsUseDialogOpen(open);
                          if (open) setSelectedStudent(student);
                        }}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              <Gift className="h-4 w-4 mr-1" />
                              사용
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>포인트 사용</DialogTitle>
                              <DialogDescription>{student.name} 학생의 포인트를 사용합니다 (현재: {(student.points || 0).toLocaleString()}P)</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label>사용 포인트</Label>
                                <Input
                                  type="number"
                                  placeholder="사용할 포인트"
                                  value={pointAmount}
                                  onChange={(e) => setPointAmount(e.target.value)}
                                  max={student.points || 0}
                                />
                              </div>
                              <div>
                                <Label>사용 사유</Label>
                                <Textarea
                                  placeholder="포인트 사용 사유를 입력하세요"
                                  value={pointReason}
                                  onChange={(e) => setPointReason(e.target.value)}
                                />
                              </div>
                              <Button onClick={handleUsePoints} disabled={usePointsMutation.isPending} className="w-full">
                                {usePointsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "사용하기"}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    학생 데이터가 없습니다
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
