import React, { useEffect, useMemo, useState } from "react";
import { api, type Row } from "./main";

type Props = { go: (target: string) => void };
const money = (value: unknown) => `¥${Number(value || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const statusText = (value: unknown, kind: "statement" | "invoice") => (kind === "statement"
  ? ["草稿", "待确认", "已确认", "已结清", "已作废"]
  : ["待处理", "开票中", "已开具", "已驳回"])[Number(value)] || "未知";

export function FinancePage({ go }: Props) {
  const [tab, setTab] = useState<"overview" | "payables" | "statements" | "invoices" | "settings">("overview");
  const [summary, setSummary] = useState<Row>({});
  const [profile, setProfile] = useState<Row>({});
  const [payables, setPayables] = useState<Row[]>([]);
  const [statements, setStatements] = useState<Row[]>([]);
  const [applications, setApplications] = useState<Row[]>([]);
  const [eligibleOrders, setEligibleOrders] = useState<Row[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [statementForm, setStatementForm] = useState<Row>();
  const [invoiceForm, setInvoiceForm] = useState<Row>();
  const [error, setError] = useState("");
  const canManage = permissions.includes("finance:manage");
  const load = async () => {
    try {
      const [summaryRow, profileRow, payableRows, statementRows, applicationRows, auth] = await Promise.all([
        api<Row>("/api/client/finance/summary"), api<Row>("/api/client/finance/profile"),
        api<Row[]>("/api/client/finance/payables"), api<Row[]>("/api/client/finance/statements"),
        api<Row[]>("/api/client/finance/invoice-applications"), api<Row>("/api/client/organization/me"),
      ]);
      setSummary(summaryRow); setProfile(profileRow); setPayables(payableRows); setStatements(statementRows);
      setApplications(applicationRows); setPermissions(auth.permissionCodes || []); setError("");
    } catch (e) { setError((e as Error).message); }
  };
  useEffect(() => { void load(); }, []);
  const previousMonth = () => {
    const now = new Date(); const end = new Date(now.getFullYear(), now.getMonth(), 0); const start = new Date(end.getFullYear(), end.getMonth(), 1);
    const date = (value: Date) => `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}`;
    setStatementForm({ periodStart: date(start), periodEnd: date(end), remark: "" });
  };
  const generateStatement = async () => {
    try { await api("/api/client/finance/statements", { method: "POST", body: JSON.stringify(statementForm) }); setStatementForm(undefined); await load(); setTab("statements"); }
    catch (e) { setError((e as Error).message); }
  };
  const confirmStatement = async (row: Row) => {
    if (!confirm(`确认对账单 ${row.statementNo}？确认后将进入付款流程。`)) return;
    try { await api(`/api/client/finance/statements/${row.id}/confirm`, { method: "POST" }); await load(); }
    catch (e) { setError((e as Error).message); }
  };
  const openInvoice = async () => {
    try { const rows = await api<Row[]>("/api/client/finance/invoice-eligible-orders"); setEligibleOrders(rows); setInvoiceForm({ ...profile, orderIds: [], remark: "" }); }
    catch (e) { setError((e as Error).message); }
  };
  const applyInvoice = async () => {
    if (!invoiceForm?.orderIds?.length) return setError("请至少选择一笔已付款订单");
    try { await api("/api/client/finance/invoice-applications", { method: "POST", body: JSON.stringify(invoiceForm) }); setInvoiceForm(undefined); await load(); setTab("invoices"); }
    catch (e) { setError((e as Error).message); }
  };
  const saveProfile = async () => {
    try { await api("/api/client/finance/profile", { method: "PUT", body: JSON.stringify(profile) }); await load(); }
    catch (e) { setError((e as Error).message); }
  };
  const invoiceAmount = useMemo(() => eligibleOrders.filter(x => invoiceForm?.orderIds?.includes(x.id)).reduce((sum, row) => sum + Number(row.payableAmount), 0), [eligibleOrders, invoiceForm]);

  return <main className="page account-page finance-page">
    <aside><div className="account-brand"><i>鲁</i><strong>企业采购中心</strong></div>
      {[["profile","账户概览"],["orders","我的订单"],["addresses","地址管理"],["finance","财务中心"],["invoices","开票记录"],["members","企业成员"],["organization","组织与权限"]].map(x=><button className={x[0]==="finance"?"active":""} key={x[0]} onClick={()=>go(x[0])}>{x[1]}<span>›</span></button>)}
    </aside>
    <section><div className="account-heading action-heading"><div><h1>财务中心</h1><p>集中查看应付、月度对账和开票申请</p></div>{canManage&&<div><button onClick={previousMonth}>＋ 生成对账单</button><button onClick={()=>void openInvoice()}>＋ 申请开票</button></div>}</div>
      {error&&<div className="organization-error">{error}</div>}
      <div className="finance-summary"><article><span>未结应付</span><strong>{money(summary.outstandingAmount)}</strong><small>{summary.payableCount||0} 笔</small></article><article className={Number(summary.overdueCount)>0?"danger":""}><span>已逾期</span><strong>{money(summary.overdueAmount)}</strong><small>{summary.overdueCount||0} 笔</small></article><article><span>待确认对账单</span><strong>{summary.pendingStatementCount||0}</strong><small>份</small></article><article><span>开票处理中</span><strong>{summary.pendingInvoiceCount||0}</strong><small>份</small></article></div>
      <nav className="finance-tabs">{[["overview","财务概览"],["payables","应付查询"],["statements","月度对账"],["invoices","开票申请"],["settings","账期与票据信息"]].map(x=><button className={tab===x[0]?"active":""} key={x[0]} onClick={()=>setTab(x[0] as typeof tab)}>{x[1]}</button>)}</nav>
      {tab==="overview"&&<div className="finance-overview"><section><header><strong>待办事项</strong></header><button onClick={()=>setTab("payables")}><span>{summary.payableCount||0} 笔应付待处理</span><em>›</em></button><button onClick={()=>setTab("statements")}><span>{summary.pendingStatementCount||0} 份对账单待确认</span><em>›</em></button></section><section><header><strong>当前账期</strong></header><dl><dt>对账周期</dt><dd>按月</dd><dt>付款账期</dt><dd>{profile.paymentTermDays||0} 天</dd><dt>授信额度</dt><dd>{money(profile.creditLimit)}</dd><dt>默认发票</dt><dd>{profile.invoiceType||"未配置"}</dd></dl></section></div>}
      {tab==="payables"&&<div className="finance-table"><header><span>订单号</span><span>采购人 / 下单时间</span><span>应付金额</span><span>付款截止</span><span>状态</span></header>{payables.map(row=><article key={row.id}><span><b>{row.orderNo}</b><small>{row.statementNo||"未进入对账单"}</small></span><span>{row.buyerName}<small>{row.createdAt}</small></span><span><b>{money(row.outstandingAmount)}</b><small>订单 {money(row.payableAmount)}</small></span><span>{row.paymentDueDate||"未设定"}</span><span><em className={Number(row.overdue)?"danger-tag":"status-tag"}>{Number(row.paymentStatus)===2?"已付款":Number(row.overdue)?"已逾期":"待付款"}</em></span></article>)}</div>}
      {tab==="statements"&&<div className="finance-table statement-table"><header><span>对账单</span><span>对账期间</span><span>订单</span><span>应付 / 已付</span><span>状态 / 截止日</span><span>操作</span></header>{statements.map(row=><article key={row.id}><span><b>{row.statementNo}</b><small>{row.createdAt}</small></span><span>{row.periodStart}<small>至 {row.periodEnd}</small></span><span>{row.orderCount} 笔</span><span><b>{money(row.payableAmount)}</b><small>已付 {money(row.paidAmount)}</small></span><span><em className="status-tag">{statusText(row.status,"statement")}</em><small>{row.dueDate||"—"}</small></span><span>{canManage&&Number(row.status)===1&&<button onClick={()=>void confirmStatement(row)}>确认对账</button>}</span></article>)}</div>}
      {tab==="invoices"&&<div className="finance-table invoice-table"><header><span>申请单号</span><span>发票信息</span><span>订单</span><span>金额</span><span>状态</span><span>电子发票</span></header>{applications.map(row=><article key={row.id}><span><b>{row.applicationNo}</b><small>{row.createdAt}</small></span><span>{row.invoiceTitle}<small>{row.invoiceType}</small></span><span>{row.orderCount} 笔</span><span><b>{money(row.amount)}</b></span><span><em className="status-tag">{statusText(row.status,"invoice")}</em>{row.failureReason&&<small>{row.failureReason}</small>}</span><span>{row.invoiceFileUrl?<a href={row.invoiceFileUrl} target="_blank" rel="noreferrer">下载发票</a>:"—"}</span></article>)}</div>}
      {tab==="settings"&&<div className="finance-settings"><label>发票抬头<input value={profile.invoiceTitle||""} disabled={!canManage} onChange={e=>setProfile({...profile,invoiceTitle:e.target.value})}/></label><label>统一社会信用代码<input value={profile.taxNo||""} disabled={!canManage} onChange={e=>setProfile({...profile,taxNo:e.target.value})}/></label><label>发票类型<select value={profile.invoiceType||""} disabled={!canManage} onChange={e=>setProfile({...profile,invoiceType:e.target.value})}><option>增值税普通发票</option><option>增值税专用发票</option></select></label><label>电子发票接收邮箱<input type="email" value={profile.recipientEmail||""} disabled={!canManage} onChange={e=>setProfile({...profile,recipientEmail:e.target.value})}/></label><label>付款账期（天）<input type="number" min="0" max="365" value={profile.paymentTermDays||0} disabled={!canManage} onChange={e=>setProfile({...profile,paymentTermDays:Number(e.target.value)})}/></label>{canManage&&<button className="save-button" onClick={()=>void saveProfile()}>保存财务信息</button>}</div>}
    </section>
    {statementForm&&<div className="dialog-mask"><div className="client-dialog form-dialog"><button className="dialog-close" onClick={()=>setStatementForm(undefined)}>×</button><h2>生成月度对账单</h2><label>开始日期<input type="date" value={statementForm.periodStart} onChange={e=>setStatementForm({...statementForm,periodStart:e.target.value})}/></label><label>结束日期<input type="date" value={statementForm.periodEnd} onChange={e=>setStatementForm({...statementForm,periodEnd:e.target.value})}/></label><label>备注<textarea value={statementForm.remark||""} onChange={e=>setStatementForm({...statementForm,remark:e.target.value})}/></label><p className="form-help">系统将汇总期间内尚未进入其他对账单的有效订单。</p><button className="save-button" onClick={()=>void generateStatement()}>生成并提交确认</button></div></div>}
    {invoiceForm&&<div className="dialog-mask"><div className="client-dialog form-dialog finance-dialog"><button className="dialog-close" onClick={()=>setInvoiceForm(undefined)}>×</button><h2>申请电子发票</h2><div className="eligible-orders">{eligibleOrders.length?eligibleOrders.map(row=><label key={row.id}><input type="checkbox" checked={invoiceForm.orderIds.includes(row.id)} onChange={e=>setInvoiceForm({...invoiceForm,orderIds:e.target.checked?[...invoiceForm.orderIds,row.id]:invoiceForm.orderIds.filter((id:number)=>id!==row.id)})}/><span><b>{row.orderNo}</b><small>{row.createdAt}</small></span><strong>{money(row.payableAmount)}</strong></label>):<p>暂无可开票的已付款订单</p>}</div><label>发票抬头<input value={invoiceForm.invoiceTitle||""} onChange={e=>setInvoiceForm({...invoiceForm,invoiceTitle:e.target.value})}/></label><label>税号<input value={invoiceForm.taxNo||""} onChange={e=>setInvoiceForm({...invoiceForm,taxNo:e.target.value})}/></label><label>发票类型<select value={invoiceForm.invoiceType||""} onChange={e=>setInvoiceForm({...invoiceForm,invoiceType:e.target.value})}><option>增值税普通发票</option><option>增值税专用发票</option></select></label><label>接收邮箱<input type="email" value={invoiceForm.recipientEmail||""} onChange={e=>setInvoiceForm({...invoiceForm,recipientEmail:e.target.value})}/></label><div className="invoice-total">申请金额 <strong>{money(invoiceAmount)}</strong></div><button className="save-button" disabled={!eligibleOrders.length} onClick={()=>void applyInvoice()}>提交开票申请</button></div></div>}
  </main>;
}
