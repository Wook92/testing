import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Lock, User, Clock, MessageSquare } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { UserRole } from "@shared/schema";

export default function SettingsPage() {
  const { user, selectedCenter } = useAuth();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Teacher check-in settings state
  const [checkInCode, setCheckInCode] = useState("");
  const [smsRecipient1, setSmsRecipient1] = useState("");
  const [smsRecipient2, setSmsRecipient2] = useState("");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [isCheckInActive, setIsCheckInActive] = useState(true);
  
  const isTeacherOrHigher = user?.role === UserRole.TEACHER || 
    user?.role === UserRole.PRINCIPAL;

  // Fetch existing teacher check-in settings
  const { data: checkInSettings, isLoading: isLoadingSettings } = useQuery<{
    id: string;
    checkInCode: string;
    smsRecipient1: string | null;
    smsRecipient2: string | null;
    messageTemplate: string | null;
    isActive: boolean;
  } | null>({
    queryKey: [`/api/teacher-check-in-settings?teacherId=${user?.id}&centerId=${selectedCenter?.id}`],
    enabled: !!user?.id && !!selectedCenter?.id && isTeacherOrHigher,
  });

  // Populate form with existing settings when data loads
  useEffect(() => {
    if (checkInSettings) {
      setCheckInCode(checkInSettings.checkInCode || "");
      setSmsRecipient1(checkInSettings.smsRecipient1 || "");
      setSmsRecipient2(checkInSettings.smsRecipient2 || "");
      setMessageTemplate(checkInSettings.messageTemplate || "");
      setIsCheckInActive(checkInSettings.isActive ?? true);
    }
  }, [checkInSettings]);

  const changePasswordMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/users/change-password", data);
    },
    onSuccess: () => {
      toast({ title: "비밀번호가 변경되었습니다" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: () => {
      toast({ title: "비밀번호 변경에 실패했습니다", variant: "destructive" });
    },
  });

  const saveCheckInSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/teacher-check-in-settings", data);
    },
    onSuccess: () => {
      toast({ title: "출근 설정이 저장되었습니다" });
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("/api/teacher-check-in-settings");
        }
      });
    },
    onError: (error: any) => {
      const message = error?.message || "출근 설정 저장에 실패했습니다";
      toast({ title: message, variant: "destructive" });
    },
  });

  const handleCheckInSettingsSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkInCode) {
      toast({ title: "출근코드를 입력해주세요", variant: "destructive" });
      return;
    }
    if (!/^\d{4}$/.test(checkInCode)) {
      toast({ title: "출근코드는 4자리 숫자여야 합니다", variant: "destructive" });
      return;
    }
    saveCheckInSettingsMutation.mutate({
      teacherId: user?.id,
      centerId: selectedCenter?.id,
      checkInCode,
      smsRecipient1: smsRecipient1 || null,
      smsRecipient2: smsRecipient2 || null,
      messageTemplate: messageTemplate || null,
      isActive: isCheckInActive,
    });
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "새 비밀번호가 일치하지 않습니다", variant: "destructive" });
      return;
    }
    changePasswordMutation.mutate({
      userId: user?.id,
      currentPassword,
      newPassword,
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">설정</h1>
        <p className="text-muted-foreground">계정 및 앱 설정</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            내 정보
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-muted-foreground">이름</Label>
              <p className="font-medium" data-testid="text-user-name">{user?.name}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">아이디 (휴대폰)</Label>
              <p className="font-medium" data-testid="text-user-phone">{user?.username}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            비밀번호 변경
          </CardTitle>
          <CardDescription>보안을 위해 주기적으로 비밀번호를 변경해주세요</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">현재 비밀번호</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                data-testid="input-current-password"
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="newPassword">새 비밀번호</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                data-testid="input-new-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">새 비밀번호 확인</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                data-testid="input-confirm-password"
              />
            </div>

            <Button
              type="submit"
              disabled={changePasswordMutation.isPending}
              data-testid="button-change-password"
            >
              {changePasswordMutation.isPending ? "변경 중..." : "비밀번호 변경"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {isTeacherOrHigher && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              출근 알림 설정
            </CardTitle>
            <CardDescription>
              출결패드에서 사용할 출근코드와 SMS 알림을 설정합니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCheckInSettingsSave} className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>출근 알림 활성화</Label>
                  <p className="text-sm text-muted-foreground">
                    출근 시 SMS 알림을 받습니다
                  </p>
                </div>
                <Switch
                  checked={isCheckInActive}
                  onCheckedChange={setIsCheckInActive}
                  data-testid="switch-check-in-active"
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="checkInCode">출근코드 (4자리 숫자)</Label>
                <Input
                  id="checkInCode"
                  type="text"
                  maxLength={4}
                  pattern="\d{4}"
                  placeholder="1234"
                  value={checkInCode}
                  onChange={(e) => setCheckInCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  data-testid="input-check-in-code"
                />
                <p className="text-xs text-muted-foreground">
                  출결패드에서 출근 시 입력하는 코드입니다. 학생 출결번호와 중복되지 않아야 합니다.
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="smsRecipient1">
                  <MessageSquare className="inline-block h-4 w-4 mr-1" />
                  SMS 수신자 1
                </Label>
                <Input
                  id="smsRecipient1"
                  type="tel"
                  placeholder="010-1234-5678"
                  value={smsRecipient1}
                  onChange={(e) => setSmsRecipient1(e.target.value)}
                  data-testid="input-sms-recipient-1"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smsRecipient2">SMS 수신자 2 (선택사항)</Label>
                <Input
                  id="smsRecipient2"
                  type="tel"
                  placeholder="010-1234-5678"
                  value={smsRecipient2}
                  onChange={(e) => setSmsRecipient2(e.target.value)}
                  data-testid="input-sms-recipient-2"
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="messageTemplate">
                  SMS 메시지 템플릿
                </Label>
                <Textarea
                  id="messageTemplate"
                  placeholder="{name} 선생님이 {time}에 출근하셨습니다."
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  rows={3}
                  data-testid="input-message-template"
                />
                <p className="text-xs text-muted-foreground">
                  사용 가능한 변수: {"{name}"} (선생님 이름), {"{time}"} (출근 시간), {"{date}"} (날짜)
                </p>
              </div>

              <Button
                type="submit"
                disabled={saveCheckInSettingsMutation.isPending || isLoadingSettings}
                data-testid="button-save-check-in-settings"
              >
                {saveCheckInSettingsMutation.isPending ? "저장 중..." : "설정 저장"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
