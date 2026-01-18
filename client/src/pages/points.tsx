import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Trophy, Star, CheckCircle, BookOpen, Clock } from "lucide-react";

export default function PointsPage() {
  const { user } = useAuth();

  const { data: pointsData, isLoading } = useQuery({
    queryKey: [`/api/points/my-points?actorId=${user?.id}`],
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const points = pointsData || { total: 0, history: [] };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">내 포인트</h1>
        <p className="text-muted-foreground">출결, 테스트, 숙제를 통해 적립된 포인트를 확인하세요</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 포인트</CardTitle>
            <Trophy className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{points.total?.toLocaleString() || 0} P</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">이번 달 적립</CardTitle>
            <Star className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{points.monthlyEarned?.toLocaleString() || 0} P</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">사용 가능</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{points.available?.toLocaleString() || points.total?.toLocaleString() || 0} P</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>포인트 적립 기준</CardTitle>
          <CardDescription>아래 활동을 통해 포인트가 자동으로 적립됩니다</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <div className="font-medium">출석</div>
                <div className="text-sm text-muted-foreground">수업 출석 시 10P 적립</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
              <BookOpen className="h-5 w-5 text-blue-500" />
              <div>
                <div className="font-medium">숙제 제출</div>
                <div className="text-sm text-muted-foreground">숙제 완료 시 20P, 우수 완료 시 30P 적립</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <div>
                <div className="font-medium">테스트 성적</div>
                <div className="text-sm text-muted-foreground">90점 이상 50P, 80점 이상 30P, 70점 이상 20P 적립</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>포인트 내역</CardTitle>
          <CardDescription>최근 적립 및 사용 내역</CardDescription>
        </CardHeader>
        <CardContent>
          {points.history && points.history.length > 0 ? (
            <div className="space-y-3">
              {points.history.map((item: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{item.description}</div>
                      <div className="text-sm text-muted-foreground">{item.date}</div>
                    </div>
                  </div>
                  <div className={`font-bold ${item.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {item.amount > 0 ? '+' : ''}{item.amount} P
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              아직 포인트 내역이 없습니다
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
