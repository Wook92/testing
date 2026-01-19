import { useLocation, Link } from "wouter";
import { 
  Home, 
  Calendar, 
  CalendarDays,
  ClipboardList, 
  BarChart3, 
  MoreHorizontal, 
  Users, 
  Settings, 
  UserCheck, 
  FileText, 
  FileBarChart, 
  HelpCircle, 
  ListTodo, 
  TrendingUp, 
  BookOpen, 
  Coins, 
  MessageSquare,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@shared/schema";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState } from "react";

const classManagementItems = [
  { title: "출결 관리", url: "/attendance", icon: UserCheck },
  { title: "숙제 관리", url: "/homework", icon: ClipboardList },
  { title: "수업 기록", url: "/class-notes", icon: FileText },
  { title: "평가 관리", url: "/assessments", icon: BarChart3 },
];

const parentManagementItems = [
  { title: "문자 안내", url: "/student-reports", icon: FileBarChart },
  { title: "공지사항", url: "/announcements", icon: MessageSquare },
];

const studentTimetableItems = [
  { title: "나의 시간표", url: "/my-timetable", icon: Calendar },
  { title: "학원 시간표", url: "/timetable", icon: Calendar },
];

const studentClassItems = [
  { title: "숙제", url: "/homework", icon: ClipboardList },
  { title: "평가", url: "/assessments", icon: BarChart3 },
];

const studentMoreItems = [
  { title: "학원 캘린더", url: "/calendar", icon: CalendarDays },
  { title: "공지사항", url: "/announcements", icon: MessageSquare },
  { title: "포인트", url: "/points", icon: Coins },
  { title: "매뉴얼", url: "/manual", icon: HelpCircle },
];

const teacherMoreItems = [
  { title: "학원 캘린더", url: "/calendar", icon: CalendarDays },
  { title: "학생 관리", url: "/users", icon: Users },
  { title: "포인트 관리", url: "/points-management", icon: Coins },
  { title: "매뉴얼", url: "/manual", icon: HelpCircle },
];

const principalMoreItems = [
  { title: "학원 캘린더", url: "/calendar", icon: CalendarDays },
  { title: "사용자 관리", url: "/users", icon: Users },
  { title: "포인트 관리", url: "/points-management", icon: Coins },
  { title: "경영", url: "/management", icon: TrendingUp },
  { title: "설정", url: "/settings", icon: Settings },
  { title: "매뉴얼", url: "/manual", icon: HelpCircle },
];

const classManagementUrls = classManagementItems.map(item => item.url);
const parentManagementUrls = parentManagementItems.map(item => item.url);
const studentClassUrls = studentClassItems.map(item => item.url);
const studentMoreUrls = studentMoreItems.map(item => item.url);
const teacherMoreUrls = teacherMoreItems.map(item => item.url);
const principalMoreUrls = principalMoreItems.map(item => item.url);

export function MobileNav() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [timetableMenuOpen, setTimetableMenuOpen] = useState(false);
  const [classManagementMenuOpen, setClassManagementMenuOpen] = useState(false);
  const [parentManagementMenuOpen, setParentManagementMenuOpen] = useState(false);
  const [studentClassMenuOpen, setStudentClassMenuOpen] = useState(false);
  const [studentMoreMenuOpen, setStudentMoreMenuOpen] = useState(false);

  if (!user) return null;

  const isPrincipal = user.role >= UserRole.PRINCIPAL;
  const isTeacher = user.role === UserRole.TEACHER;
  const isStaff = user.role >= UserRole.TEACHER;
  const isStudent = user.role === UserRole.STUDENT;
  const isParent = user.role === UserRole.PARENT;
  const isKiosk = user.role === UserRole.KIOSK;

  if (isKiosk) return null;

  const isTimetableActive = location === "/my-timetable" || location === "/timetable";
  const isClassManagementActive = classManagementUrls.includes(location);
  const isParentManagementActive = parentManagementUrls.includes(location);
  const isStudentClassActive = studentClassUrls.includes(location);
  const isStudentMoreActive = studentMoreUrls.includes(location);
  const isTeacherMoreActive = teacherMoreUrls.includes(location);
  const isPrincipalMoreActive = principalMoreUrls.includes(location);

  if (isParent) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
        <div className="flex items-center justify-around h-16">
          <Link
            href="/"
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
              location === "/" ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Home className="h-5 w-5" />
            <span className="text-xs font-medium">홈</span>
          </Link>
          <Link
            href="/manual"
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
              location === "/manual" ? "text-primary" : "text-muted-foreground"
            )}
          >
            <HelpCircle className="h-5 w-5" />
            <span className="text-xs font-medium">매뉴얼</span>
          </Link>
        </div>
      </nav>
    );
  }

  if (isStudent) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
        <div className="flex items-center justify-around h-16">
          <Link
            href="/"
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
              location === "/" ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Home className="h-5 w-5" />
            <span className="text-xs font-medium">홈</span>
          </Link>
          
          <Popover open={timetableMenuOpen} onOpenChange={setTimetableMenuOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                  isTimetableActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Calendar className="h-5 w-5" />
                <span className="text-xs font-medium">시간표</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-2" align="center" side="top">
              <div className="flex flex-col gap-1">
                {studentTimetableItems.map((item) => (
                  <button
                    key={item.url}
                    onClick={() => {
                      setLocation(item.url);
                      setTimetableMenuOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent",
                      location === item.url && "bg-accent"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.title}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          
          <Popover open={studentClassMenuOpen} onOpenChange={setStudentClassMenuOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                  isStudentClassActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <BookOpen className="h-5 w-5" />
                <span className="text-xs font-medium">수업</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-2" align="center" side="top">
              <div className="flex flex-col gap-1">
                {studentClassItems.map((item) => (
                  <button
                    key={item.url}
                    onClick={() => {
                      setLocation(item.url);
                      setStudentClassMenuOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent",
                      location === item.url && "bg-accent"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.title}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          
          <Popover open={studentMoreMenuOpen} onOpenChange={setStudentMoreMenuOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                  isStudentMoreActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <MoreHorizontal className="h-5 w-5" />
                <span className="text-xs font-medium">더보기</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-2" align="end" side="top">
              <div className="flex flex-col gap-1">
                {studentMoreItems.map((item) => (
                  <button
                    key={item.url}
                    onClick={() => {
                      setLocation(item.url);
                      setStudentMoreMenuOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent",
                      location === item.url && "bg-accent"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.title}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </nav>
    );
  }

  const moreItems = isPrincipal ? principalMoreItems : teacherMoreItems;
  const isMoreActive = isPrincipal ? isPrincipalMoreActive : isTeacherMoreActive;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
      <div className="flex items-center justify-around h-16">
        <Link
          href="/"
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
            location === "/" ? "text-primary" : "text-muted-foreground"
          )}
        >
          <Home className="h-5 w-5" />
          <span className="text-xs font-medium">홈</span>
        </Link>
        
        <Link
          href="/todos"
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
            location === "/todos" ? "text-primary" : "text-muted-foreground"
          )}
        >
          <ListTodo className="h-5 w-5" />
          <span className="text-xs font-medium">투두</span>
        </Link>
        
        <Link
          href="/timetable"
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
            location === "/timetable" ? "text-primary" : "text-muted-foreground"
          )}
        >
          <Calendar className="h-5 w-5" />
          <span className="text-xs font-medium">시간표</span>
        </Link>
        
        <Popover open={classManagementMenuOpen} onOpenChange={setClassManagementMenuOpen}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                isClassManagementActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <BookOpen className="h-5 w-5" />
              <span className="text-xs font-medium">수업</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-44 p-2" align="center" side="top">
            <div className="flex flex-col gap-1">
              {classManagementItems.map((item) => (
                <button
                  key={item.url}
                  onClick={() => {
                    setLocation(item.url);
                    setClassManagementMenuOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent",
                    location === item.url && "bg-accent"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.title}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        
        <Popover open={parentManagementMenuOpen} onOpenChange={setParentManagementMenuOpen}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                isParentManagementActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <MessageSquare className="h-5 w-5" />
              <span className="text-xs font-medium">학부모</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-44 p-2" align="center" side="top">
            <div className="flex flex-col gap-1">
              {parentManagementItems.map((item) => (
                <button
                  key={item.url}
                  onClick={() => {
                    setLocation(item.url);
                    setParentManagementMenuOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent",
                    location === item.url && "bg-accent"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.title}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        
        <Popover open={moreMenuOpen} onOpenChange={setMoreMenuOpen}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                isMoreActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-xs font-medium">더보기</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-44 p-2" align="end" side="top">
            <div className="flex flex-col gap-1">
              {moreItems.map((item) => (
                <button
                  key={item.url}
                  onClick={() => {
                    setLocation(item.url);
                    setMoreMenuOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent",
                    location === item.url && "bg-accent"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.title}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </nav>
  );
}
