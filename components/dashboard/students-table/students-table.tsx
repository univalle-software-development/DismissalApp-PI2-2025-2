"use client"

import * as React from "react"
import { useTranslations } from 'next-intl'
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import {
    ColumnFiltersState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    SortingState,
    useReactTable,
} from "@tanstack/react-table"
import { Search, GraduationCap, Plus, MapPin } from "lucide-react"

import { Button } from "@/components/ui/button"
// import {
//     DropdownMenu,
//     DropdownMenuContent,
//     DropdownMenuItem,
//     DropdownMenuLabel,
//     DropdownMenuSeparator,
//     DropdownMenuTrigger,
// } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { useColumns } from "./columns"
import { Student } from "./types"
import { DeleteStudentsDialog } from "./delete-students-dialog"
import { StudentFormDialog } from "./student-form-dialog"
import { FilterDropdown } from "@/components/ui/filter-dropdown"
import { CAMPUS_LOCATIONS, GRADES, Grade, CampusLocation, Id } from "@/convex/types"
import { useStudentsData } from "@/hooks/use-students-data"

// Componente de Skeleton optimizado
function StudentsTableSkeleton() {
    return (
        <div className="w-full space-y-4">
            <div className="flex items-center justify-between">
                <Skeleton className="h-8 w-[200px]" />
                <Skeleton className="h-8 w-[100px]" />
            </div>
            <div className="rounded-md border">
                <div className="space-y-2 p-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                    ))}
                </div>
            </div>
        </div>
    )
}


