import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, invalidateQueriesStartingWith } from "@/lib/queryClient";
import { UserRole, ExitReasons, MARKETING_CHANNEL_LIST, MarketingChannels, type MarketingCampaign, type MonthlyFinancialRecord, FinancialExpenseCategories } from "@shared/schema";
import { TrendingDown, TrendingUp, Users, RefreshCw, BarChart3, PieChart, Clock, Calendar, AlertCircle, GraduationCap, Briefcase, DollarSign, Megaphone, Plus, Edit, Trash2, ChevronLeft, ChevronRight, ChevronDown, Calculator } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell, ComposedChart, Area } from "recharts";
import { format, startOfMonth, parseISO, differenceInDays } from "date-fns";
import { ko } from "date-fns/locale";
import { formatKoreanTime } from "@/lib/utils";

type TeacherWorkRecord = {
  id: string;
  teacherId: string;
  centerId: string;
  workDate: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  workMinutes: number | null;
  noCheckOut: boolean;
  teacherName?: string;
};

type MonthlyData = {
  month: string;
  studentCount: number;
  exitCount: number;
  exitRatio: number;
  reasons: Record<string, number>;
};

type StudentTrendsData = {
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
};

type MarketingComparisonData = {
  currentYear: number;
  lastYear: number;
  currentYearTotal: number;
  lastYearTotal: number;
  currentYearMonthly: { month: number; total: number }[];
  lastYearMonthly: { month: number; total: number }[];
  currentYearCampaigns: MarketingCampaign[];
  lastYearCampaigns: MarketingCampaign[];
};

function formatBudget(value: number): string {
  if (value >= 10000) {
    const man = Math.floor(value / 10000);
    const remainder = value % 10000;
    if (remainder === 0) {
      return `${man}만원`;
    } else if (remainder % 1000 === 0) {
      return `${man}만${remainder / 1000}천원`;
    } else {
      return `${man}만${remainder.toLocaleString()}원`;
    }
  }
  return `${value.toLocaleString()}원`;
}

const CHART_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#06B6D4", "#EC4899", "#84CC16", "#F97316", "#6366F1",
  "#14B8A6", "#A855F7"
];

function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  return `${year.slice(2)}년 ${parseInt(m)}월`;
}

function formatMonthShort(month: string): string {
  const [, m] = month.split("-");
  return `${parseInt(m)}월`;
}

