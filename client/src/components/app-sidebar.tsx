import { useState } from "react";
import { useLocation, Link } from "wouter";
import {
  Home,
  Calendar,
  ClipboardList,
  BarChart3,
  BookOpen,
  Users,
  Settings,
  LogOut,
  UserCheck,
  FileText,
  ChevronDown,
  GraduationCap,
  FileBarChart,
  HelpCircle,
  ListTodo,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/role-badge";
import { CenterSelector } from "@/components/center-selector";
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@shared/schema";

const classManagementItems = [
  { title: "출결 관리", url: "/attendance", icon: UserCheck },
  { title: "숙제 관리", url: "/homework", icon: ClipboardList },
  { title: "수업 기록", url: "/class-notes", icon: FileText },
  { title: "평가 관리", url: "/assessments", icon: BarChart3 },
];

const classManagementUrls = classManagementItems.map(item => item.url);

const kioskMenuItems = [
  { title: "출결패드", url: "/attendance-pad", icon: UserCheck },
];

const parentMenuItems = [
  { title: "홈", url: "/", icon: Home },
  { title: "매뉴얼", url: "/manual", icon: HelpCircle },
];

const studentMenuItems = [
  { title: "홈", url: "/", icon: Home },
  { title: "나의 시간표", url: "/my-timetable", icon: Calendar },
  { title: "학원 시간표", url: "/timetable", icon: Calendar },
  { title: "숙제", url: "/homework", icon: ClipboardList },
  { title: "평가", url: "/assessments", icon: BarChart3 },
  { title: "포인트", url: "/points", icon: GraduationCap },
  { title: "매뉴얼", url: "/manual", icon: HelpCircle },
];

const teacherMenuItems = [
  { title: "대시보드", url: "/", icon: Home },
  { title: "투두리스트", url: "/todos", icon: ListTodo },
  { title: "시간표", url: "/timetable", icon: Calendar },
  { title: "수업 계획", url: "/class-plans", icon: BookOpen },
  { title: "월간 보고서", url: "/student-reports", icon: FileBarChart },
  { title: "학생 관리", url: "/users", icon: Users },
  { title: "포인트 관리", url: "/points-management", icon: GraduationCap },
  { title: "매뉴얼", url: "/manual", icon: HelpCircle },
];

const principalMenuItems = [
  { title: "대시보드", url: "/", icon: Home },
  { title: "투두리스트", url: "/todos", icon: ListTodo },
  { title: "사용자 관리", url: "/users", icon: Users },
  { title: "시간표 관리", url: "/timetable", icon: Calendar },
  { title: "수업 계획", url: "/class-plans", icon: BookOpen },
  { title: "월간 보고서", url: "/student-reports", icon: FileBarChart },
  { title: "포인트 관리", url: "/points-management", icon: GraduationCap },
  { title: "매뉴얼", url: "/manual", icon: HelpCircle },
  { title: "설정", url: "/settings", icon: Settings },
];

const adminMenuItems = principalMenuItems;

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [classManagementOpen, setClassManagementOpen] = useState(() => 
    classManagementUrls.includes(location)
  );

  if (!user) return null;

  const getMenuItems = () => {
    if (user.role === UserRole.KIOSK) return kioskMenuItems;
    if (user.role >= UserRole.ADMIN) return adminMenuItems;
    if (user.role >= UserRole.PRINCIPAL) return principalMenuItems;
    if (user.role >= UserRole.TEACHER) return teacherMenuItems;
    if (user.role === UserRole.STUDENT) return studentMenuItems;
    return parentMenuItems;
  };

  const menuItems = getMenuItems();
  const showClassManagement = user.role >= UserRole.TEACHER;
  const isKiosk = user.role === UserRole.KIOSK;
  
  // Determine where to insert class management
  // Admin: after index 4 (after 사용자 관리, before 시간표 관리)
  // Principal: after index 3 (after 사용자 관리, before 시간표 관리)
  // Teacher: after index 0 (after 대시보드, at top)
  const classManagementInsertIndex = user.role >= UserRole.ADMIN ? 5 : (user.role >= UserRole.PRINCIPAL ? 4 : 1);

  const renderMenuItem = (item: typeof menuItems[0]) => (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton
        asChild
        isActive={location === item.url}
        data-testid={`nav-${item.url.replace("/", "") || "home"}`}
      >
        <Link href={item.url}>
          <item.icon className="h-4 w-4" />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  const renderClassManagementItem = (item: typeof classManagementItems[0]) => (
    <SidebarMenuSubItem key={item.title}>
      <SidebarMenuSubButton
        asChild
        isActive={location === item.url}
        data-testid={`nav-${item.url.replace("/", "")}`}
      >
        <Link href={item.url}>
          <item.icon className="h-4 w-4" />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );

  const renderClassManagement = () => (
    <Collapsible
      open={classManagementOpen}
      onOpenChange={setClassManagementOpen}
      className="group/collapsible"
      key="class-management"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            isActive={classManagementUrls.some(url => location.startsWith(url.split("?")[0]))}
            data-testid="nav-class-management"
          >
            <GraduationCap className="h-4 w-4" />
            <span>수업 관리</span>
            <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {classManagementItems.map((item) => renderClassManagementItem(item))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="font-bold text-xl text-primary">로고</span>
        </div>
        {isKiosk ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <RoleBadge role={user.role} isClinicTeacher={false} size="sm" />
                <span className="font-medium truncate" data-testid="text-user-name">{user.name}</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {user.name.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate" data-testid="text-user-name">{user.name}</span>
                  <RoleBadge role={user.role} isClinicTeacher={user.isClinicTeacher} size="sm" />
                </div>
                <p className="text-xs text-muted-foreground truncate">{user.username}</p>
              </div>
            </div>
            <div className="mt-3">
              <CenterSelector />
            </div>
          </>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>메뉴</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item, index) => {
                const elements = [];
                elements.push(renderMenuItem(item));
                if (showClassManagement && index === classManagementInsertIndex - 1) {
                  elements.push(renderClassManagement());
                }
                return elements;
              }).flat()}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2"
          onClick={logout}
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4" />
          로그아웃
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
