import { useEffect, useMemo, useState } from "react";
import {
  App as AntApp, Button, Card, Checkbox, ConfigProvider, Descriptions, Drawer, Form, Input,
  InputNumber, Layout, Menu, Modal, Select, Space, Statistic, Switch, Table, Tag, Typography
} from "antd";
import type { ColumnsType } from "antd/es/table";
import zhCN from "antd/locale/zh_CN";

type Row = Record<string, any>;
type Module = "overview" | "users" | "roles" | "permissions" | "logs" | "configs";
const apiHeaders = { "Content-Type": "application/json", Authorization: `Basic ${btoa("admin:change-me-before-production")}` };
const dateTime = (value?: string) => value ? new Intl.DateTimeFormat("zh-CN", {
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false
}).format(new Date(value.replace(" ", "T"))) : "—";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/admin/system${path}`, { ...init, headers: { ...apiHeaders, ...init?.headers } });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || payload.detail || `请求失败（${response.status}）`);
  }
  if (response.status === 204 || response.headers.get("content-length") === "0") return undefined as T;
  return response.json();
}

const navItems = [
  { key: "overview", label: "经营概览", icon: <span>概</span> },
  { type: "group" as const, label: "业务管理", children: [
    { key: "products", label: "商品管理", icon: <span>商</span>, disabled: true },
    { key: "enterprises", label: "企业管理", icon: <span>企</span>, disabled: true },
    { key: "agreements", label: "协议管理", icon: <span>协</span>, disabled: true },
    { key: "orders", label: "订单管理", icon: <span>单</span>, disabled: true }
  ]},
  { type: "group" as const, label: "系统管理", children: [
    { key: "users", label: "用户管理", icon: <span>用</span> },
    { key: "roles", label: "角色管理", icon: <span>角</span> },
    { key: "permissions", label: "权限管理", icon: <span>权</span> },
    { key: "logs", label: "操作日志", icon: <span>志</span> },
    { key: "configs", label: "基本配置", icon: <span>设</span> }
  ]}
];

export function App() {
  return <ConfigProvider locale={zhCN} theme={{ token: {
    colorPrimary: "#1767d2", borderRadius: 10, fontSize: 16, colorText: "#17243d"
  }}}><AntApp><AdminApp /></AntApp></ConfigProvider>;
}

function AdminApp() {
  const [module, setModule] = useState<Module>("overview");
  const titles: Record<Module, [string,string]> = {
    overview:["经营概览","掌握平台账户、权限与关键业务运行状态"],
    users:["用户管理","维护后台登录用户、角色归属与启停状态"],
    roles:["角色管理","按岗位配置角色与操作权限"],
    permissions:["权限管理","查看系统权限点及所属业务模块"],
    logs:["操作日志","追踪关键管理操作，支持审计与问题定位"],
    configs:["基本配置","维护平台信息、订单和库存参数"]
  };
  return <Layout className="admin-shell">
    <Layout.Sider width={242} className="admin-sider">
      <div className="brand"><i>链</i><div><strong>供应链运营中心</strong><small>ADMIN CONSOLE</small></div></div>
      <Menu mode="inline" theme="dark" selectedKeys={[module]} items={navItems}
        onClick={({key}) => setModule(key as Module)} />
      <div className="service-state"><span><i /> 系统服务正常</span><small>数据库与缓存已连接</small></div>
    </Layout.Sider>
    <Layout>
      <Layout.Header className="admin-header">
        <div><small>运营管理 / 系统管理 /</small><strong>{titles[module][0]}</strong></div>
        <label className="global-search">⌕ <input placeholder="搜索用户、角色或日志" /></label>
        <div className="admin-account"><span>王</span><div><strong>王运营</strong><small>超级管理员</small></div></div>
      </Layout.Header>
      <Layout.Content className="admin-content">
        <div className="page-heading"><div><span>2026年7月29日 · 数据实时更新</span><Typography.Title level={2}>{titles[module][0]}</Typography.Title><p>{titles[module][1]}</p></div>
          <Space><Button href="/web/">查看客户端</Button><Button onClick={() => location.reload()}>刷新数据</Button></Space></div>
        {module === "overview" && <Overview go={setModule}/>}
        {module === "users" && <Users />}
        {module === "roles" && <Roles />}
        {module === "permissions" && <Permissions />}
        {module === "logs" && <Logs />}
        {module === "configs" && <Configs />}
      </Layout.Content>
    </Layout>
  </Layout>;
}

function useLoad<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const { message } = AntApp.useApp();
  const [data,setData] = useState<T>();
  const [loading,setLoading] = useState(true);
  const refresh = async () => {
    setLoading(true);
    try { setData(await loader()); } catch (error) { message.error((error as Error).message); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, deps);
  return { data, loading, refresh };
}

function Overview({go}:{go:(value:Module)=>void}) {
  const {data = {},loading} = useLoad<Row>(()=>api("/summary"));
  const metrics = [
    ["后台用户",data.users ?? 0,"用","#e9f2ff"],["系统角色",data.roles ?? 0,"角","#e8faf6"],
    ["权限点",data.permissions ?? 0,"权","#f4edff"],["今日操作",data.todayLogs ?? 0,"志","#fff4e5"]
  ];
  return <><div className="metric-grid">{metrics.map(([label,value,icon,color])=><Card loading={loading} key={label as string}>
    <div className="metric"><div><span>{label}</span><strong>{value}</strong><small>数据来自正式数据库</small></div><i style={{background:color as string}}>{icon}</i></div>
  </Card>)}</div>
  <div className="overview-grid">
    <Card title="系统管理快捷入口" extra={<Tag color="green">权限系统已启用</Tag>}>
      <div className="quick-grid">{[
        ["users","用户管理","创建用户、分配角色与状态控制","用"],
        ["roles","角色管理","配置角色的业务操作权限","角"],
        ["permissions","权限清单","查看全部权限点与模块","权"],
        ["logs","操作审计","追踪增删改和配置变更","志"]
      ].map(item=><button key={item[0]} onClick={()=>go(item[0] as Module)}><i>{item[3]}</i><span><strong>{item[1]}</strong><small>{item[2]}</small></span><em>›</em></button>)}</div>
    </Card>
    <Card title="安全检查"><div className="security-list">
      <p><i className="ok">✓</i><span><strong>数据库迁移</strong><small>结构版本已由 Flyway 管理</small></span></p>
      <p><i className="ok">✓</i><span><strong>操作审计</strong><small>系统变更自动写入操作日志</small></span></p>
      <p><i className="warn">!</i><span><strong>开发账号</strong><small>上线前需替换临时 Basic Auth</small></span></p>
    </div></Card>
  </div></>;
}

function Users() {
  const {message,modal} = AntApp.useApp();
  const roles = useLoad<Row[]>(()=>api("/roles"));
  const users = useLoad<Row[]>(()=>api("/users"));
  const [open,setOpen]=useState(false); const [editing,setEditing]=useState<Row>(); const [form]=Form.useForm();
  const show=(row?:Row)=>{setEditing(row);form.setFieldsValue(row?{...row,roleIds:String(row.roleIds||"").split(",").filter(Boolean).map(Number),password:""}:{status:1,roleIds:[]});setOpen(true);};
  const save=async()=>{
    try { const values=await form.validateFields(); await api(editing?`/users/${editing.id}`:"/users",{method:editing?"PUT":"POST",body:JSON.stringify(values)});
      message.success(editing?"用户已更新":"用户已创建");setOpen(false);void users.refresh();
    } catch(error) { if(error instanceof Error) message.error(error.message); }
  };
  const remove=(row:Row)=>modal.confirm({title:`确认删除用户“${row.realName}”？`,content:"删除后该账号将无法登录。",okText:"确认删除",okButtonProps:{danger:true},
    onOk:async()=>{try{await api(`/users/${row.id}`,{method:"DELETE"});message.success("用户已删除");void users.refresh();}catch(error){message.error((error as Error).message);}}});
  const columns:ColumnsType<Row>=[
    {title:"用户",render:(_,row)=><div className="user-cell"><i>{row.realName?.slice(0,1)}</i><span><strong>{row.realName}</strong><small>@{row.username}</small></span></div>},
    {title:"联系方式",render:(_,row)=><span>{row.phone||"—"}<small className="subline">{row.email||"—"}</small></span>},
    {title:"角色",dataIndex:"roleNames",render:value=><Tag color="blue">{value||"未分配"}</Tag>},
    {title:"状态",dataIndex:"status",render:value=><Tag color={value?"green":"default"}>{value?"启用":"停用"}</Tag>},
    {title:"最近登录",dataIndex:"lastLoginAt",render:dateTime},
    {title:"创建时间",dataIndex:"createdAt",render:dateTime},
    {title:"操作",fixed:"right",render:(_,row)=><Space><Button type="link" onClick={()=>show(row)}>编辑</Button><Button type="link" danger disabled={row.id===1} onClick={()=>remove(row)}>删除</Button></Space>}
  ];
  return <Card className="data-card" title="后台用户列表" extra={<Button type="primary" onClick={()=>show()}>＋ 新增用户</Button>}>
    <Table rowKey="id" loading={users.loading} dataSource={users.data} columns={columns} scroll={{x:1050}} pagination={{pageSize:8,showTotal:n=>`共 ${n} 位用户`}}/>
    <Modal open={open} title={editing?"编辑用户":"新增用户"} onCancel={()=>setOpen(false)} onOk={save} okText="保存" width={680}>
      <Form form={form} layout="vertical" className="two-column-form">
        <Form.Item name="username" label="登录账号" rules={[{required:true,message:"请输入登录账号"}]}><Input placeholder="例如：operation01"/></Form.Item>
        <Form.Item name="realName" label="姓名" rules={[{required:true,message:"请输入姓名"}]}><Input placeholder="请输入真实姓名"/></Form.Item>
        <Form.Item name="phone" label="手机号码"><Input placeholder="请输入手机号码"/></Form.Item>
        <Form.Item name="email" label="邮箱"><Input placeholder="name@example.com"/></Form.Item>
        <Form.Item name="password" label={editing?"重置密码（不修改请留空）":"初始密码"} rules={editing?[]:[{required:true,message:"请输入初始密码"},{min:8,message:"至少8位"}]}><Input.Password/></Form.Item>
        <Form.Item name="status" label="账号状态"><Select options={[{value:1,label:"启用"},{value:0,label:"停用"}]}/></Form.Item>
        <Form.Item name="roleIds" label="分配角色" className="full" rules={[{required:true,message:"至少选择一个角色"}]}><Select mode="multiple" options={(roles.data||[]).map(r=>({value:r.id,label:r.name}))}/></Form.Item>
      </Form>
    </Modal>
  </Card>;
}

function Roles() {
  const {message,modal}=AntApp.useApp(); const roles=useLoad<Row[]>(()=>api("/roles")); const permissions=useLoad<Row[]>(()=>api("/permissions"));
  const [open,setOpen]=useState(false);const [editing,setEditing]=useState<Row>();const [form]=Form.useForm();
  const grouped=useMemo(()=>Object.entries((permissions.data||[]).reduce((a:Record<string,Row[]>,p)=>{(a[p.module]??=[]).push(p);return a;},{})),[permissions.data]);
  const show=(row?:Row)=>{setEditing(row);form.setFieldsValue(row?{...row,permissionIds:String(row.permissionIds||"").split(",").filter(Boolean).map(Number)}:{status:1,permissionIds:[]});setOpen(true);};
  const save=async()=>{try{const values=await form.validateFields();await api(editing?`/roles/${editing.id}`:"/roles",{method:editing?"PUT":"POST",body:JSON.stringify(values)});message.success("角色已保存");setOpen(false);void roles.refresh();}catch(error){if(error instanceof Error)message.error(error.message);}};
  const remove=(row:Row)=>modal.confirm({title:`删除角色“${row.name}”？`,content:"有关联用户的角色不能删除。",okButtonProps:{danger:true},onOk:async()=>{try{await api(`/roles/${row.id}`,{method:"DELETE"});message.success("角色已删除");void roles.refresh();}catch(error){message.error((error as Error).message);}}});
  return <div className="role-layout"><Card className="data-card" title="角色列表" extra={<Button type="primary" onClick={()=>show()}>＋ 新增角色</Button>}>
    <Table rowKey="id" loading={roles.loading} dataSource={roles.data} pagination={false} columns={[
      {title:"角色名称",render:(_,r)=><><strong>{r.name}</strong><small className="subline">{r.roleCode}</small></>},
      {title:"说明",dataIndex:"description"},{title:"用户数",dataIndex:"userCount",render:v=>`${v} 人`},
      {title:"状态",dataIndex:"status",render:v=><Tag color={v?"green":"default"}>{v?"启用":"停用"}</Tag>},
      {title:"操作",render:(_,r)=><Space><Button type="link" onClick={()=>show(r)}>配置权限</Button><Button type="link" danger disabled={r.id===1} onClick={()=>remove(r)}>删除</Button></Space>}
    ]}/></Card>
    <Drawer open={open} width={600} title={editing?"编辑角色":"新增角色"} onClose={()=>setOpen(false)} extra={<Button type="primary" onClick={save}>保存角色</Button>}>
      <Form form={form} layout="vertical"><Form.Item name="name" label="角色名称" rules={[{required:true}]}><Input/></Form.Item>
        <Form.Item name="roleCode" label="角色编码" rules={[{required:true}]}><Input placeholder="例如：CONTENT_EDITOR"/></Form.Item>
        <Form.Item name="description" label="角色说明"><Input.TextArea rows={3}/></Form.Item>
        <Form.Item name="status" label="状态"><Select options={[{value:1,label:"启用"},{value:0,label:"停用"}]}/></Form.Item>
        <Form.Item name="permissionIds" label="权限范围" rules={[{required:true,message:"至少选择一个权限"}]}>
          <Checkbox.Group className="permission-groups">{grouped.map(([module,items])=><section key={module}><strong>{module}</strong>{items.map(p=><Checkbox key={p.id} value={p.id}>{p.name}<small>{p.description}</small></Checkbox>)}</section>)}</Checkbox.Group>
        </Form.Item></Form>
    </Drawer>
  </div>;
}

function Permissions() {
  const result=useLoad<Row[]>(()=>api("/permissions"));
  return <Card className="data-card" title="权限点清单" extra={<Tag color="blue">权限由代码注册，避免误删</Tag>}><Table rowKey="id" loading={result.loading} dataSource={result.data} columns={[
    {title:"所属模块",dataIndex:"module",filters:[...new Set((result.data||[]).map(x=>x.module))].map(v=>({text:v,value:v})),onFilter:(v,r)=>r.module===v},
    {title:"权限名称",dataIndex:"name",render:v=><strong>{v}</strong>},{title:"权限编码",dataIndex:"permissionCode",render:v=><code>{v}</code>},{title:"说明",dataIndex:"description"}
  ]}/></Card>;
}

function Logs() {
  const result=useLoad<Row[]>(()=>api("/logs")); const [detail,setDetail]=useState<Row>();
  return <Card className="data-card" title="操作日志" extra={<Space><Tag color="green">保留最近 200 条</Tag><Button onClick={result.refresh}>刷新</Button></Space>}><Table rowKey="id" loading={result.loading} dataSource={result.data} columns={[
    {title:"操作时间",dataIndex:"createdAt",render:dateTime},{title:"模块",dataIndex:"module"},{title:"操作",dataIndex:"action",render:v=><strong>{v}</strong>},
    {title:"对象",render:(_,r)=><><span>{r.targetType}</span><small className="subline">ID：{r.targetId}</small></>},{title:"操作人",dataIndex:"operatorId",render:v=>`管理员 #${v}`},
    {title:"IP地址",dataIndex:"ip"},{title:"结果",dataIndex:"result",render:v=><Tag color={v==="SUCCESS"?"green":"red"}>{v==="SUCCESS"?"成功":"失败"}</Tag>},
    {title:"",render:(_,r)=><Button type="link" onClick={()=>setDetail(r)}>详情</Button>}
  ]} pagination={{pageSize:10}}/>
  <Modal open={!!detail} footer={null} title="操作日志详情" onCancel={()=>setDetail(undefined)}><Descriptions column={1} bordered items={detail?Object.entries(detail).map(([key,value])=>({key,label:key,children:String(value??"—")})):[]}/></Modal>
  </Card>;
}

