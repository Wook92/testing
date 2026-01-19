import { Switch, Route, Link, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { UserRole } from "@shared/schema";
import { ThemeProvider } from "@/lib/theme-provider";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileNav } from "@/components/mobile-nav";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import TimetablePage from "@/pages/timetable";
import MyTimetablePage from "@/pages/my-timetable";
import HomeworkPage from "@/pages/homework";
import AssessmentsPage from "@/pages/assessments";
import UsersPage from "@/pages/users";
import SettingsPage from "@/pages/settings";
import AttendancePage from "@/pages/attendance";
import AttendancePadPage from "@/pages/attendance-pad";
import ClassNotesPage from "@/pages/class-notes";
import StudentReportsPage from "@/pages/student-reports";
import ManualPage from "@/pages/manual";
import TodosPage from "@/pages/todos";
import PointsPage from "@/pages/points";
import PointsManagementPage from "@/pages/points-management";
import AnnouncementsPage from "@/pages/announcements";
import CalendarPage from "@/pages/calendar";
import { Loader2, User, Settings, LogOut, Download, Smartphone, Coins } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PWAInstallProvider, usePWAInstall } from "@/lib/pwa-install";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { NotificationBell } from "@/components/notification-bell";
import { HomeworkDueReminder } from "@/components/homework-due-reminder";

function ProtectedRoutes() {
  const { user, isLoading, logout } = useAuth();
  const { canInstall, isInstalled, promptInstall, isIOS, showIOSInstructions, setShowIOSInstructions } = usePWAInstall();
  
  const isStudent = user?.role === UserRole.STUDENT;
  
  const { data: pointsData } = useQuery<{ total: number; available: number }>({
    queryKey: [`/api/points/my-points?actorId=${user?.id}`],
    enabled: isStudent && !!user,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  // Kiosk users should only access the attendance pad
  if (user.role === UserRole.KIOSK) {
    return <Redirect to="/attendance-pad" />;
  }

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <div className="hidden md:block">
          <AppSidebar />
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <header className="sticky top-0 z-40 flex items-center justify-between gap-2 p-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="hidden md:flex" data-testid="button-sidebar-toggle" />
              <Link href="/" className="md:hidden">
                <img src="/logo.png" alt="학원 로고" className="h-8 w-auto" data-testid="link-logo-home" />
              </Link>
            </div>
            <div className="flex items-center gap-2">
              {isStudent && pointsData && (
                <div className="flex items-center gap-1 text-muted-foreground md:hidden">
                  <Coins className="h-4 w-4 text-amber-600" />
                  <span className="text-xs font-medium">{pointsData.available?.toLocaleString() ?? 0}P</span>
                </div>
              )}
              <NotificationBell />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" data-testid="button-user-menu">
                    <User className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="end">
                  <div className="flex flex-col gap-1">
                    <Link href="/settings">
                      <button className="flex items-center gap-2 px-3 py-2 rounded-md text-sm w-full hover-elevate">
                        <Settings className="h-4 w-4" />
                        설정
                      </button>
                    </Link>
                    {!isInstalled && (
                      <button
                        onClick={promptInstall}
                        className="flex items-center gap-2 px-3 py-2 rounded-md text-sm w-full hover-elevate text-primary"
                        data-testid="button-install-app"
                      >
                        <Smartphone className="h-4 w-4" />
                        홈 화면에 추가
                      </button>
                    )}
                    {isInstalled && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground">
                        <Download className="h-4 w-4" />
                        앱 설치됨
                      </div>
                    )}
                    <button
                      onClick={logout}
                      className="flex items-center gap-2 px-3 py-2 rounded-md text-sm w-full hover-elevate text-destructive"
                      data-testid="button-logout-mobile"
                    >
                      <LogOut className="h-4 w-4" />
                      로그아웃
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6 pb-20 md:pb-6">
            <HomeworkDueReminder />
            <Switch>
              <Route path="/" component={DashboardPage} />
              <Route path="/timetable" component={TimetablePage} />
              <Route path="/my-timetable" component={MyTimetablePage} />
              <Route path="/homework" component={HomeworkPage} />
              <Route path="/assessments" component={AssessmentsPage} />
              <Route path="/users" component={UsersPage} />
              <Route path="/attendance" component={AttendancePage} />
              <Route path="/class-notes" component={ClassNotesPage} />
              <Route path="/student-reports" component={StudentReportsPage} />
              <Route path="/todos" component={TodosPage} />
              <Route path="/manual" component={ManualPage} />
              <Route path="/points" component={PointsPage} />
              <Route path="/points-management" component={PointsManagementPage} />
              <Route path="/announcements" component={AnnouncementsPage} />
              <Route path="/calendar" component={CalendarPage} />
              <Route path="/settings" component={SettingsPage} />
              <Route component={NotFound} />
            </Switch>
          </main>
          <MobileNav />
        </div>
      </div>
      
      <Dialog open={showIOSInstructions} onOpenChange={setShowIOSInstructions}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>홈 화면에 추가하기</DialogTitle>
            <DialogDescription>
              아래 안내에 따라 홈 화면에 앱을 추가해주세요
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border p-4 bg-muted">
              <h4 className="font-medium mb-2">iPhone / iPad (Safari)</h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>하단의 공유 버튼 (□↑) 누르기</li>
                <li>"홈 화면에 추가" 선택</li>
                <li>"추가" 버튼 누르기</li>
              </ol>
            </div>
            <div className="rounded-md border p-4 bg-muted">
              <h4 className="font-medium mb-2">Android (Chrome)</h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>우측 상단 메뉴 (⋮) 누르기</li>
                <li>"홈 화면에 추가" 또는 "앱 설치" 선택</li>
                <li>"추가" 또는 "설치" 버튼 누르기</li>
              </ol>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <PWAInstallProvider>
            <TooltipProvider>
              <Switch>
                <Route path="/attendance-pad" component={AttendancePadPage} />
                <Route component={ProtectedRoutes} />
              </Switch>
              <Toaster />
            </TooltipProvider>
          </PWAInstallProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
