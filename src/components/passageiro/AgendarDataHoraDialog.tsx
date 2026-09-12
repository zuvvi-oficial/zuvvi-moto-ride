import * as React from "react";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";

// Passa a horário selecionado no mesmo formato que a tela já usa pra
// montar a corrida agendada (new Date(horarioAgendado).toISOString()) —
// trocar só a experiência de escolher, sem tocar em nada além disso.
const MINUTOS_PASSO = 15;

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseValue(value: string): { date: Date; hour: number; minute: number } | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return { date: parsed, hour: parsed.getHours(), minute: parsed.getMinutes() };
}

interface AgendarDataHoraDialogProps {
  value: string;
  onChange: (value: string) => void;
  min: Date;
  max: Date;
}

export function AgendarDataHoraDialog({ value, onChange, min, max }: AgendarDataHoraDialogProps) {
  const [open, setOpen] = React.useState(false);
  const parsedValue = parseValue(value);

  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(parsedValue?.date);
  const [hour, setHour] = React.useState<number | null>(parsedValue?.hour ?? null);
  const [minute, setMinute] = React.useState<number | null>(parsedValue?.minute ?? null);

  // Reabre sempre sincronizado com o valor já confirmado, não com o que
  // ficou selecionado numa tentativa anterior cancelada.
  React.useEffect(() => {
    if (open) {
      const parsed = parseValue(value);
      setSelectedDate(parsed?.date);
      setHour(parsed?.hour ?? null);
      setMinute(parsed?.minute ?? null);
    }
  }, [open, value]);

  const isDiaMinimo = selectedDate ? isSameDay(selectedDate, min) : false;
  const isDiaMaximo = selectedDate ? isSameDay(selectedDate, max) : false;

  const horasDisponiveis = React.useMemo(() => {
    const horas: number[] = [];
    for (let h = 0; h <= 23; h += 1) {
      if (isDiaMinimo && h < min.getHours()) continue;
      if (isDiaMaximo && h > max.getHours()) continue;
      horas.push(h);
    }
    return horas;
  }, [isDiaMinimo, isDiaMaximo, min, max]);

  const minutosDisponiveis = React.useMemo(() => {
    const minutos: number[] = [];
    for (let m = 0; m < 60; m += MINUTOS_PASSO) {
      if (isDiaMinimo && hour === min.getHours() && m < min.getMinutes()) continue;
      if (isDiaMaximo && hour === max.getHours() && m > max.getMinutes()) continue;
      minutos.push(m);
    }
    return minutos;
  }, [isDiaMinimo, isDiaMaximo, hour, min, max]);

  const podeConfirmar = selectedDate != null && hour != null && minute != null;

  const handleConfirmar = () => {
    if (!selectedDate || hour == null || minute == null) return;
    const combinado = new Date(selectedDate);
    combinado.setHours(hour, minute, 0, 0);
    onChange(toDatetimeLocalValue(combinado));
    setOpen(false);
  };

  const displayLabel = parsedValue
    ? format(parsedValue.date, "EEE',' dd 'de' MMM',' HH:mm", { locale: ptBR })
    : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-left hover:bg-white/10 transition-colors focus:outline-none focus:border-zuvvi-volt/50"
      >
        <CalendarClock className="w-4 h-4 text-zuvvi-volt shrink-0" />
        <span className={`flex-1 text-sm truncate ${displayLabel ? "font-bold text-white" : "text-white/40"}`}>
          {displayLabel ?? "Toque para escolher o dia e o horário"}
        </span>
        <ChevronDown className="w-4 h-4 text-white/40 shrink-0" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[92vw] max-w-[92vw] sm:max-w-sm max-h-[85dvh] overflow-y-auto rounded-[2.5rem] border-white/10 bg-zuvvi-indigo text-white p-6">
          <DialogHeader className="items-center text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-zuvvi-volt/15 border border-zuvvi-volt/30 flex items-center justify-center">
              <CalendarClock className="h-5 w-5 text-zuvvi-volt" />
            </div>
            <DialogTitle className="text-white text-lg font-bold">Escolha o dia e o horário</DialogTitle>
            <DialogDescription className="text-white/60 text-sm leading-relaxed">
              Selecione o dia no calendário e depois o horário da corrida.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-center">
            <Calendar
              mode="single"
              locale={ptBR}
              selected={selectedDate}
              onSelect={(date) => {
                setSelectedDate(date);
                setHour(null);
                setMinute(null);
              }}
              disabled={[{ before: min }, { after: max }]}
              defaultMonth={selectedDate ?? min}
              classNames={{
                root: "w-full",
                month: "w-full",
                month_caption: "flex h-(--cell-size) w-full items-center justify-center px-(--cell-size) text-white font-bold text-sm",
                nav: "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
                weekdays: "flex",
                weekday: "flex-1 select-none rounded-md text-[11px] uppercase text-white/40 font-normal",
                week: "mt-2 flex w-full",
                day: "group/day relative aspect-square h-full w-full select-none p-0 text-center text-white/80",
                today: "bg-white/10 text-zuvvi-volt rounded-md data-[selected=true]:rounded-none font-bold",
                outside: "text-white/20 aria-selected:text-white/20",
                disabled: "text-white/15 opacity-100",
                button_previous:
                  "h-(--cell-size) w-(--cell-size) select-none p-0 aria-disabled:opacity-30 text-white hover:bg-white/10 rounded-xl",
                button_next:
                  "h-(--cell-size) w-(--cell-size) select-none p-0 aria-disabled:opacity-30 text-white hover:bg-white/10 rounded-xl",
              }}
              modifiersClassNames={{
                selected: "bg-zuvvi-volt! text-zuvvi-indigo! rounded-full! font-black",
              }}
            />
          </div>

          {selectedDate && (
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest px-1">Horário</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <select
                    value={hour ?? ""}
                    onChange={(e) => {
                      setHour(Number(e.target.value));
                      setMinute(null);
                    }}
                    className="w-full appearance-none bg-white/5 border border-white/10 rounded-2xl pl-4 pr-9 py-3 text-sm font-bold text-white focus:outline-none focus:border-zuvvi-volt/50 [color-scheme:dark]"
                  >
                    <option value="" disabled>Hora</option>
                    {horasDisponiveis.map((h) => (
                      <option key={h} value={h}>{String(h).padStart(2, "0")} h</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-white/40 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <div className="relative">
                  <select
                    value={minute ?? ""}
                    onChange={(e) => setMinute(Number(e.target.value))}
                    disabled={hour == null}
                    className="w-full appearance-none bg-white/5 border border-white/10 rounded-2xl pl-4 pr-9 py-3 text-sm font-bold text-white focus:outline-none focus:border-zuvvi-volt/50 disabled:opacity-40 [color-scheme:dark]"
                  >
                    <option value="" disabled>Min</option>
                    {minutosDisponiveis.map((m) => (
                      <option key={m} value={m}>{String(m).padStart(2, "0")} min</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-white/40 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>
          )}

          <Button
            type="button"
            onClick={handleConfirmar}
            disabled={!podeConfirmar}
            className="w-full h-12 rounded-xl bg-zuvvi-volt text-zuvvi-indigo font-bold hover:bg-zuvvi-volt/90 disabled:opacity-40"
          >
            Confirmar horário
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
