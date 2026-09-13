import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: string;
  icon?: React.FC<{ className?: string }> | React.ReactNode;
  color?: string;
  subtitle?: string;
  badge?: string;
  disabled?: boolean;
}

export interface CustomSelectProps {
  value: string | number;
  onChange: (value: any) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  allowClear?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  error?: boolean;
  id?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Selecione uma opção...',
  disabled = false,
  searchable,
  size = 'md',
  className = '',
  buttonClassName = '',
  menuClassName = '',
  error = false,
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-enable search if there are more than 6 options
  const isSearchable = searchable !== undefined ? searchable : options.length > 6;

  const selectedOption = useMemo(() => {
    return options.find((opt) => String(opt.value) === String(value));
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        (opt.subtitle && opt.subtitle.toLowerCase().includes(query)) ||
        (opt.badge && opt.badge.toLowerCase().includes(query))
    );
  }, [options, searchQuery]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Auto-focus search input on open
  useEffect(() => {
    if (isOpen && isSearchable) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, isSearchable]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setSearchQuery('');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev + 1 >= filteredOptions.length ? 0 : prev + 1;
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev - 1 < 0 ? filteredOptions.length - 1 : prev - 1;
        return next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        const opt = filteredOptions[highlightedIndex];
        if (!opt.disabled) {
          onChange(opt.value);
          setIsOpen(false);
          setSearchQuery('');
        }
      }
    }
  };

  const handleSelect = (opt: SelectOption) => {
    if (opt.disabled) return;
    onChange(opt.value);
    setIsOpen(false);
    setSearchQuery('');
  };

  const heightClasses = size === 'sm' ? 'py-1.5 px-3 text-xs' : 'py-2.5 px-3.5 text-sm';

  const renderOptionIcon = (icon: any, defaultClass: string) => {
    if (!icon) return null;
    if (React.isValidElement(icon)) {
      return icon;
    }
    if (typeof icon === 'function') {
      const IconComp = icon;
      return <IconComp className={defaultClass} />;
    }
    return null;
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full select-none ${className}`}
      onKeyDown={handleKeyDown}
      id={id}
    >
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen((prev) => !prev);
            setSearchQuery('');
            setHighlightedIndex(-1);
          }
        }}
        className={`w-full flex items-center justify-between rounded-xl border text-left transition-all duration-150 outline-none
          ${heightClasses}
          ${
            disabled
              ? 'bg-slate-950/40 border-slate-850 text-slate-500 cursor-not-allowed'
              : isOpen
              ? 'bg-slate-900 border-brand-500/80 shadow-lg shadow-brand-500/10 ring-1 ring-brand-500/40 text-white'
              : error
              ? 'bg-slate-950/80 border-rose-500/50 hover:border-rose-400 text-white'
              : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 text-white hover:bg-slate-900/60'
          }
          ${buttonClassName}
        `}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1 truncate pr-2">
          {selectedOption ? (
            <>
              {selectedOption.color && (
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                  style={{ backgroundColor: selectedOption.color }}
                />
              )}
              {renderOptionIcon(selectedOption.icon, "w-4 h-4 shrink-0 text-slate-400")}
              <span className="truncate text-slate-100 font-medium">
                {selectedOption.label}
              </span>
              {selectedOption.subtitle && (
                <span className="text-xs text-slate-400 truncate hidden sm:inline">
                  • {selectedOption.subtitle}
                </span>
              )}
            </>
          ) : (
            <span className="text-slate-500 font-normal truncate">{placeholder}</span>
          )}
        </div>

        <ChevronDown
          className={`w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-brand-400' : ''
          }`}
        />
      </button>

      {/* Dropdown Floating Menu */}
      {isOpen && (
        <div
          className={`absolute z-50 left-0 right-0 mt-1.5 glass-dropdown rounded-xl overflow-hidden animate-dropdown ${menuClassName}`}
          style={{ maxHeight: '320px' }}
        >
          {/* Search Input */}
          {isSearchable && (
            <div className="p-2 border-b border-slate-800/80 bg-slate-950/50">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  placeholder="Pesquisar..."
                  className="w-full bg-slate-900 border border-slate-850 rounded-lg pl-8 pr-7 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500/80 transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 text-slate-500 hover:text-white p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options List */}
          <div
            ref={listRef}
            className="max-h-56 overflow-y-auto custom-scrollbar p-1.5 space-y-0.5"
          >
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-500">
                Nenhuma opção encontrada
              </div>
            ) : (
              filteredOptions.map((opt, index) => {
                const isSelected = String(opt.value) === String(value);
                const isHighlighted = highlightedIndex === index;

                return (
                  <button
                    key={`${opt.value}-${index}`}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => handleSelect(opt)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors duration-100 ${
                      opt.disabled
                        ? 'opacity-40 cursor-not-allowed text-slate-500'
                        : isSelected
                        ? 'bg-brand-500/15 text-brand-300 font-semibold'
                        : isHighlighted
                        ? 'bg-slate-800/90 text-white'
                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 truncate">
                      {opt.color && (
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: opt.color }}
                        />
                      )}
                      {renderOptionIcon(
                        opt.icon,
                        `w-4 h-4 shrink-0 ${isSelected ? 'text-brand-400' : 'text-slate-400'}`
                      )}
                      <div className="truncate">
                        <div className="text-xs truncate">{opt.label}</div>
                        {opt.subtitle && (
                          <div className="text-[10px] text-slate-400 truncate">
                            {opt.subtitle}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {opt.badge && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700">
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
