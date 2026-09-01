import React, { useEffect, useMemo, useState } from "react";
import type { Row } from "./main";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(new URL(path, window.location.origin), {
    ...init, headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.detail || `操作失败（${response.status}）`);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

type Props = { go: (target: string) => void };
type RoleForm = { id?: number; roleCode: string; name: string; dataScope: string; readOnly: number; status: number; permissionCodes: string[] };
const emptyRole = (): RoleForm => ({ roleCode: "CUSTOM_ROLE", name: "", dataScope: "SELF", readOnly: 0, status: 1, permissionCodes: [] });
const parseIds = (value: unknown) => String(value || "").split(",").filter(Boolean).map(Number);

export function OrganizationPage({ go }: Props) {
  const [departments, setDepartments] = useState<Row[]>([]);
  const [roles, setRoles] = useState<Row[]>([]);
  const [permissions, setPermissions] = useState<Row[]>([]);
  const [members, setMembers] = useState<Row[]>([]);
  const [roleForm, setRoleForm] = useState<RoleForm>();
  const [departmentForm, setDepartmentForm] = useState<Row>();
  const [memberForm, setMemberForm] = useState<Row>();
  const [error, setError] = useState("");
  const load = async () => {
    try {
      const [departmentRows, roleRows, permissionRows, memberRows] = await Promise.all([
        api<Row[]>("/api/client/organization/departments"),
        api<Row[]>("/api/client/organization/roles"),
        api<Row[]>("/api/client/organization/permissions"),
        api<Row[]>("/api/client/members"),
      ]);
      setDepartments(departmentRows); setRoles(roleRows); setPermissions(permissionRows); setMembers(memberRows); setError("");
    } catch (e) { setError((e as Error).message); }
  };
  useEffect(() => { void load(); }, []);
  const permissionsByModule = useMemo(() => Object.entries(permissions.reduce<Record<string, Row[]>>((all, item) => {
    (all[String(item.module)] ||= []).push(item); return all;
  }, {})), [permissions]);
  const saveDepartment = async () => {
    if (!departmentForm?.name?.trim()) return setError("请输入部门名称");
    try {
      await api(`/api/client/organization/departments${departmentForm.id ? `/${departmentForm.id}` : ""}`, {
        method: departmentForm.id ? "PUT" : "POST", body: JSON.stringify({ ...departmentForm, sortOrder: Number(departmentForm.sortOrder || 0), status: Number(departmentForm.status ?? 1) }),
      }); setDepartmentForm(undefined); await load();
    } catch (e) { setError((e as Error).message); }
  };
  const saveRole = async () => {
    if (!roleForm?.name.trim()) return setError("请输入角色名称");
    try {
      await api(`/api/client/organization/roles${roleForm.id ? `/${roleForm.id}` : ""}`, {
        method: roleForm.id ? "PUT" : "POST", body: JSON.stringify(roleForm),
      }); setRoleForm(undefined); await load();
    } catch (e) { setError((e as Error).message); }
  };
  const saveMemberRoles = async () => {
    const roleIds = (memberForm?.roleIds || []) as number[];
    if (!memberForm?.id || !roleIds.length) return setError("请至少选择一个角色");
    try {
      await api(`/api/client/organization/members/${memberForm.id}/roles`, { method: "PUT", body: JSON.stringify({ roleIds }) });
      setMemberForm(undefined); await load();
    } catch (e) { setError((e as Error).message); }
  };
  const remove = async (kind: "departments" | "roles", row: Row) => {
    if (!confirm(`确认删除“${row.name}”？`)) return;
    try { await api(`/api/client/organization/${kind}/${row.id}`, { method: "DELETE" }); await load(); }
    catch (e) { setError((e as Error).message); }
  };
  return <main className="page account-page organization-page">
    <aside>
      <div className="account-brand"><i>鲁</i><strong>企业采购中心</strong></div>
      {[['profile','账户概览'],['orders','我的订单'],['addresses','地址管理'],['invoices','发票管理'],['members','企业成员'],['organization','组织与权限']].map(x=><button className={x[0]==='organization'?'active':''} key={x[0]} onClick={()=>go(x[0])}>{x[1]}<span>›</span></button>)}
    </aside>
    <section>
      <div className="account-heading"><div><h1>组织与权限</h1><p>维护部门、自定义角色、数据范围和成员授权</p></div></div>
      {error && <div className="organization-error">{error}</div>}
      <div className="organization-grid">
        <section className="organization-card">
          <header><div><strong>部门管理</strong><span>{departments.length} 个部门</span></div><button onClick={()=>setDepartmentForm({parentId:null,name:'',sortOrder:0,status:1})}>＋ 添加部门</button></header>
          {departments.map(row=><article key={row.id}><div><strong>{row.parentId?'　└ ':''}{row.name}</strong><span>{row.memberCount || 0} 位成员 · {Number(row.status)===1?'启用':'停用'}</span></div><p><button onClick={()=>setDepartmentForm({...row})}>编辑</button><button onClick={()=>void remove('departments',row)}>删除</button></p></article>)}
        </section>
        <section className="organization-card">
          <header><div><strong>角色权限</strong><span>{roles.length} 个角色</span></div><button onClick={()=>setRoleForm(emptyRole())}>＋ 新增角色</button></header>
          {roles.map(row=><article key={row.id}><div><strong>{row.name}{Number(row.readOnly)===1&&<em>只读</em>}</strong><span>{({SELF:'本人',DEPARTMENT:'所属部门',ENTERPRISE:'本企业'} as Row)[row.dataScope] || row.dataScope} · {row.memberCount || 0} 人</span></div><p><button onClick={()=>setRoleForm({...emptyRole(),...row,permissionCodes:String(row.permissionCodes||'').split(',').filter(Boolean)})}>编辑</button>{!Number(row.builtIn)&&<button onClick={()=>void remove('roles',row)}>删除</button>}</p></article>)}
        </section>
      </div>
      <section className="organization-card member-role-card">
        <header><div><strong>成员授权</strong><span>角色变化保存后立即生效</span></div></header>
        {members.map(row=><article key={row.id}><div><strong>{row.realName}　@{row.username}</strong><span>{row.departmentName||'未分配部门'} · {row.roleNames||row.roleCode}</span></div><button onClick={()=>setMemberForm({...row,roleIds:parseIds(row.roleIds)})}>配置角色</button></article>)}
      </section>
    </section>
    {departmentForm&&<div className="dialog-mask"><div className="client-dialog form-dialog"><button className="dialog-close" onClick={()=>setDepartmentForm(undefined)}>×</button><h2>{departmentForm.id?'编辑':'新增'}部门</h2><label>部门名称<input value={departmentForm.name||''} onChange={e=>setDepartmentForm({...departmentForm,name:e.target.value})}/></label><label>上级部门<select value={departmentForm.parentId||''} onChange={e=>setDepartmentForm({...departmentForm,parentId:e.target.value?Number(e.target.value):null})}><option value="">无（一级部门）</option>{departments.filter(x=>x.id!==departmentForm.id).map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></label><label>排序<input type="number" value={departmentForm.sortOrder||0} onChange={e=>setDepartmentForm({...departmentForm,sortOrder:Number(e.target.value)})}/></label><button className="save-button" onClick={()=>void saveDepartment()}>保存</button></div></div>}
    {roleForm&&<div className="dialog-mask"><div className="client-dialog form-dialog organization-dialog"><button className="dialog-close" onClick={()=>setRoleForm(undefined)}>×</button><h2>{roleForm.id?'编辑':'新增'}角色</h2>{!roleForm.id&&<label>角色编码<input value={roleForm.roleCode} onChange={e=>setRoleForm({...roleForm,roleCode:e.target.value.toUpperCase()})}/></label>}<label>角色名称<input value={roleForm.name} onChange={e=>setRoleForm({...roleForm,name:e.target.value})}/></label><label>数据范围<select value={roleForm.dataScope} onChange={e=>setRoleForm({...roleForm,dataScope:e.target.value})}><option value="SELF">本人</option><option value="DEPARTMENT">所属部门</option><option value="ENTERPRISE">本企业</option></select></label><label className="check-line"><input type="checkbox" checked={!!roleForm.readOnly} onChange={e=>setRoleForm({...roleForm,readOnly:e.target.checked?1:0})}/>只读角色</label><div className="permission-groups">{permissionsByModule.map(([module,items])=><fieldset key={module}><legend>{module}</legend>{items.map(item=><label className="check-line" key={item.permissionCode}><input type="checkbox" checked={roleForm.permissionCodes.includes(item.permissionCode)} onChange={e=>setRoleForm({...roleForm,permissionCodes:e.target.checked?[...roleForm.permissionCodes,item.permissionCode]:roleForm.permissionCodes.filter(x=>x!==item.permissionCode)})}/>{item.name}</label>)}</fieldset>)}</div><button className="save-button" onClick={()=>void saveRole()}>保存</button></div></div>}
    {memberForm&&<div className="dialog-mask"><div className="client-dialog form-dialog"><button className="dialog-close" onClick={()=>setMemberForm(undefined)}>×</button><h2>配置成员角色</h2><p>{memberForm.realName}　@{memberForm.username}</p><div className="permission-groups">{roles.filter(x=>Number(x.status)===1).map(role=><label className="check-line" key={role.id}><input type="checkbox" checked={(memberForm.roleIds||[]).includes(role.id)} onChange={e=>setMemberForm({...memberForm,roleIds:e.target.checked?[...(memberForm.roleIds||[]),role.id]:(memberForm.roleIds||[]).filter((x:number)=>x!==role.id)})}/>{role.name}</label>)}</div><button className="save-button" onClick={()=>void saveMemberRoles()}>保存并立即生效</button></div></div>}
  </main>;
}
