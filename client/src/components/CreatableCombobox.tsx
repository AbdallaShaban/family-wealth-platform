import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreatableComboboxProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  emptyLabel?: string;
}

export default function CreatableCombobox({
  id,
  value,
  onChange,
  options,
  placeholder = "اختر من القائمة أو اكتب مخصصاً...",
  disabled = false,
  className,
  emptyLabel = "لا توجد خيارات مطابقة، اضغط لإضافة التصنيف المخصص",
}: CreatableComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || "");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync internal input value when external value changes
  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const trimmedQuery = inputValue.trim().toLowerCase();
  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(trimmedQuery)
  );

  const exactMatch = options.some(
    (opt) => opt.toLowerCase() === trimmedQuery
  );

  const handleSelectOption = (opt: string) => {
    onChange(opt);
    setInputValue(opt);
    setIsOpen(false);
  };

  const handleCustomAdd = () => {
    if (!inputValue.trim()) return;
    onChange(inputValue.trim());
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setInputValue("");
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative w-full text-right" dir="rtl">
      <div
        className={cn(
          "relative flex items-center w-full rounded-xl transition-all duration-200",
          "bg-white dark:bg-[#0E1420]",
          "border border-slate-200/90 dark:border-slate-800",
          "focus-within:border-sky-500/80 dark:focus-within:border-sky-500/80",
          "focus-within:ring-2 focus-within:ring-sky-500/15 dark:focus-within:ring-sky-500/15",
          disabled && "opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-900/50",
          className
        )}
      >
        <input
          id={id}
          ref={inputRef}
          type="text"
          value={inputValue}
          disabled={disabled}
          onChange={(e) => {
            setInputValue(e.target.value);
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            if (!disabled) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="w-full bg-transparent py-2.5 px-3.5 pr-3.5 pl-16 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none font-medium text-right"
        />

        <div className="absolute left-2.5 flex items-center gap-1">
          {inputValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="مسح"
            >
              <X className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (!disabled) {
                setIsOpen(!isOpen);
                inputRef.current?.focus();
              }
            }}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ChevronDown
              className={cn(
                "size-4 transition-transform duration-200 text-slate-500 dark:text-slate-400",
                isOpen && "rotate-180"
              )}
            />
          </button>
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1.5 w-full rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-[#0E1420]/95 backdrop-blur-md shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
          <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5 scrollbar-thin">
            {/* Custom option prompt if typed something not matching any standard option */}
            {inputValue.trim() && !exactMatch && (
              <button
                type="button"
                onClick={handleCustomAdd}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold rounded-lg text-sky-700 dark:text-sky-300 bg-sky-50/70 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors text-right"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Plus className="size-3.5 shrink-0" />
                  <span className="truncate">استخدام المخصص: &quot;{inputValue.trim()}&quot;</span>
                </div>
                <span className="text-[10px] bg-sky-200/60 dark:bg-sky-800/60 px-1.5 py-0.5 rounded font-mono shrink-0">
                  جديد
                </span>
              </button>
            )}

            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isSelected = value === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleSelectOption(option)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors text-right font-medium",
                      isSelected
                        ? "bg-slate-100 dark:bg-slate-800/80 text-sky-600 dark:text-sky-400 font-semibold"
                        : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white"
                    )}
                  >
                    <span className="truncate">{option}</span>
                    {isSelected && <Check className="size-3.5 text-sky-600 dark:text-sky-400 shrink-0" />}
                  </button>
                );
              })
            ) : !inputValue.trim() ? (
              <div className="py-3 text-center text-xs text-slate-400 dark:text-slate-500">
                لا توجد عناصر متاحة
              </div>
            ) : null}

            {filteredOptions.length === 0 && inputValue.trim() && exactMatch && (
              <div className="py-2.5 px-3 text-center text-xs text-slate-400 dark:text-slate-500">
                {emptyLabel}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
