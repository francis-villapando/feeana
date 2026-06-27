import { useState } from "react";
import { BookOpen, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CountBadge } from "@/components/common";
import { SessionCard } from "@/components/student";
import { isSessionActive } from "@/lib/utils/sessionStatusUtils";
import type { Class, Session } from "@/lib/types/types";

interface ActiveSessionAccordionProps {
  classes: Class[];
  sessions: Session[];
  submittedSessionIds: Set<string>;
  onClassInfoClick: (cls: Class) => void;
  onSubmitSession?: (session: Session) => void;
}

export function ActiveSessionAccordion({
  classes,
  sessions,
  submittedSessionIds,
  onClassInfoClick,
  onSubmitSession,
}: ActiveSessionAccordionProps) {
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  return (
    <Accordion
      type="multiple"
      value={expandedItems}
      onValueChange={setExpandedItems}
      className="space-y-2"
    >
      {classes.map((cls) => {
        const activeSessions = sessions.filter(
          (s) =>
            s.classId === cls.id &&
            isSessionActive(s) &&
            !submittedSessionIds.has(s.id),
        );

        return (
          <AccordionItem
            key={cls.id}
            value={cls.id}
            className="border border-border/60 rounded-lg bg-background/40 px-1 transition-all"
          >
            <div className="relative flex items-center w-full">
              <AccordionTrigger className="hover:no-underline py-3 pl-3 pr-4 flex-1 min-w-0 relative">
                <div className="flex items-center gap-3 text-left overflow-hidden w-full pr-28">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/30">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-sm truncate block">
                      {cls.courseDisplay}
                    </span>
                    <span className="text-xs text-muted-foreground truncate block">
                      {cls.facultyName}
                    </span>
                  </div>
                </div>
                <CountBadge count={activeSessions.length} />
              </AccordionTrigger>
              <div className="absolute right-10 top-1/2 -translate-y-1/2 flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClassInfoClick(cls);
                  }}
                >
                  <Info className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <AccordionContent className="pt-0 px-3 pb-3">
              {activeSessions.length === 0 ? (
                <Card className="border-dashed border-border/60 bg-card/40">
                  <CardContent className="px-4 py-6 text-center">
                    <p className="text-xs text-muted-foreground">
                      No active sessions
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {activeSessions.map((s) => (
                    <SessionCard key={s.id} session={s} onSubmit={onSubmitSession} />
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}