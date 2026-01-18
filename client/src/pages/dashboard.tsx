import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Calendar, ClipboardList, BarChart3, Users, Clock, BookOpen, AlertCircle, Check, TrendingUp, TrendingDown, ListTodo, Flame, CircleCheck, Circle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@shared/schema";
import { CompletionIndicator } from "@/components/completion-indicator";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Link } from "wouter";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { apiRequest, invalidateQueriesStartingWith } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function StatCard({ 
  icon: Icon, 
  title, 
  value, 
  description,
  variant = "default",
  href
}: { 
  icon: typeof Calendar; 
  title: string; 
  value: string | number; 
  description?: string;
  variant?: "default" | "warning" | "success";
  href?: string;
}) {
  const iconColors = {
    default: "text-primary bg-primary/10",
    warning: "text-amber-600 bg-amber-100",
    success: "text-green-600 bg-green-100",
  };

  const cardContent = (
    <Card className={`h-full ${href ? "hover-elevate cursor-pointer transition-shadow" : ""}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`p-2 rounded-md ${iconColors[variant]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" data-testid={`stat-${title}`}>{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{cardContent}</Link>;
  }
  return cardContent;
}

function StudentDashboard() {
  const { user } = useAuth();

  const { data: todayClasses, isLoading: loadingClasses } = useQuery<any[]>({
    queryKey: [`/api/students/${user?.id}/classes/today`],
    enabled: !!user?.id,
  });

  const { data: pendingHomework, isLoading: loadingHomework } = useQuery<any[]>({
    queryKey: [`/api/students/${user?.id}/homework/pending`],
    enabled: !!user?.id,
  });

  const { data: recentAssessments, isLoading: loadingAssessments } = useQuery<any[]>({
    queryKey: [`/api/students/${user?.id}/assessments/recent`],
    enabled: !!user?.id,
  });

  const today = format(new Date(), "M월 d일 EEEE", { locale: ko });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-welcome">안녕하세요, {user?.name}님</h1>
        <p className="text-muted-foreground">{today}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <StatCard
          icon={Calendar}
          title="오늘의 수업"
          value={todayClasses?.length ?? 0}
          description="예정된 수업"
          href="/my-timetable"
        />
        <StatCard
          icon={ClipboardList}
          title="숙제"
          value={pendingHomework?.length ?? 0}
          description="제출 필요"
          variant="warning"
          href="/homework"
        />
        <StatCard
          icon={BarChart3}
          title="평균 점수"
          value={recentAssessments?.length ? Math.round(recentAssessments.reduce((a, b) => a + b.score, 0) / recentAssessments.length) : "-"}
          description="최근 평가"
          href="/assessments"
        />
        <StatCard
          icon={BookOpen}
          title="수업 수"
          value={todayClasses?.length ?? 0}
          href="/my-timetable"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              오늘의 시간표
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingClasses ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : todayClasses?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>오늘은 수업이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(todayClasses ?? []).map((cls: any) => (
                  <div
                    key={cls.id}
                    className="flex items-center gap-3 p-3 rounded-md bg-muted/50"
                    data-testid={`class-${cls.id}`}
                  >
                    <div
                      className="w-1 h-12 rounded-full"
                      style={{ backgroundColor: cls.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{cls.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {cls.startTime} - {cls.endTime}
                      </p>
                    </div>
                    {cls.classType === "assessment" && (
                      <Badge variant="secondary">평가</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              숙제
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingHomework ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : pendingHomework?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ClipboardList className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>숙제가 없습니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(pendingHomework ?? []).slice(0, 5).map((hw: any) => (
                  <div
                    key={hw.id}
                    className="p-3 rounded-md bg-muted/50"
                    data-testid={`homework-${hw.id}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="font-medium break-words min-w-0 flex-1">{hw.title}</p>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {format(new Date(hw.dueDate), "M/d")}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {hw.class?.name}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface StudentTrendsData {
  currentTotal: number;
  currentYear: number;
  lastYear: number;
  hasLastYearData: boolean;
  monthlyData: Array<{
    month: number;
    year: number;
    label: string;
    count: number;
    lastYearCount: number | null;
    delta: number;
    deltaPercent: number;
  }>;
  lastUpdated: string;
}

function TeacherDashboard() {
  const { user } = useAuth();
  const isAdminOrPrincipal = !!user && user.role >= UserRole.PRINCIPAL;

  const { data: stats, isLoading } = useQuery<{
    todayClasses: number;
    pendingReviews: number;
    totalStudents: number;
    pendingAssessments: number;
  }>({
    queryKey: [`/api/teachers/${user?.id}/stats`],
    enabled: !!user?.id,
  });

  const { data: recentSubmissions } = useQuery<any[]>({
    queryKey: [`/api/teachers/${user?.id}/submissions/recent`],
    enabled: !!user?.id,
  });

  const { data: studentTrends, isLoading: loadingTrends } = useQuery<StudentTrendsData>({
    queryKey: [`/api/dashboard/student-trends?actorId=${user?.id}`],
    enabled: isAdminOrPrincipal && !!user?.id,
  });

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const { data: allTodos = [] } = useQuery<any[]>({
    queryKey: [`/api/todos?assigneeId=${user?.id}`],
    enabled: !!user?.id,
  });

  const todayTodos = useMemo(() => {
    return allTodos.filter((todo: any) => {
      const startDateStr = todo.startDate || todo.dueDate;
      const dueDateStr = todo.dueDate;
      const today = new Date(todayStr);
      const startDt = new Date(startDateStr);
      const dueDt = new Date(dueDateStr);
      
      if (todo.recurrence === "none") {
        return today >= startDt && today <= dueDt;
      }
      const anchor = todo.recurrenceAnchorDate || todo.dueDate;
      const anchorDate = new Date(anchor);
      if (today < anchorDate) return false;
      if (todo.recurrence === "weekly") {
        const diffDays = Math.floor((today.getTime() - anchorDate.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays % 7 === 0;
      }
      if (todo.recurrence === "monthly") {
        return anchorDate.getDate() === today.getDate();
      }
      return false;
    });
  }, [allTodos, todayStr]);

  const overdueTodos = useMemo(() => {
    return allTodos.filter((todo: any) => {
      if (todo.recurrence !== "none") return false;
      // Use string comparison to avoid timezone issues
      if (todo.dueDate >= todayStr) return false;
      
      const isCompleted = todo.assignees?.some((a: any) => 
        a.assigneeId === user?.id && a.completedForDate === todo.dueDate
      );
      return !isCompleted;
    });
  }, [allTodos, todayStr, user?.id]);

  const { toast } = useToast();

  const toggleCompleteMutation = useMutation({
    mutationFn: async ({ todoId, date, assigneeId, todoTitle, isUndo }: { todoId: string; date: string; assigneeId: string; todoTitle?: string; isUndo?: boolean }) => {
      return apiRequest("POST", `/api/todos/${todoId}/toggle-complete`, { date, assigneeId });
    },
    onSuccess: (_, variables) => {
      invalidateQueriesStartingWith("/api/todos");
      if (!variables.isUndo) {
        toast({
          title: "완료 상태가 변경되었습니다",
          description: variables.todoTitle ? `"${variables.todoTitle}"` : undefined,
          action: (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                toggleCompleteMutation.mutate({
                  todoId: variables.todoId,
                  date: variables.date,
                  assigneeId: variables.assigneeId,
                  isUndo: true,
                });
              }}
              data-testid="button-undo-toggle-dashboard"
            >
              실행 취소
            </Button>
          ),
        });
      } else {
        toast({ title: "취소되었습니다" });
      }
    },
  });

  const today = format(new Date(), "M월 d일 EEEE", { locale: ko });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-welcome">
          {user?.role === UserRole.PRINCIPAL ? "원장님" : "선생님"}, {user?.name}님
        </h1>
        <p className="text-muted-foreground">{today}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        {isLoading ? (
          [1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatCard
              icon={Calendar}
              title="오늘 수업"
              value={stats?.todayClasses ?? 0}
              description="진행 예정"
              href="/timetable"
            />
            <StatCard
              icon={ClipboardList}
              title="미검사 숙제"
              value={stats?.pendingReviews ?? 0}
              description="검사 대기중"
              variant="warning"
              href="/homework"
            />
            <StatCard
              icon={BarChart3}
              title="평가 대기"
              value={stats?.pendingAssessments ?? 0}
              description="점수 입력 필요"
              href="/assessments"
            />
            <StatCard
              icon={Users}
              title="학생"
              value={stats?.totalStudents ?? 0}
              description="내 수업 학생"
              variant="success"
              href="/users"
            />
          </>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ListTodo className="h-5 w-5" />
            할 일
            {overdueTodos.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                {overdueTodos.length}개 미완료
              </Badge>
            )}
          </CardTitle>
          <Link href="/todos">
            <Badge variant="outline" className="cursor-pointer">
              전체 보기
            </Badge>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {overdueTodos.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  미완료된 지난 할일
                </div>
                {overdueTodos.slice(0, 3).map((todo: any) => (
                  <div
                    key={`overdue-${todo.id}`}
                    className="flex items-center gap-3 p-2 rounded-md bg-destructive/5 border border-destructive/20"
                    data-testid={`overdue-todo-${todo.id}`}
                  >
                    <Checkbox
                      checked={todo.assignees?.some((a: any) => 
                        a.assigneeId === user?.id && a.completedForDate === todo.dueDate
                      )}
                      onCheckedChange={() => toggleCompleteMutation.mutate({
                        todoId: todo.id,
                        date: todo.dueDate,
                        assigneeId: user?.id || "",
                        todoTitle: todo.title
                      })}
                      data-testid={`checkbox-overdue-${todo.id}`}
                    />
                    {todo.priority === "urgent" ? (
                      <Flame className="h-4 w-4 text-red-600 flex-shrink-0" />
                    ) : todo.priority === "high" ? (
                      <Flame className="h-4 w-4 text-orange-500 flex-shrink-0" />
                    ) : todo.priority === "medium" ? (
                      <AlertCircle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className="flex-1 truncate">{todo.title}</span>
                    <Badge variant="destructive" className="text-xs">
                      {format(new Date(todo.dueDate), "M/d")}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
            {todayTodos.length > 0 && (
              <div className="space-y-2">
                {overdueTodos.length > 0 && (
                  <div className="text-xs font-medium text-muted-foreground">오늘의 할일</div>
                )}
                {todayTodos.slice(0, 5).map((todo: any) => {
                  const isCompleted = todo.assignees?.some((a: any) => 
                    a.assigneeId === user?.id && a.completedForDate === todayStr
                  );
                  return (
                    <div
                      key={todo.id}
                      className={`flex items-center gap-3 p-2 rounded-md ${isCompleted ? "bg-muted/30" : "bg-muted/50"}`}
                      data-testid={`todo-${todo.id}`}
                    >
                      <Checkbox
                        checked={isCompleted}
                        onCheckedChange={() => toggleCompleteMutation.mutate({
                          todoId: todo.id,
                          date: todayStr,
                          assigneeId: user?.id || "",
                          todoTitle: todo.title
                        })}
                        data-testid={`checkbox-dashboard-todo-${todo.id}`}
                      />
                      {todo.priority === "urgent" ? (
                        <Flame className="h-4 w-4 text-red-600 flex-shrink-0" />
                      ) : todo.priority === "high" ? (
                        <Flame className="h-4 w-4 text-orange-500 flex-shrink-0" />
                      ) : todo.priority === "medium" ? (
                        <AlertCircle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className={`flex-1 truncate ${isCompleted ? "line-through opacity-60" : ""}`}>{todo.title}</span>
                      {isCompleted && <CircleCheck className="h-4 w-4 text-green-500 flex-shrink-0" />}
                    </div>
                  );
                })}
              </div>
            )}
            {todayTodos.length === 0 && overdueTodos.length === 0 && (
              <div className="text-center py-4 text-muted-foreground text-sm">
                오늘의 할 일이 없습니다
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {isAdminOrPrincipal && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              월별 학생 수 추이
            </CardTitle>
            <CardDescription>
              {studentTrends?.currentYear}년 월별 학생 수{studentTrends?.hasLastYearData ? "와 전년 동기 비교" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingTrends ? (
              <div className="h-64 flex items-center justify-center">
                <Skeleton className="h-full w-full" />
              </div>
            ) : studentTrends?.monthlyData ? (
              (() => {
                const hasLastYearData = studentTrends.hasLastYearData;
                const latest = studentTrends.monthlyData.length > 0 
                  ? studentTrends.monthlyData[studentTrends.monthlyData.length - 1] 
                  : null;
                
                return (
                  <div className="space-y-4">
                    <div className="flex items-center flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(var(--primary))' }} />
                        <span className="font-medium">{studentTrends.currentYear}년 (올해)</span>
                      </div>
                      {hasLastYearData && (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(var(--muted-foreground) / 0.4)' }} />
                          <span className="font-medium">{studentTrends.lastYear}년 (작년)</span>
                        </div>
                      )}
                      {hasLastYearData && latest && (
                        <Badge 
                          variant={latest.delta >= 0 ? "default" : "secondary"} 
                          className="ml-auto"
                        >
                          {latest.delta >= 0 ? (
                            <TrendingUp className="w-3 h-3 mr-1" />
                          ) : (
                            <TrendingDown className="w-3 h-3 mr-1" />
                          )}
                          전년 대비 {latest.delta >= 0 ? "+" : ""}{latest.delta}명 
                          ({latest.delta >= 0 ? "+" : ""}{latest.deltaPercent}%)
                        </Badge>
                      )}
                    </div>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={studentTrends.monthlyData} barCategoryGap="20%">
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                          <XAxis 
                            dataKey="label" 
                            className="text-xs"
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                            axisLine={{ stroke: 'hsl(var(--border))' }}
                            tickLine={false}
                          />
                          <YAxis 
                            className="text-xs"
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                            width={40}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                            }}
                            labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600, marginBottom: 4 }}
                            formatter={(value: number, name: string) => [
                              `${value}명`,
                              name === 'count' ? `${studentTrends.currentYear}년` : `${studentTrends.lastYear}년`
                            ]}
                            cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                          />
                          {hasLastYearData && (
                            <Bar 
                              dataKey="lastYearCount" 
                              fill="hsl(var(--muted-foreground) / 0.4)" 
                              radius={[4, 4, 0, 0]}
                              name="lastYearCount"
                              maxBarSize={40}
                            />
                          )}
                          <Bar 
                            dataKey="count" 
                            fill="hsl(var(--primary))" 
                            radius={[4, 4, 0, 0]}
                            name="count"
                            maxBarSize={40}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                데이터를 불러올 수 없습니다
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            최근 숙제 제출
          </CardTitle>
          <CardDescription>검사가 필요한 숙제 제출 목록</CardDescription>
        </CardHeader>
        <CardContent>
          {!recentSubmissions?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardList className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>검사 대기중인 숙제가 없습니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentSubmissions.map((sub: any) => (
                <div
                  key={sub.id}
                  className="flex items-center gap-4 p-3 rounded-md bg-muted/50"
                  data-testid={`submission-${sub.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium">{sub.student?.name}</p>
                      <Badge variant="outline" className="text-xs">
                        {sub.status === "submitted" ? "제출됨" : sub.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {sub.homework?.title}
                    </p>
                  </div>
                  <CompletionIndicator rate={sub.completionRate || 0} size="sm" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface ChildData {
  id: string;
  name: string;
  enrolledClasses: number;
  pendingHomework: number;
  avgCompletionRate: number;
  avgScore: number;
  recentAssessments: any[];
}

function ParentDashboard() {
  const { user } = useAuth();
  const today = format(new Date(), "M월 d일 EEEE", { locale: ko });

  const { data: children, isLoading } = useQuery<ChildData[]>({
    queryKey: [`/api/parents/${user?.id}/children`],
    enabled: !!user?.id,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-welcome">안녕하세요, {user?.name}님</h1>
        <p className="text-muted-foreground">{today}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            자녀 학습 현황
          </CardTitle>
          <CardDescription>
            자녀의 학습 현황을 확인하세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : !children?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="mb-2">연결된 자녀가 없습니다</p>
              <p className="text-sm">관리자에게 자녀 연결을 요청해주세요</p>
            </div>
          ) : (
            <div className="space-y-4">
              {children.map((child) => (
                <div
                  key={child.id}
                  className="p-4 rounded-lg border bg-muted/30"
                  data-testid={`child-${child.id}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg">{child.name}</h3>
                    <Badge variant="secondary">{child.enrolledClasses}개 수업</Badge>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-orange-500/10">
                        <ClipboardList className="h-4 w-4 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">미제출 숙제</p>
                        <p className="font-semibold">{child.pendingHomework}개</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-green-500/10">
                        <Check className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">평균 완료율</p>
                        <p className="font-semibold">{child.avgCompletionRate}%</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-blue-500/10">
                        <BarChart3 className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">평균 평가점수</p>
                        <p className="font-semibold">{child.avgScore}점</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              학부모 안내
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>자녀의 숙제 제출 현황을 확인할 수 있습니다</li>
              <li>평가 점수와 학습 진도를 모니터링할 수 있습니다</li>
              <li>궁금한 사항은 담당 선생님께 문의해주세요</li>
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              주요 일정
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              예정된 평가나 특별 수업 일정이 표시됩니다
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  if (user.role >= UserRole.TEACHER) {
    return <TeacherDashboard />;
  }

  if (user.role === UserRole.PARENT) {
    return <ParentDashboard />;
  }

  return <StudentDashboard />;
}
