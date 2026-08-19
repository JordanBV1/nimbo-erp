/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  ShieldCheck,
  Trash2,
  Edit3,
  Building2,
  Search,
  Eye,
  EyeOff,
  Lock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  UserCheck,
  Briefcase,
  ShieldAlert,
  Info,
  X
} from "lucide-react";
import { Role, User, Branch, Organization, BusinessType } from "../../types.js";

interface DetailedUser extends User {
  branchName?: string;
}

interface UserManagerProps {
  currentUser: User;
  org?: Organization | null;
  triggerToast: (message: string, type?: "success" | "error" | "info") => void;
  onRefreshData?: () => void;
}

export default function UserManager({
  currentUser,
  org,
  triggerToast,
  onRefreshData
}: UserManagerProps) {
  const [users, setUsers] = useState<DetailedUser[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [pricing, setPricing] = useState<{ basePrice: number; perBranchPrice: number; totalPrice: number }>({
    basePrice: 5000,
    perBranchPrice: 1000,
    totalPrice: 5000,
  });

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<DetailedUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<DetailedUser | null>(null);

  const [isBranchModalOpen, setIsBranchModalOpen] = useState<boolean>(false);
  const [branchFormData, setBranchFormData] = useState({
    name: "",
    address: "",
    businessType: BusinessType.GENERAL
  });
  const [submittingBranch, setSubmittingBranch] = useState<boolean>(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: Role.CAJERO,
    branchId: ""
  });
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setBranches(data.branches || []);
        if (data.branches && data.branches.length > 0 && !formData.branchId) {
          const isAdminUser = currentUser.role === Role.ADMIN;
          if (isAdminUser) {
            setFormData((prev) => ({ ...prev, branchId: data.branches[0].id }));
          } else {
            setFormData((prev) => ({ ...prev, branchId: currentUser.branchId }));
          }
        }
      } else {
        triggerToast("Error al cargar la lista de usuarios", "error");
      }
    } catch (e) {
      console.error(e);
      triggerToast("Error de conexión al servidor", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (!org?.id) return;
    const ctrl = new AbortController();
    fetch(`/api/subscription/pricing?orgId=${org.id}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (p && !ctrl.signal.aborted) setPricing({ basePrice: p.basePrice, perBranchPrice: p.perBranchPrice, totalPrice: p.totalPrice });
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [org?.id]);

  const openCreateModal = () => {
    setEditingUser(null);
    const isAdminUser = currentUser.role === Role.ADMIN;
    setFormData({
      name: "",
      email: "",
      password: "",
      role: Role.CAJERO,
      branchId: isAdminUser ? (branches.length > 0 ? branches[0].id : "") : currentUser.branchId || ""
    });
    setIsModalOpen(true);
  };

  const openEditModal = (user: DetailedUser) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      branchId: user.branchId || (branches.length > 0 ? branches[0].id : "")
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      triggerToast("Completa los campos obligatorios", "error");
      return;
    }

    setSubmitting(true);
    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
      const method = editingUser ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          adminUserId: currentUser.id
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        triggerToast(
          editingUser
            ? `Usuario ${formData.name} actualizado con éxito`
            : `Nuevo usuario ${formData.name} creado correctamente`,
          "success"
        );
        setIsModalOpen(false);
        loadUsers();
        if (onRefreshData) onRefreshData();
      } else {
        triggerToast(data.error || "Ocurrió un error al procesar la solicitud", "error");
      }
    } catch (err) {
      console.error(err);
      triggerToast("Error de conexión al guardar usuario", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    if (deletingUser.id === currentUser.id) {
      triggerToast("No puedes eliminar tu propio usuario en sesión activa", "error");
      setDeletingUser(null);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/users/${deletingUser.id}?adminUserId=${currentUser.id}`, {
        method: "DELETE"
      });
      const data = await res.json();

      if (res.ok && data.success) {
        triggerToast(`Usuario ${deletingUser.name} eliminado del sistema`, "success");
        setDeletingUser(null);
        loadUsers();
        if (onRefreshData) onRefreshData();
      } else {
        triggerToast(data.error || "Error al eliminar usuario", "error");
      }
    } catch (err) {
      console.error(err);
      triggerToast("Error de conexión al eliminar", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchFormData.name.trim()) {
      triggerToast("El nombre del local/sucursal es obligatorio", "error");
      return;
    }

    setSubmittingBranch(true);
    try {
      const res = await fetch("/api/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...branchFormData,
          organizationId: org?.id || "",
          adminUserId: currentUser.id
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        triggerToast(
          `¡Local '${data.branch.name}' creado con éxito! Nueva tarifa mensual: $${data.monthlyFee} CUP (${data.branchCount} locales).`,
          "success"
        );
        setIsBranchModalOpen(false);
        setBranchFormData({ name: "", address: "", businessType: BusinessType.GENERAL });
        await loadUsers();
        if (onRefreshData) onRefreshData();
      } else {
        triggerToast(data.error || "Error al registrar la sucursal", "error");
      }
    } catch (err) {
      console.error(err);
      triggerToast("Error de conexión al crear sucursal", "error");
    } finally {
      setSubmittingBranch(false);
    }
  };

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case Role.ADMIN:
        return {
          label: "Administrador",
          bg: "bg-purple-950/60 text-purple-300 border-purple-500/30",
          desc: "Acceso total a la configuración, reportes y gestión"
        };
      case Role.GERENTE:
        return {
          label: "Gerente",
          bg: "bg-blue-950/60 text-blue-300 border-blue-500/30",
          desc: "Gestión comercial, inventarios y cierres de turno"
        };
      case Role.CAJERO:
        return {
          label: "Cajero",
          bg: "bg-emerald-950/60 text-emerald-300 border-emerald-500/30",
          desc: "Punto de Venta (POS), cobros en CUP/USD y arqueos"
        };
      case Role.BODEGA:
        return {
          label: "Bodega / Stock",
          bg: "bg-amber-950/60 text-amber-300 border-amber-500/30",
          desc: "Entradas, salidas de stock y recepción de insumos"
        };
      case Role.PRODUCCION:
        return {
          label: "Producción",
          bg: "bg-orange-950/60 text-orange-300 border-orange-500/30",
          desc: "Órdenes de elaboración, recetas BOM y mermas"
        };
      case Role.CONTABLE:
        return {
          label: "Contable / ONAT",
          bg: "bg-cyan-950/60 text-cyan-300 border-cyan-500/30",
          desc: "Libro diario, libro de caja y reportes fiscales"
        };
      case Role.RRHH:
        return {
          label: "Recursos Humanos",
          bg: "bg-pink-950/60 text-pink-300 border-pink-500/30",
          desc: "Control de asistencia, incidencias y nómina"
        };
      default:
        return {
          label: role,
          bg: "bg-slate-800 text-slate-300 border-slate-700",
          desc: "Acceso operativo estándar"
        };
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const totalUsersCount = users.length;
  const adminManagerCount = users.filter((u) => u.role === Role.ADMIN || u.role === Role.GERENTE).length;
  const posCount = users.filter((u) => u.role === Role.CAJERO).length;
  const operationsCount = users.filter(
    (u) => u.role === Role.BODEGA || u.role === Role.PRODUCCION || u.role === Role.CONTABLE || u.role === Role.RRHH
  ).length;

  return (
    <div className="space-y-6" id="user-management-module">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#121214] border border-slate-800 rounded-3xl p-6 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 bg-blue-600/10 border border-blue-500/20 rounded-2xl text-blue-400">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight font-display flex items-center">
                Gestión de Usuarios y Equipo
                <span className="ml-3 text-xs font-mono font-bold bg-blue-500/10 text-blue-400 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                  {users.length} {users.length === 1 ? "usuario" : "usuarios"}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Crea y administra las cuentas con credenciales de acceso para tus gerentes, cajeros, bodegueros y contables.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={loadUsers}
            disabled={loading}
            className="p-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
            title="Recargar directorio"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-blue-400" : ""}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>

          {currentUser.role === Role.ADMIN && (
            <button
              type="button"
              onClick={() => setIsBranchModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <Building2 className="h-4 w-4" />
              <span>+ Crear Nuevo Local</span>
            </button>
            )}

            <button
            type="button"
            onClick={openCreateModal}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-2 shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            <span>Agregar Nuevo Usuario</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#121214] border border-slate-800/80 rounded-2xl p-4 flex items-center space-x-4">
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Admin & Gerencia</span>
            <span className="text-xl font-bold font-mono text-white block mt-0.5">{adminManagerCount}</span>
          </div>
        </div>

        <div className="bg-[#121214] border border-slate-800/80 rounded-2xl p-4 flex items-center space-x-4">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Cajeros / POS</span>
            <span className="text-xl font-bold font-mono text-white block mt-0.5">{posCount}</span>
          </div>
        </div>

        <div className="bg-[#121214] border border-slate-800/80 rounded-2xl p-4 flex items-center space-x-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Bodega & Operaciones</span>
            <span className="text-xl font-bold font-mono text-white block mt-0.5">{operationsCount}</span>
          </div>
        </div>

        <div className="bg-[#121214] border border-slate-800/80 rounded-2xl p-4 flex items-center space-x-4">
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Sucursales / Locales</span>
            <span className="text-xl font-bold font-mono text-white block mt-0.5">{branches.length || 1}</span>
          </div>
        </div>
      </div>

      {currentUser.role === Role.ADMIN && (
      <div className="bg-[#121214] border border-slate-800 rounded-3xl p-6 shadow-sm space-y-4" id="branches-list-section">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="space-y-0.5">
            <h3 className="font-bold text-white text-base font-display flex items-center">
              <Building2 className="h-5 w-5 text-blue-400 mr-2" />
              Locales y Sucursales de la Organización
              <span className="ml-3 text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                {branches.length || 1} {branches.length === 1 ? "Local" : "Locales"}
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Cada local opera de forma independiente. Tu plan incluye 1er local ({pricing.basePrice.toLocaleString()} CUP base); cada local extra suma +{pricing.perBranchPrice.toLocaleString()} CUP/mes a la suscripción.
            </p>
          </div>

          {currentUser.role === Role.ADMIN && (
          <button
            type="button"
            onClick={() => setIsBranchModalOpen(true)}
            className="bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 self-start sm:self-auto cursor-pointer"
          >
            <Building2 className="h-4 w-4" />
            <span>Añadir Local (+{pricing.perBranchPrice.toLocaleString()} CUP)</span>
          </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map((b, index) => (
            <div key={b.id} className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white font-display flex items-center">
                  {b.name}
                  {index === 0 && (
                    <span className="ml-2 text-[9px] font-mono bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.2 rounded-md uppercase">
                      Principal
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-500/20">
                  {index === 0 ? "Incluido Base" : `+${pricing.perBranchPrice.toLocaleString()} CUP / mes`}
                </span>
              </div>

              <p className="text-[11px] text-slate-400">
                📍 {b.address || "Dirección no especificada"}
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-[10px] text-slate-500 font-mono">
                <span>Tipo: <strong className="text-slate-300 capitalize">{b.businessType || "General"}</strong></span>
                <span>ID: {b.id.substring(0, 8)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      )}

      <div className="bg-[#121214] border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nombre o correo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs font-medium text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <span className="text-xs font-bold text-slate-400 shrink-0">Filtrar por Rol:</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-xs font-bold text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500 cursor-pointer w-full sm:w-auto"
          >
            <option value="ALL">Todos los Roles ({users.length})</option>
            <option value={Role.ADMIN}>Administradores</option>
            <option value={Role.GERENTE}>Gerentes</option>
            <option value={Role.CAJERO}>Cajeros</option>
            <option value={Role.BODEGA}>Bodega / Almacén</option>
            <option value={Role.PRODUCCION}>Producción</option>
            <option value={Role.CONTABLE}>Contabilidad</option>
            <option value={Role.RRHH}>Recursos Humanos</option>
          </select>
        </div>
      </div>

      <div className="bg-[#121214] border border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-500" />
            <p className="text-xs font-medium">Cargando directorio de equipo...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <Users className="h-10 w-10 mx-auto text-slate-600" />
            <p className="text-sm font-bold text-white">No se encontraron usuarios</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Prueba cambiando los términos de búsqueda o agrega un nuevo miembro al equipo.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase font-mono font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-6">Usuario / Nombre</th>
                  <th className="py-3.5 px-6">Correo Electrónico</th>
                  <th className="py-3.5 px-6">Rol del Sistema</th>
                  <th className="py-3.5 px-6">Sucursal Asignada</th>
                  <th className="py-3.5 px-6">Clave de Acceso</th>
                  <th className="py-3.5 px-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filteredUsers.map((userItem) => {
                  const roleBadge = getRoleBadge(userItem.role);
                  const isCurrent = userItem.id === currentUser.id;

                  return (
                    <tr key={userItem.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center font-bold text-white font-mono shadow-md text-sm shrink-0">
                            {userItem.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-white text-sm block flex items-center">
                              {userItem.name}
                              {isCurrent && (
                                <span className="ml-2 text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.2 rounded-full">
                                  Tú (Sesión Activa)
                                </span>
                              )}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">ID: {userItem.id.substring(0, 8)}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <span className="text-slate-200 font-mono font-medium">{userItem.email}</span>
                      </td>

                      <td className="py-4 px-6">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border font-mono ${roleBadge.bg}`}
                          >
                            <ShieldCheck className="h-3 w-3 mr-1" />
                            {roleBadge.label}
                          </span>
                          <p className="text-[10px] text-slate-400 max-w-xs">{roleBadge.desc}</p>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-1.5 text-slate-300">
                          <Building2 className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                          <span className="font-semibold text-xs">{userItem.branchName || "Sucursal Principal"}</span>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-2 font-mono text-slate-400">
                          <Lock className="h-3.5 w-3.5 text-slate-500" />
                          <span className="tracking-widest">••••••••</span>
                        </div>
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(userItem)}
                            className="p-2 bg-slate-900 border border-slate-800 hover:bg-blue-600 hover:text-white text-slate-300 rounded-xl transition-colors cursor-pointer"
                            title="Editar usuario y permisos"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>

                          {!isCurrent ? (
                            <button
                              type="button"
                              onClick={() => setDeletingUser(userItem)}
                              className="p-2 bg-slate-900 border border-slate-800 hover:bg-rose-600 hover:text-white text-slate-400 hover:border-rose-500 rounded-xl transition-colors cursor-pointer"
                              title="Eliminar usuario"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <div className="p-2 text-slate-600 cursor-not-allowed" title="No puedes eliminar tu cuenta activa">
                              <ShieldAlert className="h-3.5 w-3.5" />
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-[#121214] border border-slate-800/80 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center space-x-2">
          <Info className="h-5 w-5 text-blue-400" />
          <h3 className="font-bold text-white text-sm">Guía Rápida de Roles y Privilegios</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl space-y-1">
            <span className="font-bold text-purple-400 font-mono">ADMINISTRADOR</span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Acceso total al sistema, creación de usuarios, configuración fiscal, parámetros cambiarios y arqueos generales.
            </p>
          </div>
          <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl space-y-1">
            <span className="font-bold text-blue-400 font-mono">GERENTE</span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Supervisión general de ventas, inventarios, compras a proveedores y cierres diarios de caja.
            </p>
          </div>
          <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl space-y-1">
            <span className="font-bold text-emerald-400 font-mono">CAJERO</span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Operación directa del Punto de Venta (POS), cobros en efectivo/transferencia (CUP y USD) y arqueo de turno.
            </p>
          </div>
          <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl space-y-1">
            <span className="font-bold text-amber-400 font-mono">BODEGA / ALMACÉN</span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Registro de entradas de mercancía, ajuste de stock, transferencias entre sucursales y alertas de inventario.
            </p>
          </div>
          <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl space-y-1">
            <span className="font-bold text-orange-400 font-mono">PRODUCCIÓN</span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Generación de órdenes de trabajo, formulación de recetas (BOM) y consumo automático de materias primas.
            </p>
          </div>
          <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl space-y-1">
            <span className="font-bold text-cyan-400 font-mono">CONTABLE / RRHH</span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Generación de modelos ONAT, estado de resultados, libros contables, nóminas y control de empleados.
            </p>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#121214] border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-blue-600/10 text-blue-400 rounded-xl border border-blue-500/20">
                  {editingUser ? <Edit3 className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-white text-base font-display">
                    {editingUser ? "Editar Usuario del Sistema" : "Registrar Nuevo Usuario"}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {editingUser
                      ? `Modifica credenciales o permisos para ${editingUser.name}`
                      : "Añade un colaborador bajo tu mando para operar la plataforma"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Carlos Vendedor"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Correo Electrónico / Usuario de Acceso *
                </label>
                <input
                  type="email"
                  required
                  placeholder="ejemplo@negocio.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Contraseña {editingUser ? "(Dejar en blanco para conservar actual)" : "*"}
                  </label>
                  {!editingUser && (
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, password: Math.random().toString(36).slice(-8) + "123" })
                      }
                      className="text-[10px] text-blue-400 hover:underline font-mono"
                    >
                      Generar Clave
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required={!editingUser}
                    placeholder={editingUser ? "•••••••• (Sin cambios)" : "Mínimo 6 caracteres"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-4 pr-10 py-2.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rol de Acceso *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value={Role.CAJERO}>Cajero (Punto de Venta / Arqueos)</option>
                  <option value={Role.GERENTE}>Gerente (Gestión General / Ventas)</option>
                  <option value={Role.BODEGA}>Bodega (Control de Stock / Almacén)</option>
                  <option value={Role.PRODUCCION}>Producción (Elaboración / BOM)</option>
                  <option value={Role.CONTABLE}>Contable (ONAT / Libros Contables)</option>
                  <option value={Role.RRHH}>Recursos Humanos (Asistencia / Nómina)</option>
                  <option value={Role.ADMIN}>Administrador (Acceso Total)</option>
                </select>
              </div>

              {branches.filter(b => currentUser.role === Role.ADMIN || b.id === currentUser.branchId).length > 0 && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sucursal Asignada</label>
                  <select
                    value={formData.branchId}
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                    disabled={currentUser.role !== Role.ADMIN}
                  >
                    {branches.filter(b => currentUser.role === Role.ADMIN || b.id === currentUser.branchId).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.businessType})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-3 flex items-center justify-end space-x-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center space-x-2 cursor-pointer"
                >
                  {submitting ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  <span>{editingUser ? "Guardar Cambios" : "Crear Usuario"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121214] border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-white text-base font-display">¿Eliminar Usuario?</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Estás a punto de revocar el acceso a <strong className="text-white">{deletingUser.name}</strong> (
              <span className="font-mono text-blue-400">{deletingUser.email}</span>). Esta persona ya no podrá ingresar a la
              plataforma con sus credenciales.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={submitting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/20 transition-all flex items-center space-x-2 cursor-pointer"
              >
                {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                <span>Sí, Eliminar Acceso</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {isBranchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#121214] border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-emerald-600/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base font-display">
                    Crear Nuevo Local / Sucursal
                  </h3>
                  <p className="text-xs text-slate-400">
                    Añade un local adicional vinculado a tu organización ({org?.name || "Nimbo ERP"})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBranchModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-blue-950/40 border border-blue-500/30 rounded-2xl p-4 space-y-1.5 text-xs text-slate-300">
              <div className="flex items-center justify-between text-blue-400 font-bold font-mono">
                <span>Impacto en la Suscripción</span>
                <span>+{pricing.perBranchPrice.toLocaleString()}.00 CUP / mes</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-400">
                Tu primer local está incluido en la cuota base de <strong className="text-white">{pricing.basePrice.toLocaleString()} CUP/mes</strong>. Cada local adicional agrega <strong className="text-emerald-400 font-bold">+{pricing.perBranchPrice.toLocaleString()} CUP/mes</strong> al cobro total recurrente.
              </p>
            </div>

            <form onSubmit={handleCreateBranch} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nombre del Local / Sucursal *</label>
                <input
                  type="text"
                  required
                  placeholder="ej. Sucursal Miramar, Cafetería Vedado..."
                  value={branchFormData.name}
                  onChange={(e) => setBranchFormData({ ...branchFormData, name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dirección Física</label>
                <input
                  type="text"
                  placeholder="ej. Calle 23 #456 e/ H e I, Vedado"
                  value={branchFormData.address}
                  onChange={(e) => setBranchFormData({ ...branchFormData, address: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tipo de Negocio / Actividad</label>
                <select
                  value={branchFormData.businessType}
                  onChange={(e) => setBranchFormData({ ...branchFormData, businessType: e.target.value as BusinessType })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value={BusinessType.GENERAL}>General / Comercio Estándar</option>
                  <option value={BusinessType.CAFETERIA}>Gastronomía / Cafetería / Restaurante</option>
                  <option value={BusinessType.BAKERY}>Panadería / Dulcería</option>
                  <option value={BusinessType.GROCERY}>Mercado / Víveres / Bodega</option>
                  <option value={BusinessType.CLOTHING}>Tienda de Ropa y Calzado</option>
                  <option value={BusinessType.ELECTRONICS}>Electrónica / Reparaciones</option>
                  <option value={BusinessType.HARDWARE}>Ferretería / Materiales</option>
                  <option value={BusinessType.SERVICES}>Servicios / Consultoría</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end space-x-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsBranchModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingBranch}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {submittingBranch ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Building2 className="h-4 w-4" />
                  )}
                  <span>Crear Local (+{pricing.perBranchPrice.toLocaleString()} CUP)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}