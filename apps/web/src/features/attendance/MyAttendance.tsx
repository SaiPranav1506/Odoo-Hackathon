import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { attendanceApi } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import { Card, EmptyState, Pagination, Spinner, StatusBadge, inputClass, primaryBtn, ghostBtn } from '../../components/ui';

export function MyAttendance() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const daily = useQuery({ queryKey: ['att-daily'], queryFn: attendanceApi.daily });
  const my = useQuery({ queryKey: ['att-my', page], queryFn: () => attendanceApi.my({ page, pageSize: 20 }) });

  const checkIn = useMutation({
    mutationFn: attendanceApi.checkIn,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['att-daily'] }); qc.invalidateQueries({ queryKey: ['att-my'] }); setMsg('Checked in.'); setErr(''); },
    onError: (e) => setErr(errorMessage(e)),
  });
  const checkOut = useMutation({
    mutationFn: attendanceApi.checkOut,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['att-daily'] }); qc.invalidateQueries({ queryKey: ['att-my'] }); setMsg('Checked out.'); setErr(''); },
    onError: (e) => setErr(errorMessage(e)),
  });

  const today = daily.data?.data;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">My Attendance</h1>

      <Card title="Today">
        {daily.isLoading ? <Spinner /> : (
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <StatusBadge value={today?.status ?? 'none'} />
                <p className="text-sm text-slate-500">{today?.date?.slice(0, 10) ?? new Date().toDateString()}</p>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {today?.checkInTime ? `Checked in at ${new Date(today.checkInTime).toLocaleTimeString()}` : 'Not checked in yet'}
                {today?.checkOutTime ? ` · Checked out at ${new Date(today.checkOutTime).toLocaleTimeString()}` : ''}
              </p>
            </div>
            {msg && <p className="text-sm text-green-700">{msg}</p>}
            <div className="flex gap-3">
              {!today?.checkInTime && <button className={primaryBtn} onClick={() => checkIn.mutate()} disabled={checkIn.isPending}>Check in</button>}
              {today?.checkInTime && !today?.checkOutTime && <button className={ghostBtn} onClick={() => checkOut.mutate()} disabled={checkOut.isPending}>Check out</button>}
            </div>
          </div>
        )}
      </Card>
      {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

      <Card title="History">
        {my.isLoading ? <Spinner /> : (
          <>
            {!my.data?.data?.length ? <EmptyState message="No attendance records yet." /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-slate-500">
                      <th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Check-in</th><th className="py-2">Check-out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {my.data.data.map((r) => (
                      <tr key={r.id} className="border-b border-slate-50">
                        <td className="py-2 pr-4">{r.date.slice(0, 10)}</td>
                        <td className="py-2 pr-4"><StatusBadge value={r.status} /></td>
                        <td className="py-2 pr-4">{r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                        <td className="py-2">{r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination page={page} totalPages={my.data?.meta?.totalPages ?? 1} onChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}