import { useLocation, useSearch, Link } from "wouter";
import { Home, Calendar, ClipboardList, BarChart3, Video, BookOpen, MoreHorizontal, Building2, Users, Settings, Stethoscope, UserCheck, FileText, Coffee, DollarSign, FileBarChart, GraduationCap, HelpCircle, ListTodo, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@shared/schema";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState } from "react";

const MAX_VISIBLE_ITEMS = 4;
const STUDENT_VISIBLE_ITEMS = 2;

const studentTimetableItems = [
  { title: "나의 시간표", url: "/my-timetable", icon: Calendar },
  { title: "학원 시간표", url: "/timetable", icon: Building2 },
];

const studentVideoItems = [
  { title: "수업영상", url: "/videos", icon: Video },
  { title: "교재영상", url: "/textbooks", icon: BookOpen },
];

const classManagementItems = [
  { title: "출결 관리", url: "/attendance", icon: UserCheck },
  { title: "숙제 관리", url: "/homework", icon: ClipboardList },
  { title: "수업 기록", url: "/class-notes", icon: FileText },
  { title: "평가 관리", url: "/assessments", icon: BarChart3 },
  { title: "고등클리닉", url: "/clinic?type=high", icon: Stethoscope },
  { title: "중등클리닉", url: "/clinic?type=middle", icon: Stethoscope },
  { title: "수업 영상", url: "/videos", icon: Video },
];

const classManagementUrls = classManagementItems.map(item => item.url.split("?")[0]);

const parentAllItems = [
  { title: "홈", url: "/", icon: Home },
  { title: "교육비", url: "/tuition", icon: DollarSign },
  { title: "매뉴얼", url: "/manual", icon: HelpCircle },
];

const studentAllItems = [
  { title: "홈", url: "/", icon: Home },
  { title: "숙제", url: "/homework", icon: ClipboardList },
  { title: "평가", url: "/assessments", icon: BarChart3 },
  { title: "스카", url: "/study-cafe", icon: Coffee },
  { title: "교육비", url: "/tuition", icon: DollarSign },
  { title: "매뉴얼", url: "/manual", icon: HelpCircle },
];

const teacherAllItems = [
  { title: "홈", url: "/", icon: Home },
  { title: "투두", url: "/todos", icon: ListTodo },
  { title: "시간표", url: "/timetable", icon: Calendar },
  { title: "월간보고서", url: "/student-reports", icon: FileBarChart },
  { title: "학생", url: "/users", icon: Users },
  { title: "스터디카페", url: "/study-cafe", icon: Coffee },
  { title: "교재영상", url: "/textbooks", icon: BookOpen },
  { title: "매뉴얼", url: "/manual", icon: HelpCircle },
];

const principalAllItems = [
  { title: "홈", url: "/", icon: Home },
  { title: "투두", url: "/todos", icon: ListTodo },
  { title: "경영", url: "/management", icon: TrendingUp },
  { title: "시간표", url: "/timetable", icon: Calendar },
  { title: "계정", url: "/users", icon: Users },
  { title: "월간보고서", url: "/student-reports", icon: FileBarChart },
  { title: "스터디카페", url: "/study-cafe", icon: Coffee },
  { title: "교재영상", url: "/textbooks", icon: BookOpen },
  { title: "교육비", url: "/tuition", icon: DollarSign },
  { title: "매뉴얼", url: "/manual", icon: HelpCircle },
  { title: "설정", url: "/settings", icon: Settings },
];

const adminAllItems = [
  { title: "홈", url: "/", icon: Home },
  { title: "투두", url: "/todos", icon: ListTodo },
  { title: "경영", url: "/management", icon: TrendingUp },
  { title: "시간표", url: "/timetable", icon: Calendar },
  { title: "센터", url: "/centers", icon: Building2 },
  { title: "계정", url: "/users", icon: Users },
  { title: "월간보고서", url: "/student-reports", icon: FileBarChart },
  { title: "스터디카페", url: "/study-cafe", icon: Coffee },
  { title: "교재영상", url: "/textbooks", icon: BookOpen },
  { title: "교육비", url: "/tuition", icon: DollarSign },
  { title: "매뉴얼", url: "/manual", icon: HelpCircle },
  { title: "설정", url: "/settings", icon: Settings },
];

export function MobileNav() {
  const [location, setLocation] = useLocation();
  const searchString = useSearch();
  const { user } = useAuth();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [timetableMenuOpen, setTimetableMenuOpen] = useState(false);
  const [studentVideoMenuOpen, setStudentVideoMenuOpen] = useState(false);
  const [classManagementMenuOpen, setClassManagementMenuOpen] = useState(false);
  
  const urlParams = new URLSearchParams(searchString);
  const currentClinicType = urlParams.get("type") || "middle";

  if (!user) return null;

  const isAdmin = user.role >= UserRole.ADMIN;
  const isPrincipal = user.role === UserRole.PRINCIPAL;
  const isTeacher = user.role === UserRole.TEACHER || user.role === UserRole.CLINIC_TEACHER;
  const isStaff = user.role >= UserRole.TEACHER;
  const isStudent = user.role === UserRole.STUDENT;
  const isParent = user.role === UserRole.PARENT;

  const allItems = isAdmin ? adminAllItems : isPrincipal ? principalAllItems : isTeacher ? teacherAllItems : isStudent ? studentAllItems : parentAllItems;
  
  const maxItems = isStudent ? STUDENT_VISIBLE_ITEMS : MAX_VISIBLE_ITEMS;
  const hasMoreItems = allItems.length > maxItems;
  const visibleCount = hasMoreItems ? maxItems - 1 : allItems.length;
  
  const staffVisibleCount = isStaff ? 2 : visibleCount;
  const navItems = isStaff ? allItems.slice(0, staffVisibleCount) : allItems.slice(0, visibleCount);
  const moreItems = isStaff ? allItems.slice(staffVisibleCount) : (hasMoreItems ? allItems.slice(visibleCount) : []);
  
  const isVideoActive = location === "/videos" || location === "/textbooks";
  const isMoreActive = moreItems.some(item => location === item.url);
  const isTimetableActive = location === "/my-timetable" || location === "/timetable";
  const isClassManagementActive = classManagementUrls.includes(location);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = location === item.url;
          return (
            <Link
              key={item.title}
              href={item.url}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
              data-testid={`mobile-nav-${item.url.replace("/", "") || "home"}`}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.title}</span>
            </Link>
          );
        })}
        
        {isStaff && (
          <Popover open={classManagementMenuOpen} onOpenChange={setClassManagementMenuOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                  isClassManagementActive ? "text-primary" : "text-muted-foreground"
                )}
                data-testid="mobile-nav-class-management"
              >
                <GraduationCap className="h-5 w-5" />
                <span className="text-xs font-medium">수업</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-2" align="center" side="top">
              <div className="flex flex-col gap-1">
                {classManagementItems.map((item) => {
                  const itemPath = item.url.split("?")[0];
                  const itemParams = new URLSearchParams(item.url.split("?")[1] || "");
                  const itemType = itemParams.get("type");
                  const isActive = itemType 
                    ? (location === itemPath && currentClinicType === itemType)
                    : (location === item.url);
                  return (
                    <button
                      key={item.url}
                      onClick={() => {
                        setLocation(item.url);
                        setClassManagementMenuOpen(false);
                      }}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-md text-sm hover-elevate",
                        isActive && "bg-accent"
                      )}
                      data-testid={`mobile-nav-class-${item.url.replace("/", "").replace("?", "-")}`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.title}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        )}
        
        {isStudent && (
          <Popover open={timetableMenuOpen} onOpenChange={setTimetableMenuOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                  isTimetableActive ? "text-primary" : "text-muted-foreground"
                )}
                data-testid="mobile-nav-timetable"
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
                      "flex items-center gap-2 px-3 py-2 rounded-md text-sm hover-elevate",
                      location === item.url && "bg-accent"
                    )}
                    data-testid={`mobile-nav-timetable-${item.url.replace("/", "")}`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.title}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
        
        {isStudent && (
          <Popover open={studentVideoMenuOpen} onOpenChange={setStudentVideoMenuOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                  isVideoActive ? "text-primary" : "text-muted-foreground"
                )}
                data-testid="mobile-nav-student-videos"
              >
                <Video className="h-5 w-5" />
                <span className="text-xs font-medium">영상</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-2" align="end" side="top">
              <div className="flex flex-col gap-1">
                {studentVideoItems.map((item) => (
                  <button
                    key={item.url}
                    onClick={() => {
                      setLocation(item.url);
                      setStudentVideoMenuOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md text-sm hover-elevate",
                      location === item.url && "bg-accent"
                    )}
                    data-testid={`mobile-nav-student-video-${item.url.replace("/", "")}`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.title}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
        
        {moreItems.length > 0 && (
          <Popover open={moreMenuOpen} onOpenChange={setMoreMenuOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                  isMoreActive ? "text-primary" : "text-muted-foreground"
                )}
                data-testid="mobile-nav-more"
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
                      "flex items-center gap-2 px-3 py-2 rounded-md text-sm hover-elevate",
                      location === item.url && "bg-accent"
                    )}
                    data-testid={`mobile-nav-more-${item.url.replace("/", "")}`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.title}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </nav>
  );
}
