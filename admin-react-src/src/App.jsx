import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import ProtectedPage from './components/ProtectedPage';
import Dashboard from './pages/Dashboard';
import News from './pages/News';
import NewsEditor from './pages/NewsEditor';
import Polls from './pages/Polls';
import GateControl from './pages/GateControl';
import Apartments from './pages/Apartments';
import Residents from './pages/Residents';
import Businesses from './pages/Businesses';
import Clientele from './pages/Clientele';
import Employees from './pages/Employees';
import Assets from './pages/Assets';
import Tariffs from './pages/Tariffs';
import AccountingReports from './pages/AccountingReports';
import CCCenter from './pages/CCCenter';
import Payments from './pages/Payments';
import Notifications from './pages/Notifications';
import Reports from './pages/Reports';
import SokhSettings from './pages/SokhSettings';
import MarketValuation from './pages/MarketValuation';
import './App.css';

// ⚠️ HashRouter ашиглав (BrowserRouter биш) — GitHub Pages дэд замд (base:
// '/suh/admin-react/') deploy хийхэд server-side rewrite байхгүй тул шууд
// route-руу шилжихэд (жиш нь хуудас дахин ачаалах, deep-link) 404 өгөхгүйн тулд.
// userapp-react ижил асуудалтай тулгарвал энд эх загвар байх болно.
function Shell() {
  const { initializing, isLoggedIn } = useAuth();

  if (initializing) {
    return <div className="app-loading">Ачаалж байна...</div>;
  }

  if (!isLoggedIn) {
    return <Login />;
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<ProtectedPage pageName="dashboard"><Dashboard /></ProtectedPage>} />
          <Route path="/news" element={<ProtectedPage pageName="news"><News /></ProtectedPage>} />
          <Route path="/newseditor" element={<ProtectedPage pageName="newseditor"><NewsEditor /></ProtectedPage>} />
          <Route path="/polls" element={<ProtectedPage pageName="polls"><Polls /></ProtectedPage>} />
          <Route path="/gate-log" element={<ProtectedPage pageName="gate-log"><GateControl /></ProtectedPage>} />
          <Route path="/apartments" element={<ProtectedPage pageName="apartments"><Apartments /></ProtectedPage>} />
          <Route path="/residents" element={<ProtectedPage pageName="residents"><Residents /></ProtectedPage>} />
          <Route path="/business" element={<ProtectedPage pageName="business"><Businesses /></ProtectedPage>} />
          <Route path="/clientele" element={<ProtectedPage pageName="clientele"><Clientele /></ProtectedPage>} />
          <Route path="/employees" element={<ProtectedPage pageName="employees"><Employees /></ProtectedPage>} />
          <Route path="/assets" element={<ProtectedPage pageName="assets"><Assets /></ProtectedPage>} />
          <Route path="/tariff-settings" element={<ProtectedPage pageName="tariff-settings"><Tariffs /></ProtectedPage>} />
          <Route path="/accounting" element={<ProtectedPage pageName="accounting"><AccountingReports /></ProtectedPage>} />
          <Route path="/cc-center" element={<ProtectedPage pageName="cc-center"><CCCenter /></ProtectedPage>} />
          <Route path="/payments" element={<ProtectedPage pageName="payments"><Payments /></ProtectedPage>} />
          <Route path="/communications" element={<ProtectedPage pageName="communications"><Notifications /></ProtectedPage>} />
          <Route path="/reports" element={<ProtectedPage pageName="reports"><Reports /></ProtectedPage>} />
          <Route path="/sokh-settings" element={<ProtectedPage pageName="sokh-settings"><SokhSettings /></ProtectedPage>} />
          <Route path="/market-valuation" element={<ProtectedPage pageName="market-valuation"><MarketValuation /></ProtectedPage>} />
          {/* Дараагийн түвшнүүдэд модуль бүрийн page эндээс нэмэгдэнэ:
              /residents, /business, /finance, гэх мэт (lib/permissions.js
              AUTH_MODULES-ийн 'page' талбартай тааруулах) */}
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </HashRouter>
  );
}
