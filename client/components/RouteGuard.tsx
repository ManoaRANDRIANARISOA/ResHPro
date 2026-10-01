import { PropsWithChildren } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { useAppSelector } from "@/store";
import { Role, normalizeRole } from "@/hooks/useRBAC";

export function RouteGuard({ allowed, children }: PropsWithChildren<{ allowed: Role[] }>) {
  const rawRole = useAppSelector((s) => s.session.role);
  const role = normalizeRole(rawRole);
  const location = useLocation();
  const { tenantId } = useParams();

  if (!allowed.includes(role)) {
    console.warn("Accès refusé:", { rawRole, normalizedRole: role, path: location.pathname });
    return <Navigate to={`/${tenantId}/dashboard`} replace />;
  }
  return <>{children}</>;
}

export default RouteGuard;