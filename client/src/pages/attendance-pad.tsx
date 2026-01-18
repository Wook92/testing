import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type Center, type User, type Class, UserRole } from "@shared/schema";
import { Delete, Check, X, ArrowLeft, Settings, BookOpen, Maximize, Minimize, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useAuth } from "@/lib/auth-context";

function useWakeLock() {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let wakeLockSupported = false;

    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
          wakeLockSupported = true;
          console.log("[WakeLock] Screen wake lock acquired");
        }
      } catch (err) {
        console.log("[WakeLock] Native wake lock failed, using video fallback:", err);
        wakeLockSupported = false;
      }
    };

    // Video-based fallback for devices that don't support Wake Lock API
    const startVideoFallback = () => {
      if (wakeLockSupported) return;
      
      if (!videoRef.current) {
        // Create a tiny, silent, looping video to keep screen awake
        const video = document.createElement("video");
        video.setAttribute("playsinline", "");
        video.setAttribute("muted", "");
        video.setAttribute("loop", "");
        video.style.position = "fixed";
        video.style.top = "-1px";
        video.style.left = "-1px";
        video.style.width = "1px";
        video.style.height = "1px";
        video.style.opacity = "0.01";
        video.style.pointerEvents = "none";
        
        // Use a data URL for a tiny transparent video
        video.src = "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAA" +
          "hBtZGF0AAACrwYF//+r3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE2NCByMzEgOWE1ZmY0YyAtIEguMjY0L" +
          "01QRUctNCBBVkMgY29kZWMgLSBDb3B5bGVmdCAyMDAzLTIwMjQgLSBodHRwczovL3d3dy52aWRlb2xhbi5vcmcvZ" +
          "GV2ZWxvcGVycy94MjY0Lmh0bWwgLSBvcHRpb25zOiBjYWJhYz0xIHJlZj0zIGRlYmxvY2s9MTowOjAgYW5hbHlzZ" +
          "T0weDM6MHgxMTMgbWU9aGV4IHN1Ym1lPTcgcHN5PTEgcHN5X3JkPTEuMDA6MC4wMCBtaXhlZF9yZWY9MSBtZT1o" +
          "ZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xAAACiW1vb3YAAABsbXZoZAAAAAD" +
          "c7WIU3O1iFAAAA+gAAAAKAAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAA" +
          "AAAAAAAAAAAAAAAAAAAAAAAIAAAB0dHJhawAAAFx0a2hkAAAAA9ztYhTc7WIUAAAAAQAAAAAAAAAKAAAAAAAAAA" +
          "AAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB4AAACYbWRpYQA" +
          "AACBtZGhkAAAAANztYhTc7WIUAAAAGAAAABgVxwAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAAFWaWR" +
          "lb0hhbmRsZXIAAAABQ21pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx" +
          "1cmwgAAAAAQAAAQNzdGJsAAAAl3N0c2QAAAAAAAAAAQAAAIdhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAABg" +
          "AGABIAAAASAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGP//AAAAMWF2Y0MBZAAK/+E" +
          "AFmdkAAqs2UHB//oQAAADABAAAAMAIPEiWWABAAZo6+PLIsAAAAAYc3R0cwAAAAAAAAABAAAAGAAAABgAAAAUc3R" +
          "zcwAAAAAAAAABAAAAAQAAABhzdHNjAAAAAAAAAAEAAAABAAAAGAAAAAEAAAAgc3RzegAAAAAAAAAAAAAAGAAAAEQ" +
          "AAAAUAAAAE3N0Y28AAAAAAAAAAQAAADAAAABidWR0YQAAAFptZXRhAAAAAAAAACFoZGxyAAAAAAAAAABtZGlyYXB" +
          "wbAAAAAAAAAAAAAAAAC1pbHN0AAAAJal0b28AAAAdZGF0YQAAAAEAAAAATGF2ZjYwLjMuMTAw";
        
        document.body.appendChild(video);
        videoRef.current = video;
        
        // Try to play the video
        video.play().catch(() => {
          console.log("[WakeLock] Video fallback play failed");
        });
      }
    };

    requestWakeLock().then(() => {
      if (!wakeLockSupported) {
        startVideoFallback();
      }
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        requestWakeLock().then(() => {
          if (!wakeLockSupported) {
            startVideoFallback();
          }
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.remove();
        videoRef.current = null;
      }
    };
  }, []);
}

