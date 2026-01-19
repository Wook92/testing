import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  BookOpen, Users, Calendar, ClipboardList, FileText, Settings, 
  UserCheck, Home, Info, FileBarChart, BarChart3, Star, Bell, CheckSquare
} from "lucide-react";
import { UserRole } from "@shared/schema";

interface ManualFeature {
  title: string;
  description: string;
  steps?: string[];
}

interface ManualSection {
  id: string;
  title: string;
  icon: typeof BookOpen;
  description: string;
  features: ManualFeature[];
  tips?: string[];
  lastUpdated: string;
}

type RoleType = "principal" | "teacher" | "student";

const principalSections: ManualSection[] = [
  {
    id: "dashboard",
    title: "대시보드",
    icon: Home,
    description: "학원 현황을 한눈에 볼 수 있는 메인 화면입니다.",
    features: [
      {
        title: "월별 학생 수 통계",
        description: "연도별 월간 학생 수 변화를 차트로 확인할 수 있습니다.",
        steps: [
          "연도를 선택하여 해당 연도의 통계를 확인합니다",
          "막대 그래프에 마우스를 올리면 정확한 수치가 표시됩니다",
          "전년도 대비 증감률이 퍼센트로 함께 표시됩니다"
        ]
      },
      {
        title: "빠른 현황 카드",
        description: "오늘의 출석, 숙제 제출률 등을 카드 형태로 확인합니다.",
        steps: [
          "각 카드를 클릭하면 해당 상세 페이지로 이동합니다",
          "숫자가 빨간색이면 주의가 필요한 항목입니다"
        ]
      }
    ],
    tips: [
      "대시보드에서 학원 전체 현황을 한눈에 파악할 수 있습니다",
      "차트는 매일 자정에 자동으로 업데이트됩니다"
    ],
    lastUpdated: "2026-01"
  },
  {
    id: "users",
    title: "사용자 관리",
    icon: Users,
    description: "학원 구성원 계정을 관리하는 페이지입니다. 선생님, 학생, 출결 계정을 생성하고 관리합니다.",
    features: [
      {
        title: "사용자 등록",
        description: "새로운 사용자 계정을 생성합니다.",
        steps: [
          "우측 상단의 '사용자 추가' 버튼을 클릭합니다",
          "이름을 입력합니다",
          "전화번호를 입력합니다 (로그인 ID로 사용됩니다)",
          "비밀번호를 설정합니다",
          "역할(권한)을 선택합니다: 선생님, 학생, 출결 계정",
          "학생인 경우 학년을 선택합니다",
          "'저장' 버튼을 클릭하여 완료합니다"
        ]
      },
      {
        title: "엑셀 일괄등록",
        description: "엑셀 파일로 여러 사용자를 한번에 등록합니다. 학기 초 대량 등록에 유용합니다.",
        steps: [
          "'엑셀 일괄등록' 버튼을 클릭합니다",
          "'양식 다운로드'를 클릭하여 엑셀 템플릿을 받습니다",
          "양식에 맞게 사용자 정보를 입력합니다",
          "작성한 엑셀 파일을 업로드합니다",
          "미리보기에서 데이터를 확인합니다",
          "'등록하기' 버튼을 클릭하여 완료합니다"
        ]
      },
      {
        title: "비밀번호 초기화",
        description: "사용자가 비밀번호를 잊어버린 경우 초기화할 수 있습니다.",
        steps: [
          "사용자 목록에서 해당 사용자를 찾습니다",
          "사용자 행의 우측 메뉴(⋮)를 클릭합니다",
          "'비밀번호 초기화'를 선택합니다",
          "새 비밀번호를 입력하고 확인합니다",
          "사용자에게 새 비밀번호를 안내합니다"
        ]
      },
      {
        title: "담임 선생님 지정",
        description: "학생에게 담임 선생님을 배정합니다. 담임 선생님은 해당 학생의 정보를 조회할 수 있습니다.",
        steps: [
          "학생 목록에서 해당 학생을 찾습니다",
          "학생 정보 수정 버튼을 클릭합니다",
          "'담임 선생님' 항목에서 선생님을 선택합니다",
          "'저장'을 클릭하여 완료합니다"
        ]
      },
      {
        title: "출결 계정 생성",
        description: "키오스크 전용 출결 계정을 생성합니다.",
        steps: [
          "'사용자 추가' 버튼을 클릭합니다",
          "역할에서 '출결 계정'을 선택합니다",
          "전화번호와 비밀번호를 설정합니다",
          "저장 후 해당 계정으로 로그인하면 출결 화면으로 자동 이동합니다"
        ]
      },
      {
        title: "사용자 검색 및 필터",
        description: "원하는 사용자를 빠르게 찾을 수 있습니다.",
        steps: [
          "검색창에 이름 또는 전화번호를 입력합니다",
          "역할별 필터를 사용하여 선생님/학생만 표시할 수 있습니다"
        ]
      }
    ],
    tips: [
      "원장은 본인보다 낮은 권한의 사용자만 관리할 수 있습니다",
      "매년 1월 1일에 학생 학년이 자동으로 올라갑니다 (초6→중1, 중3→고1)",
      "삭제된 사용자는 복구할 수 없으니 신중하게 삭제하세요",
      "전화번호가 로그인 ID이므로 중복될 수 없습니다",
      "출결 계정은 출결 화면만 접근 가능합니다"
    ],
    lastUpdated: "2026-01"
  },
  {
    id: "timetable",
    title: "시간표 관리",
    icon: Calendar,
    description: "수업 일정을 관리하는 시간표 페이지입니다. 수업을 추가, 수정, 삭제하고 수업 계획을 작성할 수 있습니다.",
    features: [
      {
        title: "시간표 조회",
        description: "요일별, 시간대별 수업 일정을 확인합니다.",
        steps: [
          "요일 탭(월~일)을 클릭하여 해당 요일 수업을 확인합니다",
          "수업 카드를 클릭하면 상세 정보가 표시됩니다"
        ]
      },
      {
        title: "수업 추가",
        description: "새로운 수업을 등록합니다.",
        steps: [
          "우측 상단의 '수업 추가' 버튼을 클릭합니다",
          "수업명을 입력합니다",
          "담당 선생님을 선택합니다",
          "과목을 선택합니다",
          "수업 요일을 선택합니다 (복수 선택 가능)",
          "시작 시간과 종료 시간을 설정합니다",
          "교실 정보를 입력합니다 (선택사항)",
          "'저장' 버튼을 클릭하여 완료합니다"
        ]
      },
      {
        title: "수업 수정",
        description: "기존 수업 정보를 변경합니다.",
        steps: [
          "시간표에서 수정할 수업을 클릭합니다",
          "'수정' 버튼을 클릭합니다",
          "변경할 정보를 수정합니다",
          "'저장' 버튼을 클릭하여 완료합니다"
        ]
      },
      {
        title: "수업 삭제",
        description: "더 이상 진행하지 않는 수업을 삭제합니다.",
        steps: [
          "시간표에서 삭제할 수업을 클릭합니다",
          "'삭제' 버튼을 클릭합니다",
          "확인 메시지에서 '삭제'를 선택합니다"
        ]
      },
      {
        title: "수강생 관리",
        description: "수업에 등록된 학생을 확인하고 관리합니다.",
        steps: [
          "수업을 클릭하여 상세 정보를 엽니다",
          "'학생 관리' 버튼을 클릭합니다",
          "학생을 추가하거나 제외할 수 있습니다"
        ]
      },
      {
        title: "수업 계획 작성",
        description: "주간/월간 수업 계획을 작성합니다.",
        steps: [
          "'수업 계획' 탭을 클릭합니다",
          "수업을 선택합니다",
          "주간 또는 월간 계획을 작성합니다",
          "'저장' 버튼을 클릭합니다",
          "작성된 계획은 시간표에서 수업 클릭 시 확인 가능합니다"
        ]
      }
    ],
    tips: [
      "수업 시간이 겹치지 않도록 주의하세요",
      "수업을 삭제하면 해당 수업의 모든 기록이 함께 삭제됩니다",
      "같은 선생님의 수업이 시간대별로 색상 구분되어 표시됩니다",
      "수업 계획은 학생이 시간표에서 확인할 수 있습니다"
    ],
    lastUpdated: "2026-01"
  },
  {
    id: "calendar",
    title: "학원 캘린더",
    icon: Calendar,
    description: "학원 일정과 이벤트를 관리하는 캘린더입니다.",
    features: [
      {
        title: "일정 확인",
        description: "월별 학원 일정을 확인합니다.",
        steps: [
          "캘린더 페이지로 이동합니다",
          "월 이동 버튼으로 원하는 달을 선택합니다",
          "날짜에 표시된 이벤트를 확인합니다"
        ]
      },
      {
        title: "일정 추가",
        description: "새로운 학원 일정을 등록합니다.",
        steps: [
          "'일정 추가' 버튼을 클릭합니다",
          "일정 제목을 입력합니다",
          "시작일과 종료일을 선택합니다 (하루 일정은 같은 날짜)",
          "12가지 색상 중 원하는 색상을 선택합니다",
          "'저장'을 클릭합니다"
        ]
      },
      {
        title: "일정 수정/삭제",
        description: "기존 일정을 수정하거나 삭제합니다.",
        steps: [
          "캘린더에서 일정을 클릭합니다",
          "수정 또는 삭제 버튼을 클릭합니다"
        ]
      }
    ],
    tips: [
      "여러 날에 걸친 일정은 캘린더에 연결선으로 표시됩니다",
      "색상을 활용하여 일정 종류를 구분하세요",
      "학생들도 캘린더를 볼 수 있습니다"
    ],
    lastUpdated: "2026-01"
  },
  {
    id: "announcements",
    title: "공지사항",
    icon: Bell,
    description: "학부모에게 공지사항을 전달하고 SMS로 알림을 발송합니다.",
    features: [
      {
        title: "공지사항 작성",
        description: "학부모에게 전달할 공지사항을 작성합니다.",
        steps: [
          "'공지 추가' 버튼을 클릭합니다",
          "제목과 내용을 입력합니다",
          "대상을 선택합니다 (반별, 학년별, 학생 선택)",
          "'저장'을 클릭합니다"
        ]
      },
      {
        title: "SMS 발송",
        description: "공지사항을 SMS로 학부모에게 발송합니다.",
        steps: [
          "공지사항 목록에서 발송할 공지를 선택합니다",
          "'SMS 발송' 버튼을 클릭합니다",
          "발송 대상을 확인합니다",
          "'발송'을 클릭합니다"
        ]
      },
      {
        title: "공지 수정/삭제",
        description: "기존 공지사항을 수정하거나 삭제합니다.",
        steps: [
          "공지사항을 클릭합니다",
          "수정 또는 삭제 버튼을 클릭합니다"
        ]
      }
    ],
    tips: [
      "SMS 발송을 위해 SOLAPI 연동이 필요합니다",
      "발송 이력은 기록되어 나중에 확인할 수 있습니다"
    ],
    lastUpdated: "2026-01"
  },
  {
    id: "student-reports",
    title: "월간 보고서",
    icon: FileBarChart,
    description: "학생의 월간 학습 보고서를 작성하고 학부모에게 발송합니다.",
    features: [
      {
        title: "보고서 작성",
        description: "학생의 월간 활동을 정리하여 보고서를 작성합니다.",
        steps: [
          "학생을 선택합니다",
          "보고서 기간(년/월)을 선택합니다",
          "'보고서 작성' 버튼을 클릭합니다",
          "출석, 숙제, 평가 내용을 참고하여 보고서를 작성합니다",
          "'저장' 버튼을 클릭합니다"
        ]
      },
      {
        title: "보고서 수정",
        description: "작성한 보고서 내용을 수정합니다.",
        steps: [
          "보고서에서 '수정' 버튼을 클릭합니다",
          "내용을 수정합니다",
          "'저장' 버튼을 클릭합니다"
        ]
      },
      {
        title: "SMS 발송",
        description: "보고서를 학부모에게 SMS로 발송합니다.",
        steps: [
          "보고서를 선택합니다",
          "'SMS 발송' 버튼을 클릭합니다",
          "발송 대상을 확인하고 발송합니다"
        ]
      }
    ],
    tips: [
      "보고서는 학생의 출석률, 숙제 제출률, 평가 점수를 참고하여 작성하세요",
      "학부모 상담 시 보고서를 활용하면 효과적입니다",
      "글자 수는 2000자까지 작성 가능합니다"
    ],
    lastUpdated: "2026-01"
  },
  {
    id: "points",
    title: "포인트 관리",
    icon: Star,
    description: "학생 포인트를 관리하고 적립/차감합니다.",
    features: [
      {
        title: "포인트 적립",
        description: "학생에게 포인트를 적립합니다.",
        steps: [
          "포인트 관리 페이지로 이동합니다",
          "학생을 선택합니다",
          "'포인트 추가' 버튼을 클릭합니다",
          "포인트 수량과 사유를 입력합니다",
          "'저장'을 클릭합니다"
        ]
      },
      {
        title: "포인트 사용",
        description: "학생의 포인트를 차감합니다.",
        steps: [
          "학생을 선택합니다",
          "'포인트 사용' 버튼을 클릭합니다",
          "사용할 포인트와 사유를 입력합니다",
          "'저장'을 클릭합니다"
        ]
      },
      {
        title: "포인트 내역 조회",
        description: "학생별 포인트 적립/사용 내역을 확인합니다.",
        steps: [
          "학생을 선택합니다",
          "포인트 내역이 날짜순으로 표시됩니다"
        ]
      }
    ],
    tips: [
      "포인트 적립 기준: 출석 10P, 숙제 완료 20P/30P, 테스트 성적별 포인트",
      "포인트는 학생이 본인 페이지에서 확인할 수 있습니다"
    ],
    lastUpdated: "2026-01"
  },
  {
    id: "attendance",
    title: "출결 관리",
    icon: UserCheck,
    description: "학생 출석을 관리하고 학부모에게 알림을 발송하는 페이지입니다.",
    features: [
      {
        title: "출석 현황 조회",
        description: "날짜별, 수업별 학생 출석 현황을 확인합니다.",
        steps: [
          "조회할 날짜를 선택합니다",
          "수업별로 출석한 학생 목록이 표시됩니다",
          "출석/지각/결석 상태가 표시됩니다"
        ]
      },
      {
        title: "수동 출석 처리",
        description: "키오스크 외에 수동으로 출석을 처리합니다.",
        steps: [
          "해당 학생을 찾습니다",
          "'출석 처리' 버튼을 클릭합니다",
          "출석 시간과 상태(출석/지각)를 선택합니다"
        ]
      },
      {
        title: "출석 PIN 관리",
        description: "학생별 키오스크 출석용 4자리 PIN을 관리합니다.",
        steps: [
          "'PIN 관리' 탭으로 이동합니다",
          "학생 목록에서 PIN을 확인하거나 수정합니다",
          "PIN을 변경하려면 새 4자리 숫자를 입력합니다",
          "'저장'을 클릭하여 완료합니다"
        ]
      },
      {
        title: "메시지 템플릿 관리",
        description: "출석 알림 SMS 템플릿을 설정합니다.",
        steps: [
          "'메시지 템플릿' 탭으로 이동합니다",
          "출석 시 발송할 메시지 내용을 작성합니다",
          "{학생명}, {시간} 등 변수를 사용할 수 있습니다",
          "'저장'을 클릭하여 완료합니다"
        ]
      }
    ],
    tips: [
      "학생이 키오스크에서 PIN을 입력하면 자동으로 출석 처리됩니다",
      "출석 시 등록된 학부모 전화번호로 SMS가 자동 발송됩니다",
      "PIN은 학생이 기억하기 쉬운 숫자로 설정하세요"
    ],
    lastUpdated: "2026-01"
  },
  {
    id: "todos",
    title: "할 일 관리",
    icon: CheckSquare,
    description: "학원 업무를 할 일 목록으로 관리합니다.",
    features: [
      {
        title: "할 일 추가",
        description: "새로운 할 일을 등록합니다.",
        steps: [
          "'할 일 추가' 버튼을 클릭합니다",
          "할 일 내용을 입력합니다",
          "담당 선생님을 선택합니다",
          "마감일을 설정합니다 (선택)",
          "'저장'을 클릭합니다"
        ]
      },
      {
        title: "할 일 완료",
        description: "완료된 할 일을 체크합니다.",
        steps: [
          "할 일 앞의 체크박스를 클릭합니다",
          "완료된 할 일은 목록에서 분리됩니다"
        ]
      }
    ],
    tips: [
      "담당자를 지정하면 해당 선생님에게 알림이 갑니다",
      "마감일이 지난 할 일은 강조 표시됩니다"
    ],
    lastUpdated: "2026-01"
  },
  {
    id: "settings",
    title: "설정",
    icon: Settings,
    description: "개인 설정을 관리하는 페이지입니다.",
    features: [
      {
        title: "비밀번호 변경",
        description: "본인의 로그인 비밀번호를 변경합니다.",
        steps: [
          "'비밀번호 변경' 섹션으로 이동합니다",
          "현재 비밀번호를 입력합니다",
          "새 비밀번호를 입력합니다",
          "새 비밀번호를 다시 한번 확인 입력합니다",
          "'변경' 버튼을 클릭합니다"
        ]
      },
      {
        title: "테마 설정",
        description: "라이트/다크 모드를 선택합니다.",
        steps: [
          "우측 상단의 테마 아이콘을 클릭합니다",
          "라이트/다크/시스템 중 선택합니다"
        ]
      },
      {
        title: "SMS 설정",
        description: "SMS 알림 기능을 관리합니다.",
        steps: [
          "SOLAPI SMS 연동 정보를 입력합니다"
        ]
      }
    ],
    tips: [
      "비밀번호는 8자 이상 권장됩니다",
      "SMS 연동을 위해 SOLAPI API 키와 발신번호가 필요합니다"
    ],
    lastUpdated: "2026-01"
  }
];

