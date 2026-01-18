import { useQuery } from "@tanstack/react-query";
import { AlertCircle, BookOpen, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@shared/schema";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";

interface HomeworkReminder {
  id: string;
  title: string;
  dueDate: string;
}

export function HomeworkDueReminder() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [dismissed, setDismissed] = useState<string[]>([]);

  const isStudent = user?.role === UserRole.STUDENT;

  const { data: dueTodayHomework = [] } = useQuery<HomeworkReminder[]>({
    queryKey: ["/api/notifications/homework-reminders", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const res = await fetch(`/api/notifications/homework-reminders?studentId=${user.id}`);
      return res.json();
    },
    enabled: isStudent && !!user?.id,
    refetchInterval: 60000,
  });

  useEffect(() => {
    const savedDismissed = sessionStorage.getItem("dismissed-homework-reminders");
    if (savedDismissed) {
      setDismissed(JSON.parse(savedDismissed));
    }
  }, []);

  const handleDismiss = (homeworkId: string) => {
    const newDismissed = [...dismissed, homeworkId];
    setDismissed(newDismissed);
    sessionStorage.setItem("dismissed-homework-reminders", JSON.stringify(newDismissed));
  };

  if (!isStudent) return null;

  const pendingReminders = dueTodayHomework.filter(hw => !dismissed.includes(hw.id));

  if (pendingReminders.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {pendingReminders.map((hw) => (
        <Alert key={hw.id} variant="destructive" className="relative">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            오늘 마감 숙제
          </AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-2">
            <span className="truncate">{hw.title}</span>
            <Button 
              size="sm" 
              variant="outline" 
              className="shrink-0"
              onClick={() => navigate("/homework")}
              data-testid={`button-submit-homework-${hw.id}`}
            >
              제출하기
            </Button>
          </AlertDescription>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6"
            onClick={() => handleDismiss(hw.id)}
            data-testid={`button-dismiss-reminder-${hw.id}`}
          >
            <X className="h-4 w-4" />
          </Button>
        </Alert>
      ))}
    </div>
  );
}