function Configs() {
  const {message}=AntApp.useApp();const result=useLoad<Row[]>(()=>api("/configs"));const [saving,setSaving]=useState<number>();
  const save=async(row:Row,value:any)=>{setSaving(row.id);try{await api(`/configs/${row.id}`,{method:"PUT",body:JSON.stringify({configValue:String(value),description:row.description,isPublic:row.isPublic})});message.success(`${row.description}已保存`);void result.refresh();}catch(error){message.error((error as Error).message);}finally{setSaving(undefined);}};
  const groups=useMemo(()=>Object.entries((result.data||[]).reduce((a:Record<string,Row[]>,r)=>{(a[r.groupName]??=[]).push(r);return a;},{})),[result.data]);
  return <div className="config-layout">{groups.map(([group,items])=><Card key={group} title={group}>{items.map(row=><ConfigRow key={row.id} row={row} saving={saving===row.id} save={value=>save(row,value)}/>)}</Card>)}</div>;
}

function ConfigRow({row,saving,save}:{row:Row;saving:boolean;save:(value:any)=>void}) {
  const [value,setValue]=useState<any>(row.configValue);
  useEffect(()=>setValue(row.configValue),[row.configValue]);
  return <div className="config-row"><div><strong>{row.description}</strong><small>{row.configKey} · 最近更新 {dateTime(row.updatedAt)}</small></div>
    {row.valueType==="BOOLEAN"?<Switch checked={value==="true"} onChange={checked=>{setValue(String(checked));void save(checked);}}/>:
      row.valueType==="NUMBER"?<InputNumber value={Number(value)} min={0} onChange={setValue}/>:
      <Input value={value} onChange={e=>setValue(e.target.value)}/>}
    {row.valueType!=="BOOLEAN"&&<Button loading={saving} onClick={()=>save(value)}>保存</Button>}
  </div>;
}
