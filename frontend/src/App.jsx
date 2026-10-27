import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth, homeFor } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import MyDay from './pages/MyDay';
import MyHistory from './pages/MyHistory';
import MyLeave from './pages/MyLeave';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';
import Overview from './pages/team/Overview';
import Records from './pages/team/Records';
import People from './pages/team/People';
import LeaveRequests from './pages/team/LeaveRequests';
import Holidays from './pages/team/Holidays';
import Notices from './pages/team/Notices';
import Activity from './pages/team/Activity';
import SettingsPage from './pages/team/Settings';

function LoginGate() {
  const { user } = useAuth();
  return user ? <Navigate to={homeFor(user)} replace /> : <Login />;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LoginGate />} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/day" element={<MyDay />} />
            <Route path="/history" element={<MyHistory />} />
            <Route path="/leave" element={<MyLeave />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/team" element={<ProtectedRoute roles={['manager']}><Overview /></ProtectedRoute>} />
            <Route path="/team/records" element={<ProtectedRoute roles={['manager']}><Records /></ProtectedRoute>} />
            <Route path="/team/people" element={<ProtectedRoute roles={['manager']}><People /></ProtectedRoute>} />
            <Route path="/team/leave" element={<ProtectedRoute roles={['manager']}><LeaveRequests /></ProtectedRoute>} />
            <Route path="/team/holidays" element={<ProtectedRoute roles={['manager']}><Holidays /></ProtectedRoute>} />
            <Route path="/team/notices" element={<ProtectedRoute roles={['manager']}><Notices /></ProtectedRoute>} />
            <Route path="/team/activity" element={<ProtectedRoute roles={['manager']}><Activity /></ProtectedRoute>} />
            <Route path="/team/settings" element={<ProtectedRoute roles={['manager']}><SettingsPage /></ProtectedRoute>} />
            {/* v1 URLs keep working */}
            <Route path="/employee" element={<Navigate to="/day" replace />} />
            <Route path="/developer" element={<Navigate to="/day" replace />} />
            <Route path="/manager/*" element={<Navigate to="/team" replace />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </ToastProvider>
  );
}
