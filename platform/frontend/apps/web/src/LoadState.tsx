import type { ReactNode } from "react";

export function LoadState({loading,error,empty,emptyText,retry,children}:{loading:boolean;error:string;empty:boolean;emptyText:string;retry:()=>void;children:ReactNode}){
  if(loading)return <div className="load-state loading"><i/><strong>正在加载，请稍候…</strong></div>;
  if(error)return <div className="load-state error"><strong>数据加载失败</strong><span>{error}</span><button onClick={retry}>重新加载</button></div>;
  if(empty)return <div className="load-state empty"><strong>{emptyText}</strong></div>;
  return <>{children}</>;
}