export function StudentsTable() {
    const t = useTranslations('studentsManagement')
    const columns = useColumns()

    // Table state - NO duplicar filtros
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
    const [rowSelection, setRowSelection] = React.useState({})
    const [globalFilter, setGlobalFilter] = React.useState("")
    const [pagination, setPagination] = React.useState({
        pageIndex: 0,
        pageSize: 10,
    })

    // Dialog state
    const [editDialogOpen, setEditDialogOpen] = React.useState(false)
    const [selectedStudent, setSelectedStudent] = React.useState<Student | undefined>()

    // Hook personalizado para datos de estudiantes - SIN filtros (enfoque estándar)
    const studentsData = useStudentsData({
        // Cargar TODOS los estudiantes sin filtros para que React Table maneje el filtrado
        limit: 10000, // Aumentar significativamente para asegurar que obtengamos todos
    })

    // Función de filtrado personalizada para buscar por nombre O número de carro
    const globalFilterFunction = React.useCallback((row: { original: Student }, columnId: string, filterValue: string) => {
        if (!filterValue) return true

        const searchTerm = filterValue.toLowerCase().trim()
        const student = row.original as Student

        // Buscar en el nombre completo
        const nameMatch = student.fullName.toLowerCase().includes(searchTerm)

        // Buscar en el número de carro (convertir a string para comparación)
        const carNumberMatch = student.carNumber > 0 &&
            student.carNumber.toString().includes(searchTerm)

        return nameMatch || carNumberMatch
    }, [])

    // Mutations de Convex
    const createStudent = useMutation(api.students.create)
    const updateStudent = useMutation(api.students.update)
    const deleteStudent = useMutation(api.students.deleteStudent)
    const deleteMultipleStudents = useMutation(api.students.deleteMultipleStudents)

    // Transform Convex data con memoización mejorada
    const data: Student[] = React.useMemo(() => {
        if (!studentsData?.students) return []

        return studentsData.students.map((student: {
            _id: string;
            fullName: string;
            firstName: string;
            lastName: string;
            birthday: string;
            carNumber: number;
            grade: string;
            campusLocation: string;
            avatarUrl?: string;
            avatarStorageId?: Id<"_storage">;
            isActive: boolean;
            createdAt: number;
        }) => {

            return {
                id: student._id,
                fullName: student.fullName,
                firstName: student.firstName,
                lastName: student.lastName,
                birthday: student.birthday,
                carNumber: student.carNumber,
                grade: student.grade as Grade,
                campusLocation: student.campusLocation as CampusLocation,
                avatarUrl: student.avatarUrl || "",
                avatarStorageId: student.avatarStorageId,
            }
        })
    }, [studentsData?.students]) // Más específico que studentsData completo

    // Loading state - Convex retorna undefined mientras carga
    const isLoading = studentsData === undefined
    // Table instance - ENFOQUE ESTÁNDAR con filtrado local
    const table = useReactTable({
        data,
        columns,
        state: {
            sorting,
            columnFilters,
            rowSelection,
            globalFilter,
            pagination,
        },
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onRowSelectionChange: setRowSelection,
        onGlobalFilterChange: setGlobalFilter,
        onPaginationChange: setPagination,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(), // ✅ Filtrado local estándar
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        globalFilterFn: globalFilterFunction,
        // manualFiltering: false por defecto - React Table maneja filtros
        // manualPagination: false por defecto - React Table maneja paginación
        autoResetPageIndex: false, // ✅ Evita que se resetee la página automáticamente
    })

    // Efecto para ajustar la página si estamos en una página vacía después de eliminar elementos
    React.useEffect(() => {
        if (!isLoading && table.getPageCount() > 0) {
            const currentPageIndex = table.getState().pagination.pageIndex
            const totalPages = table.getPageCount()

            // Si estamos en una página que ya no existe (por ejemplo, después de eliminar elementos)
            if (currentPageIndex >= totalPages) {
                setPagination(prev => ({
                    ...prev,
                    pageIndex: Math.max(0, totalPages - 1)
                }))
            }
        }
    }, [table, isLoading, setPagination, data.length]) // Reaccionar a cambios en los datos

    // Get selected students
    const selectedStudents = table.getFilteredSelectedRowModel().rows.map(row => row.original)

    // Handlers optimizados con useCallback y mejor manejo de errores
    const handleDeleteStudents = React.useCallback(async (studentIds: string[]) => {
        try {
            if (studentIds.length === 1) {
                // Single student deletion
                await deleteStudent({ studentId: studentIds[0] as Id<"students"> })
            } else {
                // Multiple students deletion - use batch operation
                await deleteMultipleStudents({
                    studentIds: studentIds as Id<"students">[]
                })
            }
            setRowSelection({})
            // La página se mantiene automáticamente con autoResetPageIndex: false
            // TODO: Agregar toast de éxito aquí
        } catch {
            // TODO: Agregar toast de error aquí
        }
    }, [deleteStudent, deleteMultipleStudents])

    const handleCreateStudent = React.useCallback(async (studentData: Omit<Student, 'id'>) => {
        try {
            await createStudent({
                firstName: studentData.firstName,
                lastName: studentData.lastName,
                grade: studentData.grade,
                campusLocation: studentData.campusLocation,
                birthday: studentData.birthday,
                carNumber: studentData.carNumber,
                avatarUrl: studentData.avatarUrl,
                avatarStorageId: studentData.avatarStorageId,
            })
            // La página se mantiene automáticamente con autoResetPageIndex: false
            // TODO: Agregar toast de éxito aquí
        } catch {
            // TODO: Agregar toast de error aquí
        }
    }, [createStudent])

    const handleUpdateStudent = React.useCallback(async (studentData: Omit<Student, 'id'>) => {
        if (!selectedStudent) return

        try {
            await updateStudent({
                studentId: selectedStudent.id as Id<"students">,
                firstName: studentData.firstName,
                lastName: studentData.lastName,
                grade: studentData.grade,
                campusLocation: studentData.campusLocation,
                birthday: studentData.birthday,
                carNumber: studentData.carNumber,
                avatarUrl: studentData.avatarUrl,
                avatarStorageId: studentData.avatarStorageId,
            })
            setEditDialogOpen(false)
            setSelectedStudent(undefined)
            // La página se mantiene automáticamente con autoResetPageIndex: false
            // TODO: Agregar toast de éxito aquí
        } catch {
            // TODO: Agregar toast de error aquí
        }
    }, [selectedStudent, updateStudent])

    const handleDeleteStudent = React.useCallback(async (studentId: string) => {
        try {
            await deleteStudent({ studentId: studentId as Id<"students"> })
            setEditDialogOpen(false)
            setSelectedStudent(undefined)
            // La página se mantiene automáticamente con autoResetPageIndex: false
            // TODO: Agregar toast de éxito aquí
        } catch {
            // TODO: Agregar toast de error aquí
        }
    }, [deleteStudent])

    const handleRowClick = React.useCallback((student: Student, event: React.MouseEvent) => {
        // Skip if clicking checkbox
        if ((event.target as HTMLElement).closest('[role="checkbox"]')) return

        setSelectedStudent(student)
        setEditDialogOpen(true)
    }, [])

    if (isLoading) {
        return <StudentsTableSkeleton />
    }

    return (
        <div className="w-full">
            {/* Filters */}
            <div className="py-4 pt-0">
                <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:justify-between md:gap-4">
                    {/* Search */}
                    <div className="relative col-span-2 md:col-span-1">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                            placeholder={t('search.placeholder')}
                            value={globalFilter ?? ""}
                            onChange={(e) => setGlobalFilter(e.target.value)}
                            className="pl-8 border-2 border-yankees-blue focus:ring-yankees-blue"
                            aria-label={t('search.placeholder')}
                        />
                    </div>

                    {/* Campus filter */}
                    <FilterDropdown<typeof CAMPUS_LOCATIONS[number]>
                        value={(table.getColumn("campusLocation")?.getFilterValue() as typeof CAMPUS_LOCATIONS[number]) ?? ""}
                        onChange={(value: string) =>
                            table.getColumn("campusLocation")?.setFilterValue(value)
                        }
                        options={CAMPUS_LOCATIONS}
                        icon={MapPin}
                        label={t('filters.campus.label')}
                        placeholder={t('filters.campus.all')}
                        placeholderShort={t('filters.campus.short')}
                    />

                    {/* Grade filter */}
                    <FilterDropdown<Grade>
                        value={(table.getColumn("grade")?.getFilterValue() as Grade) ?? ""}
                        onChange={(value: string) =>
                            table.getColumn("grade")?.setFilterValue(value)
                        }
                        options={GRADES as readonly Grade[]}
                        icon={GraduationCap}
                        label={t('filters.grade.label')}
                        placeholder={t('filters.grade.all')}
                        placeholderShort={t('filters.grade.short')}
                    />

                    {/* Actions */}
                    <div className="col-span-2 flex gap-2 md:col-span-1 md:ml-auto">
                        <div className="flex-1 md:flex-none">
                            <StudentFormDialog
                                mode="create"
                                onSubmit={handleCreateStudent}
                                trigger={
                                    <Button className="w-full gap-2 bg-yankees-blue hover:bg-yankees-blue/90 md:w-auto">
                                        <Plus className="h-4 w-4" />
                                        <span className="hidden lg:inline">{t('actions.add')}</span>
                                        <span className="lg:hidden">{t('actions.addShort')}</span>
                                    </Button>
                                }
                            />
                        </div>
                        <div className="flex-1 md:flex-none">
                            <DeleteStudentsDialog
                                selectedStudents={selectedStudents}
                                onDeleteStudents={handleDeleteStudents}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-md border-2 border-yankees-blue">
                <Table>
                    <TableHeader className="bg-yankees-blue">
                        {table.getHeaderGroups().map(headerGroup => (
                            <TableRow key={headerGroup.id} className="border-b-2 border-yankees-blue hover:bg-yankees-blue">
                                {headerGroup.headers.map(header => (
                                    <TableHead
                                        key={header.id}
                                        className={`whitespace-nowrap px-2 py-3 text-white lg:px-4 ${(header.column.columnDef.meta as { className?: string })?.className || ''
                                            }`}
                                    >
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(header.column.columnDef.header, header.getContext())}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map(row => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                    className="cursor-pointer border-b border-yankees-blue/20 hover:bg-muted/50"
                                    onClick={(e) => handleRowClick(row.original, e)}
                                >
                                    {row.getVisibleCells().map(cell => (
                                        <TableCell
                                            key={cell.id}
                                            className={`px-2 py-3 lg:px-4 ${(cell.column.columnDef.meta as { className?: string })?.className || ''
                                                }`}
                                        >
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    {t('table.noResults')}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div>
                        {table.getFilteredSelectedRowModel().rows.length} of{" "}
                        {table.getFilteredRowModel().rows.length} row(s) selected.
                    </div>
                    <div className="hidden sm:block">
                        •
                    </div>
                    <div className="font-medium text-yankees-blue">
                        {studentsData?.total ?? data.length} total students
                    </div>
                    <div className="hidden md:block">
                        •
                    </div>
                    <div className="hidden md:block">
                        Page {table.getState().pagination.pageIndex + 1} of{" "}
                        {table.getPageCount()}
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        <span className="hidden sm:inline">{t('table.pagination.previous')}</span>
                        <span className="sm:hidden">{t('table.pagination.previousShort')}</span>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        {t('table.pagination.next')}
                    </Button>
                </div>
            </div>

            {/* Edit Dialog */}
            <StudentFormDialog
                mode="edit"
                student={selectedStudent}
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                onSubmit={handleUpdateStudent}
                onDelete={handleDeleteStudent}
            />
        </div>
    )
}
