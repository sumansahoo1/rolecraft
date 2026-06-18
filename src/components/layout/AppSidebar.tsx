"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, FileText, Wand2, CircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navItems = [
  {
    href: "/app/builder",
    label: "Builder",
    icon: Wand2,
  },
  {
    href: "/app/resume",
    label: "Master Resume",
    icon: FileText,
  },
  {
    href: "/app/settings",
    label: "Settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-14 flex-col border-r bg-background">
      <Link
        href="/"
        className="flex h-14 items-center justify-center border-b"
      >
        <CircleIcon className="size-5 text-primary" />
      </Link>

      <nav className="flex flex-1 flex-col items-center gap-1 px-2 py-3">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger>
                <Link
                  href={item.href}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="size-4" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
    </aside>
  );
}
