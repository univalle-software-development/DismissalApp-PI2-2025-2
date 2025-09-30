"use client"

import * as React from "react"
import {
  BookOpen,
  User,
  GraduationCap,
  FileText,
  Users,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useUser } from "@clerk/nextjs"

import { NavMain } from "@/components/nav-main"
import { UniversityLogo } from "@/components/university-logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
// import { LangToggle } from "./lang-toggle"
import { UserButtonWrapper } from "./user-button-wrapper"
import { extractRoleFromMetadata } from "@/lib/role-utils"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { state } = useSidebar()
  const { user } = useUser()
  const t = useTranslations('navigation')

  // Get user role from Clerk metadata using centralized extraction
  const userRole = user ? extractRoleFromMetadata(user.publicMetadata) : undefined

  // Determinar si mostrar el dashboard (Students) basado en el rol
  const showDashboard = userRole === 'admin' || userRole === 'superadmin'

  // Configuración de íconos para cada tipo de menú
  const iconMap = {
    profile: User,
    student: BookOpen,
    studentDocs: FileText,
    professor: GraduationCap,
    professorDocs: FileText,
    operators: Users,
    adminDocs: FileText,
  } as const

  // Generar estructura de navegación basada en el rol del usuario
  const navItems = React.useMemo(() => {
    const menuConfig = t.raw('menu') as Record<string, {
      title: string;
      url: string;
      items: Array<{ title: string; url: string }>
    }>

    const items = []

    // Admin y SuperAdmin ven todos los enlaces
    if (userRole === 'admin' || userRole === 'superadmin') {
      // Operadores con todos los sub-elementos
      if (menuConfig.operators) {
        items.push({
          title: menuConfig.operators.title,
          url: menuConfig.operators.url,
          icon: iconMap.operators,
          isActive: true,
          items: menuConfig.operators.items.map(item => ({
            title: item.title,
            url: item.url,
          })),
        })
      }

      // Documentación para administradores
      if (menuConfig.adminDocs) {
        items.push({
          title: menuConfig.adminDocs.title,
          url: menuConfig.adminDocs.url,
          icon: iconMap.adminDocs,
          isActive: false,
          items: menuConfig.adminDocs.items.map(item => ({
            title: item.title,
            url: item.url,
          })),
        })
      }
    }
    // Operator ve todos los sub-elementos dentro de operators
    else if (userRole === 'operator') {
      if (menuConfig.operators) {
        items.push({
          title: menuConfig.operators.title,
          url: menuConfig.operators.url,
          icon: iconMap.operators,
          isActive: true,
          items: menuConfig.operators.items.map(item => ({
            title: item.title,
            url: item.url,
          })),
        })
      }
    }
    // Allocator solo ve su enlace específico
    else if (userRole === 'allocator') {
      if (menuConfig.operators) {
        items.push({
          title: menuConfig.operators.title,
          url: menuConfig.operators.url,
          icon: iconMap.operators,
          isActive: true,
          items: menuConfig.operators.items
            .filter(item => item.url === '/operators/allocator')
            .map(item => ({
              title: item.title,
              url: item.url,
            })),
        })
      }
    }
    // Dispatcher solo ve su enlace específico
    else if (userRole === 'dispatcher') {
      if (menuConfig.operators) {
        items.push({
          title: menuConfig.operators.title,
          url: menuConfig.operators.url,
          icon: iconMap.operators,
          isActive: true,
          items: menuConfig.operators.items
            .filter(item => item.url === '/operators/dispatcher')
            .map(item => ({
              title: item.title,
              url: item.url,
            })),
        })
      }
    }
    // Viewer solo ve su enlace específico
    else if (userRole === 'viewer') {
      if (menuConfig.operators) {
        items.push({
          title: menuConfig.operators.title,
          url: menuConfig.operators.url,
          icon: iconMap.operators,
          isActive: true,
          items: menuConfig.operators.items
            .filter(item => item.url === '/operators/viewer')
            .map(item => ({
              title: item.title,
              url: item.url,
            })),
        })
      }
    }

    return items
  }, [t, userRole, iconMap.adminDocs, iconMap.operators])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <UserButtonWrapper
          showName={state !== "collapsed"}
          collapsed={state === "collapsed"}
        />
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          items={navItems}
          dashboardLabel={t('dashboard')}
          navigationLabel={t('navigation')}
          showDashboard={showDashboard}
        />
      </SidebarContent>
      <SidebarFooter>
        {/* <LangToggle showText={state !== "collapsed"} /> */}
        {/* <ModeToggle showText={state !== "collapsed"} /> */}
        <UniversityLogo />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