const teacherSections: ManualSection[] = [
  {
    id: "dashboard",
    title: "대시보드",
    icon: Home,
    description: "담당 학생 현황과 오늘의 일정을 확인하는 메인 화면입니다.",
    features: [
      {
        title: "담당 학생 현황",
        description: "담임으로 배정된 학생들의 현황을 확인합니다.",
        steps: [
          "대시보드에서 담당 학생 수를 확인합니다",
          "카드를 클릭하면 학생 목록으로 이동합니다"
        ]
      },
      {
        title: "오늘의 수업",
        description: "오늘 진행할 수업 목록을 확인합니다.",
        steps: [
          "대시보드에서 오늘의 수업 카드를 확인합니다",
          "수업을 클릭하면 상세 정보로 이동합니다"
        ]
      },
      {
        title: "할 일 확인",
        description: "처리해야 할 숙제 확인, 업무 등을 확인합니다."
      }
    ],
    tips: [
      "대시보드를 자주 확인하여 놓치는 업무가 없도록 하세요"
    ],
    lastUpdated: "2026-01"
  },
  {
    id: "timetable",
    title: "시간표",
    icon: Calendar,
    description: "수업 일정을 확인하고 관리하는 페이지입니다.",
    features: [
      {
        title: "시간표 조회",
        description: "요일별, 시간대별 수업 일정을 확인합니다.",
        steps: [
          "요일 탭(월~일)을 클릭하여 해당 요일 수업을 확인합니다",
          "수업 카드를 클릭하면 상세 정보가 표시됩니다",
          "내 수업은 강조 표시됩니다"
        ]
      },
      {
        title: "수업 추가",
        description: "새로운 수업을 등록합니다.",
        steps: [
          "'수업 추가' 버튼을 클릭합니다",
          "수업명, 과목, 요일, 시간을 입력합니다",
          "교실 정보를 입력합니다 (선택)",
          "'저장' 버튼을 클릭합니다"
        ]
      },
      {
        title: "수업 수정/삭제",
        description: "담당 수업의 정보를 수정하거나 삭제합니다.",
        steps: [
          "수정할 수업을 클릭합니다",
          "'수정' 또는 '삭제' 버튼을 클릭합니다",
          "변경 사항을 저장합니다"
        ]
      },
      {
        title: "수강생 확인",
        description: "수업에 등록된 학생 목록을 확인합니다.",
        steps: [
          "수업을 클릭하여 상세 정보를 엽니다",
          "'학생 관리' 버튼을 클릭합니다"
        ]
      },
      {
        title: "수업 계획 작성",
        description: "주간/월간 수업 계획을 작성합니다.",
        steps: [
          "'수업 계획' 탭을 클릭합니다",
          "수업을 선택합니다",
          "주간 또는 월간 계획을 작성합니다",
          "'저장' 버튼을 클릭합니다"
        ]
      }
    ],
    tips: [
      "내 수업은 다른 색상으로 강조됩니다",
      "수업 시간이 겹치지 않도록 확인하세요",
      "수업 계획은 학생이 시간표에서 확인할 수 있습니다"
    ],
    lastUpdated: "2026-01"
  },
  {
    id: "homework",
    title: "숙제 관리",
    icon: ClipboardList,
    description: "숙제를 출제하고 학생들의 제출 현황을 관리하는 페이지입니다.",
    features: [
      {
        title: "숙제 출제",
        description: "학생들에게 새로운 숙제를 출제합니다.",
        steps: [
          "'숙제 추가' 버튼을 클릭합니다",
          "숙제 제목을 입력합니다",
          "상세 내용을 입력합니다",
          "마감일을 선택합니다",
          "대상 수업 또는 학생을 선택합니다",
          "'저장'을 클릭하여 완료합니다"
        ]
      },
      {
        title: "제출 현황 확인",
        description: "학생별 숙제 제출 현황을 확인합니다.",
        steps: [
          "숙제 목록에서 확인할 숙제를 클릭합니다",
          "제출/미제출 학생 목록이 표시됩니다",
          "제출 시간도 함께 확인할 수 있습니다"
        ]
      },
      {
        title: "숙제 피드백",
        description: "학생의 숙제에 피드백을 작성합니다.",
        steps: [
          "제출된 숙제를 클릭합니다",
          "완료율과 피드백을 입력합니다",
          "'저장'을 클릭합니다"
        ]
      }
    ],
    tips: [
      "마감일이 지난 숙제는 빨간색으로 표시됩니다",
      "숙제 설명은 구체적으로 작성하면 학생이 이해하기 쉽습니다",
      "정기적으로 제출 현황을 확인하세요"
    ],
    lastUpdated: "2026-01"
  },
  {
    id: "class-notes",
    title: "수업 기록",
    icon: FileText,
    description: "수업 내용과 학생별 특이사항을 기록하는 페이지입니다.",
    features: [
      {
        title: "공통 수업일지",
        description: "해당 수업의 전체 진행 내용을 기록합니다.",
        steps: [
          "주차를 선택합니다",
          "수업을 선택합니다",
          "진도, 수업 내용 등을 입력합니다",
          "'저장' 버튼을 클릭합니다"
        ]
      },
      {
        title: "학생별 특이사항",
        description: "개별 학생에 대한 메모와 피드백을 기록합니다.",
        steps: [
          "학생 이름 옆의 '메모' 버튼을 클릭합니다",
          "해당 학생의 수업 태도, 이해도 등을 기록합니다",
          "칭찬할 점, 개선할 점 등을 자세히 기록합니다",
          "'저장' 버튼을 클릭합니다"
        ]
      },
      {
        title: "과거 기록 조회",
        description: "이전 주차의 수업일지를 확인합니다.",
        steps: [
          "주차 선택에서 원하는 주를 선택합니다",
          "해당 주의 수업일지가 표시됩니다"
        ]
      }
    ],
    tips: [
      "수업일지는 주차별로 자동 정리됩니다",
      "학생별 기록은 월간 리포트 작성 시 참고됩니다",
      "구체적으로 기록할수록 학부모 상담 시 유용합니다"
    ],
    lastUpdated: "2026-01"
  },
  {
    id: "assessments",
    title: "평가 관리",
    icon: BarChart3,
    description: "시험 및 테스트를 관리하고 점수를 입력하는 페이지입니다.",
    features: [
      {
        title: "평가 생성",
        description: "새로운 시험이나 테스트를 생성합니다.",
        steps: [
          "'평가 추가' 버튼을 클릭합니다",
          "평가명을 입력합니다 (예: 3월 월말평가)",
          "평가 유형을 선택합니다",
          "만점을 입력합니다",
          "대상 학생 또는 수업을 선택합니다",
          "'저장'을 클릭합니다"
        ]
      },
      {
        title: "점수 입력",
        description: "학생별 점수를 입력합니다.",
        steps: [
          "점수를 입력할 평가를 클릭합니다",
          "학생 목록이 표시됩니다",
          "각 학생의 점수를 입력합니다",
          "'저장' 버튼을 클릭합니다"
        ]
      },
      {
        title: "성적 통계",
        description: "평가의 평균, 최고점, 최저점 등 통계를 확인합니다.",
        steps: [
          "평가를 선택합니다",
          "막대 그래프로 성적 분포를 확인합니다"
        ]
      }
    ],
    tips: [
      "점수 입력 후 반드시 저장 버튼을 클릭하세요",
      "평가별로 평균 점수가 자동 계산됩니다"
    ],
    lastUpdated: "2026-01"
  },
  {
    id: "student-reports",
    title: "월간 보고서",
    icon: FileBarChart,
    description: "담당 학생의 월간 리포트를 작성하고 관리하는 페이지입니다.",
    features: [
      {
        title: "보고서 작성",
        description: "학생의 월간 활동을 정리하여 보고서를 작성합니다.",
        steps: [
          "담당 학생을 선택합니다",
          "보고서 기간(년/월)을 선택합니다",
          "'보고서 작성' 버튼을 클릭합니다",
          "출석, 숙제, 평가 내용을 참고하여 보고서를 작성합니다",
          "'저장'을 클릭합니다"
        ]
      },
      {
        title: "보고서 수정",
        description: "작성한 내용을 수정합니다.",
        steps: [
          "보고서에서 '수정' 버튼을 클릭합니다",
          "내용을 수정합니다",
          "'저장'을 클릭합니다"
        ]
      }
    ],
    tips: [
      "담임 선생님은 본인 담당 학생의 보고서만 작성할 수 있습니다",
      "보고서 작성 시 수업 기록을 참고하세요"
    ],
    lastUpdated: "2026-01"
  },
  {
    id: "points",
    title: "포인트 관리",
    icon: Star,
    description: "학생 포인트를 관리하고 적립/차감합니다.",
    features: [
      {
        title: "포인트 적립",
        description: "학생에게 포인트를 적립합니다.",
        steps: [
          "포인트 관리 페이지로 이동합니다",
          "학생을 선택합니다",
          "'포인트 추가' 버튼을 클릭합니다",
          "포인트 수량과 사유를 입력합니다",
          "'저장'을 클릭합니다"
        ]
      },
      {
        title: "포인트 사용",
        description: "학생의 포인트를 차감합니다.",
        steps: [
          "학생을 선택합니다",
          "'포인트 사용' 버튼을 클릭합니다",
          "사용할 포인트와 사유를 입력합니다",
          "'저장'을 클릭합니다"
        ]
      }
    ],
    tips: [
      "포인트 적립 기준: 출석 10P, 숙제 완료 20P/30P, 테스트 성적별 포인트",
      "포인트는 학생이 본인 페이지에서 확인할 수 있습니다"
    ],
    lastUpdated: "2026-01"
  },
  {
    id: "calendar",
    title: "학원 캘린더",
    icon: Calendar,
    description: "학원 일정과 이벤트를 관리하는 캘린더입니다.",
    features: [
      {
        title: "일정 확인",
        description: "월별 학원 일정을 확인합니다.",
        steps: [
          "캘린더 페이지로 이동합니다",
          "월 이동 버튼으로 원하는 달을 선택합니다",
          "날짜에 표시된 이벤트를 확인합니다"
        ]
      },
      {
        title: "일정 추가",
        description: "새로운 학원 일정을 등록합니다.",
        steps: [
          "'일정 추가' 버튼을 클릭합니다",
          "일정 제목을 입력합니다",
          "시작일과 종료일을 선택합니다",
          "색상을 선택합니다",
          "'저장'을 클릭합니다"
        ]
      }
    ],
    tips: [
      "여러 날에 걸친 일정은 캘린더에 연결선으로 표시됩니다",
      "색상을 활용하여 일정 종류를 구분하세요"
    ],
    lastUpdated: "2026-01"
  },
  {
    id: "users",
    title: "학생",
    icon: Users,
    description: "담당 학생 정보를 조회하는 페이지입니다.",
    features: [
      {
        title: "학생 목록 조회",
        description: "담임으로 배정된 학생 목록을 확인합니다.",
        steps: [
          "학생 탭으로 이동합니다",
          "담임으로 배정된 학생 목록이 표시됩니다"
        ]
      },
      {
        title: "학생 정보 확인",
        description: "학생의 상세 정보를 확인합니다.",
        steps: [
          "학생을 클릭합니다",
          "연락처, 학년, 수강 수업 등 정보가 표시됩니다"
        ]
      },
      {
        title: "학부모 연락처 확인",
        description: "학생의 학부모 연락처를 확인합니다.",
        steps: [
          "학생 상세 정보에서 학부모 정보를 확인합니다"
        ]
      }
    ],
    tips: [
      "선생님은 담임으로 배정된 학생만 조회할 수 있습니다",
      "학부모 상담 전 연락처를 미리 확인하세요"
    ],
    lastUpdated: "2026-01"
  },
];

