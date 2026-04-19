import { Navigate } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';

function Layout({ children, requireAuth = false, adminAllowed = false }) {
  const user = (() => {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  })();

  if (requireAuth && !user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect admin users away from regular user pages to admin panel
  if (requireAuth && user?.isAdmin && !adminAllowed) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      <Navbar />
      <main className="flex-1 w-full">
        {children}
      </main>
      <Footer />
    </div>
  );
}

export default Layout;
