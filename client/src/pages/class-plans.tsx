import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Calendar, BookOpen } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, addMonths } from "date-fns";
import { ko } from "date-fns/locale";

export default function ClassPlansPage() {
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
  const currentMonthEnd = endOfMonth(addMonths(new Date(), monthOffset));

  const { data: classes, isLoading: classesLoading } = useQuery({
    queryKey: [`/api/classes?actorId=${user?.id}`],
    enabled: !!user,
  });

  const { data: weeklyPlanData } = useQuery({
    queryKey: [`/api/class-plans/weekly?actorId=${user?.id}&classId=${selectedClass}&weekStart=${format(currentWeekStart, "yyyy-MM-dd")}`],
    enabled: !!selectedClass && !!user,
  });

  const { data: monthlyPlanData } = useQuery({
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
      <div>
        <h1 className="text-2xl font-bold">수업 계획</h1>
        <p className="text-muted-foreground">주간/월간 수업 계획을 작성하고 관리합니다</p>
      </div>

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