const studentSections: ManualSection[] = [
  {
    id: "my-timetable",
    title: "나의 시간표",
    icon: Calendar,
    description: "내가 수강하는 수업 일정을 확인하는 페이지입니다.",
    features: [
      {
        title: "내 수업 확인",
        description: "요일별로 내가 수강하는 수업을 확인합니다.",
        steps: [
          "요일 탭(월~일)을 클릭합니다",
          "해당 요일에 수강 중인 수업이 표시됩니다",
          "수업 카드에서 시간, 교실, 선생님을 확인할 수 있습니다"
        ]
      },
      {
        title: "수업 상세 정보",
        description: "수업의 상세 정보와 수업 계획을 확인합니다.",
        steps: [
          "수업 카드를 클릭합니다",
          "수업명, 선생님, 시간, 교실 정보가 표시됩니다",
          "'수업 계획' 탭에서 주간/월간 수업 계획을 확인합니다"
        ]
      },
      {
        title: "수강 취소",
        description: "수강 중인 수업을 취소합니다.",
        steps: [
          "취소할 수업을 클릭합니다",
          "'수강 취소' 버튼을 클릭합니다",
          "확인 메시지에서 '취소'를 선택합니다"
        ]
      }
    ],
    tips: [
      "수업 시작 전에 미리 교실을 확인하세요",
      "수업 계획을 확인하여 미리 예습하세요"
    ],
    lastUpdated: "2026-01"
  },
  {
    id: "timetable",
    title: "학원 시간표",
    icon: Calendar,
    description: "학원 전체 시간표를 확인하고 수강 신청하는 페이지입니다.",
    features: [
      {
        title: "전체 시간표 조회",
        description: "학원의 모든 수업 일정을 확인합니다.",
        steps: [
          "요일 탭(월~일)을 클릭합니다",
          "해당 요일의 모든 수업이 시간대별로 표시됩니다",
          "수업 카드에서 수업명, 선생님, 시간을 확인할 수 있습니다"
        ]
      },
      {
        title: "수강 신청",
        description: "원하는 수업에 수강 신청을 합니다.",
        steps: [
          "수강하고 싶은 수업을 클릭합니다",
          "수업 상세 정보를 확인합니다",
          "'수강 신청' 버튼을 클릭합니다",
          "신청이 완료되면 '나의 시간표'에 추가됩니다"
        ]
      },
      {
        title: "수업 계획 확인",
        description: "수업의 주간/월간 계획을 확인합니다.",
        steps: [
          "수업을 클릭합니다",
          "'수업 계획' 탭을 선택합니다",
          "주간 또는 월간 수업 계획을 확인합니다"
        ]
      }
    ],
    tips: [
      "시간이 겹치는 수업은 신청할 수 없습니다",
      "수강 신청 후 '나의 시간표'에서 확인하세요"
    ],
    lastUpdated: "2026-01"
  },
  {
    id: "homework",
    title: "숙제",
    icon: ClipboardList,
    description: "선생님이 출제한 숙제를 확인하고 제출하는 페이지입니다.",
    features: [
      {
        title: "숙제 목록 확인",
        description: "나에게 배정된 숙제 목록을 확인합니다.",
        steps: [
          "숙제 페이지로 이동합니다",
          "미제출 숙제가 상단에 표시됩니다",
          "마감일 순으로 정렬되어 있습니다"
        ]
      },
      {
        title: "숙제 상세 확인",
        description: "숙제의 상세 내용을 확인합니다.",
        steps: [
          "확인할 숙제를 클릭합니다",
          "숙제 내용, 마감일, 출제 선생님이 표시됩니다"
        ]
      },
      {
        title: "숙제 제출",
        description: "숙제를 완료하고 제출 처리합니다.",
        steps: [
          "완료한 숙제를 클릭합니다",
          "'제출' 버튼을 클릭합니다",
          "제출 완료 메시지가 표시됩니다"
        ]
      },
      {
        title: "제출 이력 확인",
        description: "과거에 제출한 숙제를 확인합니다.",
        steps: [
          "'제출 완료' 탭을 클릭합니다",
          "이전에 제출한 숙제 목록이 표시됩니다"
        ]
      }
    ],
    tips: [
      "마감일이 지난 숙제는 빨간색으로 표시됩니다",
      "마감일 전에 미리미리 숙제를 완료하세요",
      "숙제를 완료했으면 반드시 제출 버튼을 눌러주세요"
    ],
    lastUpdated: "2026-01"
  },
  {
    id: "assessments",
    title: "평가",
    icon: BarChart3,
    description: "나의 시험 및 테스트 결과를 확인하는 페이지입니다.",
    features: [
      {
        title: "성적 확인",
        description: "나의 평가 점수를 확인합니다.",
        steps: [
          "평가 페이지로 이동합니다",
          "평가 목록에서 확인하고 싶은 평가를 선택합니다",
          "내 점수, 만점, 평균 점수가 표시됩니다"
        ]
      },
      {
        title: "성적 추이 확인",
        description: "시간에 따른 성적 변화를 확인합니다.",
        steps: [
          "과목별로 성적 추이를 막대 그래프로 확인할 수 있습니다"
        ]
      }
    ],
    tips: [
      "평가 결과가 나오면 알림이 표시됩니다",
      "성적이 낮은 부분은 보충 수업으로 보완할 수 있습니다"
    ],
    lastUpdated: "2026-01"
  },
  {
    id: "points",
    title: "내 포인트",
    icon: Star,
    description: "나의 포인트 현황과 내역을 확인합니다.",
    features: [
      {
        title: "포인트 확인",
        description: "현재 보유한 포인트를 확인합니다.",
        steps: [
          "포인트 페이지로 이동합니다",
          "총 적립 포인트와 사용 가능 포인트가 표시됩니다"
        ]
      },
      {
        title: "포인트 내역",
        description: "포인트 적립/사용 내역을 확인합니다.",
        steps: [
          "포인트 내역이 날짜순으로 표시됩니다",
          "적립 사유와 포인트 수량을 확인할 수 있습니다"
        ]
      }
    ],
    tips: [
      "출석하면 10P, 숙제 완료하면 20~30P가 적립됩니다",
      "테스트 성적에 따라 추가 포인트가 적립됩니다"
    ],
    lastUpdated: "2026-01"
  },
  {
    id: "calendar",
    title: "학원 캘린더",
    icon: Calendar,
    description: "학원 일정과 이벤트를 확인합니다.",
    features: [
      {
        title: "일정 확인",
        description: "월별 학원 일정을 확인합니다.",
        steps: [
          "캘린더 페이지로 이동합니다",
          "월 이동 버튼으로 원하는 달을 선택합니다",
          "날짜에 표시된 이벤트를 확인합니다"
        ]
      }
    ],
    tips: [
      "학원 휴무일, 시험 일정 등을 미리 확인하세요"
    ],
    lastUpdated: "2026-01"
  },
];