type CheckInState = "idle" | "mode_select" | "class_select" | "success" | "error" | "already" | "teacher_mode_select" | "teacher_success";
type AttendanceMode = "check_in" | "check_out";

interface PinValidationResult {
  success?: boolean;
  error?: string;
  type?: "student" | "teacher";
  student?: User;
  teacher?: { id: string; name: string; role: number };
  classes?: Class[];
  checkInTime?: string;
  message?: string;
}

interface CheckInResult {
  success?: boolean;
  error?: string;
  student?: User;
  teacher?: { id: string; name: string; role: number };
  checkInTime?: string;
  checkOutTime?: string;
  className?: string;
  message?: string;
  actionType?: "check_in" | "check_out";
}

export default function AttendancePadPage() {
  useWakeLock();
  const { user, logout } = useAuth();
  
  const [pin, setPin] = useState("");
  const [checkInState, setCheckInState] = useState<CheckInState>("idle");
  const [pinValidation, setPinValidation] = useState<PinValidationResult | null>(null);
  const [checkInResult, setCheckInResult] = useState<CheckInResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [attendanceMode, setAttendanceMode] = useState<AttendanceMode>("check_in");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // CSS-based fullscreen toggle (works in app environments)
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleNumberClick = (num: string) => {
    if (pin.length < 4 && checkInState === "idle") {
      setPin((prev) => prev + num);
    }
  };

  const handleDelete = () => {
    if (checkInState === "idle") {
      setPin((prev) => prev.slice(0, -1));
    }
  };

  const handleClear = () => {
    setPin("");
    setCheckInState("idle");
    setPinValidation(null);
    setCheckInResult(null);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  const validatePin = async () => {
    if (pin.length < 4 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/attendance/validate-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
        credentials: "include",
      });

      if (response.ok) {
        const data: PinValidationResult = await response.json();
        
        // Check if this is a teacher check-in
        if (data.type === "teacher") {
          setPinValidation(data);
          setCheckInState("teacher_mode_select");
        } else {
          // Student check-in flow
          setPinValidation(data);
          setCheckInState("mode_select");
        }
      } else {
        const error = await response.json();
        setCheckInState("error");
        setCheckInResult({ error: error.error || "출결번호 확인 실패" });
        timeoutRef.current = setTimeout(handleClear, 3000);
      }
    } catch (error) {
      setCheckInState("error");
      setCheckInResult({ error: "네트워크 오류가 발생했습니다" });
      timeoutRef.current = setTimeout(handleClear, 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModeSelect = async (mode: AttendanceMode) => {
    setAttendanceMode(mode);
    if (mode === "check_out") {
      await completeCheckOut();
    } else {
      // Check-in mode - proceed to class selection or complete check-in
      if (pinValidation?.classes && pinValidation.classes.length > 1) {
        setCheckInState("class_select");
      } else if (pinValidation?.classes && pinValidation.classes.length === 1) {
        await completeCheckIn(pinValidation.classes[0].id);
      } else {
        await completeCheckIn("");
      }
    }
  };

  const completeCheckOut = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/attendance/check-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setCheckInState("success");
        setCheckInResult(data);
      } else {
        const error = await response.json();
        if (error.checkOutTime) {
          setCheckInState("already");
          setCheckInResult(error);
        } else {
          setCheckInState("error");
          setCheckInResult({ error: error.error || "하원 실패" });
        }
      }
    } catch (error) {
      setCheckInState("error");
      setCheckInResult({ error: "네트워크 오류가 발생했습니다" });
    } finally {
      setIsSubmitting(false);
      timeoutRef.current = setTimeout(handleClear, 3000);
    }
  };

  const completeCheckIn = async (classId: string) => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/attendance/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, classId }),
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setCheckInState("success");
        setCheckInResult(data);
      } else {
        const error = await response.json();
        if (error.checkInTime) {
          setCheckInState("already");
          setCheckInResult(error);
        } else {
          setCheckInState("error");
          setCheckInResult({ error: error.error || "출결 실패" });
        }
      }
    } catch (error) {
      setCheckInState("error");
      setCheckInResult({ error: "네트워크 오류가 발생했습니다" });
    } finally {
      setIsSubmitting(false);
      timeoutRef.current = setTimeout(handleClear, 3000);
    }
  };

  const handleTeacherPunch = async (type: "check_in" | "check_out") => {
    if (!pinValidation?.teacher) return;
    
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/teacher-work/punch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: pinValidation.teacher.id,
          type,
        }),
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setCheckInResult({
          success: true,
          teacher: pinValidation.teacher,
          message: data.message,
          actionType: data.actionType,
        });
        setCheckInState("teacher_success");
      } else {
        const error = await response.json();
        setCheckInState("error");
        setCheckInResult({ error: error.error || "출퇴근 기록 실패" });
      }
    } catch (error) {
      setCheckInState("error");
      setCheckInResult({ error: "네트워크 오류가 발생했습니다" });
    } finally {
      setIsSubmitting(false);
      timeoutRef.current = setTimeout(handleClear, 3000);
    }
  };

  const handleClassSelect = async (classId: string) => {
    await completeCheckIn(classId);
  };

  useEffect(() => {
    if (pin.length === 4 && checkInState === "idle") {
      validatePin();
    }
  }, [pin, checkInState]);

  const isKioskUser = user && user.role === UserRole.KIOSK;

  if (showSettings) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 space-y-6">
            <h2 className="text-xl font-semibold text-center">출결 패드 설정</h2>
            {isKioskUser && (
              <div className="text-sm text-center text-muted-foreground">
                로그인: {user.name}
              </div>
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowSettings(false)}
              data-testid="button-back-to-pad"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              돌아가기
            </Button>
            {isKioskUser && (
              <Button
                variant="destructive"
                className="w-full"
                onClick={logout}
                data-testid="button-kiosk-logout"
              >
                <LogOut className="w-4 h-4 mr-2" />
                로그아웃
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn(
      "h-screen bg-background flex flex-col overflow-hidden",
      isFullscreen && "fixed inset-0 z-[9999]"
    )}>
      <div className="absolute top-2 right-2 z-10 flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleFullscreen}
          data-testid="button-fullscreen"
        >
          {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowSettings(true)}
          data-testid="button-settings"
        >
          <Settings className="w-5 h-5" />
        </Button>
        {isKioskUser && (
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            data-testid="button-logout-main"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center p-2 landscape:p-4">
        <div className="flex flex-col landscape:flex-row landscape:gap-12 items-center justify-center w-full max-w-5xl">
          <div className="text-center mb-4 landscape:mb-0 landscape:flex-1 flex flex-col items-center justify-center">
            <h1 
              className="text-2xl landscape:text-4xl font-bold text-primary mx-auto mb-2 landscape:mb-4"
            >프라임수학</h1>
            <div className="text-sm landscape:text-lg text-muted-foreground">
              {format(currentTime, "yyyy년 M월 d일 EEEE", { locale: ko })}
            </div>
          </div>

          <div className="landscape:flex-1 flex flex-col items-center">
            {checkInState === "idle" && (
              <>
                <div className="mb-4 landscape:mb-4">
                  <p className="text-base landscape:text-lg text-center text-muted-foreground mb-4 landscape:mb-4">
                    출결번호 4자리를 입력하세요
                  </p>
                  <div className="flex justify-center gap-3 landscape:gap-3 mb-4 landscape:mb-4">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={cn(
                          "w-14 h-16 landscape:w-16 landscape:h-20 rounded-xl border-2 flex items-center justify-center text-3xl landscape:text-4xl font-bold",
                          pin.length > i
                            ? "border-primary bg-primary/10"
                            : "border-border"
                        )}
                      >
                        {pin[i] ? "*" : ""}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 landscape:gap-3 w-full max-w-[280px] landscape:max-w-[320px] mx-auto">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                    <Button
                      key={num}
                      variant="outline"
                      className="h-16 landscape:h-14 text-2xl landscape:text-3xl font-bold"
                      onClick={() => handleNumberClick(num)}
                      data-testid={`button-num-${num}`}
                    >
                      {num}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    className="h-16 landscape:h-14"
                    onClick={handleClear}
                    data-testid="button-clear"
                  >
                    <X className="w-6 h-6 landscape:w-6 landscape:h-6" />
                  </Button>
                  <Button
                    variant="outline"
                    className="h-16 landscape:h-14 text-2xl landscape:text-3xl font-bold"
                    onClick={() => handleNumberClick("0")}
                    data-testid="button-num-0"
                  >
                    0
                  </Button>
                  <Button
                    variant="outline"
                    className="h-16 landscape:h-14"
                    onClick={handleDelete}
                    data-testid="button-delete"
                  >
                    <Delete className="w-6 h-6 landscape:w-6 landscape:h-6" />
                  </Button>
                </div>
              </>
            )}

            {checkInState === "mode_select" && pinValidation && (
              <div className="text-center animate-in fade-in zoom-in duration-300 w-full max-w-md">
                <h2 className="text-xl landscape:text-2xl font-bold mb-4">
                  {pinValidation.student?.name}
                </h2>
                <div className="grid gap-4 landscape:gap-6">
                  <Button
                    variant="default"
                    className="h-20 landscape:h-24 text-xl landscape:text-3xl font-bold"
                    onClick={() => handleModeSelect("check_in")}
                    disabled={isSubmitting}
                    data-testid="button-select-checkin"
                  >
                    등원
                  </Button>
                  <Button
                    variant="outline"
                    className="h-20 landscape:h-24 text-xl landscape:text-3xl font-bold"
                    onClick={() => handleModeSelect("check_out")}
                    disabled={isSubmitting}
                    data-testid="button-select-checkout"
                  >
                    하원
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  className="mt-6"
                  onClick={handleClear}
                  data-testid="button-cancel-mode-select"
                >
                  취소
                </Button>
              </div>
            )}

            {checkInState === "teacher_mode_select" && pinValidation && (
              <div className="text-center animate-in fade-in zoom-in duration-300 w-full max-w-md">
                <h2 className="text-xl landscape:text-2xl font-bold mb-4">
                  {pinValidation.teacher?.name} 선생님
                </h2>
                <div className="grid gap-4 landscape:gap-6">
                  <Button
                    variant="default"
                    className="h-20 landscape:h-24 text-xl landscape:text-3xl font-bold bg-blue-600 hover:bg-blue-700"
                    onClick={() => handleTeacherPunch("check_in")}
                    disabled={isSubmitting}
                    data-testid="button-teacher-checkin"
                  >
                    출근
                  </Button>
                  <Button
                    variant="outline"
                    className="h-20 landscape:h-24 text-xl landscape:text-3xl font-bold border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                    onClick={() => handleTeacherPunch("check_out")}
                    disabled={isSubmitting}
                    data-testid="button-teacher-checkout"
                  >
                    퇴근
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  className="mt-6"
                  onClick={handleClear}
                  data-testid="button-cancel-teacher-mode"
                >
                  취소
                </Button>
              </div>
            )}

            {checkInState === "class_select" && pinValidation && (
              <div className="text-center animate-in fade-in zoom-in duration-300 w-full max-w-md">
                <h2 className="text-xl landscape:text-2xl font-bold mb-2">
                  {pinValidation.student?.name}
                </h2>
                <p className="text-base landscape:text-lg text-muted-foreground mb-6">
                  출결할 수업을 선택하세요
                </p>
                <div className="grid gap-3 landscape:gap-4">
                  {pinValidation.classes?.map((cls) => (
                    <Button
                      key={cls.id}
                      variant="outline"
                      className="h-16 landscape:h-20 text-lg landscape:text-2xl font-semibold justify-start px-6 gap-4"
                      onClick={() => handleClassSelect(cls.id)}
                      disabled={isSubmitting}
                      data-testid={`button-class-${cls.id}`}
                    >
                      <BookOpen className="w-6 h-6 landscape:w-8 landscape:h-8" />
                      <span>{cls.name}{cls.classroom ? ` (${cls.classroom})` : ''}</span>
                    </Button>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  className="mt-6"
                  onClick={handleClear}
                  data-testid="button-cancel-class-select"
                >
                  취소
                </Button>
              </div>
            )}

            {checkInState === "success" && checkInResult && (
              <div className="text-center animate-in fade-in zoom-in duration-300">
                <div className="w-24 h-24 landscape:w-32 landscape:h-32 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
                  <Check className="w-12 h-12 landscape:w-16 landscape:h-16 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-2xl landscape:text-4xl font-bold text-green-600 dark:text-green-400">
                  {checkInResult.student?.name} {attendanceMode === "check_in" ? "등원" : "하원"} 완료
                </h2>
                {checkInResult.className && (
                  <p className="text-lg landscape:text-xl text-muted-foreground mt-2">
                    {checkInResult.className}
                  </p>
                )}
              </div>
            )}

            {checkInState === "teacher_success" && checkInResult && (
              <div className="text-center animate-in fade-in zoom-in duration-300">
                <div className={`w-24 h-24 landscape:w-32 landscape:h-32 rounded-full flex items-center justify-center mx-auto mb-6 ${
                  checkInResult.actionType === "check_out" 
                    ? "bg-orange-100 dark:bg-orange-900/30" 
                    : "bg-blue-100 dark:bg-blue-900/30"
                }`}>
                  <Check className={`w-12 h-12 landscape:w-16 landscape:h-16 ${
                    checkInResult.actionType === "check_out"
                      ? "text-orange-600 dark:text-orange-400"
                      : "text-blue-600 dark:text-blue-400"
                  }`} />
                </div>
                <h2 className={`text-2xl landscape:text-4xl font-bold ${
                  checkInResult.actionType === "check_out"
                    ? "text-orange-600 dark:text-orange-400"
                    : "text-blue-600 dark:text-blue-400"
                }`}>
                  {checkInResult.teacher?.name} 선생님 {checkInResult.actionType === "check_out" ? "퇴근!" : "출근!"}
                </h2>
                <p className="text-lg landscape:text-xl text-muted-foreground mt-2">
                  {checkInResult.message}
                </p>
              </div>
            )}

            {checkInState === "already" && checkInResult && (
              <div className="text-center animate-in fade-in zoom-in duration-300">
                <div className="w-24 h-24 landscape:w-32 landscape:h-32 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center mx-auto mb-6">
                  <Check className="w-12 h-12 landscape:w-16 landscape:h-16 text-yellow-600 dark:text-yellow-400" />
                </div>
                <h2 className="text-2xl landscape:text-4xl font-bold text-yellow-600 dark:text-yellow-400">
                  {checkInResult.student?.name} 이미 {attendanceMode === "check_in" ? "등원" : "하원"} 완료
                </h2>
              </div>
            )}

            {checkInState === "error" && checkInResult && (
              <div className="text-center animate-in fade-in zoom-in duration-300">
                <div className="w-24 h-24 landscape:w-32 landscape:h-32 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-6">
                  <X className="w-12 h-12 landscape:w-16 landscape:h-16 text-red-600 dark:text-red-400" />
                </div>
                <p className="text-xl landscape:text-2xl text-red-600 dark:text-red-400 font-semibold mb-4">
                  {checkInResult.error || "출석 실패"}
                </p>
                <Button variant="outline" onClick={handleClear} className="mt-4">
                  다시 시도
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
