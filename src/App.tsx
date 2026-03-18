import { AuthGate } from './components/AuthGate';
import { AuthProvider } from './context/AuthContext';
import { GiftsPage } from './pages/GiftsPage';

function App() {
  return (
    <AuthProvider>
      <AuthGate>
        <GiftsPage />
      </AuthGate>
    </AuthProvider>
  );
}

export default App;