const roleManualMap: Record<RoleType, { title: string; sections: ManualSection[] }> = {
  principal: { title: "원장", sections: principalSections },
  teacher: { title: "선생님", sections: teacherSections },
  student: { title: "학생", sections: studentSections },
};

function getDefaultRole(userRole: number): RoleType {
  if (userRole >= UserRole.PRINCIPAL) return "principal";
  if (userRole >= UserRole.TEACHER) return "teacher";
  return "student";
}

function getAccessibleRoles(userRole: number): RoleType[] {
  if (userRole >= UserRole.PRINCIPAL) return ["principal", "teacher", "student"];
  if (userRole >= UserRole.TEACHER) return ["teacher", "student"];
  return ["student"];
}

export default function ManualPage() {
  const { user } = useAuth();
  const defaultRole = user ? getDefaultRole(user.role) : "student";
  const accessibleRoles: RoleType[] = user ? getAccessibleRoles(user.role) : ["student"];
  
  const [selectedRole, setSelectedRole] = useState<RoleType>(defaultRole);
  const [selectedSection, setSelectedSection] = useState<string>("");

  const currentManual = roleManualMap[selectedRole];
  const sections = currentManual.sections;

  useEffect(() => {
    if (sections.length > 0 && !sections.find(s => s.id === selectedSection)) {
      setSelectedSection(sections[0].id);
    }
  }, [selectedRole, sections, selectedSection]);

  const currentSection = sections.find(s => s.id === selectedSection);

  return (
    <div className="flex flex-col h-full">
      {accessibleRoles.length > 1 && (
        <div className="border-b p-4 bg-muted/30">
          <Tabs value={selectedRole} onValueChange={(v) => setSelectedRole(v as RoleType)}>
            <TabsList>
              {accessibleRoles.map((role) => (
                <TabsTrigger key={role} value={role} data-testid={`tab-manual-${role}`}>
                  {roleManualMap[role].title} 계정
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      )}

      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        <div className="md:hidden p-4 border-b bg-muted/30">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="h-5 w-5" />
            <span className="font-semibold">{currentManual.title} 매뉴얼</span>
          </div>
          <Select value={selectedSection} onValueChange={setSelectedSection}>
            <SelectTrigger data-testid="mobile-section-select">
              <SelectValue placeholder="메뉴 선택" />
            </SelectTrigger>
            <SelectContent>
              {sections.map((section) => (
                <SelectItem key={section.id} value={section.id}>
                  {section.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="hidden md:flex w-64 border-r bg-muted/30 flex-shrink-0 flex-col">
          <div className="p-4 border-b">
            <h2 className="font-semibold flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              {currentManual.title} 매뉴얼
            </h2>
            <p className="text-xs text-muted-foreground mt-1">프라임수학 사용 안내서</p>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setSelectedSection(section.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors ${
                      selectedSection === section.id
                        ? "bg-primary text-primary-foreground"
                        : "hover-elevate"
                    }`}
                    data-testid={`manual-nav-${section.id}`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{section.title}</span>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 overflow-auto">
          {currentSection ? (
            <div className="p-4 md:p-6 max-w-4xl">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <currentSection.icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold">{currentSection.title}</h1>
                    <p className="text-sm sm:text-base text-muted-foreground">{currentSection.description}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs self-start">
                  업데이트: {currentSection.lastUpdated}
                </Badge>
              </div>

              <Separator className="my-4 md:my-6" />

              <div className="space-y-4 md:space-y-6">
                <h2 className="text-base md:text-lg font-semibold flex items-center gap-2">
                  <Info className="h-4 w-4 md:h-5 md:w-5" />
                  주요 기능
                </h2>

                <div className="space-y-4">
                  {currentSection.features.map((feature, idx) => (
                    <Card key={idx}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{feature.title}</CardTitle>
                        <CardDescription>{feature.description}</CardDescription>
                      </CardHeader>
                      {feature.steps && feature.steps.length > 0 && (
                        <CardContent>
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">사용 방법:</p>
                            <ol className="list-decimal list-inside space-y-1">
                              {feature.steps.map((step, stepIdx) => (
                                <li key={stepIdx} className="text-sm text-muted-foreground">
                                  {step}
                                </li>
                              ))}
                            </ol>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>

                {currentSection.tips && currentSection.tips.length > 0 && (
                  <>
                    <Separator className="my-4 md:my-6" />
                    <div>
                      <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">알아두세요</h2>
                      <Card className="bg-muted/30">
                        <CardContent className="pt-4">
                          <ul className="space-y-2">
                            {currentSection.tips.map((tip, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-sm">
                                <span className="text-primary mt-0.5">•</span>
                                <span>{tip}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-muted-foreground">
              <span className="hidden md:inline">좌측 메뉴에서 </span>
              <span className="md:hidden">위 메뉴에서 </span>
              항목을 선택해주세요
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
