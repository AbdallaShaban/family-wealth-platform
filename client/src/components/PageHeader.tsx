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
    <header
      className={cn(
        "page-header-container relative overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-gradient-to-br from-white via-slate-50/70 to-emerald-50/25 dark:from-[#111827] dark:via-[#0F172A] dark:to-[#0B1522] p-5 sm:p-6 shadow-[0_8px_30px_rgb(15,23,42,0.04)] dark:shadow-[0_12px_36px_rgba(0,0,0,0.45)] space-y-4",
        className
      )}
      dir="rtl"
    >
      {/* Top 1px Sovereign Emerald Hairline */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-l from-emerald-500/70 via-emerald-400/25 to-transparent"
      />

      {/* Breadcrumbs */}
      <Breadcrumb>
        <BreadcrumbList className="text-xs font-medium text-slate-500 dark:text-slate-400">
          <BreadcrumbItem>
            <BreadcrumbLink href="/" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              الرئيسية
            </BreadcrumbLink>
          </BreadcrumbItem>
          {breadcrumbs ? (
            breadcrumbs
              .filter((crumb) => crumb.label !== "الرئيسية" && crumb.href !== "/")
              .map((crumb, idx) => (
                <React.Fragment key={idx}>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {crumb.href ? (
                      <BreadcrumbLink
                        href={crumb.href}
                        className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                      >
                        {crumb.label}
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage className="font-bold text-slate-800 dark:text-slate-200">
                        {crumb.label}
                      </BreadcrumbPage>
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
                      <BreadcrumbLink
                        href={categoryHref}
                        className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                      >
                        {category}
                      </BreadcrumbLink>
                    ) : (
                      <span>{category}</span>
                    )}
                  </BreadcrumbItem>
                </>
              )}
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-bold text-slate-800 dark:text-slate-200">{title}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>

      {/* Title & Actions Row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3.5 min-w-0">
          {Icon && (
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/12 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 shadow-[0_4px_14px_rgba(16,185,129,0.12)]">
              <Icon className="size-5.5" />
            </div>
          )}
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
                {title}
              </h1>
              {(() => {
                if (!badge) return null;
                if (React.isValidElement(badge)) return badge;
                if (typeof badge === "string" || typeof badge === "number") {
                  return (
                    <Badge
                      variant="secondary"
                      className="rounded-lg px-2.5 py-0.5 text-xs font-bold bg-emerald-500/12 text-emerald-800 dark:text-emerald-300 border border-emerald-500/25"
                    >
                      {badge}
                    </Badge>
                  );
                }
                if (typeof badge === "object" && "text" in badge) {
                  const isInst = badge.variant === "institutional";
                  const variant = isInst ? "secondary" : ((badge.variant as any) || "secondary");
                  return (
                    <Badge
                      variant={variant}
                      className={
                        isInst
                          ? "rounded-lg px-2.5 py-0.5 border border-emerald-500/30 bg-emerald-500/12 text-emerald-900 font-bold dark:text-emerald-300 dark:bg-emerald-950/60"
                          : "rounded-lg px-2.5 py-0.5 font-bold"
                      }
                    >
                      {badge.text}
                    </Badge>
                  );
                }
                return null;
              })()}
            </div>
            {description && (
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400 max-w-3xl font-medium">
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex shrink-0 items-center flex-wrap gap-2.5 self-start sm:self-end">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}

export default PageHeader;
