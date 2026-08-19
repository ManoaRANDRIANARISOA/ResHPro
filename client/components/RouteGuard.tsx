import { PropsWithChildren } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { useAppSelector } from "@/store";
import { Role } from "@/hooks/useRBAC";

export function RouteGuard({ allowed, children }: PropsWithChildren<{ allowed: Role[] }>) {
  const role = useAppSelector((s) => s.session.role);
  const location = useLocation();
  const { tenantId } = useParams();

  if (!allowed.includes(role)) {
    console.warn("Accès refusé:", { role, path: location.pathname });
    return <Navigate to={`/${tenantId}/dashboard`} replace />;
  }
  return <>{children}</>;
}

export default RouteGuard;