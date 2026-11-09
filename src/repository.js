import { createClient } from '@supabase/supabase-js';
import { demoTasks, demoFriends, rollWeek, validateTask, weekStart } from './domain.js';
import { validateProfile } from './appearance.js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(url && key);
export const supabase = configured ? createClient(url, key, {
  auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
}) : null;

const STORAGE_KEY = 'ritm.demo.v1';
async function allRows(table, columns) {
  const rows = [], pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from(table).select(columns).order('id').range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}
export class LocalRepository {
  async listFriends() {
    const sample = demoFriends(weekStart());
    return { profiles: [{ ...await this.getProfile(), id: 'demo' }, ...sample.profiles], tasks: [...this.tasks, ...sample.tasks] };
  }
  async getProfile() {
    const saved = localStorage.getItem('ritm.demo.profile');
    return saved ? JSON.parse(saved) : { display_name: 'Демо', accent_color: '#c2e6d9' };
  }
  async saveProfile(input) {
    const next = { ...await this.getProfile(), ...validateProfile(input) };
    localStorage.setItem('ritm.demo.profile', JSON.stringify(next));
    return next;
  }
  constructor() {
    const raw = localStorage.getItem(STORAGE_KEY);
    // Never overwrite corrupt storage silently.
    this.tasks = raw ? JSON.parse(raw) : demoTasks(weekStart());
    if (!Array.isArray(this.tasks)) throw new Error('Не удалось прочитать локальные данные.');
  }
  commit(tasks) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    this.tasks = tasks;
  }
  async list() {
    const all = rollWeek(this.tasks, weekStart());
    this.commit(all);
    return all.filter((t) => t.week_start === weekStart() && !t.deleted_at);
  }
  async save(input, id) {
    const fields = validateTask(input);
    const task = id ? this.tasks.find((t) => t.id === id) : {
      id: crypto.randomUUID(), owner_id: 'demo', week_start: weekStart(), origin_week: weekStart(), created_at: new Date().toISOString(),
    };
    if (!task || task.week_start !== weekStart()) throw new Error('Неделя изменилась. Обнови список задач.');
    const next = { ...task, ...fields };
    this.commit(id ? this.tasks.map((t) => t.id === id ? next : t) : [...this.tasks, next]);
    return next;
  }
  async increment(task) { return this.save({ ...task, progress: Math.min(task.target, task.progress + (task.mode === 'percent' ? 10 : 1)) }, task.id); }
  async remove(id) { this.commit(this.tasks.map((t) => t.id === id ? { ...t, deleted_at: new Date().toISOString() } : t)); }
}

export class SupabaseRepository {
  constructor(userId) { this.userId = userId; }
  async listFriends() {
    const [profiles, tasks] = await Promise.all([
      allRows('profiles', 'id,display_name,telegram_username,avatar_url,accent_color'),
      allRows('tasks', 'id,owner_id,title,difficulty,mode,target,progress,week_start,origin_week,rolled_from,deleted_at,created_at'),
    ]);
    return { profiles, tasks };
  }
  async getProfile() {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', this.userId).single();
    if (error) throw error;
    return data;
  }
  async saveProfile(input) {
    const { data, error } = await supabase.from('profiles').update(validateProfile(input)).eq('id', this.userId).select().single();
    if (error) throw error;
    return data;
  }
  async list() {
    const { error: rolloverError } = await supabase.rpc('roll_week');
    if (rolloverError) throw rolloverError;
    const { data, error } = await supabase.from('tasks').select('*')
      .eq('owner_id', this.userId).eq('week_start', weekStart()).is('deleted_at', null).order('created_at');
    if (error) throw error;
    return data;
  }
  async save(input, id) {
    const fields = validateTask(input);
    const query = id ? supabase.from('tasks').update(fields).eq('id', id).eq('owner_id', this.userId)
      : supabase.from('tasks').insert({ ...fields, owner_id: this.userId });
    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
  }
  async remove(id) {
    const { data, error } = await supabase.from('tasks').update({ deleted_at: new Date().toISOString() }).eq('id', id).eq('owner_id', this.userId).select('id');
    if (error) throw error;
    if (!data.length) throw new Error('Задача уже изменена или недоступна.');
  }
  async increment(task) {
    const { data, error } = await supabase.rpc('increment_task', { task_id: task.id });
    if (error) throw error;
    if (!data?.length) throw new Error('Задача уже изменена или недоступна.');
    return data[0];
  }
}

export async function signIn() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: import.meta.env.VITE_AUTH_PROVIDER || 'custom:telegram',
    options: { redirectTo: `${location.origin}${location.pathname}`, scopes: 'openid profile' },
  });
  if (error) throw error;
}