// Salary breakdown panel component for showing detailed calculation
function SalaryBreakdownPanel({ teacherId, yearMonth, centerId }: { teacherId: string; yearMonth: string; centerId: string }) {
  type SalaryCalcType = {
    baseSalary: number;
    performanceBonus: number;
    totalSalary: number;
    breakdown: {
      classes: Array<{
        classId: string;
        className: string;
        studentCount: number;
        basePay: number;
        extraStudents: number;
        extraPay: number;
        totalPay: number;
        level?: string;
      }>;
      classCount: number;
      totalStudents: number;
      bonusStudents: number;
    };
  };

  const { data: salaryCalc, isLoading } = useQuery<SalaryCalcType>({
    queryKey: [`/api/teacher-salary-calculation/${teacherId}/${yearMonth}?centerId=${centerId}`],
    enabled: !!teacherId && !!yearMonth && !!centerId,
  });

  if (isLoading) {
    return <div className="p-3 text-sm text-muted-foreground">불러오는 중...</div>;
  }

  if (!salaryCalc) {
    return <div className="p-3 text-sm text-muted-foreground">급여 정보를 불러올 수 없습니다</div>;
  }

  return (
    <div className="p-3 bg-muted/50 border-t text-sm space-y-2">
      <div className="font-medium text-xs text-muted-foreground mb-2">급여 세부 산정 내역</div>
      <div className="flex justify-between">
        <span>기본급</span>
        <span>{formatBudget(salaryCalc.baseSalary)}</span>
      </div>
      <div className="flex justify-between">
        <span>성과급 ({salaryCalc.breakdown.classCount}개 수업)</span>
        <span>{formatBudget(salaryCalc.performanceBonus)}</span>
      </div>
      {salaryCalc.breakdown.classes.length > 0 && (
        <div className="mt-2 pt-2 border-t space-y-1">
          <div className="font-medium text-xs text-muted-foreground">수업별 내역</div>
          {salaryCalc.breakdown.classes.map((cls, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="flex items-center gap-1">
                {cls.className}
                <span className="text-muted-foreground">
                  ({cls.level === "high" ? "고등" : "중등"}, {cls.studentCount}명
                  {cls.extraStudents > 0 && <span className="text-green-600">, 초과 {cls.extraStudents}명</span>})
                </span>
              </span>
              <span>{formatBudget(cls.totalPay)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-between font-bold border-t pt-2 mt-2">
        <span>합계</span>
        <span className="text-primary">{formatBudget(salaryCalc.totalSalary)}</span>
      </div>
    </div>
  );
}

export default function ManagementPage() {
  const { user, selectedCenter } = useAuth();
  const { toast } = useToast();
  const [months] = useState(12);
  const [mainTab, setMainTab] = useState("students");
  const [studentSubTab, setStudentSubTab] = useState("trend");
  
  const today = new Date();
  const [workStartDate, setWorkStartDate] = useState(() => format(startOfMonth(today), "yyyy-MM-dd"));
  const [workEndDate, setWorkEndDate] = useState(() => format(today, "yyyy-MM-dd"));
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("all");

  const isAdmin = user?.role === UserRole.ADMIN;
  const isPrincipal = user?.role === UserRole.PRINCIPAL;

  if (!isAdmin && !isPrincipal) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Card className="p-8 text-center">
          <CardTitle className="text-destructive mb-2">접근 권한 없음</CardTitle>
          <CardDescription>경영 대시보드는 관리자와 원장만 접근할 수 있습니다.</CardDescription>
        </Card>
      </div>
    );
  }

  const { data: metricsData, isLoading, refetch } = useQuery<{ monthlyData: MonthlyData[] }>({
    queryKey: [`/api/management/metrics?centerId=${selectedCenter?.id}&months=${months}`],
    enabled: !!selectedCenter?.id,
  });

  const { data: studentTrends, isLoading: loadingTrends } = useQuery<StudentTrendsData>({
    queryKey: [`/api/dashboard/student-trends?centerId=${selectedCenter?.id}&actorId=${user?.id}`],
    enabled: !!user?.id && !!selectedCenter?.id,
  });

  const updateCountMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/management/update-student-count", {
        centerId: selectedCenter?.id,
      });
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/management");
      toast({ title: "학생 수가 업데이트되었습니다" });
    },
    onError: () => {
      toast({ title: "업데이트에 실패했습니다", variant: "destructive" });
    },
  });

  const { data: teacherWorkRecords = [], isLoading: loadingWorkRecords } = useQuery<TeacherWorkRecord[]>({
    queryKey: [`/api/teacher-work-records?centerId=${selectedCenter?.id}&startDate=${workStartDate}&endDate=${workEndDate}`],
    enabled: !!selectedCenter?.id && !!workStartDate && !!workEndDate && mainTab === "teachers",
  });

  // Extract unique teachers from work records for filtering
  const uniqueTeachers = teacherWorkRecords.reduce((acc, record) => {
    if (record.teacherId && record.teacherName && !acc.find(t => t.id === record.teacherId)) {
      acc.push({ id: record.teacherId, name: record.teacherName });
    }
    return acc;
  }, [] as { id: string; name: string }[]).sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  // Filter work records by selected teacher
  const filteredWorkRecords = selectedTeacherId === "all" 
    ? teacherWorkRecords 
    : teacherWorkRecords.filter(r => r.teacherId === selectedTeacherId);

  // Marketing state
  const [showCampaignDialog, setShowCampaignDialog] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<MarketingCampaign | null>(null);
  const [campaignForm, setCampaignForm] = useState({
    name: "",
    channel: "",
    startDate: "",
    endDate: "",
    budget: 0,
    notes: "",
  });

  const { data: marketingComparison, isLoading: loadingMarketing } = useQuery<MarketingComparisonData>({
    queryKey: ["/api/marketing-campaigns/comparison", selectedCenter?.id],
    enabled: !!selectedCenter?.id && mainTab === "marketing",
  });

  const invalidateMarketingQueries = () => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        if (Array.isArray(key) && key[0] === "/api/marketing-campaigns/comparison") return true;
        if (typeof key[0] === "string" && key[0].startsWith("/api/marketing-campaigns")) return true;
        if (Array.isArray(key) && key[0] === "/api/monthly-financial-records") return true;
        if (typeof key[0] === "string" && key[0].startsWith("/api/monthly-financial-records")) return true;
        return false;
      },
    });
  };

  const createCampaignMutation = useMutation({
    mutationFn: async (data: typeof campaignForm) => {
      return apiRequest("POST", "/api/marketing-campaigns", {
        ...data,
        centerId: selectedCenter?.id,
        createdBy: user?.id,
      });
    },
    onSuccess: () => {
      invalidateMarketingQueries();
      setShowCampaignDialog(false);
      resetCampaignForm();
      toast({ title: "캠페인이 등록되었습니다" });
    },
    onError: () => {
      toast({ title: "등록에 실패했습니다", variant: "destructive" });
    },
  });

  const updateCampaignMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof campaignForm }) => {
      return apiRequest("PATCH", `/api/marketing-campaigns/${id}`, data);
    },
    onSuccess: () => {
      invalidateMarketingQueries();
      setShowCampaignDialog(false);
      setEditingCampaign(null);
      resetCampaignForm();
      toast({ title: "캠페인이 수정되었습니다" });
    },
    onError: () => {
      toast({ title: "수정에 실패했습니다", variant: "destructive" });
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/marketing-campaigns/${id}`);
    },
    onSuccess: () => {
      invalidateMarketingQueries();
      toast({ title: "캠페인이 삭제되었습니다" });
    },
    onError: () => {
      toast({ title: "삭제에 실패했습니다", variant: "destructive" });
    },
  });

  const resetCampaignForm = () => {
    setCampaignForm({
      name: "",
      channel: "",
      startDate: "",
      endDate: "",
      budget: 0,
      notes: "",
    });
  };

  const openEditCampaign = (campaign: MarketingCampaign) => {
    setEditingCampaign(campaign);
    setCampaignForm({
      name: campaign.name,
      channel: campaign.channel,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      budget: campaign.budget,
      notes: campaign.notes || "",
    });
    setShowCampaignDialog(true);
  };

  const handleSaveCampaign = () => {
    if (!campaignForm.name || !campaignForm.channel || !campaignForm.startDate || !campaignForm.endDate) {
      toast({ title: "필수 항목을 입력해주세요", variant: "destructive" });
      return;
    }
    if (campaignForm.budget <= 0) {
      toast({ title: "예산은 0보다 커야 합니다", variant: "destructive" });
      return;
    }
    if (new Date(campaignForm.endDate) < new Date(campaignForm.startDate)) {
      toast({ title: "종료일은 시작일 이후여야 합니다", variant: "destructive" });
      return;
    }
    if (editingCampaign) {
      updateCampaignMutation.mutate({ id: editingCampaign.id, data: campaignForm });
    } else {
      createCampaignMutation.mutate(campaignForm);
    }
  };

  const getChannelLabel = (key: string) => {
    return (MarketingChannels as Record<string, string>)[key] || key;
  };

  // Finance state
  const currentYear = new Date().getFullYear();
  const currentMonthNum = new Date().getMonth() + 1;
  const [financeYear, setFinanceYear] = useState(currentYear);
  const [selectedFinanceMonth, setSelectedFinanceMonth] = useState(
    `${currentYear}-${String(currentMonthNum).padStart(2, "0")}`
  );
  const [showFinanceDialog, setShowFinanceDialog] = useState(false);
  const [editingFinance, setEditingFinance] = useState<MonthlyFinancialRecord | null>(null);
  const [financeDialogTab, setFinanceDialogTab] = useState<"revenue" | "expense">("revenue");

  // Finance types - separated revenue and expense
  type RevenueItem = { name: string; amount: number; studentId?: string; school?: string; grade?: string; classes?: { id: string; name: string; subject: string }[] };
  type ExpenseItem = { name: string; amount: number; category: string; teacherId?: string };

  // State for expanded salary detail in finance dialog
  const [expandedSalaryTeacherId, setExpandedSalaryTeacherId] = useState<string | null>(null);
  
  // State for expanded salary breakdown in teacher settings
  const [expandedSalaryBreakdownTeacherId, setExpandedSalaryBreakdownTeacherId] = useState<string | null>(null);
  const currentYearMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const [salaryBreakdownYearMonth, setSalaryBreakdownYearMonth] = useState<string>(currentYearMonth);

  // Expense category options
  const expenseCategories = [
    // 인건비 그룹
    { key: "expenseRegularSalary", label: "정규선생님 급여", group: "인건비" },
    { key: "expensePartTimeSalary", label: "파트선생님 급여", group: "인건비" },
    { key: "expenseHourlySalary", label: "아르바이트 급여", group: "인건비" },
    { key: "expenseEmployeeInsurance", label: "4대보험", group: "인건비" },
    // 고정비 그룹 - 매달 유지되는 금액
    { key: "expenseRent", label: "임대료 및 관리비", group: "고정비" },
    { key: "expenseUtilities", label: "수도광열비", group: "고정비" },
    { key: "expenseCommunication", label: "통신비", group: "고정비" },
    { key: "expenseInsurance", label: "보험료", group: "고정비" },
    { key: "expenseDepreciation", label: "감가상각비", group: "고정비" },
    // 판관비 그룹
    { key: "expenseWelfare", label: "복리후생비", group: "판관비" },
    { key: "expenseSupplies", label: "소모품비", group: "판관비" },
    { key: "expenseAdvertising", label: "광고선전비", group: "판관비" },
    { key: "expenseFees", label: "지급수수료", group: "판관비" },
    { key: "expenseVehicle", label: "차량유지비", group: "판관비" },
    { key: "expenseEducation", label: "교육운영비", group: "판관비" },
    { key: "expenseOther", label: "기타판관비", group: "판관비" },
  ];

  const getCategoryLabel = (key: string) => expenseCategories.find(c => c.key === key)?.label || key;

  const [revenueItems, setRevenueItems] = useState<RevenueItem[]>([]);
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([]);

  // Calculate totals
  const calculateRevenueTotal = () => revenueItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  const calculateExpenseTotal = () => expenseItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  const calculateExpenseByCategory = (category: string) => 
    expenseItems.filter(item => item.category === category).reduce((sum, item) => sum + (item.amount || 0), 0);

  // Build form data from items
  const buildFinanceFormFromItems = () => {
    const formData: Record<string, any> = {};
    
    // Revenue
    formData.revenueTuition = calculateRevenueTotal();
    formData.revenueTuitionDetails = JSON.stringify(revenueItems);
    
    // Expenses by category
    expenseCategories.forEach(({ key }) => {
      const categoryItems = expenseItems.filter(item => item.category === key);
      formData[key] = categoryItems.reduce((sum, item) => sum + (item.amount || 0), 0);
      formData[`${key}Details`] = JSON.stringify(categoryItems.map(item => ({ name: item.name, amount: item.amount, teacherId: item.teacherId })));
    });
    
    return formData;
  };

  // Parse items from record
  const parseItemsFromRecord = (record: MonthlyFinancialRecord) => {
    // Parse revenue
    const revenueJson = record.revenueTuitionDetails as string | null;
    let parsedRevenue: RevenueItem[] = [];
    if (revenueJson) {
      try { parsedRevenue = JSON.parse(revenueJson); } catch { parsedRevenue = []; }
    }
    if (parsedRevenue.length === 0 && record.revenueTuition > 0) {
      parsedRevenue = [{ name: "수강료", amount: record.revenueTuition }];
    }
    
    // Parse expenses
    const parsedExpenses: ExpenseItem[] = [];
    expenseCategories.forEach(({ key }) => {
      const detailsKey = `${key}Details` as keyof MonthlyFinancialRecord;
      const detailsJson = record[detailsKey] as string | null;
      if (detailsJson) {
        try {
          const items = JSON.parse(detailsJson);
          items.forEach((item: { name: string; amount: number; teacherId?: string }) => {
            parsedExpenses.push({ ...item, category: key });
          });
        } catch {}
      } else {
        const total = record[key as keyof MonthlyFinancialRecord] as number;
        if (total > 0) {
          parsedExpenses.push({ name: getCategoryLabel(key), amount: total, category: key });
        }
      }
    });
    
    return { revenue: parsedRevenue, expenses: parsedExpenses };
  };

  // Revenue item handlers
  const addRevenueItem = () => setRevenueItems(prev => [...prev, { name: "", amount: 0 }]);
  const updateRevenueItem = (index: number, field: keyof RevenueItem, value: string | number) => {
    setRevenueItems(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: field === "amount" ? Number(value) || 0 : value } : item
    ));
  };
  const removeRevenueItem = (index: number) => setRevenueItems(prev => prev.filter((_, i) => i !== index));

  // Expense item handlers
  const addExpenseItem = () => setExpenseItems(prev => [...prev, { name: "", amount: 0, category: "expenseOther" }]);
  const updateExpenseItem = (index: number, field: keyof ExpenseItem, value: string | number) => {
    setExpenseItems(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: field === "amount" ? Number(value) || 0 : value } : item
    ));
  };
  const removeExpenseItem = (index: number) => setExpenseItems(prev => prev.filter((_, i) => i !== index));

  const { data: financeRecords = [], isLoading: loadingFinance } = useQuery<MonthlyFinancialRecord[]>({
    queryKey: [`/api/monthly-financials?centerId=${selectedCenter?.id}&year=${financeYear}`],
    enabled: !!selectedCenter?.id && mainTab === "finance",
  });

  // Teacher list for salary expenses
  type TeacherWithEmploymentType = { id: string; name: string; employmentType: string | null; dailyRate: number | null };
  const { data: teacherList = [], isLoading: loadingTeachers } = useQuery<TeacherWithEmploymentType[]>({
    queryKey: [`/api/users?centerId=${selectedCenter?.id}`],
    enabled: !!selectedCenter?.id && showFinanceDialog,
    select: (data: any[]) => data.filter(u => u.role === 2).map(u => ({ 
      id: u.id, 
      name: u.name, 
      employmentType: u.employmentType || "regular",
      dailyRate: u.dailyRate || null,
    })),
  });
  
  // Get work days count for hourly teachers in the selected month
  const financeDialogYearMonth = editingFinance?.yearMonth || selectedFinanceMonth;
  const { data: workDaysData = {} } = useQuery<Record<string, number>>({
    queryKey: [`/api/teacher-work-days?centerId=${selectedCenter?.id}&yearMonth=${financeDialogYearMonth}`],
    enabled: !!selectedCenter?.id && showFinanceDialog && !!financeDialogYearMonth,
  });
  
  // State for controlled teacher salary select
  const [selectedSalaryTeacher, setSelectedSalaryTeacher] = useState<string>("");

  // Salary settings state
  const [showSalarySettingsDialog, setShowSalarySettingsDialog] = useState(false);
  const [selectedTeacherForSalary, setSelectedTeacherForSalary] = useState<string>("");
  const [salarySettingsForm, setSalarySettingsForm] = useState({
    baseSalary: 0,
    classBasePay: 0,
    classBasePayMiddle: 0,
    classBasePayHigh: 0,
    studentThreshold: 0,
    studentThresholdMiddle: 0,
    studentThresholdHigh: 0,
    perStudentBonus: 0,
    perStudentBonusMiddle: 0,
    perStudentBonusHigh: 0,
  });

  // Get all salary settings for the center
  type TeacherSalarySettingsType = {
    id: string;
    teacherId: string;
    centerId: string;
    baseSalary: number;
    classBasePay: number;
    classBasePayMiddle: number;
    classBasePayHigh: number;
    studentThreshold: number;
    studentThresholdMiddle: number;
    studentThresholdHigh: number;
    perStudentBonus: number;
    perStudentBonusMiddle: number;
    perStudentBonusHigh: number;
  };

  const { data: allSalarySettings = [] } = useQuery<TeacherSalarySettingsType[]>({
    queryKey: [`/api/teacher-salary-settings?centerId=${selectedCenter?.id}`],
    enabled: !!selectedCenter?.id && (mainTab === "teachers" || mainTab === "finance"),
  });

  // Get salary calculation for selected teacher
  type SalaryCalculationType = {
    baseSalary: number;
    performanceBonus: number;
    totalSalary: number;
    breakdown: {
      classes: Array<{
        classId: string;
        className: string;
        studentCount: number;
        basePay: number;
        extraStudents: number;
        extraPay: number;
        totalPay: number;
      }>;
      classCount: number;
      totalStudents: number;
      bonusStudents: number;
    };
  };

  const { data: salaryCalculation } = useQuery<SalaryCalculationType>({
    queryKey: ["/api/teacher-salary-calculation", selectedTeacherForSalary, selectedFinanceMonth, selectedCenter?.id],
    enabled: !!selectedTeacherForSalary && !!selectedCenter?.id && showSalarySettingsDialog,
  });

  // Salary adjustments (급여 조정 항목)
  type SalaryAdjustmentType = {
    id: string;
    teacherId: string;
    centerId: string;
    yearMonth: string;
    amount: number;
    description: string;
    createdAt: string;
    createdBy: string | null;
  };

  const { data: salaryAdjustments = [] } = useQuery<SalaryAdjustmentType[]>({
    queryKey: [`/api/teacher-salary-adjustments?centerId=${selectedCenter?.id}&yearMonth=${selectedFinanceMonth}&teacherId=${selectedTeacherForSalary}`],
    enabled: !!selectedTeacherForSalary && !!selectedCenter?.id && showSalarySettingsDialog,
  });

  const [newAdjustmentAmount, setNewAdjustmentAmount] = useState("");
  const [newAdjustmentDescription, setNewAdjustmentDescription] = useState("");

  const createAdjustmentMutation = useMutation({
    mutationFn: async (data: { teacherId: string; centerId: string; yearMonth: string; amount: number; description: string }) => {
      return apiRequest("POST", `/api/teacher-salary-adjustments?actorId=${user?.id}`, data);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/teacher-salary-adjustments");
      setNewAdjustmentAmount("");
      setNewAdjustmentDescription("");
      toast({ title: "급여 조정 항목이 추가되었습니다" });
    },
    onError: (error: any) => {
      toast({ title: error?.message || "추가에 실패했습니다", variant: "destructive" });
    },
  });

  const deleteAdjustmentMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/teacher-salary-adjustments/${id}?actorId=${user?.id}`);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/teacher-salary-adjustments");
      toast({ title: "급여 조정 항목이 삭제되었습니다" });
    },
    onError: (error: any) => {
      toast({ title: error?.message || "삭제에 실패했습니다", variant: "destructive" });
    },
  });

  const handleAddAdjustment = () => {
    if (!selectedTeacherForSalary || !selectedCenter?.id || !newAdjustmentAmount || !newAdjustmentDescription) {
      toast({ title: "금액과 내용을 입력해주세요", variant: "destructive" });
      return;
    }
    createAdjustmentMutation.mutate({
      teacherId: selectedTeacherForSalary,
      centerId: selectedCenter.id,
      yearMonth: selectedFinanceMonth,
      amount: parseInt(newAdjustmentAmount),
      description: newAdjustmentDescription,
    });
  };

  // Calculate total adjustments
  const totalAdjustments = salaryAdjustments.reduce((sum, adj) => sum + adj.amount, 0);

  const saveSalarySettingsMutation = useMutation({
    mutationFn: async (data: { teacherId: string; centerId: string; baseSalary: number; classBasePay: number; classBasePayMiddle: number; classBasePayHigh: number; studentThreshold: number; studentThresholdMiddle: number; studentThresholdHigh: number; perStudentBonus: number; perStudentBonusMiddle: number; perStudentBonusHigh: number }) => {
      return apiRequest("POST", "/api/teacher-salary-settings", { ...data, actorId: user?.id });
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/teacher-salary-settings");
      invalidateQueriesStartingWith("/api/teacher-salary-calculation");
      toast({ title: "급여 설정이 저장되었습니다" });
    },
    onError: (error: any) => {
      toast({ title: error?.message || "저장에 실패했습니다", variant: "destructive" });
    },
  });

  const openSalarySettings = (teacherId: string) => {
    setSelectedTeacherForSalary(teacherId);
    const existing = allSalarySettings.find(s => s.teacherId === teacherId);
    if (existing) {
      setSalarySettingsForm({
        baseSalary: existing.baseSalary,
        classBasePay: existing.classBasePay,
        classBasePayMiddle: existing.classBasePayMiddle || existing.classBasePay || 0,
        classBasePayHigh: existing.classBasePayHigh || existing.classBasePay || 0,
        studentThreshold: existing.studentThreshold,
        studentThresholdMiddle: existing.studentThresholdMiddle || existing.studentThreshold || 0,
        studentThresholdHigh: existing.studentThresholdHigh || existing.studentThreshold || 0,
        perStudentBonus: existing.perStudentBonus,
        perStudentBonusMiddle: existing.perStudentBonusMiddle || existing.perStudentBonus || 0,
        perStudentBonusHigh: existing.perStudentBonusHigh || existing.perStudentBonus || 0,
      });
    } else {
      setSalarySettingsForm({ baseSalary: 0, classBasePay: 0, classBasePayMiddle: 0, classBasePayHigh: 0, studentThreshold: 0, studentThresholdMiddle: 0, studentThresholdHigh: 0, perStudentBonus: 0, perStudentBonusMiddle: 0, perStudentBonusHigh: 0 });
    }
    setShowSalarySettingsDialog(true);
  };

  const handleSaveSalarySettings = () => {
    if (!selectedTeacherForSalary || !selectedCenter?.id) return;
    saveSalarySettingsMutation.mutate({
      teacherId: selectedTeacherForSalary,
      centerId: selectedCenter.id,
      ...salarySettingsForm,
    });
  };

  // Hourly teacher daily rate update mutation
  const updateDailyRateMutation = useMutation({
    mutationFn: async ({ teacherId, dailyRate }: { teacherId: string; dailyRate: number }) => {
      return apiRequest("PATCH", `/api/users/${teacherId}`, { dailyRate, actorId: user?.id });
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/users");
      toast({ title: "일급이 저장되었습니다" });
    },
    onError: (error: any) => {
      toast({ title: error?.message || "저장에 실패했습니다", variant: "destructive" });
    },
  });

  // State for editing hourly teacher daily rate
  const [editingDailyRateTeacherId, setEditingDailyRateTeacherId] = useState<string | null>(null);
  const [editingDailyRateValue, setEditingDailyRateValue] = useState<number>(0);

  // Get teacher list for salary settings (not just hourly)
  const { data: allTeachersForSalary = [] } = useQuery<TeacherWithEmploymentType[]>({
    queryKey: [`/api/users?centerId=${selectedCenter?.id}`],
    enabled: !!selectedCenter?.id && mainTab === "teachers",
    select: (data: any[]) => data.filter(u => u.role === 2).map(u => ({ 
      id: u.id, 
      name: u.name, 
      employmentType: u.employmentType || "regular",
      dailyRate: u.dailyRate || null,
    })),
  });

  // Add teacher salary expense with auto-category based on employment type
  const addTeacherSalaryExpense = async (teacherId: string) => {
    if (!teacherId || teacherId === "__placeholder") return;
    const teacher = teacherList.find(t => t.id === teacherId);
    if (!teacher) return;
    
    // Map employment type to expense category
    const categoryMap: Record<string, string> = {
      "regular": "expenseRegularSalary",
      "part_time": "expensePartTimeSalary",
      "hourly": "expenseHourlySalary",
    };
    const category = categoryMap[teacher.employmentType || "regular"] || "expenseOther";
    
    let calculatedAmount = 0;

    if (teacher.employmentType === "hourly") {
      // Auto-calculate salary for hourly teachers
      if (!teacher.dailyRate || teacher.dailyRate <= 0) {
        toast({ 
          title: "일급 설정 없음", 
          description: `${teacher.name} 선생님의 일급이 설정되지 않았습니다. 선생님 탭에서 일급을 먼저 설정해주세요.`,
          variant: "destructive" 
        });
        setSelectedSalaryTeacher("");
        return; // Don't add expense without daily rate
      }
      const workDays = workDaysData[teacher.id] || 0;
      if (workDays === 0) {
        toast({ 
          title: "근무 기록 없음", 
          description: `${teacher.name} 선생님의 ${financeDialogYearMonth} 근무 기록이 없습니다. 출근 기록을 먼저 해주세요.`,
          variant: "destructive" 
        });
        setSelectedSalaryTeacher("");
        return; // Don't add expense without work days
      }
      calculatedAmount = teacher.dailyRate * workDays;
    } else if (teacher.employmentType === "regular" || teacher.employmentType === "part_time") {
      // Auto-calculate salary for regular/part-time teachers using salary settings
      const settings = allSalarySettings.find(s => s.teacherId === teacherId);
      if (settings) {
        // Use base salary + estimate performance from settings
        calculatedAmount = settings.baseSalary;
        
        // Try to get accurate calculation from API
        try {
          const yearMonth = editingFinance?.yearMonth || selectedFinanceMonth;
          const response = await apiRequest("GET", `/api/teacher-salary-calculation/${teacherId}/${yearMonth}?centerId=${selectedCenter?.id}`);
          const salaryData = await response.json();
          if (salaryData && salaryData.totalSalary > 0) {
            calculatedAmount = salaryData.totalSalary;
          }
        } catch (err) {
          console.error("Failed to fetch salary calculation, using base salary:", err);
        }
      } else {
        // No salary settings - warn user and don't add
        toast({ 
          title: "급여 설정 없음", 
          description: `${teacher.name} 선생님의 급여 설정이 없습니다. 선생님 탭에서 먼저 설정해주세요.`,
          variant: "destructive" 
        });
        setSelectedSalaryTeacher("");
        return; // Don't add expense without settings
      }
    }
    
    // Block adding if amount is 0 for regular/part-time
    if (calculatedAmount === 0 && (teacher.employmentType === "regular" || teacher.employmentType === "part_time")) {
      toast({ 
        title: "급여 금액 확인 필요", 
        description: `${teacher.name} 선생님의 계산된 급여가 0원입니다. 선생님 탭에서 급여 설정을 확인해주세요.`,
        variant: "destructive" 
      });
      setSelectedSalaryTeacher("");
      return; // Don't add zero expense
    }
    
    setExpenseItems(prev => [...prev, { 
      name: `${teacher.name} 선생님`, 
      amount: calculatedAmount, 
      category,
      teacherId: teacher.id,
    }]);
    
    // Reset the select after adding
    setSelectedSalaryTeacher("");
  };

  const invalidateFinanceQueries = () => {
    invalidateQueriesStartingWith("/api/monthly-financials");
  };

  const createFinanceMutation = useMutation({
    mutationFn: async (data: Record<string, any> & { yearMonth: string }) => {
      return apiRequest("POST", "/api/monthly-financials", {
        ...data,
        centerId: selectedCenter?.id,
        createdBy: user?.id,
      });
    },
    onSuccess: () => {
      invalidateFinanceQueries();
      setShowFinanceDialog(false);
      toast({ title: "재무 기록이 저장되었습니다" });
    },
    onError: (error: any) => {
      toast({ title: error?.message || "저장에 실패했습니다", variant: "destructive" });
    },
  });

  const updateFinanceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      return apiRequest("PATCH", `/api/monthly-financials/${id}`, data);
    },
    onSuccess: () => {
      invalidateFinanceQueries();
      setShowFinanceDialog(false);
      setEditingFinance(null);
      toast({ title: "재무 기록이 수정되었습니다" });
    },
    onError: () => {
      toast({ title: "수정에 실패했습니다", variant: "destructive" });
    },
  });

  // Sync student tuition to finance
  const syncTuitionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCenter?.id) throw new Error("센터를 선택해주세요");
      const res = await apiRequest("POST", `/api/sync-student-tuition/${selectedCenter.id}/${selectedFinanceMonth}`, {
        actorId: user?.id,
      });
      return res.json();
    },
    onSuccess: (data: { studentCount: number; totalRevenue: number }) => {
      invalidateFinanceQueries();
      toast({ title: `교육비 동기화 완료: ${data.studentCount}명, ${formatBudget(data.totalRevenue)}` });
    },
    onError: (error: any) => {
      toast({ title: error?.message || "동기화에 실패했습니다", variant: "destructive" });
    },
  });

  const deleteFinanceMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/monthly-financials/${id}`);
    },
    onSuccess: () => {
      invalidateFinanceQueries();
      toast({ title: "재무 기록이 삭제되었습니다" });
    },
    onError: () => {
      toast({ title: "삭제에 실패했습니다", variant: "destructive" });
    },
  });

  const openEditFinance = (record: MonthlyFinancialRecord) => {
    setEditingFinance(record);
    const { revenue, expenses } = parseItemsFromRecord(record);
    setRevenueItems(revenue);
    setExpenseItems(expenses);
    setFinanceDialogTab("revenue");
    setShowFinanceDialog(true);
  };

  const openNewFinance = (yearMonth: string) => {
    setEditingFinance(null);
    setSelectedFinanceMonth(yearMonth);
    setRevenueItems([]);
    setExpenseItems([]);
    setFinanceDialogTab("revenue");
    setShowFinanceDialog(true);
  };

  const handleSaveFinance = () => {
    const formData = buildFinanceFormFromItems();
    if (editingFinance) {
      updateFinanceMutation.mutate({ id: editingFinance.id, data: formData });
    } else {
      createFinanceMutation.mutate({ ...formData, yearMonth: selectedFinanceMonth });
    }
  };

  // Calculate finance summary
  const calculateFinanceSummary = (record: MonthlyFinancialRecord | null) => {
    if (!record) return { revenue: 0, laborCost: 0, operatingExpense: 0, operatingProfit: 0 };
    
    const revenue = record.revenueTuition;
    const laborCost = record.expenseRegularSalary + record.expensePartTimeSalary + 
                      record.expenseHourlySalary + record.expenseEmployeeInsurance;
    const operatingExpense = record.expenseRent + record.expenseWelfare + record.expenseUtilities +
                             record.expenseCommunication + record.expenseSupplies + record.expenseAdvertising +
                             record.expenseFees + record.expenseInsurance + record.expenseDepreciation +
                             record.expenseVehicle + record.expenseEducation + record.expenseOther;
    const operatingProfit = revenue - laborCost - operatingExpense;
    
    return { revenue, laborCost, operatingExpense, operatingProfit };
  };

  // Prepare chart data for finance
  const financeChartData = financeRecords
    .slice()
    .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth))
    .map(record => {
      const summary = calculateFinanceSummary(record);
      return {
        month: formatMonthShort(record.yearMonth),
        fullMonth: record.yearMonth,
        매출: summary.revenue,
        인건비: summary.laborCost,
        판관비: summary.operatingExpense,
        영업이익: summary.operatingProfit,
      };
    });

  const monthlyData = metricsData?.monthlyData || [];
  const currentMonth = monthlyData[monthlyData.length - 1];
  const previousMonth = monthlyData[monthlyData.length - 2];

  const studentCountChange = currentMonth && previousMonth 
    ? currentMonth.studentCount - previousMonth.studentCount 
    : 0;
  const totalExits = monthlyData.reduce((sum, m) => sum + m.exitCount, 0);
  const avgExitRatio = monthlyData.length > 0 
    ? monthlyData.reduce((sum, m) => sum + m.exitRatio, 0) / monthlyData.length 
    : 0;

  const reasonTotals: Record<string, number> = {};
  monthlyData.forEach(m => {
    Object.entries(m.reasons).forEach(([reason, count]) => {
      reasonTotals[reason] = (reasonTotals[reason] || 0) + count;
    });
  });

  const sortedReasons = Object.entries(reasonTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const reasonChartData = sortedReasons.map(([reason, count], index) => ({
    reason: reason.length > 12 ? reason.slice(0, 12) + "..." : reason,
    fullReason: reason,
    count,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">경영 대시보드</h1>
          <p className="text-muted-foreground">학원 경영 현황 및 분석</p>
        </div>
      </div>

      <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-lg">
          <TabsTrigger value="students" data-testid="tab-students" className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            <span className="hidden sm:inline">학생</span>
          </TabsTrigger>
          <TabsTrigger value="teachers" data-testid="tab-teachers" className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            <span className="hidden sm:inline">선생님</span>
          </TabsTrigger>
          <TabsTrigger value="finance" data-testid="tab-finance" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">재무</span>
          </TabsTrigger>
          <TabsTrigger value="marketing" data-testid="tab-marketing" className="flex items-center gap-2">
            <Megaphone className="h-4 w-4" />
            <span className="hidden sm:inline">마케팅</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="mt-6 space-y-6">
          <div className="flex items-center justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateCountMutation.mutate()}
              disabled={updateCountMutation.isPending}
              data-testid="button-update-count"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${updateCountMutation.isPending ? 'animate-spin' : ''}`} />
              현재 학생 수 업데이트
            </Button>
          </div>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-24" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-16" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-1 pb-2">
                  <CardTitle className="text-sm font-medium">현재 학생 수</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{currentMonth?.studentCount || 0}명</div>
                  <div className="flex items-center text-xs text-muted-foreground">
                    {studentCountChange > 0 ? (
                      <>
                        <TrendingUp className="h-3 w-3 mr-1 text-emerald-500" />
                        <span className="text-emerald-500">+{studentCountChange}명</span>
                      </>
                    ) : studentCountChange < 0 ? (
                      <>
                        <TrendingDown className="h-3 w-3 mr-1 text-red-500" />
                        <span className="text-red-500">{studentCountChange}명</span>
                      </>
                    ) : (
                      <span>전월 대비 변동 없음</span>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-1 pb-2">
                  <CardTitle className="text-sm font-medium">이번 달 퇴원</CardTitle>
                  <TrendingDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{currentMonth?.exitCount || 0}명</div>
                  <p className="text-xs text-muted-foreground">
                    퇴원율 {currentMonth?.exitRatio.toFixed(1) || 0}%
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-1 pb-2">
                  <CardTitle className="text-sm font-medium">{months}개월 총 퇴원</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalExits}명</div>
                  <p className="text-xs text-muted-foreground">
                    평균 퇴원율 {avgExitRatio.toFixed(1)}%
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-1 pb-2">
                  <CardTitle className="text-sm font-medium">주요 퇴원 사유</CardTitle>
                  <PieChart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {sortedReasons.length > 0 ? (
                    <div className="space-y-1">
                      <div className="text-sm font-medium truncate">{sortedReasons[0][0]}</div>
                      <p className="text-xs text-muted-foreground">
                        {sortedReasons[0][1]}건 ({((sortedReasons[0][1] / totalExits) * 100).toFixed(0)}%)
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">데이터 없음</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <Tabs value={studentSubTab} onValueChange={setStudentSubTab} className="w-full">
            <TabsList className="flex-wrap">
              <TabsTrigger value="trend" data-testid="tab-trend">학생 수 추이</TabsTrigger>
              <TabsTrigger value="exit" data-testid="tab-exit">퇴원 분석</TabsTrigger>
              <TabsTrigger value="reasons" data-testid="tab-reasons">퇴원 사유</TabsTrigger>
            </TabsList>

            <TabsContent value="trend" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>월별 학생 수 추이</CardTitle>
                  <CardDescription>
                    {studentTrends?.currentYear}년 월별 학생 수{studentTrends?.hasLastYearData ? "와 전년 동기 비교" : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingTrends ? (
                    <div className="h-80 flex items-center justify-center">
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
                          <div className="h-72">
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
                    <div className="h-80 flex items-center justify-center text-muted-foreground">
                      데이터가 없습니다
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="exit" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>월별 퇴원 현황</CardTitle>
                  <CardDescription>학생 수 대비 퇴원 비율</CardDescription>
                </CardHeader>
                <CardContent>
                  {monthlyData.length > 0 ? (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={monthlyData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis 
                            dataKey="month" 
                            tickFormatter={formatMonthShort}
                            className="text-xs"
                          />
                          <YAxis yAxisId="left" className="text-xs" />
                          <YAxis yAxisId="right" orientation="right" unit="%" className="text-xs" />
                          <Tooltip 
                            labelFormatter={formatMonth}
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))', 
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px'
                            }}
                          />
                          <Legend />
                          <Bar 
                            yAxisId="left"
                            dataKey="exitCount" 
                            name="퇴원 수"
                            fill="#EF4444" 
                            radius={[4, 4, 0, 0]}
                          />
                          <Line 
                            yAxisId="right"
                            type="monotone" 
                            dataKey="exitRatio" 
                            name="퇴원율 (%)"
                            stroke="#F59E0B" 
                            strokeWidth={2}
                            dot={{ fill: '#F59E0B', strokeWidth: 2 }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-80 flex items-center justify-center text-muted-foreground">
                      데이터가 없습니다
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reasons" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>퇴원 사유 분석</CardTitle>
                  <CardDescription>최근 {months}개월간 퇴원 사유 통계</CardDescription>
                </CardHeader>
                <CardContent>
                  {reasonChartData.length > 0 ? (
                    <div className="space-y-6">
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={reasonChartData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis type="number" className="text-xs" />
                            <YAxis 
                              type="category" 
                              dataKey="reason" 
                              width={100}
                              className="text-xs"
                            />
                            <Tooltip 
                              formatter={(value: number, name, props) => [
                                `${value}건`,
                                props.payload.fullReason
                              ]}
                              contentStyle={{ 
                                backgroundColor: 'hsl(var(--card))', 
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px'
                              }}
                            />
                            <Bar dataKey="count" name="건수" radius={[0, 4, 4, 0]}>
                              {reasonChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      
                      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                        {sortedReasons.map(([reason, count], index) => (
                          <div 
                            key={reason}
                            className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                          >
                            <div 
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                            />
                            <span className="text-sm truncate flex-1">{reason}</span>
                            <Badge variant="secondary" className="shrink-0">{count}건</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-80 flex items-center justify-center text-muted-foreground">
                      데이터가 없습니다
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="teachers" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    선생님 출퇴근 기록
                  </CardTitle>
                  <CardDescription>
                    선생님들의 출근/퇴근 기록을 달력으로 확인합니다
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm shrink-0">선생님</Label>
                    <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                      <SelectTrigger className="w-32" data-testid="select-teacher-filter">
                        <SelectValue placeholder="전체" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">전체</SelectItem>
                        {uniqueTeachers.map((teacher) => (
                          <SelectItem key={teacher.id} value={teacher.id}>
                            {teacher.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const [y, m] = workStartDate.split("-").map(Number);
                        const prevMonth = m === 1 ? 12 : m - 1;
                        const prevYear = m === 1 ? y - 1 : y;
                        const lastDay = new Date(prevYear, prevMonth, 0).getDate();
                        setWorkStartDate(`${prevYear}-${String(prevMonth).padStart(2, "0")}-01`);
                        setWorkEndDate(`${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`);
                      }}
                      data-testid="button-prev-month"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium min-w-[100px] text-center">
                      {workStartDate ? format(new Date(workStartDate), "yyyy년 M월", { locale: ko }) : "-"}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const [y, m] = workStartDate.split("-").map(Number);
                        const nextMonth = m === 12 ? 1 : m + 1;
                        const nextYear = m === 12 ? y + 1 : y;
                        const lastDay = new Date(nextYear, nextMonth, 0).getDate();
                        setWorkStartDate(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01`);
                        setWorkEndDate(`${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`);
                      }}
                      data-testid="button-next-month"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingWorkRecords ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : (
                (() => {
                  // Build calendar grid
                  const [year, month] = workStartDate.split("-").map(Number);
                  const firstDayOfMonth = new Date(year, month - 1, 1);
                  const lastDayOfMonth = new Date(year, month, 0);
                  const daysInMonth = lastDayOfMonth.getDate();
                  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday
                  
                  // Group records by date
                  const recordsByDate: Record<string, typeof filteredWorkRecords> = {};
                  filteredWorkRecords.forEach(record => {
                    const dateKey = record.workDate;
                    if (!recordsByDate[dateKey]) recordsByDate[dateKey] = [];
                    recordsByDate[dateKey].push(record);
                  });
                  
                  // Calculate total work days and hours
                  const totalWorkDays = Object.keys(recordsByDate).length;
                  const totalWorkMinutes = filteredWorkRecords.reduce((sum, r) => sum + (r.workMinutes || 0), 0);
                  const totalHours = Math.floor(totalWorkMinutes / 60);
                  const totalMins = totalWorkMinutes % 60;
                  
                  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
                  
                  return (
                    <div className="space-y-4">
                      {/* Summary */}
                      <div className="flex gap-4 p-3 bg-muted/50 rounded-lg">
                        <div>
                          <div className="text-xs text-muted-foreground">출근 일수</div>
                          <div className="text-lg font-bold">{totalWorkDays}일</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">총 근무 시간</div>
                          <div className="text-lg font-bold">{totalHours}시간 {totalMins}분</div>
                        </div>
                      </div>
                      
                      {/* Calendar Grid */}
                      <div className="border rounded-lg overflow-hidden">
                        {/* Day headers */}
                        <div className="grid grid-cols-7 bg-muted">
                          {dayNames.map((day, i) => (
                            <div 
                              key={day} 
                              className={`p-2 text-center text-sm font-medium ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : ""}`}
                            >
                              {day}
                            </div>
                          ))}
                        </div>
                        
                        {/* Calendar cells */}
                        <div className="grid grid-cols-7">
                          {/* Empty cells for days before the 1st */}
                          {Array.from({ length: startDayOfWeek }).map((_, i) => (
                            <div key={`empty-${i}`} className="min-h-[80px] p-1 border-t border-r bg-muted/30" />
                          ))}
                          
                          {/* Day cells */}
                          {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1;
                            const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                            const dayRecords = recordsByDate[dateStr] || [];
                            const dayOfWeek = (startDayOfWeek + i) % 7;
                            const isToday = dateStr === format(new Date(), "yyyy-MM-dd");
                            
                            return (
                              <div 
                                key={day} 
                                className={`min-h-[80px] p-1 border-t border-r ${isToday ? "bg-primary/10" : ""} ${dayRecords.length > 0 ? "bg-green-50 dark:bg-green-950/30" : ""}`}
                              >
                                <div className={`text-xs font-medium mb-1 ${dayOfWeek === 0 ? "text-red-500" : dayOfWeek === 6 ? "text-blue-500" : ""}`}>
                                  {day}
                                </div>
                                {dayRecords.map(record => {
                                  const workHours = record.workMinutes ? Math.floor(record.workMinutes / 60) : 0;
                                  const workMins = record.workMinutes ? record.workMinutes % 60 : 0;
                                  return (
                                    <div 
                                      key={record.id} 
                                      className={`text-xs p-1 rounded mb-1 ${record.noCheckOut ? "bg-destructive/20 text-destructive" : "bg-primary/20"}`}
                                      title={`${record.teacherName}: ${record.checkInAt ? formatKoreanTime(record.checkInAt) : "-"} ~ ${record.checkOutAt ? formatKoreanTime(record.checkOutAt) : "-"}`}
                                    >
                                      {selectedTeacherId === "all" && (
                                        <div className="font-medium truncate">{record.teacherName}</div>
                                      )}
                                      <div className="text-muted-foreground">
                                        {record.checkInAt ? formatKoreanTime(record.checkInAt) : "-"}
                                        {" ~ "}
                                        {record.noCheckOut ? "퇴근X" : record.checkOutAt ? formatKoreanTime(record.checkOutAt) : "근무중"}
                                      </div>
                                      {record.workMinutes !== null && (
                                        <div className="font-medium text-primary">
                                          {workHours}h {workMins}m
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                          
                          {/* Empty cells to complete the grid */}
                          {Array.from({ length: (7 - ((startDayOfWeek + daysInMonth) % 7)) % 7 }).map((_, i) => (
                            <div key={`empty-end-${i}`} className="min-h-[80px] p-1 border-t border-r bg-muted/30" />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}
            </CardContent>
          </Card>

          {/* Salary Settings Section */}
          <Card className="mt-6">
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    정규/파트 선생님 급여 설정
                  </CardTitle>
                  <CardDescription>
                    정규 및 파트타임 선생님의 기본급과 성과급을 설정합니다 (관리자/원장만 수정 가능)
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">산정내역 기준월:</span>
                  <Select value={salaryBreakdownYearMonth} onValueChange={setSalaryBreakdownYearMonth}>
                    <SelectTrigger className="w-36" data-testid="select-salary-breakdown-month">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => {
                        const date = new Date();
                        date.setMonth(date.getMonth() - i);
                        const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
                        return (
                          <SelectItem key={ym} value={ym}>{ym}</SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {allTeachersForSalary.filter(t => t.employmentType === "regular" || t.employmentType === "part_time").length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  정규 또는 파트타임 선생님이 없습니다
                </div>
              ) : (
                <div className="space-y-3">
                  {allTeachersForSalary
                    .filter(t => t.employmentType === "regular" || t.employmentType === "part_time")
                    .map(teacher => {
                      const settings = allSalarySettings.find(s => s.teacherId === teacher.id);
                      const isExpanded = expandedSalaryBreakdownTeacherId === teacher.id;
                      return (
                        <div 
                          key={teacher.id}
                          className="rounded-lg border bg-muted/30 overflow-hidden"
                        >
                          <div className="flex items-center justify-between p-3">
                            <div className="flex items-center gap-3">
                              <div>
                                <div className="font-medium">{teacher.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {teacher.employmentType === "regular" ? "정규 선생님" : "파트타임 선생님"}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {!settings && (
                                <span className="text-sm text-muted-foreground mr-2">설정 없음</span>
                              )}
                              {settings && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setExpandedSalaryBreakdownTeacherId(isExpanded ? null : teacher.id)}
                                  data-testid={`button-salary-breakdown-${teacher.id}`}
                                >
                                  <Calculator className="h-4 w-4 mr-1" />
                                  산정내역
                                  <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                </Button>
                              )}
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => openSalarySettings(teacher.id)}
                                data-testid={`button-salary-settings-${teacher.id}`}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                설정
                              </Button>
                            </div>
                          </div>
                          {isExpanded && settings && (
                            <div className="border-t p-3 bg-background">
                              <SalaryBreakdownPanel 
                                teacherId={teacher.id} 
                                yearMonth={salaryBreakdownYearMonth}
                                centerId={selectedCenter?.id || ""}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Hourly Teacher Daily Rate Settings */}
          <Card className="mt-6">
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    아르바이트 일급 설정
                  </CardTitle>
                  <CardDescription>
                    아르바이트 선생님의 일급을 설정합니다 (관리자/원장만 수정 가능)
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {allTeachersForSalary.filter(t => t.employmentType === "hourly").length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  아르바이트 선생님이 없습니다
                </div>
              ) : (
                <div className="space-y-3">
                  {allTeachersForSalary
                    .filter(t => t.employmentType === "hourly")
                    .map(teacher => (
                      <div 
                        key={teacher.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                      >
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="font-medium">{teacher.name}</div>
                            <div className="text-sm text-muted-foreground">
                              아르바이트 선생님
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {editingDailyRateTeacherId === teacher.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                value={editingDailyRateValue}
                                onChange={(e) => setEditingDailyRateValue(parseInt(e.target.value) || 0)}
                                className="w-32"
                                placeholder="일급"
                                data-testid={`input-daily-rate-${teacher.id}`}
                              />
                              <span className="text-sm text-muted-foreground">원</span>
                              <Button 
                                size="sm"
                                onClick={() => {
                                  updateDailyRateMutation.mutate({
                                    teacherId: teacher.id,
                                    dailyRate: editingDailyRateValue,
                                  });
                                  setEditingDailyRateTeacherId(null);
                                }}
                                disabled={updateDailyRateMutation.isPending}
                                data-testid={`button-save-daily-rate-${teacher.id}`}
                              >
                                저장
                              </Button>
                              <Button 
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingDailyRateTeacherId(null)}
                                data-testid={`button-cancel-daily-rate-${teacher.id}`}
                              >
                                취소
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div className="text-right text-sm">
                                {teacher.dailyRate ? (
                                  <div className="font-medium">일급: {formatBudget(teacher.dailyRate)}</div>
                                ) : (
                                  <span className="text-muted-foreground">일급 미설정</span>
                                )}
                              </div>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setEditingDailyRateTeacherId(teacher.id);
                                  setEditingDailyRateValue(teacher.dailyRate || 0);
                                }}
                                data-testid={`button-edit-daily-rate-${teacher.id}`}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                수정
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="finance" className="mt-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(() => {
              const selectedRecord = financeRecords.find(r => r.yearMonth === selectedFinanceMonth);
              const summary = calculateFinanceSummary(selectedRecord || null);
              return (
                <>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">매출</div>
                      <div className="text-2xl font-bold text-primary">
                        {formatBudget(summary.revenue)}
                      </div>
                      <div className="text-xs text-muted-foreground">수강료</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">인건비</div>
                      <div className="text-2xl font-bold text-orange-600">
                        {formatBudget(summary.laborCost)}
                      </div>
                      <div className="text-xs text-muted-foreground">정규/파트/알바 급여 + 4대보험</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">판관비</div>
                      <div className="text-2xl font-bold text-amber-600">
                        {formatBudget(summary.operatingExpense)}
                      </div>
                      <div className="text-xs text-muted-foreground">운영 비용</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">영업이익</div>
                      <div className={`text-2xl font-bold ${summary.operatingProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                        {summary.operatingProfit >= 0 ? '+' : ''}{formatBudget(summary.operatingProfit)}
                      </div>
                      <div className="text-xs text-muted-foreground">매출 - 인건비 - 판관비</div>
                    </CardContent>
                  </Card>
                </>
              );
            })()}
          </div>

          {/* Monthly Chart */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    월별 재무 현황
                  </CardTitle>
                  <CardDescription>
                    매출, 인건비, 판관비, 영업이익 추이
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={String(financeYear)} onValueChange={(v) => setFinanceYear(Number(v))}>
                    <SelectTrigger className="w-28" data-testid="select-finance-year">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(y => (
                        <SelectItem key={y} value={String(y)}>{y}년</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingFinance ? (
                <Skeleton className="h-64 w-full" />
              ) : financeChartData.length > 0 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={financeChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis 
                        tickFormatter={(v) => formatBudget(v)} 
                        className="text-xs"
                        width={80}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => [formatBudget(value), name]}
                        labelFormatter={(label) => `${label}`}
                      />
                      <Legend />
                      <Bar dataKey="매출" fill="#3B82F6" />
                      <Bar dataKey="인건비" fill="#F97316" />
                      <Bar dataKey="판관비" fill="#F59E0B" />
                      <Line type="monotone" dataKey="영업이익" stroke="#10B981" strokeWidth={2} dot={{ r: 4 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <DollarSign className="h-10 w-10" />
                  <p>{financeYear}년 재무 기록이 없습니다</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Monthly Records Table */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    월별 재무 기록
                  </CardTitle>
                  <CardDescription>
                    월별 수입/지출 항목을 관리합니다
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={selectedFinanceMonth} onValueChange={setSelectedFinanceMonth}>
                    <SelectTrigger className="w-32" data-testid="select-finance-month">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => {
                        const m = `${financeYear}-${String(i + 1).padStart(2, "0")}`;
                        return (
                          <SelectItem key={m} value={m}>{i + 1}월</SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {!financeRecords.find(r => r.yearMonth === selectedFinanceMonth) && (
                    <Button
                      onClick={() => openNewFinance(selectedFinanceMonth)}
                      data-testid="button-add-finance"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      등록
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {(() => {
                const record = financeRecords.find(r => r.yearMonth === selectedFinanceMonth);
                if (!record) {
                  return (
                    <div className="h-40 flex flex-col items-center justify-center text-muted-foreground gap-2">
                      <DollarSign className="h-10 w-10" />
                      <p>{formatMonth(selectedFinanceMonth)} 재무 기록이 없습니다</p>
                      <Button variant="outline" onClick={() => openNewFinance(selectedFinanceMonth)}>
                        <Plus className="h-4 w-4 mr-1" />
                        재무 기록 등록
                      </Button>
                    </div>
                  );
                }
                
                const summary = calculateFinanceSummary(record);
                const { revenue: parsedRevenue, expenses: parsedExpenses } = parseItemsFromRecord(record);
                
                return (
                  <div className="space-y-6">
                    {/* Revenue Section */}
                    <div className="border-2 border-primary/30 rounded-lg p-4 bg-primary/5">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                          <TrendingUp className="h-5 w-5 text-primary" />
                          매출
                          <Badge className="ml-2">{formatBudget(summary.revenue)}</Badge>
                        </h3>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => syncTuitionMutation.mutate()}
                            disabled={syncTuitionMutation.isPending}
                            data-testid="button-sync-tuition"
                          >
                            <RefreshCw className={`h-3 w-3 mr-1 ${syncTuitionMutation.isPending ? 'animate-spin' : ''}`} />
                            교육비 동기화
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setFinanceDialogTab("revenue");
                              openEditFinance(record);
                            }}
                            data-testid="button-edit-revenue"
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            수정
                          </Button>
                        </div>
                      </div>
                      {parsedRevenue.length > 0 ? (
                        <div className="space-y-1">
                          {parsedRevenue.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-background rounded px-3 py-2">
                              <div className="flex items-center gap-2">
                                {item.studentId ? (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <button className="text-left hover:underline cursor-pointer">
                                        <span className="font-medium">{item.name}</span>
                                        {(item.school || item.grade) && (
                                          <span className="text-muted-foreground text-sm ml-2">
                                            {item.school} {item.grade}
                                          </span>
                                        )}
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-64">
                                      <div className="space-y-2">
                                        <div className="font-medium">{item.name} 수강 수업</div>
                                        {item.classes && item.classes.length > 0 ? (
                                          <ul className="space-y-1 text-sm">
                                            {item.classes.map((cls) => (
                                              <li key={cls.id} className="flex items-center gap-2">
                                                <Badge variant="outline" className="text-xs">{cls.subject}</Badge>
                                                {cls.name}
                                              </li>
                                            ))}
                                          </ul>
                                        ) : (
                                          <p className="text-sm text-muted-foreground">수강 수업 없음</p>
                                        )}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                ) : (
                                  <span>{item.name || '(항목명 없음)'}</span>
                                )}
                              </div>
                              <span className="font-medium">{formatBudget(item.amount)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">(세부 항목 없음)</p>
                      )}
                    </div>

                    {/* Expense Section */}
                    <div className="border-2 border-destructive/30 rounded-lg p-4 bg-destructive/5">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                          <Briefcase className="h-5 w-5 text-destructive" />
                          지출
                          <Badge variant="destructive" className="ml-2">{formatBudget(summary.laborCost + summary.operatingExpense)}</Badge>
                        </h3>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setFinanceDialogTab("expense");
                            openEditFinance(record);
                          }}
                          data-testid="button-edit-expense"
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          수정
                        </Button>
                      </div>
                      {parsedExpenses.length > 0 ? (
                        <div className="space-y-1">
                          {parsedExpenses.map((item, idx) => (
                            <div key={idx} className="flex justify-between bg-background rounded px-3 py-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">{getCategoryLabel(item.category)}</Badge>
                                <span>{(item.name || '(항목명 없음)').replace(/\s*\([^)]*\)/g, '')}</span>
                              </div>
                              <span className="font-medium">{formatBudget(item.amount)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">(세부 항목 없음)</p>
                      )}
                      
                      {/* Category Summary */}
                      {parsedExpenses.length > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <h4 className="font-medium mb-2 text-sm">분류별 합계</h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                            {expenseCategories.map(cat => {
                              const total = parsedExpenses.filter(e => e.category === cat.key).reduce((sum, e) => sum + e.amount, 0);
                              if (total === 0) return null;
                              return (
                                <div key={cat.key} className="flex justify-between bg-muted/50 rounded px-2 py-1">
                                  <span className="text-muted-foreground">{cat.label}</span>
                                  <span className="font-medium">{formatBudget(total)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Summary */}
                    <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-muted-foreground">총 지출</div>
                          <div className="text-xl font-bold">
                            {formatBudget(summary.laborCost + summary.operatingExpense)}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">영업이익</div>
                          <div className={`text-xl font-bold ${summary.operatingProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                            {summary.operatingProfit >= 0 ? '+' : ''}{formatBudget(summary.operatingProfit)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (confirm(`${formatMonth(record.yearMonth)} 재무 기록을 삭제하시겠습니까?`)) {
                            deleteFinanceMutation.mutate(record.id);
                          }
                        }}
                        data-testid="button-delete-finance"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        삭제
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Finance Dialog */}
          <Dialog open={showFinanceDialog} onOpenChange={setShowFinanceDialog}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingFinance ? `${formatMonth(editingFinance.yearMonth)} 재무 수정` : `${formatMonth(selectedFinanceMonth)} 재무 등록`}
                </DialogTitle>
              </DialogHeader>
              
              {/* Tab Buttons */}
              <div className="flex gap-2 border-b pb-2">
                <Button
                  variant={financeDialogTab === "revenue" ? "default" : "outline"}
                  onClick={() => setFinanceDialogTab("revenue")}
                  className="flex-1"
                  data-testid="button-tab-revenue"
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  매출
                  <Badge variant="secondary" className="ml-2">
                    {formatBudget(calculateRevenueTotal())}
                  </Badge>
                </Button>
                <Button
                  variant={financeDialogTab === "expense" ? "destructive" : "outline"}
                  onClick={() => setFinanceDialogTab("expense")}
                  className="flex-1"
                  data-testid="button-tab-expense"
                >
                  <Briefcase className="h-4 w-4 mr-2" />
                  지출
                  <Badge variant="secondary" className="ml-2">
                    {formatBudget(calculateExpenseTotal())}
                  </Badge>
                </Button>
              </div>

              <div className="space-y-6 py-4">
                {/* Revenue Section - 매출 */}
                {financeDialogTab === "revenue" && (
                  <div className="border-2 border-primary/30 rounded-lg p-4 bg-primary/5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-lg flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        매출 항목
                      </h3>
                      <Button size="sm" onClick={addRevenueItem} data-testid="button-add-revenue">
                        <Plus className="h-3 w-3 mr-1" />
                        매출 추가
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {revenueItems.map((item, index) => (
                        <div key={index} className="flex items-center gap-2 bg-background rounded p-2">
                          <Input
                            placeholder="매출 항목명 (예: 수강료, 교재판매)"
                            value={item.name}
                            onChange={(e) => updateRevenueItem(index, "name", e.target.value)}
                            className="flex-1"
                            data-testid={`input-revenue-name-${index}`}
                          />
                          <Input
                            type="number"
                            placeholder="금액"
                            value={item.amount || ""}
                            onChange={(e) => updateRevenueItem(index, "amount", e.target.value)}
                            className="w-32"
                            data-testid={`input-revenue-amount-${index}`}
                          />
                          <span className="text-sm text-muted-foreground shrink-0">원</span>
                          <Button size="icon" variant="ghost" onClick={() => removeRevenueItem(index)} data-testid={`button-remove-revenue-${index}`}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                      {revenueItems.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">매출 추가 버튼을 눌러 수강료 등을 입력하세요</p>
                      )}
                    </div>
                    {revenueItems.length > 0 && (
                      <div className="mt-4 pt-4 border-t flex justify-end">
                        <div className="text-lg font-bold text-primary">
                          합계: {formatBudget(calculateRevenueTotal())}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Expense Section - 지출 */}
                {financeDialogTab === "expense" && (
                  <div className="space-y-4">
                    {/* 인건비 섹션 */}
                    <div className="border-2 border-orange-400/30 rounded-lg p-4 bg-orange-50/50 dark:bg-orange-950/20">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                          <Users className="h-5 w-5 text-orange-600" />
                          인건비
                        </h3>
                        <Select 
                          value={selectedSalaryTeacher} 
                          onValueChange={(v) => {
                            setSelectedSalaryTeacher(v);
                            addTeacherSalaryExpense(v);
                          }}
                        >
                          <SelectTrigger className="w-48" data-testid="select-add-teacher-salary">
                            <SelectValue placeholder={loadingTeachers ? "불러오는 중..." : "선생님 급여 추가"} />
                          </SelectTrigger>
                          <SelectContent>
                            {teacherList.length === 0 ? (
                              <SelectItem value="__none" disabled>선생님이 없습니다</SelectItem>
                            ) : (
                              teacherList.map(t => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.name} ({t.employmentType === "regular" ? "정규직" : t.employmentType === "part_time" ? "파트타임" : "아르바이트"})
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        {expenseItems.filter(item => expenseCategories.find(c => c.key === item.category)?.group === "인건비").map((item, _) => {
                          const actualIndex = expenseItems.findIndex(e => e === item);
                          return (
                            <div key={actualIndex} className="flex items-center gap-2 bg-background rounded p-2">
                              <Select
                                value={item.category}
                                onValueChange={(value) => updateExpenseItem(actualIndex, "category", value)}
                              >
                                <SelectTrigger className="w-36" data-testid={`select-expense-category-${actualIndex}`}>
                                  <SelectValue placeholder="분류 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                  {expenseCategories.filter(c => c.group === "인건비").map(cat => (
                                    <SelectItem key={cat.key} value={cat.key}>{cat.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                placeholder="선생님 이름"
                                value={item.name}
                                onChange={(e) => updateExpenseItem(actualIndex, "name", e.target.value)}
                                className="flex-1"
                                data-testid={`input-expense-name-${actualIndex}`}
                              />
                              <Input
                                type="number"
                                placeholder="금액"
                                value={item.amount || ""}
                                onChange={(e) => updateExpenseItem(actualIndex, "amount", e.target.value)}
                                className="w-32"
                                data-testid={`input-expense-amount-${actualIndex}`}
                              />
                              <span className="text-sm text-muted-foreground shrink-0">원</span>
                              <Button size="icon" variant="ghost" onClick={() => removeExpenseItem(actualIndex)} data-testid={`button-remove-expense-${actualIndex}`}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          );
                        })}
                        {expenseItems.filter(item => expenseCategories.find(c => c.key === item.category)?.group === "인건비").length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-3">선생님 급여 추가 버튼으로 인건비를 입력하세요</p>
                        )}
                      </div>
                      {/* 인건비 소계 */}
                      {expenseItems.filter(item => expenseCategories.find(c => c.key === item.category)?.group === "인건비").length > 0 && (
                        <div className="mt-3 pt-3 border-t border-orange-200 dark:border-orange-800 flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">인건비 소계</span>
                          <span className="font-bold text-orange-600">{formatBudget(
                            expenseItems.filter(item => expenseCategories.find(c => c.key === item.category)?.group === "인건비")
                              .reduce((sum, item) => sum + (item.amount || 0), 0)
                          )}</span>
                        </div>
                      )}
                    </div>

                    {/* 고정비 섹션 - 매달 유지되는 금액 */}
                    <div className="border-2 border-blue-400/30 rounded-lg p-4 bg-blue-50/50 dark:bg-blue-950/20">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                          <Calendar className="h-5 w-5 text-blue-600" />
                          고정비 (매월 유지)
                        </h3>
                        <Button size="sm" variant="outline" onClick={() => setExpenseItems(prev => [...prev, { name: "", amount: 0, category: "expenseRent" }])} data-testid="button-add-fixed-expense">
                          <Plus className="h-3 w-3 mr-1" />
                          고정비 추가
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {expenseItems.filter(item => expenseCategories.find(c => c.key === item.category)?.group === "고정비").map((item, _) => {
                          const actualIndex = expenseItems.findIndex(e => e === item);
                          return (
                            <div key={actualIndex} className="flex items-center gap-2 bg-background rounded p-2">
                              <Select
                                value={item.category}
                                onValueChange={(value) => updateExpenseItem(actualIndex, "category", value)}
                              >
                                <SelectTrigger className="w-36" data-testid={`select-expense-category-${actualIndex}`}>
                                  <SelectValue placeholder="분류 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                  {expenseCategories.filter(c => c.group === "고정비").map(cat => (
                                    <SelectItem key={cat.key} value={cat.key}>{cat.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                placeholder="지출처 (예: 건물주, 한국전력)"
                                value={item.name}
                                onChange={(e) => updateExpenseItem(actualIndex, "name", e.target.value)}
                                className="flex-1"
                                data-testid={`input-expense-name-${actualIndex}`}
                              />
                              <Input
                                type="number"
                                placeholder="금액"
                                value={item.amount || ""}
                                onChange={(e) => updateExpenseItem(actualIndex, "amount", e.target.value)}
                                className="w-32"
                                data-testid={`input-expense-amount-${actualIndex}`}
                              />
                              <span className="text-sm text-muted-foreground shrink-0">원</span>
                              <Button size="icon" variant="ghost" onClick={() => removeExpenseItem(actualIndex)} data-testid={`button-remove-expense-${actualIndex}`}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          );
                        })}
                        {expenseItems.filter(item => expenseCategories.find(c => c.key === item.category)?.group === "고정비").length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-3">고정비 추가 버튼으로 임대료, 통신비 등 매월 발생하는 지출을 입력하세요</p>
                        )}
                      </div>
                      {/* 고정비 소계 */}
                      {expenseItems.filter(item => expenseCategories.find(c => c.key === item.category)?.group === "고정비").length > 0 && (
                        <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800 flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">고정비 소계</span>
                          <span className="font-bold text-blue-600">{formatBudget(
                            expenseItems.filter(item => expenseCategories.find(c => c.key === item.category)?.group === "고정비")
                              .reduce((sum, item) => sum + (item.amount || 0), 0)
                          )}</span>
                        </div>
                      )}
                    </div>

                    {/* 판관비 섹션 */}
                    <div className="border-2 border-amber-400/30 rounded-lg p-4 bg-amber-50/50 dark:bg-amber-950/20">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                          <Briefcase className="h-5 w-5 text-amber-600" />
                          판관비 (판매/관리비)
                        </h3>
                        <Button size="sm" variant="outline" onClick={() => setExpenseItems(prev => [...prev, { name: "", amount: 0, category: "expenseWelfare" }])} data-testid="button-add-operating-expense">
                          <Plus className="h-3 w-3 mr-1" />
                          판관비 추가
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {expenseItems.filter(item => expenseCategories.find(c => c.key === item.category)?.group === "판관비").map((item, _) => {
                          const actualIndex = expenseItems.findIndex(e => e === item);
                          return (
                            <div key={actualIndex} className="flex items-center gap-2 bg-background rounded p-2">
                              <Select
                                value={item.category}
                                onValueChange={(value) => updateExpenseItem(actualIndex, "category", value)}
                              >
                                <SelectTrigger className="w-36" data-testid={`select-expense-category-${actualIndex}`}>
                                  <SelectValue placeholder="분류 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                  {expenseCategories.filter(c => c.group === "판관비").map(cat => (
                                    <SelectItem key={cat.key} value={cat.key}>{cat.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                placeholder="지출처 (예: 한국전력, 임대인)"
                                value={item.name}
                                onChange={(e) => updateExpenseItem(actualIndex, "name", e.target.value)}
                                className="flex-1"
                                data-testid={`input-expense-name-${actualIndex}`}
                              />
                              <Input
                                type="number"
                                placeholder="금액"
                                value={item.amount || ""}
                                onChange={(e) => updateExpenseItem(actualIndex, "amount", e.target.value)}
                                className="w-32"
                                data-testid={`input-expense-amount-${actualIndex}`}
                              />
                              <span className="text-sm text-muted-foreground shrink-0">원</span>
                              <Button size="icon" variant="ghost" onClick={() => removeExpenseItem(actualIndex)} data-testid={`button-remove-expense-${actualIndex}`}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          );
                        })}
                        {expenseItems.filter(item => expenseCategories.find(c => c.key === item.category)?.group === "판관비").length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-3">판관비 추가 버튼으로 기타 지출을 입력하세요</p>
                        )}
                      </div>
                      {/* 판관비 소계 */}
                      {expenseItems.filter(item => expenseCategories.find(c => c.key === item.category)?.group === "판관비").length > 0 && (
                        <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-800 flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">판관비 소계</span>
                          <span className="font-bold text-amber-600">{formatBudget(
                            expenseItems.filter(item => expenseCategories.find(c => c.key === item.category)?.group === "판관비")
                              .reduce((sum, item) => sum + (item.amount || 0), 0)
                          )}</span>
                        </div>
                      )}
                    </div>

                    {/* 지출 총합계 */}
                    {expenseItems.length > 0 && (
                      <div className="bg-destructive/10 rounded-lg p-3 flex justify-between items-center">
                        <span className="font-medium">총 지출</span>
                        <span className="text-xl font-bold text-destructive">{formatBudget(calculateExpenseTotal())}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Summary - Always visible */}
                <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-sm text-muted-foreground">총 매출</div>
                      <div className="text-xl font-bold text-primary">{formatBudget(calculateRevenueTotal())}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">총 지출</div>
                      <div className="text-xl font-bold text-destructive">{formatBudget(calculateExpenseTotal())}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">영업이익</div>
                      <div className={`text-xl font-bold ${calculateRevenueTotal() - calculateExpenseTotal() >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                        {calculateRevenueTotal() - calculateExpenseTotal() >= 0 ? '+' : ''}{formatBudget(calculateRevenueTotal() - calculateExpenseTotal())}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowFinanceDialog(false)}>
                  취소
                </Button>
                <Button
                  onClick={handleSaveFinance}
                  disabled={createFinanceMutation.isPending || updateFinanceMutation.isPending}
                  data-testid="button-save-finance"
                >
                  {createFinanceMutation.isPending || updateFinanceMutation.isPending ? "저장 중..." : "저장"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="marketing" className="mt-6 space-y-6">
          {/* Year-over-Year Comparison Chart */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    마케팅 예산 비교
                  </CardTitle>
                  <CardDescription>
                    올해 vs 작년 월별 마케팅 비용 비교
                  </CardDescription>
                </div>
                <Button
                  onClick={() => {
                    resetCampaignForm();
                    setEditingCampaign(null);
                    setShowCampaignDialog(true);
                  }}
                  data-testid="button-add-campaign"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  캠페인 추가
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingMarketing ? (
                <Skeleton className="h-64 w-full" />
              ) : marketingComparison ? (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-sm text-muted-foreground">올해 총 비용</div>
                        <div className="text-2xl font-bold text-primary">
                          {formatBudget(marketingComparison.currentYearTotal)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {marketingComparison.currentYearCampaigns.length}개 캠페인
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-sm text-muted-foreground">작년 총 비용</div>
                        <div className="text-2xl font-bold">
                          {formatBudget(marketingComparison.lastYearTotal)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {marketingComparison.lastYearCampaigns.length}개 캠페인
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-sm text-muted-foreground">전년 대비</div>
                        {marketingComparison.lastYearTotal > 0 ? (
                          <>
                            <div className={`text-2xl font-bold flex items-center gap-1 ${
                              marketingComparison.currentYearTotal > marketingComparison.lastYearTotal 
                                ? "text-destructive" 
                                : "text-green-600"
                            }`}>
                              {marketingComparison.currentYearTotal > marketingComparison.lastYearTotal ? (
                                <TrendingUp className="h-5 w-5" />
                              ) : (
                                <TrendingDown className="h-5 w-5" />
                              )}
                              {Math.abs(Math.round(
                                ((marketingComparison.currentYearTotal - marketingComparison.lastYearTotal) / 
                                marketingComparison.lastYearTotal) * 100
                              ))}%
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {marketingComparison.currentYearTotal > marketingComparison.lastYearTotal ? "증가" : "감소"}
                            </div>
                          </>
                        ) : (
                          <div className="text-2xl font-bold text-muted-foreground">-</div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Comparison Chart */}
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={marketingComparison.currentYearMonthly.map((curr, i) => ({
                          month: `${curr.month}월`,
                          올해: curr.total,
                          작년: marketingComparison.lastYearMonthly[i]?.total || 0,
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis tickFormatter={(v) => formatBudget(v)} />
                        <Tooltip formatter={(v: number) => formatBudget(v)} />
                        <Legend />
                        <Bar dataKey="올해" fill="#3B82F6" />
                        <Bar dataKey="작년" fill="#94A3B8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="h-40 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <Megaphone className="h-10 w-10" />
                  <p>마케팅 데이터가 없습니다</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Campaign List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                캠페인 목록
              </CardTitle>
              <CardDescription>
                올해 진행한 마케팅 캠페인
              </CardDescription>
            </CardHeader>
            <CardContent>
              {marketingComparison?.currentYearCampaigns && marketingComparison.currentYearCampaigns.length > 0 ? (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">캠페인명</TableHead>
                        <TableHead className="whitespace-nowrap">채널</TableHead>
                        <TableHead className="whitespace-nowrap">시작일</TableHead>
                        <TableHead className="whitespace-nowrap">종료일</TableHead>
                        <TableHead className="whitespace-nowrap text-right">예산</TableHead>
                        <TableHead className="whitespace-nowrap">기간</TableHead>
                        <TableHead className="whitespace-nowrap text-center">관리</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {marketingComparison.currentYearCampaigns.map((campaign) => {
                        const start = parseISO(campaign.startDate);
                        const end = parseISO(campaign.endDate);
                        const days = differenceInDays(end, start) + 1;
                        
                        return (
                          <TableRow key={campaign.id} data-testid={`row-campaign-${campaign.id}`}>
                            <TableCell className="font-medium whitespace-nowrap">
                              {campaign.name}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Badge variant="secondary">{getChannelLabel(campaign.channel)}</Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {format(start, "M월 d일", { locale: ko })}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {format(end, "M월 d일", { locale: ko })}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right font-medium">
                              {formatBudget(campaign.budget)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {days}일
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => openEditCampaign(campaign)}
                                  data-testid={`button-edit-campaign-${campaign.id}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    if (confirm("이 캠페인을 삭제하시겠습니까?")) {
                                      deleteCampaignMutation.mutate(campaign.id);
                                    }
                                  }}
                                  data-testid={`button-delete-campaign-${campaign.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="h-40 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <Calendar className="h-10 w-10" />
                  <p>올해 등록된 캠페인이 없습니다</p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      resetCampaignForm();
                      setEditingCampaign(null);
                      setShowCampaignDialog(true);
                    }}
                    data-testid="button-add-campaign-empty"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    첫 캠페인 등록하기
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Campaign Dialog */}
          <Dialog open={showCampaignDialog} onOpenChange={setShowCampaignDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingCampaign ? "캠페인 수정" : "캠페인 추가"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="campaign-name">캠페인명 *</Label>
                  <Input
                    id="campaign-name"
                    value={campaignForm.name}
                    onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                    placeholder="예: 1월 네이버 검색광고"
                    data-testid="input-campaign-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="campaign-channel">채널 *</Label>
                  <Select
                    value={campaignForm.channel}
                    onValueChange={(value) => setCampaignForm({ ...campaignForm, channel: value })}
                  >
                    <SelectTrigger data-testid="select-campaign-channel">
                      <SelectValue placeholder="채널 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {MARKETING_CHANNEL_LIST.map((ch) => (
                        <SelectItem key={ch.key} value={ch.key}>
                          {ch.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="campaign-start">시작일 *</Label>
                    <Input
                      id="campaign-start"
                      type="date"
                      value={campaignForm.startDate}
                      onChange={(e) => setCampaignForm({ ...campaignForm, startDate: e.target.value })}
                      data-testid="input-campaign-start"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="campaign-end">종료일 *</Label>
                    <Input
                      id="campaign-end"
                      type="date"
                      value={campaignForm.endDate}
                      onChange={(e) => setCampaignForm({ ...campaignForm, endDate: e.target.value })}
                      data-testid="input-campaign-end"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="campaign-budget">예산 (원) *</Label>
                  <Input
                    id="campaign-budget"
                    type="number"
                    value={campaignForm.budget}
                    onChange={(e) => setCampaignForm({ ...campaignForm, budget: parseInt(e.target.value) || 0 })}
                    placeholder="예: 500000"
                    data-testid="input-campaign-budget"
                  />
                  {campaignForm.budget > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {formatBudget(campaignForm.budget)}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="campaign-notes">메모</Label>
                  <Textarea
                    id="campaign-notes"
                    value={campaignForm.notes}
                    onChange={(e) => setCampaignForm({ ...campaignForm, notes: e.target.value })}
                    placeholder="캠페인 관련 메모"
                    rows={3}
                    data-testid="input-campaign-notes"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCampaignDialog(false);
                    setEditingCampaign(null);
                    resetCampaignForm();
                  }}
                  data-testid="button-cancel-campaign"
                >
                  취소
                </Button>
                <Button
                  onClick={handleSaveCampaign}
                  disabled={createCampaignMutation.isPending || updateCampaignMutation.isPending}
                  data-testid="button-save-campaign"
                >
                  {createCampaignMutation.isPending || updateCampaignMutation.isPending ? "저장 중..." : "저장"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>

      {/* Salary Settings Dialog */}
      <Dialog open={showSalarySettingsDialog} onOpenChange={setShowSalarySettingsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>급여 설정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="font-medium">
                {allTeachersForSalary.find(t => t.id === selectedTeacherForSalary)?.name || "-"} 선생님
              </div>
              <div className="text-sm text-muted-foreground">
                {allTeachersForSalary.find(t => t.id === selectedTeacherForSalary)?.employmentType === "regular" 
                  ? "정규 선생님" : "파트타임 선생님"}
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="salary-base">기본급 (월)</Label>
                <Input
                  id="salary-base"
                  type="number"
                  value={salarySettingsForm.baseSalary || ""}
                  onChange={(e) => setSalarySettingsForm({ ...salarySettingsForm, baseSalary: parseInt(e.target.value) || 0 })}
                  placeholder="예: 2000000"
                  data-testid="input-salary-base"
                />
                {salarySettingsForm.baseSalary > 0 && (
                  <p className="text-xs text-muted-foreground">{formatBudget(salarySettingsForm.baseSalary)}</p>
                )}
              </div>

              <div className="border-t pt-3 mt-3">
                <div className="text-sm font-medium mb-2">성과급 설정</div>
                <p className="text-xs text-muted-foreground mb-3">
                  수업당 기본급 (중등/고등 별도) + (기준 인원 초과 학생 × 초과 학생당 추가금)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="salary-class-base-middle">중등 수업당 기본급</Label>
                  <Input
                    id="salary-class-base-middle"
                    type="number"
                    value={salarySettingsForm.classBasePayMiddle || ""}
                    onChange={(e) => setSalarySettingsForm({ ...salarySettingsForm, classBasePayMiddle: parseInt(e.target.value) || 0 })}
                    placeholder="예: 100000"
                    data-testid="input-salary-class-base-middle"
                  />
                  {salarySettingsForm.classBasePayMiddle > 0 && (
                    <p className="text-xs text-muted-foreground">{formatBudget(salarySettingsForm.classBasePayMiddle)}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salary-class-base-high">고등 수업당 기본급</Label>
                  <Input
                    id="salary-class-base-high"
                    type="number"
                    value={salarySettingsForm.classBasePayHigh || ""}
                    onChange={(e) => setSalarySettingsForm({ ...salarySettingsForm, classBasePayHigh: parseInt(e.target.value) || 0 })}
                    placeholder="예: 120000"
                    data-testid="input-salary-class-base-high"
                  />
                  {salarySettingsForm.classBasePayHigh > 0 && (
                    <p className="text-xs text-muted-foreground">{formatBudget(salarySettingsForm.classBasePayHigh)}</p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-medium text-muted-foreground">중등 기준인원 / 추가금</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="salary-threshold-middle">중등 기준 인원</Label>
                    <Input
                      id="salary-threshold-middle"
                      type="number"
                      value={salarySettingsForm.studentThresholdMiddle || ""}
                      onChange={(e) => setSalarySettingsForm({ ...salarySettingsForm, studentThresholdMiddle: parseInt(e.target.value) || 0 })}
                      placeholder="예: 5"
                      data-testid="input-salary-threshold-middle"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="salary-per-student-middle">중등 초과 학생당 추가금</Label>
                    <Input
                      id="salary-per-student-middle"
                      type="number"
                      value={salarySettingsForm.perStudentBonusMiddle || ""}
                      onChange={(e) => setSalarySettingsForm({ ...salarySettingsForm, perStudentBonusMiddle: parseInt(e.target.value) || 0 })}
                      placeholder="예: 10000"
                      data-testid="input-salary-per-student-middle"
                    />
                    {salarySettingsForm.perStudentBonusMiddle > 0 && (
                      <p className="text-xs text-muted-foreground">{formatBudget(salarySettingsForm.perStudentBonusMiddle)}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-medium text-muted-foreground">고등 기준인원 / 추가금</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="salary-threshold-high">고등 기준 인원</Label>
                    <Input
                      id="salary-threshold-high"
                      type="number"
                      value={salarySettingsForm.studentThresholdHigh || ""}
                      onChange={(e) => setSalarySettingsForm({ ...salarySettingsForm, studentThresholdHigh: parseInt(e.target.value) || 0 })}
                      placeholder="예: 4"
                      data-testid="input-salary-threshold-high"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="salary-per-student-high">고등 초과 학생당 추가금</Label>
                    <Input
                      id="salary-per-student-high"
                      type="number"
                      value={salarySettingsForm.perStudentBonusHigh || ""}
                      onChange={(e) => setSalarySettingsForm({ ...salarySettingsForm, perStudentBonusHigh: parseInt(e.target.value) || 0 })}
                      placeholder="예: 15000"
                      data-testid="input-salary-per-student-high"
                    />
                    {salarySettingsForm.perStudentBonusHigh > 0 && (
                      <p className="text-xs text-muted-foreground">{formatBudget(salarySettingsForm.perStudentBonusHigh)}</p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">기준 인원 초과시 추가금 발생</p>
              </div>
            </div>

            {salaryCalculation && (
              <div className="border-t pt-3 mt-3">
                <div className="text-sm font-medium mb-2">예상 급여 계산</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>기본급</span>
                    <span>{formatBudget(salaryCalculation.baseSalary)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>성과급 ({salaryCalculation.breakdown.classCount}개 수업)</span>
                    <span>{formatBudget(salaryCalculation.performanceBonus)}</span>
                  </div>
                  <div className="flex justify-between font-medium border-t pt-2">
                    <span>자동계산 급여</span>
                    <span>{formatBudget(salaryCalculation.totalSalary)}</span>
                  </div>
                  
                  {/* 급여 조정 항목 */}
                  {salaryAdjustments.length > 0 && (
                    <div className="space-y-1 pt-2">
                      {salaryAdjustments.map((adj) => (
                        <div key={adj.id} className="flex justify-between items-center text-sm">
                          <div className="flex items-center gap-2">
                            <span className={adj.amount >= 0 ? "text-green-600" : "text-red-600"}>
                              {adj.amount >= 0 ? "+" : ""}{formatBudget(adj.amount)}
                            </span>
                            <span className="text-muted-foreground text-xs">{adj.description}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteAdjustmentMutation.mutate(adj.id)}
                            data-testid={`button-delete-adjustment-${adj.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {totalAdjustments !== 0 && (
                    <div className="flex justify-between text-sm pt-1">
                      <span>조정 합계</span>
                      <span className={totalAdjustments >= 0 ? "text-green-600" : "text-red-600"}>
                        {totalAdjustments >= 0 ? "+" : ""}{formatBudget(totalAdjustments)}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex justify-between font-bold border-t pt-2">
                    <span>최종 급여</span>
                    <span className="text-primary">{formatBudget(salaryCalculation.totalSalary + totalAdjustments)}</span>
                  </div>
                </div>
                
                {/* 조정 항목 추가 */}
                <div className="mt-3 p-3 bg-muted/30 rounded border">
                  <div className="text-xs font-medium mb-2">급여 조정 추가 ({selectedFinanceMonth})</div>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="금액 (음수: 차감)"
                      value={newAdjustmentAmount}
                      onChange={(e) => setNewAdjustmentAmount(e.target.value)}
                      className="w-28"
                      data-testid="input-adjustment-amount"
                    />
                    <Input
                      placeholder="사유 (예: 특별수당, 결근 차감)"
                      value={newAdjustmentDescription}
                      onChange={(e) => setNewAdjustmentDescription(e.target.value)}
                      className="flex-1"
                      data-testid="input-adjustment-description"
                    />
                    <Button
                      size="icon"
                      onClick={handleAddAdjustment}
                      disabled={createAdjustmentMutation.isPending}
                      data-testid="button-add-adjustment"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">플러스 금액: 추가 / 마이너스 금액: 차감</p>
                </div>
                
                {salaryCalculation.breakdown.classes.length > 0 && (
                  <div className="mt-3 p-2 bg-muted/50 rounded text-xs">
                    <div className="font-medium mb-1">수업별 내역</div>
                    {salaryCalculation.breakdown.classes.map((cls, i) => (
                      <div key={i} className="flex justify-between text-muted-foreground">
                        <span>{cls.className} ({cls.studentCount}명)</span>
                        <span>{formatBudget(cls.totalPay)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSalarySettingsDialog(false)}
              data-testid="button-cancel-salary"
            >
              취소
            </Button>
            <Button
              onClick={handleSaveSalarySettings}
              disabled={saveSalarySettingsMutation.isPending}
              data-testid="button-save-salary"
            >
              {saveSalarySettingsMutation.isPending ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
