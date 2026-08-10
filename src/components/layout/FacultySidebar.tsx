import { Link, useLocation } from "@tanstack/react-router";
import { Archive, ChevronDown, GraduationCap, Home, LayoutDashboard, Plus } from "lucide-react";
import { useCallback, useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useClassStore } from "@/lib/stores/classStore";
import { CreateClassDialog } from "@/components/faculty";
import { Button } from "@/components/ui/button";

export function FacultySidebar({ hoverEnabled = true }: { hoverEnabled?: boolean }) {
  const { activeClasses, isLoading } = useClassStore();
  const { setOpenMobile, isMobile, setOpen } = useSidebar();
  const location = useLocation();
  const [createOpen, setCreateOpen] = useState(false);

  const handleMouseEnter = useCallback(() => {
    if (isMobile || !hoverEnabled) return;
    setOpen(true);
  }, [isMobile, setOpen, hoverEnabled]);

  const handleMouseLeave = useCallback(() => {
    if (isMobile || !hoverEnabled) return;
    setOpen(false);
  }, [isMobile, setOpen, hoverEnabled]);

  const inClass = /^\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test(
    location.pathname,
  );
  const currentClassId = location.pathname.match(
    /^\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/,
  )?.[1];
  const [classesOpen, setClassesOpen] = useState(true);

  return (
    <>
      <Sidebar
        side="left"
        collapsible="icon"
        variant="floating"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigate</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === "/home"}
                  >
                    <Link to="/home" onClick={() => setOpenMobile(false)}>
                      <Home />
                      <span>Home</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === "/dashboard"}
                  >
                    <Link to="/dashboard" onClick={() => setOpenMobile(false)}>
                      <LayoutDashboard />
                      <span>Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <Collapsible open={classesOpen} onOpenChange={setClassesOpen} className="group/cls">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton isActive={inClass}>
                        <GraduationCap />
                        <span>Classes</span>
                        <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/cls:rotate-180 group-data-[collapsible=icon]:hidden" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
                      <SidebarMenuSub>
                        {isLoading && (
                          <>
                            <SidebarMenuSubItem>
                              <SidebarMenuSkeleton />
                            </SidebarMenuSubItem>
                            <SidebarMenuSubItem>
                              <SidebarMenuSkeleton />
                            </SidebarMenuSubItem>
                            <SidebarMenuSubItem>
                              <SidebarMenuSkeleton />
                            </SidebarMenuSubItem>
                          </>
                        )}
                        {!isLoading && activeClasses.length === 0 && (
                          <li className="px-2 py-1 text-xs text-muted-foreground">
                            No classes yet
                          </li>
                        )}
                        {!isLoading &&
                          activeClasses.map((cls) => (
                            <SidebarMenuSubItem key={cls.id}>
                              <SidebarMenuSubButton asChild isActive={currentClassId === cls.id}>
                                <Link
                                  to="/$classId"
                                  params={{ classId: cls.id }}
                                  onClick={() => setOpenMobile(false)}
                                >
                                  <span className="truncate">
                                    {cls.courseCode} · {cls.section}
                                  </span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        <SidebarMenuSubItem>
                          <button
                            type="button"
                            onClick={() => setCreateOpen(true)}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs text-primary hover:bg-sidebar-accent"
                          >
                            <Plus className="h-3.5 w-3.5" /> New class
                          </button>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>

                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === "/archived"}
                  >
                    <Link to="/archived" onClick={() => setOpenMobile(false)}>
                      <Archive />
                      <span>Archived classes</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="group-data-[collapsible=icon]:hidden">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCreateOpen(true)}
            className="w-full justify-start gap-2"
          >
            <Plus className="h-4 w-4" /> New class
          </Button>
        </SidebarFooter>
      </Sidebar>

      <CreateClassDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
