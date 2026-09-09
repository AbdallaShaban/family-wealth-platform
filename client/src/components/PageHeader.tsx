import React from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PageHeaderBreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderBadge {
  text: string;
  variant?: "default" | "secondary" | "destructive" | "outline" | "institutional" | string;
}

export interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  icon?: LucideIcon;
  category?: string;
  categoryHref?: string;
  breadcrumbs?: PageHeaderBreadcrumbItem[];
  badge?: React.ReactNode | PageHeaderBadge;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  category,
  categoryHref,
  breadcrumbs,
  badge,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("space-y-3 pb-6 border-b border-border/80", className)} dir="rtl">
      {/* Breadcrumbs */}
      <Breadcrumb>
        <BreadcrumbList className="text-xs text-muted-foreground">
          <BreadcrumbItem>
            <BreadcrumbLink href="/">الرئيسية</BreadcrumbLink>
          </BreadcrumbItem>
          {breadcrumbs ? (
            breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {crumb.href ? (
                    <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            ))
          ) : (
            <>
              {category && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {categoryHref ? (
                      <BreadcrumbLink href={categoryHref}>{category}</BreadcrumbLink>
                    ) : (
                      <span>{category}</span>
                    )}
                  </BreadcrumbItem>
                </>
              )}
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{title}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>

      {/* Title & Actions Row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          {Icon && (
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
              <Icon className="size-5" />
            </div>
          )}
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {title}
              </h1>
              {(() => {
                if (!badge) return null;
                if (React.isValidElement(badge)) return badge;
                if (typeof badge === "string" || typeof badge === "number") {
                  return <Badge variant="secondary">{badge}</Badge>;
                }
                if (typeof badge === "object" && "text" in badge) {
                  const isInst = badge.variant === "institutional";
                  const variant = isInst ? "secondary" : ((badge.variant as any) || "secondary");
                  return (
                    <Badge
                      variant={variant}
                      className={isInst ? "border-emerald-700/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 dark:bg-emerald-950/40" : undefined}
                    >
                      {badge.text}
                    </Badge>
                  );
                }
                return null;
              })()}
            </div>
            {description && (
              <p className="text-sm leading-relaxed text-muted-foreground max-w-3xl">
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2 self-start sm:self-end">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}

export default PageHeader;
