import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../../api/endpoints';
import { Card, EmptyState, Spinner, Pagination, ghostBtn } from '../../components/ui';

export function Notifications() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({ queryKey: ['notifs', page], queryFn: () => notificationsApi.list({ page, pageSize: 20 }) });

  const markAll = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifs'] }); qc.invalidateQueries({ queryKey: ['unread'] }); },
  });
  const markOne = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifs'] }); qc.invalidateQueries({ queryKey: ['unread'] }); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
        <button className={ghostBtn} onClick={() => markAll.mutate()}>Mark all read</button>
      </div>
      <Card>
        {isLoading ? <Spinner /> : (
          <>
            {!data?.data?.length ? <EmptyState message="No notifications." /> : (
              <ul className="divide-y divide-slate-100">
                {data.data.map((n: { id: number; readAt?: string | null; type: string; title: string; body: string; createdAt: string }) => (
                  <li key={n.id}
                    onClick={() => !n.readAt && markOne.mutate(n.id)}
                    className={`flex items-start justify-between gap-3 py-3 ${!n.readAt ? 'cursor-pointer' : ''}`}>
                    <div>
                      <p className={`text-sm font-medium ${n.readAt ? 'text-slate-500' : 'text-slate-900'}`}>{n.title}</p>
                      <p className="text-sm text-slate-600">{n.body}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{n.type.replaceAll('_', ' ')} · {new Date(n.createdAt).toLocaleString()}</p>
                    </div>
                    {!n.readAt && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />}
                  </li>
                ))}
              </ul>
            )}
            <Pagination page={page} totalPages={data?.meta?.totalPages ?? 1} onChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}