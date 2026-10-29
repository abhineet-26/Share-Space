import React, { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { useApp } from '../../app/AppContext';
import { api } from '../../lib/api';

export const AnalyticsPage: React.FC = () => {
  const { user, organization } = useApp();
  const [data, setData] = useState<{
    resourceMetrics: Array<{
      resourceId: string;
      name: string;
      category: string;
      bookedHours: number;
      availableHours: number;
      utilisationPct: number;
      waitlistedCount: number;
      incidentCount: number;
    }>;
    fairnessByUser: Array<{
      userId: string;
      name: string;
      academicGroup: string;
      bookedHours: number;
      sharePct: number;
      requestsCount: number;
    }>;
    demandByHourBlock: Array<{
      block: string;
      electronics: number;
      mediaComputing: number;
      spaces: number;
    }>;
    outcomeCounts: Array<{ status: string; count: number }>;
  } | null>(null);

  useEffect(() => {
    api.getAnalyticsData().then(setData).catch(console.error);
  }, [user]);

  if (!data) {
    return <div className="p-8 text-sm text-[var(--text-secondary)]">Loading operational analytics...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-[var(--border-color)] pb-4">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Utilisation & fairness analytics
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">
          Window: Rolling 7-day operational benchmark (40 available hours per resource). Formula: `utilisation = confirmed_booked_hours / 40h`. Insights below are advisory suggestions for human review.
        </p>
      </div>

      {/* Advisory Plain-Language Suggestions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="p-4 rounded-[8px] bg-[var(--bg-surface)] border border-[var(--border-color)] space-y-1">
          <div className="font-mono-tech text-[11px] text-[var(--brand-primary)]">
            SUGGESTION FOR HUMAN REVIEW · DEMAND BOTTLENECK
          </div>
          <div className="font-semibold text-sm text-[var(--text-primary)]">
            Mirrorless Camera Kit & Afternoon Electronics
          </div>
          <p className="text-[var(--text-secondary)]">
            Demand is concentrated between 14:00 and 17:00 with competing requests waitlisted. Consider extending supervised afternoon technician hours or adding a second camera body.
          </p>
        </div>

        <div className="p-4 rounded-[8px] bg-[var(--bg-surface)] border border-[var(--border-color)] space-y-1">
          <div className="font-mono-tech text-[11px] text-[var(--brand-primary)]">
            SUGGESTION FOR HUMAN REVIEW · FAIR ALLOCATION
          </div>
          <div className="font-semibold text-sm text-[var(--text-primary)]">
            Rolling 7-Day Cap Preventing Monopolisation
          </div>
          <p className="text-[var(--text-secondary)]">
            Kabir Shah accounts for the highest single-user hours (8.5h across resources), and the 6h rolling cap on the Camera Kit preserved slot access for Aarav Menon and Diya Rao.
          </p>
        </div>

        <div className="p-4 rounded-[8px] bg-[var(--bg-surface)] border border-[var(--border-color)] space-y-1">
          <div className="font-mono-tech text-[11px] text-[var(--brand-primary)]">
            SUGGESTION FOR HUMAN REVIEW · TRAINING ACCESS
          </div>
          <div className="font-semibold text-sm text-[var(--text-primary)]">
            3D Printer Safety Induction Demand
          </div>
          <p className="text-[var(--text-secondary)]">
            1 request (`bkg_blocked_diya`) was blocked due to uncompleted AM-201 safety training. Scheduling a weekly 30-minute practical checkoff session will unlock underused printer hours.
          </p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Booked Hours by Resource */}
        <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-5 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Booked hours per resource (7-day rolling window)
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Derived directly from confirmed bookings in {organization?.name}.
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.resourceMetrics.slice(0, 7)}
                layout="vertical"
                margin={{ top: 4, right: 20, left: 20, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis type="number" unit="h" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="bookedHours" name="Booked hours" fill="#285443" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Chart 2: Demand by Time-of-Day Block */}
        <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-5 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Request demand by time-of-day block & category
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Shows afternoon peak (14:00–17:00) across Electronics and Media equipment.
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.demandByHourBlock} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="block" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="electronics" name="Electronics" fill="#285443" />
                <Bar dataKey="mediaComputing" name="Media & Compute" fill="#A86F20" />
                <Bar dataKey="spaces" name="Spaces" fill="#59655E" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Supporting Accessible Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Table 1: Resource Utilisation & Incident Summary */}
        <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-color)] text-sm font-semibold text-[var(--text-primary)]">
            Resource utilisation & waitlist table
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/50 text-[var(--text-secondary)]">
                  <th className="py-2.5 px-4">Resource</th>
                  <th className="py-2.5 px-4 text-right">Booked / Avail</th>
                  <th className="py-2.5 px-4 text-right">Utilisation</th>
                  <th className="py-2.5 px-4 text-right">Waitlist</th>
                  <th className="py-2.5 px-4 text-right">Incidents</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {data.resourceMetrics.map((m) => (
                  <tr key={m.resourceId}>
                    <td className="py-2.5 px-4 font-medium text-[var(--text-primary)]">{m.name}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-[var(--text-secondary)]">
                      {m.bookedHours}h / {m.availableHours}h
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-[var(--text-primary)]">
                      {m.utilisationPct}%
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums">{m.waitlistedCount}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums">{m.incidentCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Table 2: Fairness & Distribution of Access Across Users */}
        <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-color)] text-sm font-semibold text-[var(--text-primary)]">
            Fairness distribution — Share of confirmed hours by user
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/50 text-[var(--text-secondary)]">
                  <th className="py-2.5 px-4">User</th>
                  <th className="py-2.5 px-4">Priority Group</th>
                  <th className="py-2.5 px-4 text-right">Booked Hours</th>
                  <th className="py-2.5 px-4 text-right">Share of Total</th>
                  <th className="py-2.5 px-4 text-right">Total Requests</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {data.fairnessByUser.map((u) => (
                  <tr key={u.userId}>
                    <td className="py-2.5 px-4 font-medium text-[var(--text-primary)]">{u.name}</td>
                    <td className="py-2.5 px-4 font-mono-tech text-[11px] text-[var(--text-secondary)]">
                      {u.academicGroup}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums font-semibold">
                      {u.bookedHours}h
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums">{u.sharePct}%</td>
                    <td className="py-2.5 px-4 text-right tabular-nums">{u.requestsCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
