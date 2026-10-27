import { Link } from 'react-router-dom';
import { useAuth, homeFor } from '../context/AuthContext';
import { Button } from '../components/ui';

export default function NotFound() {
  const { user } = useAuth();
  return (
    <div className="py-24 text-center">
      <p className="text-6xl font-semibold text-faint tabular">404</p>
      <h1 className="mt-4 text-lg font-semibold text-ink">This page does not exist</h1>
      <p className="mt-1 text-sm text-muted">The link may be old or mistyped.</p>
      <Link to={homeFor(user)}><Button className="mt-6">Go to start page</Button></Link>
    </div>
  );
}
