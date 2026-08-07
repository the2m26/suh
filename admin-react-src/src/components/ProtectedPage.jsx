import { usePermissions } from '../hooks/usePermissions';

// suh.html-ийн canAccessPage() (мөр ~6312) — эрхгүй бол хуудасны оронд
// зөвшөөрөгдөөгүй мессеж харуулна (showPage() дотор алдаа заадагтай адил зарчим).
export default function ProtectedPage({ pageName, children }) {
  const { canAccessPage } = usePermissions();
  if (!canAccessPage(pageName)) {
    return <div className="page-denied">Танд энэ хуудсанд хандах эрх байхгүй байна.</div>;
  }
  return children;
}
