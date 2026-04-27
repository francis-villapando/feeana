import { Link, useLocation } from "@tanstack/react-router";
import { Archive, ChevronDown, GraduationCap, Home, LayoutDashboard, Plus } from "lucide-react";
import { useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useClassStore } from "@/lib/classStore";
import { CreateClassDialog } from "./CreateClassDialog";
import { Button } from "@/components/ui/button";

export function FacultySidebar() {
  const { activeClasses } = useClassStore();
  const location = useLocation();
  const [createOpen, setCreateOpen] = useState(false);

  const inClass = location.pathname.match(/^\/\$classId/) !== null;
  const [classesOpen, setClassesOpen] = useState(inClass);

  return (
    <>
      <Sidebar side="left" collapsible="icon" variant="floating">
        <SidebarHeader className="px-3 py-3 group-data-[collapsible=icon]:px-1.5">
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
            <SidebarTrigger className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-primary/30" />
            <span className="text-sm font-semibold group-data-[collapsible=icon]:hidden">
              Workspace
            </span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigate</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip="Home"
                    isActive={location.pathname === "/home"}
                  >
                    <Link to="/home">
                      <Home />
                      <span>Home</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip="Dashboard"
                    isActive={location.pathname === "/dashboard"}
                  >
                    <Link to="/dashboard">
                      <LayoutDashboard />
                      <span>Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <Collapsible open={classesOpen} onOpenChange={setClassesOpen} className="group/cls">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip="Classes" isActive={inClass}>
                        <GraduationCap />
                        <span>Classes</span>
                        <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/cls:rotate-180 group-data-[collapsible=icon]:hidden" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
                      <SidebarMenuSub>
                        {activeClasses.length === 0 && (
                          <li className="px-2 py-1 text-xs text-muted-foreground">
                            No classes yet
                          </li>
                        )}
                        {activeClasses.map((c) => (
                          <SidebarMenuSubItem key={c.id}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={location.pathname.match(/^\/\$classId/) !== null}
                            >
                              <Link to="/$classId" params={{ classId: c.id }}>
                                <span className="truncate">
                                  {c.course} · {c.section}
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
                    tooltip="Archived"
                    isActive={location.pathname === "/archived"}
                  >
                    <Link to="/archived">
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
