import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthGate } from './components/AuthGate';
import { AuthProvider } from './context/AuthContext';
import { GiftsPage } from './pages/GiftsPage';
import { PublicWishlistPage } from './pages/PublicWishlistPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/wishlist/:shareId" element={<PublicWishlistPage />} />
        <Route
          path="*"
          element={
            <AuthProvider>
              <AuthGate>
                <GiftsPage />
              </AuthGate>
            </AuthProvider>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
