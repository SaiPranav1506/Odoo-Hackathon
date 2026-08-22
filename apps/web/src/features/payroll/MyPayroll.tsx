import { useQuery } from '@tanstack/react-query';
import { payrollApi } from '../../api/endpoints';
import { Card, EmptyState, Spinner, StatusBadge } from '../../components/ui';

export function MyPayroll() {
  const { data, isLoading } = useQuery({ queryKey: ['payroll-me'], queryFn: payrollApi.me });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Payroll</h1>
        <p className="text-sm text-slate-500">Read-only view of your salary structure and payslips.</p>
      </div>

      {isLoading && <Spinner />}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Salary structure">
          {data?.salaryStructure ? (
            <dl className="divide-y divide-slate-100 text-sm">
              {[
                ['Basic pay', Number(data.salaryStructure.basicPay).toLocaleString(undefined, { style: 'currency', currency: 'USD' })],
                ['Housing allowance', data.salaryStructure.housingAllowance ? Number(data.salaryStructure.housingAllowance).toLocaleString(undefined, { style: 'currency', currency: 'USD' }) : '—'],
                ['Transport allowance', data.salaryStructure.transportAllowance ? Number(data.salaryStructure.transportAllowance).toLocaleString(undefined, { style: 'currency', currency: 'USD' }) : '—'],
                ['Tax %', data.salaryStructure.taxPercent ? `${data.salaryStructure.taxPercent}%` : '—'],
                ['Effective from', data.salaryStructure.effectiveFrom ?? '—'],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex items-center justify-between py-2">
                  <dt className="text-slate-500">{k}</dt><dd className="font-medium text-slate-800">{v}</dd>
                </div>
              ))}
            </dl>
          ) : <EmptyState message="No salary structure has been set yet." />}
        </Card>

        <Card title="Payslips">
          {!data?.payslips?.length ? <EmptyState message="No payslips available." /> : (
            <ul className="space-y-3">
              {data.payslips.map((p: { id: number; period: string; gross: string; net: string; issuedAt: string }) => (
                <li key={p.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{p.period}</p>
                    <p className="text-xs text-slate-500">Issued {new Date(p.issuedAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-500">Net <b className="text-emerald-600">{Number(p.net).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</b></p>
                    <p className="text-xs text-slate-400">Gross {Number(p.gross).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}