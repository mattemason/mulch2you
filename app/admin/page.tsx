import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { supplierProfiles, users } from "@/lib/db/schema";
import { getCurrentUser, isAdmin } from "@/lib/session";
import { formatAuMobile } from "@/lib/phone";
import { ApprovalButton } from "./approval-button";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  // 404 rather than 403: no reason to advertise that an admin area exists.
  if (!isAdmin(user)) notFound();

  const select = {
    userId: supplierProfiles.userId,
    businessName: supplierProfiles.businessName,
    abn: supplierProfiles.abn,
    verifiedAt: supplierProfiles.verifiedAt,
    createdAt: supplierProfiles.createdAt,
    name: users.name,
    email: users.email,
    phone: users.phone,
  };

  const [pending, approved] = await Promise.all([
    db
      .select(select)
      .from(supplierProfiles)
      .innerJoin(users, eq(users.id, supplierProfiles.userId))
      .where(isNull(supplierProfiles.verifiedAt))
      .orderBy(desc(supplierProfiles.createdAt)),
    db
      .select(select)
      .from(supplierProfiles)
      .innerJoin(users, eq(users.id, supplierProfiles.userId))
      .where(isNotNull(supplierProfiles.verifiedAt))
      .orderBy(desc(supplierProfiles.verifiedAt)),
  ]);

  return (
    <main className="flex-1">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
            ← Dashboard
          </Link>
          <span className="text-sm font-semibold">Admin</span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Tree services</h1>
        <p className="mt-2 text-sm text-muted">
          Approving a business lets it see the approximate location of every
          active pin. Check the ABN resolves to a real tree service before you
          do — that&apos;s the whole reason this isn&apos;t automatic.
        </p>

        <section className="mt-8">
          <h2 className="font-semibold">
            Waiting on you{pending.length > 0 && ` (${pending.length})`}
          </h2>
          {pending.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Nothing pending.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {pending.map((s) => (
                <SupplierCard key={s.userId} supplier={s} approved={false} />
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="font-semibold">Approved ({approved.length})</h2>
          {approved.length === 0 ? (
            <p className="mt-2 text-sm text-muted">None yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {approved.map((s) => (
                <SupplierCard key={s.userId} supplier={s} approved />
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

type Supplier = {
  userId: string;
  businessName: string;
  abn: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  createdAt: Date;
};

function SupplierCard({ supplier, approved }: { supplier: Supplier; approved: boolean }) {
  return (
    <li className="card flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="font-medium">{supplier.businessName}</div>
        <div className="mt-1 space-y-0.5 text-sm text-muted">
          <div>
            {supplier.name}
            {supplier.email && ` · ${supplier.email}`}
          </div>
          <div>
            {supplier.phone ? formatAuMobile(supplier.phone) : "No mobile"}
            {supplier.abn ? (
              <>
                {" · ABN "}
                <a
                  href={`https://abr.business.gov.au/ABN/View?abn=${supplier.abn}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand hover:underline"
                >
                  {supplier.abn}
                </a>
              </>
            ) : (
              " · no ABN given"
            )}
          </div>
        </div>
      </div>
      <ApprovalButton userId={supplier.userId} approved={approved} />
    </li>
  );
}
