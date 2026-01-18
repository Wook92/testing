import { Building2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-context";

export function CenterSelector() {
  const { centers, selectedCenter, selectCenter } = useAuth();

  if (centers.length <= 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4" />
        <span>{selectedCenter?.name || "센터 없음"}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2" data-testid="button-center-selector">
          <Building2 className="h-4 w-4" />
          <span>{selectedCenter?.name || "센터 선택"}</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {centers.map((center) => (
          <DropdownMenuItem
            key={center.id}
            onClick={() => selectCenter(center)}
            className={selectedCenter?.id === center.id ? "bg-accent" : ""}
            data-testid={`menu-item-center-${center.id}`}
          >
            {center.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
