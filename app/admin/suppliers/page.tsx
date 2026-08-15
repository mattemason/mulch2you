import { desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { supplierProfiles, users } from "@/lib/db/schema";
import { formatAuMobile } from "@/lib/phone";
import { ApprovalButton } from "../approval-button";

export default async function AdminSuppliersPage() {
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
    <>
      <h1 className="text-2xl font-semibold">Tree services</h1>
      <p className="mt-2 text-sm text-muted">
        Approving a business lets it see the approximate location of every
        active pin. Check the ABN resolves to a real tree service before you do
        — that&apos;s the whole reason this isn&apos;t automatic.
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
    </>
  );
}

type Supplier = {
  userId: string;
  businessName: string;
  abn: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
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
