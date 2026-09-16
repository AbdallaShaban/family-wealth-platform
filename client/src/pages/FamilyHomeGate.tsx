import { useAuth } from "@/_core/hooks/useAuth";
import { lazy, Suspense } from "react";
import { Redirect } from "wouter";

const FintechDashboard = lazy(() => import("@/components/FintechDashboard"));

export default function FamilyHomeGate() {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="fintech-route-loading" role="status" aria-label="جارٍ تحميل الشاشة">
        <i /><i /><i />
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <Suspense fallback={<div className="fintech-route-loading" role="status" aria-label="جارٍ تحميل الشاشة"><i /><i /><i /></div>}>
        <FintechDashboard />
      </Suspense>
    );
  }

  return <Redirect to="/login" replace />;
}
