import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, BookOpen, Play, ExternalLink, ChevronRight, ArrowLeft, Pencil, Trash2, MoreVertical, Upload, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, invalidateQueriesStartingWith } from "@/lib/queryClient";
import { UserRole, type Textbook, type TextbookVideo } from "@shared/schema";

function getYoutubeThumbnail(url: string): string {
  const match = url.match(/(?:youtu\.be\/|(?:www\.)?youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([^?&\/]+)/);
  if (match) {
    return `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`;
  }
  return "";
}

function TextbookCover({ coverImage, title }: { coverImage?: string | null; title: string }) {
  const [hasError, setHasError] = useState(false);

  if (!coverImage || hasError) {
    return (
      <div className="aspect-[3/4] bg-muted flex items-center justify-center">
        <BookOpen className="h-16 w-16 text-muted-foreground/50" />
      </div>
    );
  }

  return (
    <div className="aspect-[3/4] bg-muted flex items-center justify-center">
      <img
        src={coverImage}
        alt={title}
        className="w-full h-full object-cover"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

function AddTextbookDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    title: "",
    coverImage: "",
    isVisible: true,
  });
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("Creating textbook with data:", data);
      return apiRequest("POST", "/api/textbooks", data);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/textbooks");
      toast({ title: "교재가 등록되었습니다" });
      onClose();
    },
    onError: (error) => {
      console.error("Failed to create textbook:", error);
      toast({ title: "교재 등록에 실패했습니다", variant: "destructive" });
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log("File selected:", file.name, file.type, file.size);
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setIsUploading(true);

    try {
      // Step 1: Request presigned URL from backend
      const urlResponse = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type,
          prefix: "textbooks",
        }),
      });
      if (!urlResponse.ok) {
        throw new Error(`Failed to get upload URL: ${urlResponse.status}`);
      }
      const { uploadURL, objectPath } = await urlResponse.json();
      console.log("Got upload URL, objectPath:", objectPath);

      // Step 2: Upload file directly to presigned URL
      const uploadResponse = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }
      console.log("Upload complete, objectPath:", objectPath);
      
      setFormData((p) => ({ ...p, coverImage: objectPath }));
      toast({ title: "이미지가 업로드되었습니다" });
    } catch (error) {
      console.error("Upload error:", error);
      toast({ title: "이미지 업로드에 실패했습니다", variant: "destructive" });
      setPreviewUrl("");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setFormData((p) => ({ ...p, coverImage: "" }));
    setPreviewUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Submitting form with data:", formData);
    createMutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">교재명</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
          placeholder="예: 수학의 정석"
          required
          data-testid="input-textbook-title"
        />
      </div>

      <div className="space-y-2">
        <Label>표지 이미지 (선택)</Label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          data-testid="input-textbook-cover-file"
        />
        {previewUrl || formData.coverImage ? (
          <div className="relative aspect-[3/4] w-32 rounded-md overflow-hidden bg-muted">
            <img
              src={previewUrl || formData.coverImage}
              alt="표지 미리보기"
              className="w-full h-full object-cover"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-1 right-1 h-6 w-6"
              onClick={handleRemoveImage}
              data-testid="button-remove-cover"
            >
              <X className="h-3 w-3" />
            </Button>
            {isUploading && (
              <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                <span className="text-xs">업로드 중...</span>
              </div>
            )}
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-full h-24"
            onClick={() => fileInputRef.current?.click()}
            data-testid="button-upload-cover"
          >
            <Upload className="h-5 w-5 mr-2" />
            이미지 업로드
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="isVisible">공개 여부</Label>
        <Switch
          id="isVisible"
          checked={formData.isVisible}
          onCheckedChange={(v) => setFormData((p) => ({ ...p, isVisible: v }))}
          data-testid="switch-textbook-visible"
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button type="submit" disabled={createMutation.isPending || isUploading} data-testid="button-add-textbook">
          {createMutation.isPending ? "등록 중..." : "교재 등록"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function EditTextbookDialog({ textbook, onClose }: { textbook: Textbook; onClose: () => void }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    title: textbook.title,
    coverImage: textbook.coverImage || "",
    isVisible: textbook.isVisible,
  });
  const [previewUrl, setPreviewUrl] = useState<string>(textbook.coverImage || "");
  const [isUploading, setIsUploading] = useState(false);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PATCH", `/api/textbooks/${textbook.id}`, data);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/textbooks");
      toast({ title: "교재가 수정되었습니다" });
      onClose();
    },
    onError: () => {
      toast({ title: "교재 수정에 실패했습니다", variant: "destructive" });
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreviewUrl(URL.createObjectURL(file));
    setIsUploading(true);

    try {
      // Step 1: Request presigned URL from backend
      const urlResponse = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type,
          prefix: "textbooks",
        }),
      });
      if (!urlResponse.ok) {
        throw new Error(`Failed to get upload URL: ${urlResponse.status}`);
      }
      const { uploadURL, objectPath } = await urlResponse.json();

      // Step 2: Upload file directly to presigned URL
      const uploadResponse = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }
      
      setFormData((p) => ({ ...p, coverImage: objectPath }));
      toast({ title: "이미지가 업로드되었습니다" });
    } catch (error) {
      toast({ title: "이미지 업로드에 실패했습니다", variant: "destructive" });
      setPreviewUrl("");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setFormData((p) => ({ ...p, coverImage: "" }));
    setPreviewUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="edit-title">교재명</Label>
        <Input
          id="edit-title"
          value={formData.title}
          onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
          placeholder="예: 수학의 정석"
          required
          data-testid="input-edit-textbook-title"
        />
      </div>

      <div className="space-y-2">
        <Label>표지 이미지 (선택)</Label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          data-testid="input-edit-textbook-cover-file"
        />
        {previewUrl || formData.coverImage ? (
          <div className="relative aspect-[3/4] w-32 rounded-md overflow-hidden bg-muted">
            <img
              src={previewUrl || formData.coverImage}
              alt="표지 미리보기"
              className="w-full h-full object-cover"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-1 right-1 h-6 w-6"
              onClick={handleRemoveImage}
              data-testid="button-edit-remove-cover"
            >
              <X className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="absolute bottom-1 left-1 right-1 text-xs"
              onClick={() => fileInputRef.current?.click()}
              data-testid="button-edit-change-cover"
            >
              변경
            </Button>
            {isUploading && (
              <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                <span className="text-xs">업로드 중...</span>
              </div>
            )}
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-full h-24"
            onClick={() => fileInputRef.current?.click()}
            data-testid="button-edit-upload-cover"
          >
            <Upload className="h-5 w-5 mr-2" />
            이미지 업로드
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="edit-isVisible">공개 여부</Label>
        <Switch
          id="edit-isVisible"
          checked={formData.isVisible}
          onCheckedChange={(v) => setFormData((p) => ({ ...p, isVisible: v }))}
          data-testid="switch-edit-textbook-visible"
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button type="submit" disabled={updateMutation.isPending || isUploading} data-testid="button-save-textbook">
          {updateMutation.isPending ? "저장 중..." : "저장"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function AddVideoDialog({ textbookId, onClose }: { textbookId: string; onClose: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    pageNumber: "",
    problemNumber: "",
    youtubeUrl: "",
  });

  const thumbnail = getYoutubeThumbnail(formData.youtubeUrl);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/textbook-videos", {
        ...data,
        textbookId,
        uploadedBy: user?.id,
      });
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/textbook-videos");
      toast({ title: "풀이 영상이 등록되었습니다" });
      onClose();
    },
    onError: () => {
      toast({ title: "영상 등록에 실패했습니다", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      pageNumber: parseInt(formData.pageNumber),
      problemNumber: parseInt(formData.problemNumber),
      youtubeUrl: formData.youtubeUrl,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="pageNumber">페이지 번호</Label>
          <Input
            id="pageNumber"
            type="number"
            min={1}
            value={formData.pageNumber}
            onChange={(e) => setFormData((p) => ({ ...p, pageNumber: e.target.value }))}
            placeholder="32"
            required
            data-testid="input-page-number"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="problemNumber">문제 번호</Label>
          <Input
            id="problemNumber"
            type="number"
            min={1}
            value={formData.problemNumber}
            onChange={(e) => setFormData((p) => ({ ...p, problemNumber: e.target.value }))}
            placeholder="1"
            required
            data-testid="input-problem-number"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="youtubeUrl">유튜브 링크</Label>
        <Input
          id="youtubeUrl"
          value={formData.youtubeUrl}
          onChange={(e) => setFormData((p) => ({ ...p, youtubeUrl: e.target.value }))}
          placeholder="https://www.youtube.com/watch?v=..."
          required
          data-testid="input-video-url"
        />
      </div>

      {thumbnail && (
        <div className="aspect-video rounded-md overflow-hidden bg-muted">
          <img src={thumbnail} alt="미리보기" className="w-full h-full object-cover" />
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button type="submit" disabled={createMutation.isPending} data-testid="button-add-solution">
          {createMutation.isPending ? "등록 중..." : "풀이 등록"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function EditTextbookVideoDialog({ video, onClose }: { video: TextbookVideo; onClose: () => void }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    pageNumber: video.pageNumber.toString(),
    problemNumber: video.problemNumber.toString(),
    youtubeUrl: video.youtubeUrl,
  });

  const thumbnail = getYoutubeThumbnail(formData.youtubeUrl);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PATCH", `/api/textbook-videos/${video.id}`, data);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/textbook-videos");
      toast({ title: "풀이 영상이 수정되었습니다" });
      onClose();
    },
    onError: () => {
      toast({ title: "수정에 실패했습니다", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      pageNumber: parseInt(formData.pageNumber),
      problemNumber: parseInt(formData.problemNumber),
      youtubeUrl: formData.youtubeUrl,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="edit-pageNumber">페이지 번호</Label>
          <Input
            id="edit-pageNumber"
            type="number"
            min={1}
            value={formData.pageNumber}
            onChange={(e) => setFormData((p) => ({ ...p, pageNumber: e.target.value }))}
            required
            data-testid="input-edit-page-number"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-problemNumber">문제 번호</Label>
          <Input
            id="edit-problemNumber"
            type="number"
            min={1}
            value={formData.problemNumber}
            onChange={(e) => setFormData((p) => ({ ...p, problemNumber: e.target.value }))}
            required
            data-testid="input-edit-problem-number"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-youtubeUrl">유튜브 링크</Label>
        <Input
          id="edit-youtubeUrl"
          value={formData.youtubeUrl}
          onChange={(e) => setFormData((p) => ({ ...p, youtubeUrl: e.target.value }))}
          placeholder="https://www.youtube.com/watch?v=..."
          required
          data-testid="input-edit-video-url"
        />
      </div>

      {thumbnail && (
        <div className="aspect-video rounded-md overflow-hidden bg-muted">
          <img src={thumbnail} alt="미리보기" className="w-full h-full object-cover" />
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-solution">
          {updateMutation.isPending ? "저장 중..." : "저장"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function TextbookDetail({ textbook, onBack }: { textbook: Textbook; onBack: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const [editingVideo, setEditingVideo] = useState<TextbookVideo | null>(null);

  const isTeacherOrAbove = user && user.role >= UserRole.TEACHER;

  const { data: videos, isLoading } = useQuery<TextbookVideo[]>({
    queryKey: [`/api/textbook-videos/${textbook.id}`],
  });

  const deleteVideoMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/textbook-videos/${id}`);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/textbook-videos");
      toast({ title: "풀이 영상이 삭제되었습니다" });
    },
    onError: () => {
      toast({ title: "삭제에 실패했습니다", variant: "destructive" });
    },
  });

  const groupedByPage = videos?.reduce((acc, video) => {
    const page = video.pageNumber;
    if (!acc[page]) acc[page] = [];
    acc[page].push(video);
    return acc;
  }, {} as Record<number, TextbookVideo[]>) ?? {};

  const sortedPages = Object.keys(groupedByPage)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{textbook.title}</h1>
          <p className="text-muted-foreground">풀이 영상 목록</p>
        </div>
        {isTeacherOrAbove && (
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-solution-dialog">
                <Plus className="h-4 w-4 mr-2" />
                풀이 등록
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>풀이 영상 등록</DialogTitle>
                <DialogDescription>{textbook.title}의 풀이 영상을 등록합니다</DialogDescription>
              </DialogHeader>
              <AddVideoDialog
                textbookId={textbook.id}
                onClose={() => setIsAddOpen(false)}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : sortedPages.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>등록된 풀이 영상이 없습니다</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-wrap gap-3">
          {sortedPages.flatMap((page) => {
            const pageVideos = groupedByPage[page].sort((a, b) => a.problemNumber - b.problemNumber);
            return pageVideos.map((video) => (
              <div 
                key={video.id} 
                className="flex items-center gap-1 px-3 py-2 rounded-md bg-muted/50 hover-elevate group"
              >
                <button
                  onClick={() => setPlayingVideo(video.id)}
                  className="flex items-center gap-2"
                  data-testid={`video-${video.id}`}
                >
                  <Play className="h-4 w-4" />
                  <span className="font-medium">p.{page} - {video.problemNumber}번</span>
                </button>
                {isTeacherOrAbove && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid={`video-menu-${video.id}`}
                      >
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => setEditingVideo(video)}
                        data-testid={`edit-video-${video.id}`}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        수정
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => {
                          if (confirm("풀이 영상을 삭제하시겠습니까?")) {
                            deleteVideoMutation.mutate(video.id);
                          }
                        }}
                        data-testid={`delete-video-${video.id}`}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        삭제
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ));
          })}
        </div>
      )}

      <Dialog open={!!playingVideo} onOpenChange={(open) => !open && setPlayingVideo(null)}>
        <DialogContent className="max-w-3xl w-[95vw] md:w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <span>풀이 영상</span>
              {playingVideo && videos && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const video = videos.find((v) => v.id === playingVideo);
                    if (video) window.open(video.youtubeUrl, "_blank");
                  }}
                  data-testid="button-fullsize-video"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  전체화면
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          {playingVideo && videos && (
            <div className="aspect-video">
              <iframe
                src={`https://www.youtube.com/embed/${videos.find((v) => v.id === playingVideo)?.youtubeUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^?&]+)/)?.[1]}?autoplay=1`}
                className="w-full h-full rounded-md"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingVideo} onOpenChange={(open) => !open && setEditingVideo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>풀이 영상 수정</DialogTitle>
            <DialogDescription>풀이 영상 정보를 수정합니다</DialogDescription>
          </DialogHeader>
          {editingVideo && (
            <EditTextbookVideoDialog
              video={editingVideo}
              onClose={() => setEditingVideo(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function TextbooksPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedTextbook, setSelectedTextbook] = useState<Textbook | null>(null);
  const [editingTextbook, setEditingTextbook] = useState<Textbook | null>(null);

  const isAdmin = user && user.role >= UserRole.ADMIN;
  const isTeacherOrAbove = user && user.role >= UserRole.TEACHER;

  const { data: textbooks, isLoading } = useQuery<Textbook[]>({
    queryKey: [`/api/textbooks`],
  });

  const deleteTextbookMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/textbooks/${id}`);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/textbooks");
      toast({ title: "교재가 삭제되었습니다" });
    },
    onError: () => {
      toast({ title: "교재 삭제에 실패했습니다", variant: "destructive" });
    },
  });

  const visibleTextbooks = textbooks?.filter((t) => isTeacherOrAbove || t.isVisible) ?? [];

  if (selectedTextbook) {
    return (
      <TextbookDetail
        textbook={selectedTextbook}
        onBack={() => setSelectedTextbook(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">교재별 풀이 영상</h1>
          <p className="text-muted-foreground">
            교재를 선택하여 풀이 영상을 확인하세요
          </p>
        </div>
        {isAdmin && (
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-textbook-dialog">
                <Plus className="h-4 w-4 mr-2" />
                교재 등록
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>교재 등록</DialogTitle>
                <DialogDescription>새 교재를 등록합니다</DialogDescription>
              </DialogHeader>
              <AddTextbookDialog onClose={() => setIsAddOpen(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <Skeleton className="aspect-[3/4]" />
              <CardContent className="p-4">
                <Skeleton className="h-5 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : visibleTextbooks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>등록된 교재가 없습니다</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {visibleTextbooks.map((textbook) => (
            <div key={textbook.id} className="relative">
              <button
                onClick={() => setSelectedTextbook(textbook)}
                className="text-left w-full"
                data-testid={`textbook-${textbook.id}`}
              >
                <Card className="overflow-hidden hover-elevate h-full">
                  <TextbookCover coverImage={textbook.coverImage} title={textbook.title} />
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-medium truncate">{textbook.title}</h4>
                      {!textbook.isVisible && (
                        <Badge variant="outline" className="text-xs">숨김</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </button>
              {isAdmin && (
                <div className="absolute top-2 right-2 z-10">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="bg-background/80 backdrop-blur"
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`textbook-menu-${textbook.id}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTextbook(textbook);
                      }}
                      data-testid={`edit-textbook-${textbook.id}`}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      수정
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("교재를 삭제하시겠습니까?")) {
                          deleteTextbookMutation.mutate(textbook.id);
                        }
                      }}
                      data-testid={`delete-textbook-${textbook.id}`}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      삭제
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editingTextbook} onOpenChange={(open) => !open && setEditingTextbook(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>교재 수정</DialogTitle>
            <DialogDescription>교재 정보를 수정합니다</DialogDescription>
          </DialogHeader>
          {editingTextbook && (
            <EditTextbookDialog
              textbook={editingTextbook}
              onClose={() => setEditingTextbook(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
