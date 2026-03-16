"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type SidebarItem<Key extends string = string> = {
  key: Key;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
};

export type SidebarProps<Key extends string = string> = {
  title: string;
  subtitle?: string;
  items: SidebarItem<Key>[];
  activeKey: Key;
  onSelect: (key: Key) => void;
  className?: string;
};

export default function Sidebar({
  title,
  subtitle,
  items,
  activeKey,
  onSelect,
  className,
}: SidebarProps) {
  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:block sticky top-24 bg-white rounded-2xl shadow-sm border border-gray-200 p-6 max-h-[calc(100vh-14rem)] overflow-auto",
          className
        )}
      >
        <div className="space-y-1">
          {subtitle ? (
            <p className="text-xs font-semibold tracking-wide text-gray-400">{subtitle}</p>
          ) : null}
          <h2 className="text-2xl font-black tracking-tight text-gray-900">{title}</h2>
        </div>

        <nav className="mt-8 space-y-2">
          {items.map((item) => {
            const isActive = activeKey === item.key;
            return (
              <button
                key={item.key}
                onClick={() => !item.disabled && onSelect(item.key)}
                className={cn(
                  "w-full rounded-xl px-4 py-3 text-left text-sm font-medium transition",
                  isActive
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-600 hover:bg-gray-50",
                  item.disabled && "cursor-not-allowed opacity-50"
                )}
                disabled={item.disabled}
              >
                <div className="flex items-center gap-2">
                  {item.icon ? <span className="text-lg">{item.icon}</span> : null}
                  <span>{item.label}</span>
                </div>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Mobile/Tablet Navigation */}
      <nav className="lg:hidden bg-white rounded-2xl shadow-sm border border-gray-200 overflow-x-auto">
        <div className="flex gap-2 p-4">
          {items.map((item) => {
            const isActive = activeKey === item.key;
            return (
              <button
                key={item.key}
                onClick={() => !item.disabled && onSelect(item.key)}
                className={cn(
                  "px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition",
                  isActive
                    ? "bg-blue-100 text-blue-900"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                  item.disabled && "cursor-not-allowed opacity-50"
                )}
                disabled={item.disabled}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
