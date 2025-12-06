import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronDown, X } from 'lucide-react';

interface DateRange {
  start_date: string;
  end_date: string;
}

interface DateRangePickerProps {
  value?: DateRange;
  onChange: (range: DateRange) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  maxDate?: Date;
  minDate?: Date;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  onChange,
  placeholder = "Selecionar período",
  disabled = false,
  className = "",
  maxDate,
  minDate
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectingStart, setSelectingStart] = useState(true);
  const [tempStartDate, setTempStartDate] = useState<Date | null>(() => {
    if (value?.start_date) {
      const [year, month, day] = value.start_date.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    return null;
  });
  const [tempEndDate, setTempEndDate] = useState<Date | null>(() => {
    if (value?.end_date) {
      const [year, month, day] = value.end_date.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    return null;
  });
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 320 });

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);

  // Sincronizar com mudanças externas
  useEffect(() => {
    if (value?.start_date && value?.end_date) {
      // Usar construtor de Date com ano, mês, dia diretamente
      const [startYear, startMonth, startDay] = value.start_date.split('-').map(Number);
      const [endYear, endMonth, endDay] = value.end_date.split('-').map(Number);
      
      setTempStartDate(new Date(startYear, startMonth - 1, startDay));
      setTempEndDate(new Date(endYear, endMonth - 1, endDay));
      setCurrentMonth(new Date(startYear, startMonth - 1, 1));
    }
  }, [value]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      if (!inputRef.current) return;
      const rect = inputRef.current.getBoundingClientRect();
      const desiredWidth = Math.max(rect.width, 320);
      const viewportWidth = window.innerWidth;
      const left = Math.min(rect.left, viewportWidth - desiredWidth - 8);
      setDropdownPosition({
        top: rect.bottom + 8,
        left: Math.max(8, left),
        width: desiredWidth,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  const formatDisplayValue = (): string => {
    if (value?.start_date && value?.end_date) {
      // Usar split para evitar problemas de fuso horário
      const [startYear, startMonth, startDay] = value.start_date.split('-').map(Number);
      const [endYear, endMonth, endDay] = value.end_date.split('-').map(Number);
      
      const start = new Date(startYear, startMonth - 1, startDay);
      const end = new Date(endYear, endMonth - 1, endDay);
      
      if (value.start_date === value.end_date) {
        return formatDate(start);
      }
      
      return `${formatDate(start)} - ${formatDate(end)}`;
    }
    return placeholder;
  };

  const getDaysInMonth = (date: Date): Date[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: Date[] = [];

    // Adicionar dias vazios do início
    const firstDayOfWeek = firstDay.getDay();
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(new Date(year, month, -firstDayOfWeek + i + 1));
    }

    // Adicionar dias do mês
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const isSameDay = (date1: Date | null, date2: Date | null): boolean => {
    if (!date1 || !date2) return false;
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  };

  const isInRange = (date: Date): boolean => {
    if (!tempStartDate) return false;
    
    const compareDate = hoverDate && selectingStart === false ? hoverDate : tempEndDate;
    if (!compareDate) return false;

    const start = tempStartDate.getTime();
    const end = compareDate.getTime();
    const current = date.getTime();

    return current > Math.min(start, end) && current < Math.max(start, end);
  };

  const isStartOrEnd = (date: Date): boolean => {
    return isSameDay(date, tempStartDate) || isSameDay(date, tempEndDate);
  };

  const handleDateClick = (date: Date) => {
    if (disabled) return;

    // Criar nova data apenas com ano, mês e dia
    const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    // Se estiver selecionando a data inicial
    if (selectingStart || !tempStartDate) {
      setTempStartDate(normalizedDate);
      setTempEndDate(null);
      setSelectingStart(false);
      return;
    }

    // Se estiver selecionando a data final
    if (normalizedDate < tempStartDate) {
      // Se selecionou uma data anterior à inicial, reinicia
      setTempStartDate(normalizedDate);
      setTempEndDate(null);
    } else {
      setTempEndDate(normalizedDate);
      
      // Confirmar seleção - formato correto para ISO string
      const formatToISODate = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      const range: DateRange = {
        start_date: formatToISODate(tempStartDate),
        end_date: formatToISODate(normalizedDate)
      };
      
      onChange(range);
      
      setTimeout(() => {
        setIsOpen(false);
        setSelectingStart(true);
      }, 300);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTempStartDate(null);
    setTempEndDate(null);
    setSelectingStart(true);
    onChange({ start_date: '', end_date: '' });
  };

  const changeMonth = (direction: number) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + direction, 1));
  };

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const isDateDisabled = (date: Date): boolean => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  const isCurrentMonth = (date: Date): boolean => {
    return date.getMonth() === currentMonth.getMonth();
  };

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" 
          onClick={() => setIsOpen(false)} 
        />
      )}
      
      <div className={`relative ${className}`}>
        <div 
          ref={inputRef}
          className={`flex items-center gap-2 px-4 py-3 bg-transparent rounded-xl cursor-pointer transition-all ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/10'
          }`}
          onClick={() => !disabled && setIsOpen(!isOpen)}
        >
          <Calendar className="w-5 h-5 text-white/90 flex-shrink-0" />
          <span className="flex-1 text-white/95 font-semibold text-sm">
            {formatDisplayValue()}
          </span>
          {value?.start_date && (
            <button
              onClick={handleClear}
              className="p-1 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-white/70" />
            </button>
          )}
          <ChevronDown className={`w-5 h-5 text-white/70 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>

        {isOpen && createPortal(
          <div 
            ref={dropdownRef}
            className="fixed z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 p-4"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              minWidth: dropdownPosition.width,
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4 bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-4 py-3 rounded-xl">
              <button
                onClick={() => changeMonth(-1)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <span className="text-xl">‹</span>
              </button>
              <span className="font-bold text-lg">
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </span>
              <button
                onClick={() => changeMonth(1)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <span className="text-xl">›</span>
              </button>
            </div>

            {/* Instruções */}
            <div className="mb-3 text-center text-sm text-gray-600 bg-blue-50 rounded-lg p-2">
              {selectingStart || !tempStartDate ? (
                <span className="font-semibold">📅 Selecione a data inicial</span>
              ) : (
                <span className="font-semibold">📅 Selecione a data final</span>
              )}
            </div>

            {/* Dias da semana */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map((day) => (
                <div key={day} className="text-center text-xs font-bold text-gray-500 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Dias do mês */}
            <div className="grid grid-cols-7 gap-1">
              {getDaysInMonth(currentMonth).map((date, idx) => {
                const isDisabled = isDateDisabled(date);
                const isSelected = isStartOrEnd(date);
                const inRange = isInRange(date);
                const isStart = isSameDay(date, tempStartDate);
                const isEnd = isSameDay(date, tempEndDate);
                const isOtherMonth = !isCurrentMonth(date);

                return (
                  <button
                    key={idx}
                    onClick={() => !isDisabled && handleDateClick(date)}
                    onMouseEnter={() => setHoverDate(date)}
                    onMouseLeave={() => setHoverDate(null)}
                    disabled={isDisabled}
                    className={`
                      relative p-2 text-sm rounded-lg transition-all
                      ${isDisabled ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'}
                      ${isOtherMonth ? 'text-gray-300' : 'text-gray-700'}
                      ${inRange ? 'bg-purple-100' : ''}
                      ${isSelected ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-bold shadow-lg scale-105' : ''}
                      ${!isSelected && !isDisabled && !isOtherMonth ? 'hover:bg-purple-50 hover:scale-105' : ''}
                      ${isStart ? 'rounded-r-none' : ''}
                      ${isEnd ? 'rounded-l-none' : ''}
                    `}
                  >
                    {date.getDate()}
                    {isSameDay(date, new Date()) && !isSelected && (
                      <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-purple-500 rounded-full"></div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer com resumo */}
            {tempStartDate && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <span className="text-gray-500">Início:</span>
                    <span className="ml-2 font-bold text-purple-600">
                      {formatDate(tempStartDate)}
                    </span>
                  </div>
                  {tempEndDate && (
                    <div>
                      <span className="text-gray-500">Fim:</span>
                      <span className="ml-2 font-bold text-purple-600">
                        {formatDate(tempEndDate)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>,
          document.body
        )}
      </div>
    </>
  );
};

export default DateRangePicker;