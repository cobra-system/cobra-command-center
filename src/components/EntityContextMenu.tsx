import React, { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from "@/components/ui/context-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface ContextMenuAction {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: "default" | "destructive";
  hidden?: boolean;
  disabled?: boolean;
  confirmTitle?: string;
  confirmDescription?: string;
}

export interface ContextMenuSubMenu {
  label: string;
  icon?: LucideIcon;
  hidden?: boolean;
  items: ContextMenuAction[];
}

export type ContextMenuGroupItem = ContextMenuAction | ContextMenuSubMenu;

function isSubMenu(item: ContextMenuGroupItem): item is ContextMenuSubMenu {
  return "items" in item;
}

interface EntityContextMenuProps {
  groups: ContextMenuGroupItem[][];
  children: React.ReactNode;
}

export function EntityContextMenu({ groups, children }: EntityContextMenuProps) {
  const [confirmAction, setConfirmAction] = useState<ContextMenuAction | null>(null);

  const visibleGroups = groups
    .map(group => group.filter(item => !item.hidden))
    .filter(group => group.length > 0);

  const handleItemClick = (item: ContextMenuAction) => {
    if (item.confirmTitle) {
      setConfirmAction(item);
    } else {
      item.onClick();
    }
  };

  const renderItem = (item: ContextMenuGroupItem, index: number) => {
    if (isSubMenu(item)) {
      const visibleSubItems = item.items.filter(si => !si.hidden);
      if (visibleSubItems.length === 0) return null;
      const Icon = item.icon;
      return (
        <ContextMenuSub key={index}>
          <ContextMenuSubTrigger className="flex items-center gap-2 cursor-pointer">
            {Icon && <Icon className="h-4 w-4" />}
            {item.label}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {visibleSubItems.map((si, si_idx) => {
              const SiIcon = si.icon;
              return (
                <ContextMenuItem
                  key={si_idx}
                  disabled={si.disabled}
                  onClick={() => handleItemClick(si)}
                  className={`flex items-center gap-2 cursor-pointer ${
                    si.variant === "destructive" ? "text-destructive focus:text-destructive" : ""
                  }`}
                >
                  {SiIcon && <SiIcon className="h-4 w-4" />}
                  {si.label}
                </ContextMenuItem>
              );
            })}
          </ContextMenuSubContent>
        </ContextMenuSub>
      );
    }

    const Icon = item.icon;
    return (
      <ContextMenuItem
        key={index}
        disabled={item.disabled}
        onClick={() => handleItemClick(item)}
        className={`flex items-center gap-2 cursor-pointer ${
          item.variant === "destructive" ? "text-destructive focus:text-destructive" : ""
        }`}
      >
        {Icon && <Icon className="h-4 w-4" />}
        {item.label}
      </ContextMenuItem>
    );
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {children}
        </ContextMenuTrigger>
        <ContextMenuContent className="min-w-[180px]">
          {visibleGroups.map((group, gi) => (
            <React.Fragment key={gi}>
              {gi > 0 && <ContextMenuSeparator />}
              {group.map(renderItem)}
            </React.Fragment>
          ))}
        </ContextMenuContent>
      </ContextMenu>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmAction?.confirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { confirmAction?.onClick(); setConfirmAction(null); }}
              className="bg-destructive text-destructive-foreground"
            >
              אישור
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
