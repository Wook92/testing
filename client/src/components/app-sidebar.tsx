import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Home,
  Calendar,
  ClipboardList,
  BarChart3,
  Users,
  Settings,
  LogOut,
  UserCheck,
  FileText,
  ChevronDown,
  Coins,
  FileBarChart,
  HelpCircle,
  ListTodo,
  MessageSquare,
  UserCog,
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
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@shared/schema";

const classManagementItems = [
  { title: "출결 관리", url: "/attendance", icon: UserCheck },
  { title: "숙제 관리", url: "/homework", icon: ClipboardList },
  { title: "수업 기록", url: "/class-notes", icon: FileText },
  { title: "평가 관리", url: "/assessments", icon: BarChart3 },
];

const classManagementUrls = classManagementItems.map(item => item.url);

const parentManagementItems = [
  { title: "문자 안내", url: "/student-reports", icon: FileBarChart },
  { title: "공지사항", url: "/announcements", icon: MessageSquare },
];

const parentManagementUrls = parentManagementItems.map(item => item.url);

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
  { title: "공지사항", url: "/announcements", icon: MessageSquare },
  { title: "포인트", url: "/points", icon: Coins },
  { title: "매뉴얼", url: "/manual", icon: HelpCircle },
];

const teacherMenuItems = [
  { title: "대시보드", url: "/", icon: Home },
  { title: "투두리스트", url: "/todos", icon: ListTodo },
  { title: "시간표", url: "/timetable", icon: Calendar },
  { title: "학생 관리", url: "/users", icon: Users },
  { title: "매뉴얼", url: "/manual", icon: HelpCircle },
  { title: "포인트 관리", url: "/points-management", icon: Coins },
];

const principalMenuItems = [
  { title: "대시보드", url: "/", icon: Home },
  { title: "투두리스트", url: "/todos", icon: ListTodo },
  { title: "사용자 관리", url: "/users", icon: Users },
  { title: "시간표", url: "/timetable", icon: Calendar },
  { title: "매뉴얼", url: "/manual", icon: HelpCircle },
  { title: "설정", url: "/settings", icon: Settings },
  { title: "포인트 관리", url: "/points-management", icon: Coins },
];


export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [classManagementOpen, setClassManagementOpen] = useState(() => 
    classManagementUrls.includes(location)
  );
  const [parentManagementOpen, setParentManagementOpen] = useState(() => 
    parentManagementUrls.includes(location)
  );

  const isStudent = user?.role === UserRole.STUDENT;

  const { data: pointsData } = useQuery<{ total: number; available: number }>({
    queryKey: [`/api/points/my-points?actorId=${user?.id}`],
    enabled: !!user && isStudent,
  });

  if (!user) return null;

  const getMenuItems = () => {
    if (user.role === UserRole.KIOSK) return kioskMenuItems;
    if (user.role >= UserRole.PRINCIPAL) return principalMenuItems;
    if (user.role >= UserRole.TEACHER) return teacherMenuItems;
    if (user.role === UserRole.STUDENT) return studentMenuItems;
    return parentMenuItems;
  };

  const menuItems = getMenuItems();
  const showClassManagement = user.role >= UserRole.TEACHER;
  const showParentManagement = user.role >= UserRole.TEACHER;
  const isKiosk = user.role === UserRole.KIOSK;
  
  // Determine where to insert class management
  // Admin: after index 4 (after 사용자 관리, before 시간표 관리)
  // Principal: after index 3 (after 사용자 관리, before 시간표 관리)
  // Teacher: after index 0 (after 대시보드, at top)
  const classManagementInsertIndex = user.role >= UserRole.PRINCIPAL ? 4 : 1;
  const parentManagementInsertIndex = user.role >= UserRole.PRINCIPAL ? 5 : 2;

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
            <Calendar className="h-4 w-4" />
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

  const renderParentManagement = () => (
    <Collapsible
      open={parentManagementOpen}
      onOpenChange={setParentManagementOpen}
      className="group/collapsible"
      key="parent-management"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            isActive={parentManagementUrls.some(url => location.startsWith(url.split("?")[0]))}
            data-testid="nav-parent-management"
          >
            <UserCog className="h-4 w-4" />
            <span>학부모 관리</span>
            <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {parentManagementItems.map((item) => (
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
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3 mb-4">
          <img src="/logo.png" alt="학원 로고" className="h-10 w-auto" />
        </div>
        {isKiosk ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <RoleBadge role={user.role} size="sm" />
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
                  <RoleBadge role={user.role} size="sm" />
                </div>
                <p className="text-xs text-muted-foreground truncate">{user.username}</p>
              </div>
            </div>
            {isStudent && pointsData && (
              <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                <Coins className="h-4 w-4 text-amber-600" />
                <span className="text-xs">보유 포인트</span>
                <span className="ml-auto text-xs font-medium">
                  {pointsData.available?.toLocaleString() ?? 0}P
                </span>
              </div>
            )}
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
                if (showParentManagement && index === parentManagementInsertIndex - 1) {
                  elements.push(renderParentManagement());
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
