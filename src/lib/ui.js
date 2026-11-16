import { reactive } from 'vue'
export const ui = reactive({ toasts: [], mapOpen: false, mapLocation: 'library' })
let seq = 0
export function notify(message, kind = 'success') { const id=++seq;ui.toasts.unshift({id,message,kind});ui.toasts.splice(3);setTimeout(()=>dismiss(id),4800);return id }
export function dismiss(id) { ui.toasts=ui.toasts.filter(t=>t.id!==id) }
export function money(value) { return Number(value||0).toFixed(2).replace(/\.00$/,'') }
export function date(value) { return new Date(value).toLocaleDateString('zh-CN',{month:'long',day:'numeric'}) }
export async function action(fn, success) { try {const result=await fn();if(success)notify(success);return result}catch(e){notify(e.message||'操作未完成，请重试','error');return null} }
