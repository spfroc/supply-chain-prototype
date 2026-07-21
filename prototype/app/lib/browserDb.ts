"use client";

import { useCallback, useEffect, useState } from "react";

const DB_NAME = "supply-chain-prototype";
const STORE_NAME = "demo-records";
const CHANNEL_NAME = "supply-chain-demo-sync";

export type DemoRecord = {
  id: string;
  module: string;
  name: string;
  company?: string;
  description?: string;
  effectiveDate?: string;
  status?: string;
  price?: number;
  createdAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("module", "module", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function listDemoRecords(module: string): Promise<DemoRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).index("module").getAll(module);
    request.onsuccess = () => resolve((request.result as DemoRecord[]).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

export async function addDemoRecord(input: Omit<DemoRecord,"id"|"createdAt">): Promise<DemoRecord> {
  const record: DemoRecord = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).add(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
  window.dispatchEvent(new CustomEvent("demo-db-change", { detail: input.module }));
  const channel=new BroadcastChannel(CHANNEL_NAME);
  channel.postMessage(input.module);
  channel.close();
  return record;
}

export function useBrowserRecords(module: string) {
  const [records,setRecords]=useState<DemoRecord[]>([]);
  const [ready,setReady]=useState(false);
  const reload=useCallback(async()=>{ try { setRecords(await listDemoRecords(module)); } finally { setReady(true); } },[module]);
  useEffect(()=>{
    void reload();
    const channel=new BroadcastChannel(CHANNEL_NAME);
    const onMessage=(event:MessageEvent<string>)=>{ if(event.data===module) void reload(); };
    const onLocal=(event:Event)=>{ if((event as CustomEvent<string>).detail===module) void reload(); };
    channel.addEventListener("message",onMessage);
    window.addEventListener("demo-db-change",onLocal);
    return ()=>{ channel.close(); window.removeEventListener("demo-db-change",onLocal); };
  },[module,reload]);
  return { records,ready,reload };
}
