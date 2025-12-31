import { Navigate } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';

function Layout({ children, requireAuth = false }) {
  const user = (() => {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  })();

  if (requireAuth && !user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <Navbar />
      <main className="flex-1 flex flex-col items-center w-full">
        {children}
      </main>
      <Footer />
    </div>
  );
}

export default Layout;
