import { ReconciliationClient } from './_components/reconciliation-client';

export default function ReconciliationPage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-6">對帳</h1>
      <ReconciliationClient />
    </div>
  );
}
