import { useAuth } from '../context/AuthContext';
import * as perm from '../lib/permissions';

// Component дотор `const {canView, canWrite} = usePermissions();
// canView('residents')` маягаар богино бичихийн тулд role/myPermissions-ыг
// автоматаар дамжуулна. Цэвэр логик нь lib/permissions.js-д үлдэнэ (тестлэхэд
// хялбар байх зорилготой — Context/hook шаардахгүйгээр шууд дуудаж болно).
export function usePermissions() {
  const { role, myPermissions } = useAuth();
  return {
    canView: (resource) => perm.canView(role, myPermissions, resource),
    canWrite: (resource) => perm.canWrite(role, myPermissions, resource),
    canAdd: (resource) => perm.canAdd(role, myPermissions, resource),
    canDelete: (resource) => perm.canDelete(role, myPermissions, resource),
    canPrint: (resource) => perm.canPrint(role, myPermissions, resource),
    canExport: (resource) => perm.canExport(role, myPermissions, resource),
    canAccrue: () => perm.canAccrue(role, myPermissions),
    canAccessPage: (pageName) => perm.canAccessPage(role, myPermissions, pageName),
  };
}
